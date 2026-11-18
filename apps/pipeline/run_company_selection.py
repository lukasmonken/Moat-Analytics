"""Publica os nomes da seleção anual a partir do cadastro aberto da CVM."""

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from zipfile import BadZipFile

from src.moat_cvm.archives import write_snapshot
from src.moat_cvm.fca import SOURCE
from src.moat_universe import read_security_catalogue

REPO = Path(__file__).resolve().parents[2]


def create_directory(selection: dict, archives: list[Path]) -> dict:
    if selection.get("schemaVersion") != "1.0.0":
        raise ValueError("Seleção anual incompatível.")
    reference = date.fromisoformat(selection["asOf"])
    _, issuers, _ = read_security_catalogue(archives, reference)
    companies = selection["companies"]
    codes = {company["cvmCode"] for company in companies}
    if not codes or len(codes) != len(companies):
        raise ValueError("A seleção deve conter códigos CVM distintos.")
    missing = codes - issuers.keys()
    if missing:
        listed = ", ".join(map(str, sorted(missing)))
        raise ValueError(f"Cadastro CVM indisponível para {listed}.")
    names = {issuers[code][1].strip() for code in codes}
    if "" in names or len(names) != len(codes):
        raise ValueError("A seleção contém nomes oficiais ausentes ou duplicados.")
    return {
        "schemaVersion": "1.0.0",
        "asOf": reference.isoformat(),
        "source": SOURCE,
        "companies": sorted(names, key=str.casefold),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--selection", type=Path,
        default=REPO / "data/processed/index-universe/index-universe.json",
    )
    parser.add_argument("--fca-archive", type=Path, action="append", required=True)
    parser.add_argument("--output", type=Path, default=REPO / "data/public/cvm-company-selection.json")
    options = parser.parse_args()

    try:
        selection = json.loads(options.selection.read_text(encoding="utf-8"))
        if not isinstance(selection, dict):
            raise ValueError("Seleção anual inválida.")
        directory = create_directory(selection, options.fca_archive)
        write_snapshot(options.output, directory)
    except (BadZipFile, KeyError, OSError, TypeError, ValueError) as error:
        print(f"Lista rejeitada. A versão anterior foi preservada. {error}", file=sys.stderr)
        return 1

    print(f"{len(directory['companies'])} nomes do cadastro CVM em {options.output}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
