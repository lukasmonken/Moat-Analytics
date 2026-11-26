"""Gera o mapa privado de empresas e tickers candidatos para valor de mercado."""

import argparse
import json
import os
import sys
from pathlib import Path

from src.moat_cvm.archives import write_snapshot
from src.moat_market_identity import create_market_cap_universe

REPO = Path(__file__).resolve().parents[2]
PROCESSED = REPO / "data/processed/market-caps"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--selection", type=Path,
        default=REPO / "data/processed/index-universe/index-universe.json",
    )
    parser.add_argument(
        "--directory", type=Path, default=REPO / "data/public/cvm-company-selection.json",
    )
    parser.add_argument("--output", type=Path, default=PROCESSED / "universe.json")
    options = parser.parse_args()

    try:
        selection = json.loads(options.selection.read_text(encoding="utf-8"))
        directory = json.loads(options.directory.read_text(encoding="utf-8"))
        if not isinstance(selection, dict) or not isinstance(directory, dict):
            raise ValueError("Seleção anual ou diretório da CVM inválido.")
        supplied = Path(os.path.abspath(options.output))
        output = supplied.resolve()
        if any(
            path.is_relative_to(REPO) and not path.is_relative_to(PROCESSED)
            for path in (supplied, output)
        ):
            raise ValueError("A saída dentro do repositório deve ficar em data/processed/market-caps.")
        if output in (options.selection.resolve(), options.directory.resolve()):
            raise ValueError("Use saídas e entradas diferentes.")
        universe = create_market_cap_universe(selection, directory)
        wrote = write_snapshot(output, universe)
    except (KeyError, OSError, TypeError, ValueError) as error:
        print(f"Mapa rejeitado. A versão anterior foi preservada. {error}", file=sys.stderr)
        return 1

    companies = universe["companies"]
    candidates = sum(bool(company["tickers"]) for company in companies)
    state = "Mapa gravado" if wrote else "Mapa atualizado"
    print(f"{state}. {candidates} de {len(companies)} empresas com candidatos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
