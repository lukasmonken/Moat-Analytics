"""Gera o snapshot de fundamentos de preço a partir dos ZIPs DFP e ITR da CVM."""

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
    parser.add_argument(
        "--output", type=Path, default=REPO / "data/public/cvm-price-fundamentals.json"
    )
    parser.add_argument("--reference-date", type=date.fromisoformat, default=date(2026, 9, 30))
    options = parser.parse_args()

    sys.path.insert(0, str(REPO / "packages/finance-core/src"))
    from src.moat_cvm.price import create_price_fundamentals_snapshot

    reference = options.reference_date
    try:
        snapshot = create_price_fundamentals_snapshot(
            options.raw_dir / f"dfp_cia_aberta_{reference.year - 1}.zip",
            options.raw_dir / f"itr_cia_aberta_{reference.year}.zip",
            reference,
        )
        wrote = write_snapshot(options.output, snapshot, ignore_generated_at=True)
    except (BadZipFile, DecimalException, KeyError, OSError, ValueError) as error:
        print(f"Lote de fundamentos rejeitado. Snapshot anterior preservado. {error}", file=sys.stderr)
        return 1

    state = "Snapshot gravado" if wrote else "Snapshot já atualizado"
    print(f"{state} em {options.output}. {len(snapshot['companies'])} companhias.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
