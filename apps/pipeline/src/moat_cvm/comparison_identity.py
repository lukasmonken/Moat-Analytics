"""Identidade e setor declarados no FCA para a seleção anual."""

from datetime import date
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from ..moat_universe import FCA_FILENAME, parse_cnpj, parse_cvm_code
from .archives import csv_rows, read_archive
from .fca import ORIGIN, declaration_order, declarations, filing_key, section_key

# Grupos bancários ou de seguros cuja atividade principal exige ROE mesmo
# quando o setor cadastral agrupa holdings, resseguradoras e corretoras.
ROE_ISSUERS = frozenset((16_659, 23_159, 23_795, 24_180, 25_860))


def uses_roe(code: int, identity: dict) -> bool:
    return identity["sector"] == "Bancos" or code in ROE_ISSUERS


def selected_companies(selection: dict, directory: dict) -> tuple[date, dict[int, str]]:
    if selection.get("schemaVersion") != "1.0.0" or directory.get("schemaVersion") != "1.0.0":
        raise ValueError("Seleção anual ou diretório público incompatível.")
    when = selection.get("asOf")
    if not isinstance(when, str) or when != directory.get("asOf"):
        raise ValueError("A data-base da seleção diverge do diretório público.")
    cutoff = date.fromisoformat(when)
    if when != cutoff.isoformat():
        raise ValueError("Data-base inválida na seleção anual.")

    companies = selection.get("companies")
    directory_names = directory.get("companies")
    if (
        not isinstance(companies, list) or not companies
        or not isinstance(directory_names, list)
        or any(not isinstance(name, str) or not name.strip() for name in directory_names)
    ):
        raise ValueError("Companhias ausentes ou inválidas na seleção anual ou no diretório.")

    names: dict[int, str] = {}
    for company in companies:
        if not isinstance(company, dict):
            raise ValueError("Companhia inválida na seleção anual.")
        code, name = company.get("cvmCode"), company.get("name")
        if type(code) is not int or not 1 <= code <= 999_999 or code in names:
            raise ValueError("A seleção anual exige códigos CVM válidos e únicos.")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"Nome ausente ou inválido para CVM {code}.")
        names[code] = name
    if len(directory_names) != len(names) or len(set(directory_names)) != len(names):
        raise ValueError("A seleção anual e o diretório devem conter os mesmos nomes únicos.")
    if set(names.values()) != set(directory_names):
        raise ValueError("Os nomes da seleção anual divergem do diretório público.")
    return cutoff, names


def classification_url(value: str) -> str:
    url = value.replace("http://www.rad.cvm.gov.br/", "https://www.rad.cvm.gov.br/", 1)
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.netloc != "www.rad.cvm.gov.br" or not parts.path:
        raise ValueError("Endereço do formulário cadastral incompatível.")
    return url


def comparison_identities(
    selection: dict, directory: dict, fca_archives: list[Path],
) -> tuple[dict[int, dict], list[dict]]:
    """Cruza o último FCA de cada emissor com a data-base da seleção.

    O CNPJ é devolvido apenas para conferir a identidade nos DFPs, sem integrar o
    snapshot público de comparativos.
    """
    cutoff, names = selected_companies(selection, directory)
    catalog: dict[int, tuple[tuple[date, int, date], dict, str]] = {}
    archives: dict[int, dict] = {}
    for path in sorted(fca_archives):
        match = FCA_FILENAME.fullmatch(path.name)
        if not match:
            raise ValueError(f"Nome de arquivo FCA incompatível: {path.name}.")
        year = int(match.group(1))
        if year in archives:
            raise ValueError(f"Informe um único ZIP do FCA por ano. Duplicado: {year}.")
        with read_archive(path) as (archive, checksum, collected):
            before = min(cutoff, collected.astimezone(ZoneInfo("America/Sao_Paulo")).date())
            filings = {
                int(code): filing
                for code, filing in declarations(archive, year, before, company_codes=None).items()
                if int(code) in names
            }
            keys = {filing_key(filing): code for code, filing in filings.items()}
            general: dict[int, dict] = {}
            for row in csv_rows(archive, f"fca_cia_aberta_geral_{year}.csv"):
                code = keys.get(section_key(row))
                if code is None:
                    continue
                if parse_cvm_code(row["Codigo_CVM"]) != code or code in general:
                    raise ValueError(f"CVM {code}: código divergente ou seção geral duplicada no FCA.")
                general[code] = row
            for code, filing in filings.items():
                order = declaration_order(filing)
                previous = catalog.get(code)
                if previous and order < previous[0]:
                    continue
                row = general.get(code)
                sector = row["Setor_Atividade"].strip() if row else None
                if (
                    not row or row["Pais_Origem"] != "Brasil"
                    or row["Categoria_Registro_CVM"] != "Categoria A"
                    or row["Situacao_Registro_CVM"] != "Ativo"
                ):
                    sector = None
                identity = {
                    "name": filing["DENOM_CIA"].strip(),
                    "sector": sector,
                    "cnpj": filing["CNPJ_CIA"],
                    "classification": {
                        "referenceDate": filing["DT_REFER"],
                        "receivedAt": filing["DT_RECEB"],
                        "version": order[1],
                        "filingUrl": classification_url(filing["LINK_DOC"]),
                        "archiveYear": year,
                    },
                }
                if previous and order == previous[0]:
                    previous_identity = previous[1]
                    previous_url = previous_identity["classification"]["filingUrl"]
                    if (
                        filing["ID_DOC"] != previous[2] or identity["sector"] != previous_identity["sector"]
                        or identity["name"] != previous_identity["name"]
                        or identity["cnpj"] != previous_identity["cnpj"]
                        or identity["classification"]["filingUrl"] != previous_url
                    ):
                        raise ValueError(f"CVM {code}: formulários cadastrais conflitantes.")
                    continue
                if filing["CATEG_DOC"] != "FCA" or parse_cnpj(filing["CNPJ_CIA"]) is None:
                    raise ValueError(f"CVM {code}: identificação incompatível no FCA.")
                catalog[code] = (order, identity, filing["ID_DOC"])
        archives[year] = {
            "kind": "fca", "year": year, "url": ORIGIN + path.name,
            "sha256": checksum, "retrievedAt": collected.isoformat(timespec="seconds"),
        }

    results = {}
    for code, name in sorted(names.items()):
        observation = catalog.get(code)
        if observation is None or not observation[1]["sector"]:
            raise ValueError(f"CVM {code}: setor cadastral indisponível na data-base da seleção.")
        identity = observation[1]
        if name != identity["name"]:
            raise ValueError(f"CVM {code}: nome cadastral diverge do diretório público.")
        results[code] = identity
    return results, [archives[year] for year in sorted(archives)]
