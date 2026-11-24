"""Seleção de versões DFP e ITR para os fundamentos de preço."""

from datetime import date, datetime
from zipfile import ZipFile

from .archives import csv_rows
from .dfp import CsvRow
from .sample import COMPANIES

ITR_ORIGIN = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/"
QUARTER_ENDS = {(3, 31), (6, 30), (9, 30)}


def select_income_filings(
    archive: ZipFile, form: str, reference: date
) -> dict[str, list[CsvRow]]:
    candidates: dict[str, list[CsvRow]] = {code: [] for code in COMPANIES}
    for row in csv_rows(archive, f"{form.lower()}_cia_aberta_{reference.year}.csv"):
        code = row["CD_CVM"]
        if code in COMPANIES and row["DT_REFER"] == reference.isoformat():
            candidates[code].append(row)
    return candidates


def latest_income_filing(
    candidates: list[CsvRow], form: str, reference: date, collected: datetime
) -> CsvRow:
    if not candidates:
        raise ValueError(f"{form} indisponível em {reference.isoformat()}.")
    version = max(int(filing["VERSAO"]) for filing in candidates)
    latest = [filing for filing in candidates if int(filing["VERSAO"]) == version]
    filing = latest[0]
    if version < 1 or any(row != filing for row in latest):
        raise ValueError(f"Versão inválida ou metadados divergentes no {form}.")
    if filing["CATEG_DOC"] != form:
        raise ValueError(f"Categoria incompatível no {form}.")
    received = date.fromisoformat(filing["DT_RECEB"])
    if not reference <= received <= collected.date():
        raise ValueError(f"Data de recebimento incompatível no {form}.")
    return filing
