"""Rendimentos de mercado usando as entradas anuais já verificadas dos comparativos."""

from datetime import date
from decimal import Decimal
from math import isfinite

from moat_finance import earnings_yield, enterprise_value, operating_yield

from .moat_cvm.dfp import amount
from .moat_cvm.sector_roic import closing_net_debt

METHOD = "market-yields-dfp.v1"


def _money(value: object) -> Decimal | None:
    if type(value) in (int, float) and abs(value) < 2**53:
        return Decimal(str(value))
    return None


def _date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.isoformat() == value else None


def _fundamentals(
    company: dict, metric: str, trade_date: date,
) -> tuple[Decimal, Decimal | None, dict] | None:
    operating = metric == "operatingYield"
    key = "nopatBrl" if operating else "netIncomeBrl"
    for observation in sorted(company["observations"], key=lambda row: row["year"], reverse=True):
        filing = observation.get("filing")
        inputs = observation.get("inputs")
        if not isinstance(filing, dict) or not isinstance(inputs, dict):
            continue
        reference = _date(filing.get("referenceDate"))
        received = _date(filing.get("receivedAt"))
        source_url = filing.get("filingUrl")
        if (
            reference != date(observation["year"], 12, 31)
            or received is None or not reference <= received <= trade_date
            or not isinstance(source_url, str) or not source_url.startswith("https://")
        ):
            continue
        numerator = _money(inputs.get(key))
        debt = closing_net_debt(inputs, reference.isoformat()) if operating else None
        if numerator is None or (operating and debt is None):
            continue
        accounting = {
            "referenceDate": reference.isoformat(),
            "receivedAt": received.isoformat(),
            "sourceUrl": source_url,
            "supportingDocumentUrl": filing.get("supportingDocumentUrl"),
        }
        return numerator, debt, accounting
    return None


def _valuation(company: dict, classified: tuple[str, dict] | None, trade_date: date) -> dict:
    metric, fundamentals = classified or (None, None)
    result = {
        "metric": metric,
        "value": None,
        "enterpriseValueBrl": None,
        "netDebtBrl": None,
        "numeratorBrl": None,
        "accounting": None,
        "reason": None,
    }
    if fundamentals is None:
        return {**result, "reason": "Companhia sem correspondência no comparativo contábil."}
    inputs = _fundamentals(fundamentals, metric, trade_date)
    if inputs is None:
        return {**result, "reason": "Insumos anuais indisponíveis até a data do pregão."}
    numerator, debt, accounting = inputs
    result.update(numeratorBrl=amount(numerator), accounting=accounting)
    if debt is not None:
        result["netDebtBrl"] = amount(debt)
    cap = _money(company.get("marketCapBrl"))
    if cap is None or cap <= 0:
        return {**result, "reason": "Valor de mercado indisponível no pregão."}

    if metric == "operatingYield":
        ev = enterprise_value(market_cap_brl=cap, net_debt_brl=debt, adjustments_brl=Decimal(0))
        if ev is None or ev >= 2**53:
            return {**result, "reason": "Valor da firma inválido para calcular o rendimento."}
        result["enterpriseValueBrl"] = amount(ev)
        value = operating_yield(nopat_ttm_brl=numerator, enterprise_value_brl=ev)
    else:
        value = earnings_yield(parent_net_income_ttm_brl=numerator, market_cap_brl=cap)
    if value is None or not isfinite(float(value)):
        return {**result, "reason": "Rendimento implícito indisponível."}
    return {**result, "value": float(value)}


def attach_market_yields(snapshot: dict, *, roic: dict, roe: dict) -> dict:
    """Acrescenta rendimentos e suas fontes ao lote privado de valor de mercado."""
    manifest = snapshot["manifest"]
    trade_date = _date(manifest.get("tradeDate"))
    selection_date = _date(manifest.get("selectionAsOf"))
    if trade_date is None or selection_date is None or trade_date < selection_date:
        raise ValueError("Data do pregão ou da seleção inválida no lote de valor de mercado.")
    classified: dict[str, tuple[str, dict]] = {}
    for metric, annual_snapshot, methodology in (
        ("operatingYield", roic, "roic-dfp-comparisons.v2"),
        ("earningsYield", roe, "roe-dfp-comparisons.v1"),
    ):
        accounting_manifest = annual_snapshot.get("manifest", {})
        if (
            accounting_manifest.get("asOf") != selection_date.isoformat()
            or accounting_manifest.get("methodologyVersion") != methodology
        ):
            raise ValueError("O comparativo contábil não corresponde à data ou à metodologia da seleção.")
        for company in annual_snapshot["companies"]:
            name = company["name"]
            if name in classified:
                raise ValueError("Companhia duplicada nos comparativos contábeis.")
            classified[name] = metric, company
    companies = [
        {**company, "valuation": _valuation(company, classified.get(company["name"]), trade_date)}
        for company in snapshot["companies"]
    ]
    return {
        "manifest": {
            **manifest,
            "valuationMethodologyVersion": METHOD,
            "coverage": {
                **manifest["coverage"],
                "availableYields": sum(company["valuation"]["value"] is not None for company in companies),
            },
        },
        "companies": companies,
    }
