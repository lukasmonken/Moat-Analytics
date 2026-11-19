"""Importa fechamentos de um CSV autorizado fornecido localmente."""

import argparse
import csv
import fcntl
import json
import math
import os
import re
import sys
from datetime import UTC, date, datetime
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from src.moat_cvm.archives import write_snapshot

REPO = Path(__file__).resolve().parents[2]
PROCESSED = REPO / "data/processed/market-closes"
FIELDS = ["ticker", "tradeDate", "closeBrl"]
VERSION = "1.0.0"
METHOD = "market-close.v1"
SAO_PAULO = ZoneInfo("America/Sao_Paulo")
TICKER = re.compile(r"[A-Z][A-Z0-9]{3}[0-9]{1,2}")
PRICE = re.compile(r"[0-9]+(?:\.[0-9]+)?")


def market_date(value: str) -> date:
    parsed = date.fromisoformat(value)
    if parsed.isoformat() != value:
        raise ValueError("Use datas no formato AAAA-MM-DD.")
    return parsed


def make_quote(
    ticker: str, trade_date: date, close: float, source: str, retrieved_at: datetime
) -> dict:
    reference_date = trade_date.isoformat()
    return {
        "ticker": ticker,
        "tradeDate": reference_date,
        "close": close,
        "currency": "BRL",
        "provenance": {
            "source": source,
            "referenceDate": reference_date,
            "publishedAt": None,
            "retrievedAt": retrieved_at.isoformat(),
            "methodologyVersion": METHOD,
            "qualityStatus": "validated",
        },
    }


def read_closes(input_path: Path, source: str, expected: date) -> dict[str, dict]:
    quotes = {}
    seen = set()
    with input_path.open(encoding="utf-8-sig", newline="") as stream:
        retrieved_at = datetime.fromtimestamp(os.fstat(stream.fileno()).st_mtime, UTC)
        if retrieved_at > datetime.now(UTC):
            raise ValueError("A data de coleta do CSV está no futuro.")
        latest = min(expected, retrieved_at.astimezone(SAO_PAULO).date())
        rows = csv.DictReader(stream, strict=True)
        if rows.fieldnames != FIELDS:
            raise ValueError("Cabeçalho esperado: ticker,tradeDate,closeBrl.")
        for row in rows:
            try:
                if None in row or any(row[field] is None for field in FIELDS):
                    raise ValueError("Número inválido de colunas.")
                ticker = row["ticker"].strip().upper()
                if not TICKER.fullmatch(ticker):
                    raise ValueError("Ticker inválido.")
                trade_date = market_date(row["tradeDate"].strip())
                if trade_date > latest:
                    raise ValueError("Pregão posterior à data esperada ou à coleta.")
                raw_close = row["closeBrl"].strip()
                if not PRICE.fullmatch(raw_close):
                    raise ValueError("Use preço em reais com ponto como separador decimal.")
                close = float(raw_close)
                if not math.isfinite(close) or close <= 0:
                    raise ValueError("O fechamento deve ser positivo e finito.")
                key = (ticker, trade_date)
                if key in seen:
                    raise ValueError(f"Pregão duplicado para {ticker}.")
                seen.add(key)
                previous = quotes.get(ticker)
                if previous is None or row["tradeDate"].strip() > previous["tradeDate"]:
                    quotes[ticker] = make_quote(ticker, trade_date, close, source, retrieved_at)
            except ValueError as error:
                raise ValueError(f"Linha {rows.line_num}. {error}") from error
    if not quotes:
        raise ValueError("O CSV não contém fechamentos.")
    return quotes


