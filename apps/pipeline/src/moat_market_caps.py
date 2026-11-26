"""Capitalização de mercado por emissor, a partir da cotação de fechamento."""

import json
from collections.abc import Callable
from datetime import UTC, date, datetime
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .moat_market_calendar import SAO_PAULO
from .moat_market_identity import MarketCapUniverse

BRAPI_QUOTES = "https://brapi.dev/api/quote/"
BRAPI_DOCS = "https://brapi.dev/docs/acoes"
METHOD = "market-cap.brapi-close.v1"
MAX_RESPONSE_BYTES = 1_000_000


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def brapi_quote_reader(token: str) -> Callable[[str], dict | None]:
    opener = build_opener(_NoRedirect())
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    def read(ticker: str) -> dict | None:
        query = urlencode({"range": "5d", "interval": "1d"})
        request = Request(f"{BRAPI_QUOTES}{ticker}?{query}", headers=headers)
        try:
            with opener.open(request, timeout=10) as response:
                payload = response.read(MAX_RESPONSE_BYTES + 1)
        except HTTPError as error:
            if error.code == 404:
                return None
            raise OSError(f"A brapi retornou HTTP {error.code}.") from None
        except (URLError, TimeoutError):
            raise OSError("Falha de conexão com a brapi.") from None
        if len(payload) > MAX_RESPONSE_BYTES:
            raise ValueError("Resposta de cotação acima do tamanho esperado.")
        try:
            body = json.loads(payload)
        except (ValueError, UnicodeError):
            raise ValueError("Resposta de cotação inválida da brapi.") from None
        if not isinstance(body, dict) or not isinstance(body.get("results"), list):
            raise ValueError("A resposta da brapi não contém a lista de cotações esperada.")
        results = body["results"]
        if not results:
            return None
        if len(results) != 1 or not isinstance(results[0], dict):
            raise ValueError("Quantidade de cotações inesperada para o código consultado.")
        return results[0]

    return read


def _positive_number(value: object) -> bool:
    return type(value) in (int, float) and 0 < value < 2**53


def closing_cap(quote: dict | None, ticker: str, trade_date: date) -> tuple[dict | None, str]:
    if quote is None:
        return None, "Cotação indisponível na brapi."
    if quote.get("symbol") != ticker or quote.get("currency") != "BRL":
        return None, "Código ou moeda incompatível com a seleção."
    amount = quote.get("marketCap")
    price = quote.get("regularMarketPrice")
    if not _positive_number(amount) or not _positive_number(price):
        return None, "Valor de mercado ou cotação indisponível."

    history = quote.get("historicalDataPrice")
    if quote.get("usedInterval") != "1d" or not isinstance(history, list):
        return None, "Histórico diário indisponível para conferir o fechamento."
    points = [
        item for item in history
        if isinstance(item, dict) and type(item.get("date")) is int
        and 0 < item["date"] <= 4_102_444_800
    ]
    if not points:
        return None, "Histórico diário indisponível para conferir o fechamento."
    latest = max(points, key=lambda item: item["date"])
    session = datetime.fromtimestamp(latest["date"], UTC).astimezone(SAO_PAULO).date()
    if session != trade_date:
        return None, "Fechamento do pregão esperado indisponível."
    if (
        sum(item["date"] == latest["date"] for item in points) != 1
        or latest.get("close") != price
        or type(latest.get("volume")) is not int
        or latest["volume"] <= 0
        or latest["volume"] != quote.get("regularMarketVolume")
    ):
        return None, "Cotação e preço ou volume de fechamento divergem."

    try:
        updated_at = datetime.fromisoformat(quote.get("regularMarketTime", ""))
    except (ValueError, TypeError):
        return None, "Horário de atualização da cotação indisponível."
    if updated_at.tzinfo is None or updated_at.astimezone(SAO_PAULO).date() < trade_date:
        return None, "Cotação anterior ao pregão esperado."
    return {
        "ticker": ticker,
        "marketCapBrl": amount,
        "quoteUpdatedAt": updated_at.isoformat(),
        "qualityStatus": "estimated",
    }, ""


def collect_market_caps(
    universe: MarketCapUniverse, trade_date: date, read_quote: Callable[[str], dict | None],
) -> dict:
    if trade_date.isoformat() < universe["asOf"]:
        raise ValueError("O pregão não pode ser anterior à seleção anual.")
    rows = []
    for company in universe["companies"]:
        observation = None
        reasons = []
        for ticker in company["tickers"]:
            observation, reason = closing_cap(read_quote(ticker), ticker, trade_date)
            if observation is not None:
                break
            reasons.append(reason)

        if observation is None:
            observation = {
                "ticker": None,
                "marketCapBrl": None,
                "quoteUpdatedAt": None,
                "qualityStatus": "unavailable",
            }
        rows.append({
            "companyId": company["companyId"],
            "name": company["name"],
            **observation,
            "reason": None if observation["marketCapBrl"] is not None else (
                " ".join(dict.fromkeys(reasons)) or "Empresa sem código validado na seleção."
            ),
        })
    return {
        "manifest": {
            "schemaVersion": "1.0.0",
            "methodologyVersion": METHOD,
            "generatedAt": datetime.now(UTC).isoformat(),
            "tradeDate": trade_date.isoformat(),
            "selectionAsOf": universe["asOf"],
            "currency": "BRL",
            "source": {"name": "brapi", "url": BRAPI_DOCS},
            "coverage": {
                "includedCompanies": len(rows),
                "availableCompanies": sum(row["marketCapBrl"] is not None for row in rows),
            },
        },
        "companies": rows,
    }
