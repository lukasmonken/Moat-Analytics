"""Ponto retrospectivo do Itaú, extraído da Nota 19 do 6-K público na SEC."""

from datetime import date
from decimal import Decimal

from moat_finance import ShareClassClose, earnings_yield, market_capitalization

from .dfp import amount


ITAU_REVIEWED_DATE = date(2026, 9, 30)
ITAU_REVIEWED_PRICES = {"ITUB3": Decimal("48.47"), "ITUB4": Decimal("44.28")}
ITAU_EXHIBIT = (
    "https://www.sec.gov/Archives/edgar/data/1132597/000113259726000279/"
    "condensedconsolidatedfin.htm"
)
SEC_REUSE = "https://www.sec.gov/about/webmaster-frequently-asked-questions"


def historical_market_point(company: dict, reference: date) -> dict | None:
    if company["companyId"] != "cvm:19348" or reference != ITAU_REVIEWED_DATE:
        return None
    shares = company.get("shares")
    if (
        shares is None
        or shares["referenceDate"] != reference.isoformat()
        or shares["evidenceUrl"] != ITAU_EXHIBIT
        or company["periodEnd"] != reference.isoformat()
        or company["metric"] != "parentNetIncome"
    ):
        return None

    classes = [
        ShareClassClose(
            class_id=row["ticker"],
            trade_date=reference,
            close_brl=ITAU_REVIEWED_PRICES.get(row["ticker"]),
            shares_on_trade_date=row["outstanding"],
        )
        for row in shares["classes"]
    ]
    capital = market_capitalization(classes, expected_classes=ITAU_REVIEWED_PRICES, trade_date=reference)
    yield_value = earnings_yield(
        parent_net_income_ttm_brl=Decimal(str(company["amountBrl"])), market_cap_brl=capital
    )
    if capital is None or yield_value is None:
        return None

    return {
        "referenceDate": reference.isoformat(),
        "sourceName": "Itaú Unibanco · demonstrações IFRS, Nota 19",
        "documentUrl": ITAU_EXHIBIT,
        "reusePolicyUrl": SEC_REUSE,
        "classes": [
            {"ticker": ticker, "priceBrl": amount(price)}
            for ticker, price in ITAU_REVIEWED_PRICES.items()
        ],
        "marketCapBrl": amount(capital),
        "earningsYield": amount(yield_value),
    }
