"""Gera o comparativo de ROE de bancos a partir dos DFPs anuais da CVM."""

import argparse
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
    parser.add_argument("--output", type=Path, default=REPO / "data/public/cvm-bank-roe.json")
    parser.add_argument("--start-year", type=int, default=2021)
    parser.add_argument("--end-year", type=int, default=2025)
    options = parser.parse_args()
    if not 2021 <= options.start_year <= options.end_year < date.today().year:
        parser.error("Informe exercícios anuais completos a partir de 2021.")

    sys.path.insert(0, str(REPO / "packages/finance-core/src"))
    from src.moat_cvm.bank_roe import create_bank_roe_snapshot

    try:
        archives = {
            year: options.raw_dir / f"dfp_cia_aberta_{year}.zip"
            for year in range(options.start_year, options.end_year + 1)
        }
        snapshot = create_bank_roe_snapshot(archives)
        wrote = write_snapshot(options.output, snapshot, ignore_generated_at=True)
    except (BadZipFile, DecimalException, KeyError, OSError, ValueError) as error:
        print(f"Lote de ROE rejeitado. Snapshot anterior preservado. {error}", file=sys.stderr)
        return 1

    observed = sum(len(company["observations"]) for company in snapshot["companies"])
    state = "Snapshot gravado" if wrote else "Snapshot já atualizado"
    print(f"{state} em {options.output}. {observed} exercícios.")
    for bank in snapshot["excluded"]:
        print(f"{bank['name']} excluído. {bank['reason']}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
