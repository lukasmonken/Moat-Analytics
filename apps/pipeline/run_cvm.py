"""Gera a amostra de DFP consolidados e promove somente lotes conciliados."""

import argparse
import sys
from datetime import date
from decimal import DecimalException
from pathlib import Path
from zipfile import BadZipFile

from src.moat_cvm.archives import acquire_archive, write_snapshot
from src.moat_cvm.dfp import ORIGIN, create_snapshot

REPO = Path(__file__).resolve().parents[2]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=2021)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--raw-dir", type=Path, default=REPO / "data/raw/cvm")
    parser.add_argument("--output", type=Path, default=REPO / "data/public/cvm-sample.json")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--offline", action="store_true", help="Usar somente ZIPs locais.")
    mode.add_argument("--refresh", action="store_true", help="Conferir reapresentações na CVM.")
    options = parser.parse_args()
    if not 2010 <= options.start_year <= options.end_year < date.today().year:
        parser.error("Informe um intervalo de exercícios anuais completos, a partir de 2010.")

    try:
        archives = {}
        for year in range(options.start_year, options.end_year + 1):
            filename = f"dfp_cia_aberta_{year}.zip"
            archives[year] = acquire_archive(
                options.raw_dir,
                filename,
                ORIGIN + filename,
                offline=options.offline,
                refresh=options.refresh,
            )
        payload = create_snapshot(archives)
        wrote = write_snapshot(options.output, payload, ignore_generated_at=True)
    except (BadZipFile, DecimalException, KeyError, OSError, ValueError) as error:
        print(f"Lote DFP rejeitado. Snapshot anterior preservado. {error}", file=sys.stderr)
        return 1

    observed = sum(len(company["observations"]) for company in payload["companies"])
    state = "Snapshot gravado" if wrote else "Snapshot já atualizado"
    print(f"{state} em {options.output}. {observed} exercícios conciliados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
