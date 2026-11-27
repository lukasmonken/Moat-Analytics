"""Histórico diário privado de fechamentos ajustados por eventos corporativos."""

import json
from calendar import monthrange
from collections.abc import Callable
from datetime import UTC, date, datetime
from http.client import HTTPException
from math import isclose
from typing import TypedDict
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .moat_market_calendar import CLOSED_DAYS, SAO_PAULO
from .moat_market_identity import MarketCapUniverse, valid_ticker

BRAPI_HISTORY = "https://brapi.dev/api/v2/stocks/historical"
SOURCE = {
    "name": "brapi",
    "url": "https://brapi.dev/docs/acoes/historico",
    "methodology": (
        "Fechamento diário ajustado em reais (adjustedClose), conforme a brapi, com efeitos de "
        "proventos, desdobramentos e grupamentos. Um código da seleção por companhia. "
        "A atualização incremental verifica a proporcionalidade dos fechamentos em comum "
        "antes de aplicar o fator aos níveis anteriores."
    ),
}
HISTORY_RANGES = {"3mo": 3, "5y": 60}
DEMO_TICKERS = frozenset({"PETR4", "MGLU3", "VALE3", "ITUB4"})
MAX_RESPONSE_BYTES = 1_000_000
OVERLAP_REL_TOLERANCE = 1e-6
HistoryReader = Callable[[str, dict[str, str]], dict | None]


class Observation(TypedDict):
    date: str
    level: int | float


class AssetHistory(TypedDict):
    company: str
    instrument: str
    observations: list[Observation]


class ProviderError(OSError):
    """Erro da brapi com mensagem adequada ao log da coleta privada."""


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def brapi_history_reader(token: str) -> HistoryReader:
    if any(not 32 < ord(character) < 127 for character in token):
        raise ValueError("O formato de BRAPI_TOKEN é inválido.")
    opener = build_opener(_NoRedirect())
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    def read(ticker: str, window: dict[str, str]) -> dict | None:
        if not valid_ticker(ticker) or (not token and ticker not in DEMO_TICKERS):
            raise ValueError("Forneça um ticker permitido para a consulta de histórico.")
        query = urlencode({**window, "symbols": ticker, "interval": "1d", "sortOrder": "asc"})
        request = Request(f"{BRAPI_HISTORY}?{query}", headers=headers)
        try:
            with opener.open(request, timeout=10) as response:
                payload = response.read(MAX_RESPONSE_BYTES + 1)
        except HTTPError as error:
            error.close()
            if error.code == 404:
                return None
            raise ProviderError(f"A brapi retornou HTTP {error.code}.") from None
        except (HTTPException, OSError):
            raise ProviderError("Falha de conexão com a brapi.") from None
        if len(payload) > MAX_RESPONSE_BYTES:
            raise ProviderError("Resposta de histórico da brapi acima do tamanho esperado.")
        try:
            body = json.loads(payload)
        except (ValueError, UnicodeError):
            raise ProviderError("Resposta de histórico da brapi inválida.") from None
        results = body.get("results") if isinstance(body, dict) and not body.get("error") else None
        if not isinstance(results, list) or len(results) > 1 or (
            results and not isinstance(results[0], dict)
        ):
            raise ProviderError("Estrutura inesperada na resposta de histórico da brapi.")
        return results[0] if results else None

    return read


def _positive_level(value: object) -> bool:
    return type(value) in (int, float) and 0 < value < 2**53


def _could_be_b3_session(day: date) -> bool:
    return day.weekday() < 5 and (day.month, day.day) not in CLOSED_DAYS.get(day.year, ())


def adjusted_close_series(result: dict | None, ticker: str, trade_date: date) -> list[Observation]:
    if result is None or (
        result.get("requestedSymbol") != ticker or result.get("symbol") != ticker
        or result.get("changed") is not False
    ):
        return []
    data = result.get("data")
    if not isinstance(data, dict) or data.get("usedInterval") != "1d":
        return []
    points = data.get("historicalDataPrice")
    if not isinstance(points, list):
        return []

    seen: set[date] = set()
    observations: list[Observation] = []
    for point in points:
        epoch = point.get("date") if isinstance(point, dict) else None
        if type(epoch) is not int or not 0 < epoch <= 4_102_444_800:
            return []
        day = datetime.fromtimestamp(epoch, UTC).astimezone(SAO_PAULO).date()
        if day > trade_date or day in seen:
            return []
        seen.add(day)
        level = point.get("adjustedClose")
        if _could_be_b3_session(day) and _positive_level(level):
            observations.append({"date": day.isoformat(), "level": level})
    return sorted(observations, key=lambda point: point["date"])


def _iso_day(value: object) -> date:
    if not isinstance(value, str):
        raise ValueError
    day = date.fromisoformat(value)
    if day.isoformat() != value:
        raise ValueError
    return day


