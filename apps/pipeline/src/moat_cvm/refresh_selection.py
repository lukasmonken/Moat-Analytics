"""Reconstitui a entrada contábil da seleção pública por nome oficial no FCA."""

from datetime import date
from pathlib import Path
from zoneinfo import ZoneInfo

from ..moat_universe import FCA_FILENAME, parse_cnpj, parse_cvm_code
from .archives import read_archive
from .comparison_identity import classification_url
from .fca import declaration_order, declarations

SAO_PAULO = ZoneInfo("America/Sao_Paulo")


def build_refresh_selection(directory: dict, fca_archives: list[Path]) -> dict:
    """Identifica cada nome publicado na data-base, sem usar os arquivos dos índices."""
    if directory.get("schemaVersion") != "1.0.0":
        raise ValueError("Versão incompatível no diretório público da seleção.")
    as_of = directory.get("asOf")
    if not isinstance(as_of, str):
        raise ValueError("Data-base ausente no diretório público da seleção.")
    cutoff = date.fromisoformat(as_of)
    if cutoff.isoformat() != as_of:
        raise ValueError("Data-base inválida no diretório público da seleção.")
    names = directory.get("companies")
    if (
        not isinstance(names, list) or not names
        or any(not isinstance(name, str) or not name or name.strip() != name for name in names)
        or len(set(names)) != len(names)
    ):
        raise ValueError("O diretório público deve conter nomes oficiais, preenchidos e únicos.")

    archive_years: set[int] = set()
    latest: dict[int, dict[str, str]] = {}
    for path in fca_archives:
        match = FCA_FILENAME.fullmatch(path.name)
        if not match:
            raise ValueError(f"Nome de arquivo FCA incompatível: {path.name}.")
        year = int(match.group(1))
        if year in archive_years:
            raise ValueError(f"Informe um único ZIP do FCA por ano. Duplicado: {year}.")
        archive_years.add(year)
        with read_archive(path) as (archive, _, collected):
            before = min(cutoff, collected.astimezone(SAO_PAULO).date())
            for raw_code, filing in declarations(archive, year, before, company_codes=None).items():
                code = parse_cvm_code(raw_code)
                if code is None:
                    continue
                previous = latest.get(code)
                order = declaration_order(filing)
                if previous is not None:
                    previous_order = declaration_order(previous)
                    if order < previous_order:
                        continue
                    if order == previous_order and filing != previous:
                        raise ValueError(f"CVM {code}: formulários cadastrais conflitantes.")
                latest[code] = filing

    wanted = set(names)
    codes_by_name: dict[str, int] = {}
    for code, filing in latest.items():
        name = filing["DENOM_CIA"].strip()
        if name not in wanted:
            continue
        if name in codes_by_name:
            raise ValueError(f"Nome ambíguo no FCA na data-base da seleção: {name}.")
        if filing["CATEG_DOC"] != "FCA" or parse_cnpj(filing["CNPJ_CIA"]) is None:
            raise ValueError(f"CVM {code}: identificação incompatível no FCA.")
        classification_url(filing["LINK_DOC"])
        codes_by_name[name] = code

    missing = wanted - codes_by_name.keys()
    if missing:
        raise ValueError(f"Nomes oficiais ausentes no FCA na data-base da seleção: {', '.join(sorted(missing))}.")
    return {
        "schemaVersion": "1.0.0",
        "asOf": as_of,
        "companies": [{"cvmCode": codes_by_name[name], "name": name} for name in names],
    }
