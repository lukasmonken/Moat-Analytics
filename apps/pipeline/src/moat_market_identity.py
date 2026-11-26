"""Recorte privado de emissores e seus candidatos à consulta de valor de mercado."""

import re
from datetime import date
from typing import TypedDict, cast

from .moat_cvm.comparison_identity import selected_companies
from .moat_cvm.fca import TRADING_CODE

COMPANY_ID = re.compile(r"cvm:[1-9][0-9]{0,5}")


class MarketCapCompany(TypedDict):
    companyId: str
    name: str
    tickers: list[str]


class MarketCapUniverse(TypedDict):
    asOf: str
    companies: list[MarketCapCompany]


def valid_ticker(value: object) -> bool:
    return isinstance(value, str) and TRADING_CODE.fullmatch(value) is not None


def parse_market_cap_universe(value: object) -> MarketCapUniverse:
    if not isinstance(value, dict) or set(value) != {"asOf", "companies"}:
        raise ValueError("Formato inválido no mapa privado de empresas e tickers.")
    as_of = value["asOf"]
    if not isinstance(as_of, str) or date.fromisoformat(as_of).isoformat() != as_of:
        raise ValueError("Data-base inválida no mapa privado.")
    companies = value["companies"]
    if not isinstance(companies, list) or not companies:
        raise ValueError("Empresas ausentes no mapa privado.")

    company_ids: set[str] = set()
    names: set[str] = set()
    seen_tickers: set[str] = set()
    for company in companies:
        if not isinstance(company, dict) or set(company) != {"companyId", "name", "tickers"}:
            raise ValueError("Registro inválido no mapa privado.")
        company_id, name, tickers = company["companyId"], company["name"], company["tickers"]
        if not isinstance(company_id, str) or not COMPANY_ID.fullmatch(company_id):
            raise ValueError("Identificador CVM inválido no mapa privado.")
        if not isinstance(name, str) or not name or name != name.strip():
            raise ValueError("Nome inválido no mapa privado.")
        if company_id in company_ids or name in names:
            raise ValueError("Empresa duplicada no mapa privado.")
        if not isinstance(tickers, list) or any(not valid_ticker(ticker) for ticker in tickers):
            raise ValueError(f"Candidatos de ticker inválidos para {company_id}.")
        if len(set(tickers)) != len(tickers) or seen_tickers.intersection(tickers):
            raise ValueError(f"Ticker duplicado no mapa privado para {company_id}.")

        company_ids.add(company_id)
        names.add(name)
        seen_tickers.update(tickers)
    return cast(MarketCapUniverse, value)


def create_market_cap_universe(selection: dict, directory: dict) -> MarketCapUniverse:
    cutoff, names = selected_companies(selection, directory)
    companies = []
    for company in sorted(selection["companies"], key=lambda row: row["cvmCode"]):
        code = company["cvmCode"]
        company_id = f"cvm:{code}"
        if company.get("companyId") != company_id:
            raise ValueError(f"Identificação divergente na seleção para {company_id}.")
        securities = company.get("securities")
        if securities is None:
            securities = []
        if not isinstance(securities, list):
            raise ValueError(f"Candidatos de ticker inválidos para {company_id}.")
        tickers = set()
        for security in securities:
            if not isinstance(security, dict) or not valid_ticker(security.get("ticker")):
                raise ValueError(f"Candidato de ticker inválido para {company_id}.")
            tickers.add(security["ticker"])
        representative = company.get("representativeTicker")
        if valid_ticker(representative) and representative in tickers:
            tickers.remove(representative)
            ordered_tickers = [representative, *sorted(tickers)]
        else:
            ordered_tickers = sorted(tickers)
        companies.append({"companyId": company_id, "name": names[code], "tickers": ordered_tickers})
    return parse_market_cap_universe({"asOf": cutoff.isoformat(), "companies": companies})
