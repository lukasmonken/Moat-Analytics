"""Extrai códigos declarados no cadastro, sem inferir liquidez ou afiliações."""

import re
from datetime import date
from pathlib import Path
from zoneinfo import ZoneInfo
from zipfile import ZipFile

from .archives import csv_rows, read_archive
from .sample import COMPANIES

ORIGIN = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FCA/DADOS/"
SOURCE = {
    "name": "Comissão de Valores Mobiliários (CVM) · FCA",
    "datasetUrl": "https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca",
    "license": "ODbL-1.0",
    "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
}
CLASSES = {"Ações Ordinárias": "ON", "Ações Preferenciais": "PN", "Units": "UNIT"}
TRADING_CODE = re.compile(r"[A-Z][A-Z0-9]{3}[0-9]{1,2}")


def declarations(archive: ZipFile, year: int, cutoff: date):
    filings = {}
    for filing in csv_rows(archive, f"fca_cia_aberta_{year}.csv"):
        code = filing["CD_CVM"]
        if code not in COMPANIES:
            continue
        reference = date.fromisoformat(filing["DT_REFER"])
        received = date.fromisoformat(filing["DT_RECEB"])
        version = int(filing["VERSAO"])
        if received > cutoff:
            continue
        if reference > received or version < 1:
            raise ValueError(f"CVM {code}: data ou versão inválida no cadastro.")
        previous = filings.get(code)
        if previous:
            previous_key = (date.fromisoformat(previous["DT_REFER"]), int(previous["VERSAO"]))
            if previous_key > (reference, version):
                continue
            if previous_key == (reference, version) and previous != filing:
                raise ValueError(f"CVM {code}: metadados conflitantes no cadastro.")
        filings[code] = filing

    missing = COMPANIES.keys() - filings.keys()
    if missing:
        raise ValueError(f"Formulários ausentes na amostra FCA: {', '.join(sorted(missing))}.")
    return filings


def codes_for_filing(archive: ZipFile, year: int, filings, cutoff: date):
    keys = {
        (filing["CNPJ_CIA"], filing["DT_REFER"], filing["VERSAO"], filing["ID_DOC"]): code
        for code, filing in filings.items()
    }
    tickers = {code: {} for code in filings}
    for security in csv_rows(archive, f"fca_cia_aberta_valor_mobiliario_{year}.csv"):
        key = tuple(
            security[column]
            for column in ("CNPJ_Companhia", "Data_Referencia", "Versao", "ID_Documento")
        )
        if key not in keys or security["Sigla_Entidade_Administradora"] != "B3":
            continue
        if security["Mercado"] != "Bolsa" or security["Valor_Mobiliario"] not in CLASSES:
            continue

        starts = (security["Data_Inicio_Negociacao"], security["Data_Inicio_Listagem"])
        ends = (security["Data_Fim_Negociacao"], security["Data_Fim_Listagem"])
        if any(not start or date.fromisoformat(start) > cutoff for start in starts):
            continue
        if any(end and date.fromisoformat(end) <= cutoff for end in ends):
            continue
        ticker = security["Codigo_Negociacao"].strip()
        if not TRADING_CODE.fullmatch(ticker):
            continue
        by_ticker = tickers[keys[key]]
        share_class = CLASSES[security["Valor_Mobiliario"]]
        if ticker in by_ticker and by_ticker[ticker] != share_class:
            raise ValueError(f"CVM {keys[key]}: classes conflitantes para {ticker}.")
        by_ticker[ticker] = share_class
    return tickers


def create_identity_snapshot(path: Path, year: int) -> dict:
    with read_archive(path) as (archive, checksum, collected):
        cutoff = collected.astimezone(ZoneInfo("America/Sao_Paulo")).date()
        filings = declarations(archive, year, cutoff)
        tickers = codes_for_filing(archive, year, filings, cutoff)

    return {
        "schemaVersion": "1.0.0",
        "source": SOURCE,
        "archiveUrl": f"{ORIGIN}fca_cia_aberta_{year}.zip",
        "archiveSha256": checksum,
        "retrievedAt": collected.isoformat(timespec="seconds"),
        "companies": [
            {
                "companyId": f"cvm:{int(code)}",
                "cvmCode": int(code),
                "filingVersion": int(filing["VERSAO"]),
                "referenceDate": filing["DT_REFER"],
                "receiptDate": filing["DT_RECEB"],
                "tickers": [
                    {"ticker": ticker, "kind": kind}
                    for ticker, kind in sorted(tickers[code].items())
                ],
            }
            for code, filing in sorted(filings.items())
        ],
    }
