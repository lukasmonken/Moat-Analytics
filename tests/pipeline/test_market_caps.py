import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch

PIPELINE = Path(__file__).resolve().parents[2] / "apps/pipeline"
sys.path.insert(0, str(PIPELINE))

import run_market_caps
from src.moat_market_caps import closing_cap, collect_market_caps

TRADE_DATE = date(2026, 11, 25)
UNIVERSE = {
    "asOf": "2026-11-18",
    "companies": [
        {"companyId": "cvm:9512", "name": "EMPRESA A", "tickers": ["TEST3", "TEST4"]},
        {"companyId": "cvm:10001", "name": "EMPRESA B", "tickers": []},
    ],
}


def quote(ticker="TEST3", *, day=TRADE_DATE):
    return {
        "symbol": ticker,
        "currency": "BRL",
        "marketCap": 500_000_000,
        "regularMarketPrice": 12.30,
        "regularMarketVolume": 10_000,
        "regularMarketTime": "2026-11-26T03:11:17+00:00",
        "usedInterval": "1d",
        "historicalDataPrice": [{
            "date": int(datetime.fromisoformat(f"{day}T03:00:00+00:00").timestamp()),
            "close": 12.30,
            "volume": 10_000,
        }],
    }


class MarketCapTests(unittest.TestCase):
    def test_uses_trade_date_from_daily_close_even_if_provider_updates_after_midnight(self):
        observation, reason = closing_cap(quote(), "TEST3", TRADE_DATE)
        self.assertEqual(observation["marketCapBrl"], 500_000_000)
        self.assertEqual(observation["quoteUpdatedAt"], "2026-11-26T03:11:17+00:00")
        self.assertEqual(reason, "")

    def test_rejects_stale_and_incompatible_observations(self):
        for payload in (
            quote(day=date(2026, 11, 24)),
            quote("WRNG3"),
            {**quote(), "marketCap": 0},
            {**quote(), "marketCap": True},
            {**quote(), "regularMarketPrice": 12.1},
            {**quote(), "regularMarketVolume": 9_000},
            {**quote(), "currency": "USD"},
        ):
            with self.subTest(payload=payload):
                observation, reason = closing_cap(payload, "TEST3", TRADE_DATE)
                self.assertIsNone(observation)
                self.assertTrue(reason)

    def test_returns_one_value_per_company_and_keeps_missing_company(self):
        fetched = []

        def read(ticker):
            fetched.append(ticker)
            return quote(ticker) if ticker == "TEST4" else None

        snapshot = collect_market_caps(UNIVERSE, TRADE_DATE, read)
        self.assertEqual(fetched, ["TEST3", "TEST4"])
        self.assertEqual(snapshot["manifest"]["coverage"], {
            "includedCompanies": 2, "availableCompanies": 1,
            "comparedCompanies": 0, "disagreeingCompanies": 0,
        })
        self.assertEqual(snapshot["companies"][0]["ticker"], "TEST4")
        self.assertEqual(snapshot["companies"][0]["marketCapBrl"], 500_000_000)
        self.assertIsNone(snapshot["companies"][1]["marketCapBrl"])
        self.assertEqual(snapshot["companies"][1]["qualityStatus"], "unavailable")

    def test_only_uses_one_estimate_when_tickers_agree_and_withholds_divergence(self):
        for alternate_cap in (500_000_000, 490_000_000):
            with self.subTest(alternate_cap=alternate_cap):
                def read(ticker):
                    payload = quote(ticker)
                    if ticker == "TEST4":
                        payload["marketCap"] = alternate_cap
                    return payload

                snapshot = collect_market_caps(UNIVERSE, TRADE_DATE, read)
                issuer = snapshot["companies"][0]
                coverage = snapshot["manifest"]["coverage"]
                self.assertEqual(coverage["comparedCompanies"], 1)
                self.assertEqual(
                    [entry["marketCapBrl"] for entry in issuer["candidateQuotes"]],
                    [500_000_000, alternate_cap],
                )
                if alternate_cap == 500_000_000:
                    self.assertEqual(issuer["marketCapBrl"], 500_000_000)
                    self.assertEqual(issuer["ticker"], "TEST3")
                    self.assertEqual(issuer["qualityStatus"], "estimated")
                    self.assertIsNone(issuer["reason"])
                    self.assertEqual(coverage["disagreeingCompanies"], 0)
                else:
                    self.assertIsNone(issuer["marketCapBrl"])
                    self.assertIsNone(issuer["ticker"])
                    self.assertIn("divergentes", issuer["reason"])
                    self.assertEqual(coverage["disagreeingCompanies"], 1)

    def test_failed_run_preserves_previous_data_and_logs_no_secrets(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "latest.json"
            output.write_text("lote anterior", encoding="utf-8")
            stderr = io.StringIO()
            with (
                patch.object(sys, "argv", ["run_market_caps.py", "--output", str(output)]),
                patch.object(run_market_caps, "completed_b3_trade_date", return_value=TRADE_DATE),
                patch.object(run_market_caps, "brapi_quote_reader", return_value=lambda _: None),
                patch.dict(os.environ, {"BRAPI_TOKEN": "segredo", "MOAT_MARKET_CAP_UNIVERSE": json.dumps(UNIVERSE)}),
                contextlib.redirect_stderr(stderr),
            ):
                self.assertEqual(run_market_caps.main(), 1)
            self.assertEqual(output.read_text(encoding="utf-8"), "lote anterior")
            self.assertNotIn("segredo", stderr.getvalue())
            self.assertNotIn("EMPRESA A", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