def _previous_assets(previous: dict, trade_date: date) -> dict[str, AssetHistory]:
    try:
        if (
            previous["schemaVersion"] != "1.0.0" or previous["frequency"] != "daily"
            or previous["basis"] != "total-return-brl"
            or any(previous["source"].get(key) != value for key, value in SOURCE.items())
        ):
            raise ValueError
        as_of = _iso_day(previous["asOf"])
        retrieved = datetime.fromisoformat(previous["source"]["retrievedAt"])
        if (
            not _could_be_b3_session(as_of) or as_of > trade_date or retrieved.utcoffset() is None
            or as_of > retrieved.astimezone(SAO_PAULO).date()
        ):
            raise ValueError

        assets = previous["assets"]
        if not isinstance(assets, list) or not assets:
            raise ValueError
        by_company: dict[str, AssetHistory] = {}
        instruments: set[str] = set()
        last_dates: set[date] = set()
        for asset in assets:
            company, instrument, observations = asset["company"], asset["instrument"], asset["observations"]
            if (
                not isinstance(company, str) or not 0 < len(company) <= 250 or company.strip() != company
                or company in by_company or not valid_ticker(instrument) or instrument in instruments
                or not isinstance(observations, list) or not observations
            ):
                raise ValueError
            last = date.min
            for point in observations:
                day = _iso_day(point["date"])
                if day <= last or day > as_of or not _could_be_b3_session(day) or not _positive_level(point["level"]):
                    raise ValueError
                last = day
            last_dates.add(last)
            instruments.add(instrument)
            by_company[company] = asset
        if as_of not in last_dates:
            raise ValueError
    except (AttributeError, KeyError, OverflowError, TypeError, ValueError):
        raise ValueError("Histórico privado anterior inválido ou de origem incompatível.") from None
    return by_company


def _incremental_window(
    observations: list[Observation], trade_date: date, history_range: str,
) -> dict[str, str] | None:
    anchor = observations[-2] if len(observations) > 1 else observations[-1]
    first_required = _iso_day(anchor["date"])
    if (trade_date - first_required).days < 7:
        return {"range": "7d", "endDate": trade_date.isoformat()}

    year, month_zero = divmod(trade_date.year * 12 + trade_date.month - 1 - HISTORY_RANGES[history_range], 12)
    month = month_zero + 1
    oldest = date(year, month, min(trade_date.day, monthrange(year, month)[1]))
    if first_required < oldest:
        return None
    return {"startDate": first_required.isoformat(), "endDate": trade_date.isoformat()}


def _merge_adjusted_levels(old: list[Observation], fresh: list[Observation]) -> list[Observation] | None:
    new_levels = {point["date"]: point["level"] for point in fresh}
    first_fresh = fresh[0]["date"]
    last_old = old[-1]
    if last_old["date"] not in new_levels:
        return None
    if len(old) == 1:
        # A resposta cobre toda a série anterior e pode substituí-la integralmente.
        return fresh

    overlap = [point for point in old if point["date"] >= first_fresh]
    factor = new_levels[last_old["date"]] / last_old["level"]
    if len(overlap) < 2 or any(
        point["date"] not in new_levels
        or not isclose(new_levels[point["date"]], point["level"] * factor, rel_tol=OVERLAP_REL_TOLERANCE)
        for point in overlap
    ):
        return None

    prefix: list[Observation] = [
        {"date": point["date"], "level": point["level"] * factor}
        for point in old if point["date"] < first_fresh
    ]
    if any(not _positive_level(point["level"]) for point in prefix):
        return None
    return [*prefix, *fresh]


def collect_market_history(
    universe: MarketCapUniverse, trade_date: date, read_history: HistoryReader, *,
    history_range: str = "3mo", previous: dict | None = None,
) -> dict:
    trade_day = trade_date.isoformat()
    if not _could_be_b3_session(trade_date) or trade_day < universe["asOf"]:
        raise ValueError("Informe um pregão da B3 a partir da data-base da seleção.")
    if history_range not in HISTORY_RANGES:
        raise ValueError("Janela inicial de histórico inválida.")
    previous_assets = _previous_assets(previous, trade_date) if previous is not None else {}
    current_tickers = {ticker for company in universe["companies"] for ticker in company["tickers"]}
    assets: list[AssetHistory] = []
    fresh_companies = 0

    for company in universe["companies"]:
        name, tickers = company["name"], company["tickers"]
        if len(name) > 250:
            raise ValueError("Nome de companhia acima do limite do contrato de histórico.")
        cached = previous_assets.get(name)
        if cached and cached["instrument"] in tickers:
            ticker = cached["instrument"]
            old = cached["observations"]
            window = _incremental_window(old, trade_date, history_range)
            if window is not None:
                fresh = adjusted_close_series(read_history(ticker, window), ticker, trade_date)
                if fresh and fresh[-1]["date"] == trade_day:
                    merged = _merge_adjusted_levels(old, fresh)
                    if merged is not None:
                        assets.append({**cached, "observations": merged})
                        fresh_companies += 1
                        continue
            assets.append(cached)
            continue

        for ticker in tickers:
            window = {"range": history_range, "endDate": trade_day}
            observations = adjusted_close_series(read_history(ticker, window), ticker, trade_date)
            if observations and observations[-1]["date"] == trade_day:
                assets.append({"company": name, "instrument": ticker, "observations": observations})
                fresh_companies += 1
                break
        else:
            if cached and cached["instrument"] not in current_tickers:
                assets.append(cached)

    if not fresh_companies:
        raise ValueError("Nenhuma companhia apresentou fechamento ajustado validado no pregão esperado.")
    if previous is not None and trade_day == previous["asOf"] and assets == previous["assets"]:
        return previous
    return {
        "schemaVersion": "1.0.0",
        "frequency": "daily",
        "basis": "total-return-brl",
        "asOf": trade_day,
        "source": {**SOURCE, "retrievedAt": datetime.now(UTC).isoformat(timespec="seconds")},
        "assets": assets,
    }
