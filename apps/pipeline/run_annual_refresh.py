"""Confere a CVM e gera um lote coerente de indicadores anuais para publicação."""

import argparse
import json
import sys
from datetime import datetime
from decimal import DecimalException
from pathlib import Path
from zipfile import BadZipFile
from zoneinfo import ZoneInfo

from src.moat_cvm.archives import write_snapshot

REPO = Path(__file__).resolve().parents[2]
PUBLIC = REPO / "data/public"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=REPO / "data/raw/cvm")
    parser.add_argument("--public-dir", type=Path, default=PUBLIC)
    parser.add_argument("--output-dir", type=Path, default=REPO / "data/processed/annual-refresh")
    parser.add_argument("--offline", action="store_true", help="Usa só os ZIPs locais da CVM.")
    parser.add_argument("--end-year", type=int, help="Define o exercício fiscal máximo a procurar.")
    options = parser.parse_args()

    sys.path.insert(0, str(REPO / "packages/finance-core/src"))
    from src.moat_cvm.annual_refresh import ROIC, SNAPSHOTS, refresh_annual_snapshots

    try:
        def read(name):
            return json.loads((options.public_dir / name).read_text(encoding="utf-8"))

        directory = read("cvm-company-selection.json")
        previous = {name: read(name) for name in SNAPSHOTS}
        today = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
        latest = previous[ROIC]["manifest"]["years"][-1]
        snapshots = refresh_annual_snapshots(
            directory,
            previous,
            options.raw_dir,
            target_year=options.end_year if options.end_year is not None else max(latest, today.year - 1),
            offline=options.offline,
            verified_on=None if options.offline else today.isoformat(),
        )
        for name, snapshot in snapshots.items():
            write_snapshot(options.output_dir / name, snapshot, ignore_generated_at=True)
    except (BadZipFile, DecimalException, KeyError, OSError, TypeError, ValueError) as error:
        print(f"Atualização contábil interrompida. {error}", file=sys.stderr)
        return 1
    print(f"Lote anual validado até {snapshots[ROIC]['manifest']['years'][-1]} em {options.output_dir}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
