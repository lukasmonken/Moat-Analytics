"""Gera o comparativo setorial de ROIC estimado a partir dos ZIPs locais da CVM."""

import argparse
import json
import sys
from datetime import date
from decimal import DecimalException
from pathlib import Path
from zipfile import BadZipFile

from src.moat_cvm.archives import write_snapshot

REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO / "data/public/cvm-sector-roic.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=REPO / "data/raw/cvm")
    parser.add_argument(
        "--selection", type=Path,
        default=REPO / "data/processed/index-universe/index-universe.json",
    )
    parser.add_argument("--directory", type=Path, default=REPO / "data/public/cvm-company-selection.json")
    parser.add_argument("--fca-archive", type=Path, action="append")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--end-year", type=int,
        help="Último dos cinco exercícios. Por padrão, usa a janela do lote publicado.",
    )
    options = parser.parse_args()

    sys.path.insert(0, str(REPO / "packages/finance-core/src"))
    from src.moat_cvm.sector_comparison import annual_window
    from src.moat_cvm.sector_roic import create_sector_roic

    try:
        selection = json.loads(options.selection.read_text(encoding="utf-8"))
        directory = json.loads(options.directory.read_text(encoding="utf-8"))
        if not isinstance(selection, dict) or not isinstance(directory, dict):
            raise ValueError("Seleção anual ou diretório da CVM inválido.")
        selection_year = date.fromisoformat(selection["asOf"]).year
        fca_archives = options.fca_archive or [
            options.raw_dir / f"fca_cia_aberta_{selection_year}.zip",
        ]
        end_year = options.end_year
        if end_year is None:
            published = json.loads(DEFAULT_OUTPUT.read_text(encoding="utf-8"))
            end_year = published["manifest"]["years"][-1]
        years = annual_window(end_year)
        dfp_archives = {year: options.raw_dir / f"dfp_cia_aberta_{year}.zip" for year in years}
        snapshot = create_sector_roic(selection, directory, fca_archives, dfp_archives)
        companies = snapshot["companies"]
        counts = [
            sum(observation["roic"] is not None for observation in company["observations"])
            for company in companies
        ]
        if not any(counts):
            raise ValueError("O lote não contém nenhuma observação de ROIC conciliada.")
        wrote = write_snapshot(options.output, snapshot, ignore_generated_at=True)
    except (BadZipFile, DecimalException, IndexError, KeyError, OSError, TypeError, ValueError) as error:
        print(f"Lote de ROIC rejeitado. Snapshot anterior preservado. {error}", file=sys.stderr)
        return 1

    state = "Snapshot gravado" if wrote else "Snapshot já atualizado"
    print(
        f"{state} em {options.output}. {len(companies)} companhias. "
        f"{sum(counts)} observações disponíveis, "
        f"{sum(count == len(years) for count in counts)} séries completas."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
