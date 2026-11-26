"""Gera o comparativo anual de dívida líquida/EBITDA a partir da CVM."""

import argparse
import json
import sys
from pathlib import Path
from zipfile import BadZipFile

from src.moat_cvm.archives import write_snapshot

REPO = Path(__file__).resolve().parents[2]
PUBLIC = REPO / "data/public"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=REPO / "data/raw/cvm")
    parser.add_argument(
        "--selection", type=Path,
        default=REPO / "data/processed/index-universe/index-universe.json",
    )
    parser.add_argument("--directory", type=Path, default=PUBLIC / "cvm-company-selection.json")
    parser.add_argument("--roic", type=Path, default=PUBLIC / "cvm-sector-roic.json")
    parser.add_argument("--output", type=Path, default=PUBLIC / "cvm-sector-leverage.json")
    options = parser.parse_args()

    sys.path.insert(0, str(REPO / "packages/finance-core/src"))
    from src.moat_cvm.sector_leverage import create_sector_leverage

    try:
        selection, directory, roic = (
            json.loads(path.read_text(encoding="utf-8"))
            for path in (options.selection, options.directory, options.roic)
        )
        snapshot = create_sector_leverage(selection, directory, roic, options.raw_dir)
        total = len(snapshot["companies"])
        available = sum(company["value"] is not None for company in snapshot["companies"])
        if not available:
            raise ValueError("O lote não contém nenhum EBITDA calculável.")
        wrote = write_snapshot(options.output, snapshot, ignore_generated_at=True)
    except (BadZipFile, KeyError, OSError, TypeError, ValueError) as error:
        print(f"Lote de alavancagem rejeitado. Snapshot anterior preservado. {error}", file=sys.stderr)
        return 1
    state = "Snapshot gravado" if wrote else "Snapshot já atualizado"
    print(f"{state} em {options.output}. Dívida líquida/EBITDA para {available} de {total} empresas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
