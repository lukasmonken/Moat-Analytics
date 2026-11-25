"""Gera o comparativo de ROE de bancos e seguradoras usando os ZIPs locais da CVM."""

import argparse
import json
import sys
from datetime import date
from decimal import DecimalException
from pathlib import Path
from zipfile import BadZipFile

from src.moat_cvm.archives import write_snapshot

REPO = Path(__file__).resolve().parents[2]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=REPO / "data/raw/cvm")
    parser.add_argument(
        "--selection", type=Path,
        default=REPO / "data/processed/index-universe/index-universe.json",
    )
    parser.add_argument(
        "--directory", type=Path, default=REPO / "data/public/cvm-company-selection.json",
    )
    parser.add_argument("--fca-archive", type=Path, action="append")
    parser.add_argument(
        "--output", type=Path, default=REPO / "data/public/cvm-sector-comparison.json",
    )
    options = parser.parse_args()

    sys.path.insert(0, str(REPO / "packages/finance-core/src"))
    from src.moat_cvm.sector_comparison import YEARS, create_sector_comparison

    try:
        selection = json.loads(options.selection.read_text(encoding="utf-8"))
        directory = json.loads(options.directory.read_text(encoding="utf-8"))
        if not isinstance(selection, dict) or not isinstance(directory, dict):
            raise ValueError("Seleção anual ou diretório da CVM inválido.")
        selection_year = date.fromisoformat(selection["asOf"]).year
        fca_archives = options.fca_archive or [
            options.raw_dir / f"fca_cia_aberta_{selection_year}.zip",
        ]
        dfp_archives = {year: options.raw_dir / f"dfp_cia_aberta_{year}.zip" for year in YEARS}
        snapshot = create_sector_comparison(selection, directory, fca_archives, dfp_archives)
        companies = snapshot["companies"]
        counts = [
            sum(observation["roe"] is not None for observation in company["observations"])
            for company in companies
        ]
        if not any(counts):
            raise ValueError("O lote não contém nenhuma observação de ROE conciliada.")
        wrote = write_snapshot(options.output, snapshot, ignore_generated_at=True)
    except (BadZipFile, DecimalException, KeyError, OSError, TypeError, ValueError) as error:
        print(f"Lote setorial rejeitado. Snapshot anterior preservado. {error}", file=sys.stderr)
        return 1

    state = "Snapshot gravado" if wrote else "Snapshot já atualizado"
    print(
        f"{state} em {options.output}. {len(companies)} companhias. "
        f"{sum(counts)} observações disponíveis, "
        f"{sum(count == len(YEARS) for count in counts)} séries completas."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
