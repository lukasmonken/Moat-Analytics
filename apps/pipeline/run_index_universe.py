"""Valida e arquiva uma composição anual de IBOV, SMLL e IDIV fornecida em CSV."""

import argparse
import csv
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import BadZipFile

from src.moat_universe import INDEX_CODES, create_universe, versioned_import

REPO = Path(__file__).resolve().parents[2]
RAW_CVM = REPO / "data/raw/cvm"
PROCESSED = REPO / "data/processed/index-universe"
PUBLIC = REPO / "data/public"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="CSV com índice e ticker de cada ação.")
    for index in INDEX_CODES:
        parser.add_argument(f"--{index.lower()}", type=Path, help=f"CSV de composição de {index}.")
    parser.add_argument("--as-of", type=date.fromisoformat, required=True, help="Data-base AAAA-MM-DD.")
    parser.add_argument("--source", required=True, help="Fonte da composição.")
    parser.add_argument("--source-url", help="Endereço HTTPS da fonte, quando público.")
    parser.add_argument("--redistribution-basis", help="Fundamento verificado para redistribuição.")
    parser.add_argument("--fca-archive", type=Path, action="append", help="ZIP anual da CVM, repetível.")
    parser.add_argument("--identity-overrides", type=Path, help="Exceções cadastrais da data-base, com evidência.")
    parser.add_argument("--output", type=Path, default=PROCESSED / "index-universe.json")
    parser.add_argument("--history-dir", type=Path, default=PROCESSED / "history")
    args = parser.parse_args()

    by_index = {index: getattr(args, index.lower()) for index in INDEX_CODES}
    if args.input and any(by_index.values()):
        parser.error("Use --input ou os três arquivos de índice.")
    if not args.input and not all(by_index.values()):
        parser.error("Informe --input ou --ibov, --smll e --idiv.")
    if args.as_of > date.today():
        parser.error("A data-base ainda não chegou.")
    if not args.source.strip():
        parser.error("Informe uma fonte com texto.")
    if args.source_url:
        source_url = urlsplit(args.source_url)
        if source_url.scheme != "https" or not source_url.hostname or source_url.username:
            parser.error("--source-url deve ser um endereço público HTTPS.")
    basis = (args.redistribution_basis or "").strip() or None
    if args.output.resolve().is_relative_to(PUBLIC.resolve()) and not basis:
        parser.error("Uma saída pública requer --redistribution-basis.")
    if args.history_dir.resolve().is_relative_to(PUBLIC.resolve()):
        parser.error("O arquivo histórico deve permanecer fora de data/public.")

    archives = args.fca_archive
    if not archives:
        years = [args.as_of.year - 1, args.as_of.year]
        archives = [
            path for year in years
            if (path := RAW_CVM / f"fca_cia_aberta_{year}.zip").is_file()
        ]
    if not archives:
        parser.error("Forneça --fca-archive com evidência cadastral disponível até a data-base.")

    try:
        payload = create_universe(
            {None: args.input} if args.input else by_index,
            archives,
            args.as_of,
            {"name": args.source.strip(), "url": args.source_url, "redistributionBasis": basis},
            args.identity_overrides,
        )
        version, promoted = versioned_import(payload, args.output, args.history_dir)
    except (BadZipFile, KeyError, OSError, ValueError, csv.Error) as error:
        print(f"Lote rejeitado. Snapshot anterior preservado. {error}", file=sys.stderr)
        return 1
    coverage = payload["coverage"]
    counts = ", ".join(f"{index}: {count}" for index, count in coverage["byIndex"].items())
    print(f"{coverage['includedCompanies']} companhias verificadas ({counts}). Arquivo: {version}")
    print(f"Snapshot atualizado: {args.output}" if promoted else "Snapshot atual preservado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