def read_previous(path: Path, source: dict, expected: date) -> dict[str, dict]:
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or payload.get("schemaVersion") != VERSION:
        raise ValueError("Versão inválida no snapshot anterior.")
    if payload.get("source") != source:
        raise ValueError("Use um destino separado para dados de outra fonte.")
    previous_expected = market_date(payload["expectedTradeDate"])
    if expected < previous_expected:
        raise ValueError("A data do pregão esperado não pode regredir.")

    rows = payload["quotes"]
    if not isinstance(rows, list) or not rows:
        raise ValueError("O snapshot anterior não tem fechamentos válidos.")
    quotes = {}
    for row in rows:
        ticker = row["ticker"]
        trade_date = market_date(row["tradeDate"])
        close = row["close"]
        collected = datetime.fromisoformat(row["provenance"]["retrievedAt"])
        if (
            not TICKER.fullmatch(ticker)
            or ticker in quotes
            or trade_date > previous_expected
            or type(close) not in (int, float)
            or not math.isfinite(close)
            or close <= 0
            or collected.tzinfo is None
            or trade_date > collected.astimezone(SAO_PAULO).date()
            or row != make_quote(ticker, trade_date, close, source["name"], collected)
        ):
            raise ValueError("Fechamento inválido no snapshot anterior.")
        quotes[ticker] = row
    return quotes


def merge_closes(previous: dict[str, dict], incoming: dict[str, dict]) -> list[dict]:
    for ticker, quote in incoming.items():
        current = previous.get(ticker)
        if current is None or quote["tradeDate"] > current["tradeDate"]:
            previous[ticker] = quote
        elif quote["tradeDate"] == current["tradeDate"]:
            collected = datetime.fromisoformat(quote["provenance"]["retrievedAt"])
            collected_before = datetime.fromisoformat(current["provenance"]["retrievedAt"])
            if collected == collected_before and quote["close"] != current["close"]:
                raise ValueError(f"Correção sem nova data de coleta para {ticker}.")
            if collected > collected_before:
                previous[ticker] = quote
    return [previous[ticker] for ticker in sorted(previous)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--source-name", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--expected-trade-date", required=True)
    parser.add_argument("--output", type=Path, default=PROCESSED / "market-closes.json")
    args = parser.parse_args()

    try:
        expected = market_date(args.expected_trade_date)
        if expected > datetime.now(SAO_PAULO).date():
            raise ValueError("O pregão esperado ainda não chegou.")
        source_name = args.source_name.strip()
        source_url = args.source_url.strip()
        address = urlsplit(source_url)
        hostname = address.hostname
        if (
            not source_name
            or address.scheme != "https"
            or not hostname
            or any(character.isspace() or character in "\\%<>^|" for character in hostname)
            or address.username is not None
            or address.password is not None
        ):
            raise ValueError("Informe o nome da fonte e seu endereço HTTPS sem credenciais.")
        # A leitura da porta também rejeita valores inválidos em urlsplit.
        _ = address.port

        supplied = Path(os.path.abspath(args.output))
        output = supplied.resolve()
        if any(
            path.is_relative_to(REPO) and not path.is_relative_to(PROCESSED)
            for path in (supplied, output)
        ):
            raise ValueError("A saída dentro do repositório deve ficar em data/processed/market-closes.")
        if output == args.input.resolve():
            raise ValueError("Use caminhos diferentes para o CSV de origem e o snapshot.")

        source = {"name": source_name, "url": source_url, "redistributionBasis": None}
        incoming = read_closes(args.input, source_name, expected)
        output.parent.mkdir(parents=True, exist_ok=True)
        lock_path = output.with_name(output.name + ".lock")
        with lock_path.open("a", encoding="utf-8") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            previous = read_previous(output, source, expected)
            quotes = merge_closes(previous, incoming)
            snapshot = {
                "schemaVersion": VERSION,
                "expectedTradeDate": expected.isoformat(),
                "source": source,
                "quotes": quotes,
            }
            wrote = write_snapshot(output, snapshot)
    except (KeyError, OSError, OverflowError, TypeError, ValueError, csv.Error) as error:
        print(f"Lote rejeitado. Snapshot anterior preservado. {error}", file=sys.stderr)
        return 1

    state = "Snapshot atualizado" if wrote else "Snapshot atual preservado"
    print(f"{state}. {len(quotes)} fechamentos em {output}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
