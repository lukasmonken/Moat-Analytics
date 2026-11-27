import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from datetime import date, datetime, time
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

PIPELINE = Path(__file__).resolve().parents[2] / "apps/pipeline"
sys.path.insert(0, str(PIPELINE))

import run_market_history
from src.moat_market_calendar import SAO_PAULO
from src.moat_market_history import (
    SOURCE, ProviderError, adjusted_close_series, brapi_history_reader, collect_market_history,
)

TRADE_DATE = date(2026, 11, 26)
UNIVERSE = {
    "asOf": "2026-11-18",
    "companies": [
        {"companyId": "cvm:9512", "name": "EMPRESA A", "tickers": ["TEST4", "TEST3"]},
        {"companyId": "cvm:10001", "name": "EMPRESA B", "tickers": ["TEST5"]},
        {"companyId": "cvm:10002", "name": "EMPRESA C", "tickers": []},
    ],
}


def result(ticker, *points):
    return {
        "requestedSymbol": ticker,
        "symbol": ticker,
        "changed": False,
        "data": {
            "usedInterval": "1d",
            "historicalDataPrice": [
                {
                    "date": int(datetime.combine(date.fromisoformat(day), time(), SAO_PAULO).timestamp()),
                    "close": 12345,
                    "adjustedClose": level,
                }
                for day, level in points
            ],
        },
    }


def asset(name, ticker, *points):
    return {
        "company": name, "instrument": ticker,
        "observations": [{"date": day, "level": level} for day, level in points],
    }


def snapshot(*assets, as_of="2026-11-25"):
    return {
        "schemaVersion": "1.0.0", "frequency": "daily", "basis": "total-return-brl",
        "asOf": as_of, "source": {**SOURCE, "retrievedAt": "2026-11-26T01:00:00+00:00"},
        "assets": list(assets),
    }


class BrapiHistoryTests(unittest.TestCase):
    def test_fetch_uses_documented_v2_shape_and_bearer_header(self):
        response = result("PETR4", ("2026-11-26", 15.0))
        with patch("src.moat_market_history.build_opener") as build:
            open_request = build.return_value.open
            open_request.return_value = io.BytesIO(json.dumps({"results": [response]}).encode())
            read = brapi_history_reader("test-secret-value")
            self.assertEqual(read("PETR4", {"range": "7d", "endDate": "2026-11-26"}), response)
        request = open_request.call_args.args[0]
        url = urlsplit(request.full_url)
        self.assertEqual((url.scheme, url.netloc, url.path), ("https", "brapi.dev", "/api/v2/stocks/historical"))
        self.assertEqual(parse_qs(url.query), {
            "symbols": ["PETR4"], "range": ["7d"], "interval": ["1d"],
            "sortOrder": ["asc"], "endDate": ["2026-11-26"],
        })
        self.assertEqual(request.get_header("Authorization"), "Bearer test-secret-value")

    def test_auth_and_quota_errors_are_fatal_and_body_is_omitted(self):
        with patch("src.moat_market_history.build_opener") as build:
            read = brapi_history_reader("test-secret-value")
            for status in (400, 401, 403, 429, 500, 302, 404):
                with self.subTest(status=status):
                    build.return_value.open.side_effect = HTTPError(
                        "https://brapi.dev", status, "test-secret-value", None, io.BytesIO(b"test-secret-value"),
                    )
                    if status == 404:
                        self.assertIsNone(read("TEST3", {"range": "3mo"}))
                    else:
                        with self.assertRaisesRegex(ProviderError, rf"^A brapi retornou HTTP {status}\.$"):
                            read("TEST3", {"range": "3mo"})

    def test_unauthenticated_reader_restricts_calls_to_documented_demo_tickers(self):
        with patch("src.moat_market_history.build_opener") as build:
            read = brapi_history_reader("")
            with self.assertRaises(ValueError):
                read("TEST3", {"range": "7d"})
            build.return_value.open.assert_not_called()
            build.return_value.open.return_value = io.BytesIO(b'{"results":[]}')
            self.assertIsNone(read("PETR4", {"range": "7d"}))
            self.assertIsNone(build.return_value.open.call_args.args[0].get_header("Authorization"))

    def test_success_status_with_provider_error_payload_is_fatal(self):
        with patch("src.moat_market_history.build_opener") as build:
            build.return_value.open.return_value = io.BytesIO(b'{"error":true,"results":[]}')
            with self.assertRaises(ProviderError):
                brapi_history_reader("test-secret-value")("TEST3", {"range": "7d"})

    def test_only_positive_daily_adjusted_closes_on_valid_dates_are_used(self):
        series = result(
            "TEST3", ("2026-11-26", 12), ("2026-11-20", 44), ("2026-11-23", None),
            ("2026-11-24", 10), ("2026-11-25", True), ("2026-11-21", 50),
        )
        self.assertEqual(adjusted_close_series(series, "TEST3", TRADE_DATE), [
            {"date": "2026-11-24", "level": 10}, {"date": "2026-11-26", "level": 12},
        ])
        for bad_series in (
            {**series, "symbol": "TEST4", "changed": True},
            {**series, "requestedSymbol": "TEST4"},
            {**series, "data": {**series["data"], "usedInterval": "1wk"}},
            result("TEST3", ("2026-11-26", 12), ("2026-11-26", 12)),
            result("TEST3", ("2026-11-26", 12), ("2026-11-27", 13)),
        ):
            with self.subTest(bad_series=bad_series):
                self.assertEqual(adjusted_close_series(bad_series, "TEST3", TRADE_DATE), [])


class MarketHistoryTests(unittest.TestCase):
    def test_seed_uses_configured_range_and_chooses_first_valid_current_ticker(self):
        read = Mock(side_effect=[
            result("TEST4", ("2026-11-25", 23)),
            result("TEST3", ("2026-11-25", 10), ("2026-11-26", 12)),
            None,
        ])
        history = collect_market_history(UNIVERSE, TRADE_DATE, read, history_range="5y")
        self.assertEqual(history["asOf"], "2026-11-26")
        self.assertEqual(history["frequency"], "daily")
        self.assertEqual(history["basis"], "total-return-brl")
        self.assertEqual(history["assets"], [asset("EMPRESA A", "TEST3", ("2026-11-25", 10), ("2026-11-26", 12))])
        self.assertEqual([call.args for call in read.call_args_list], [
            (ticker, {"range": "5y", "endDate": "2026-11-26"}) for ticker in ("TEST4", "TEST3", "TEST5")
        ])

    def test_incremental_rebases_shared_ticker_and_preserves_unavailable_company(self):
        unavailable = asset("EMPRESA B", "TEST5", ("2026-11-19", 40), ("2026-11-25", 41))
        previous = snapshot(
            asset("EMPRESA A", "TEST3", ("2026-11-10", 22), ("2026-11-24", 24), ("2026-11-25", 28)),
            unavailable,
        )
        read = Mock(side_effect=[result("TEST3", ("2026-11-24", 12), ("2026-11-25", 14), ("2026-11-26", 15)), None])
        history = collect_market_history(UNIVERSE, TRADE_DATE, read, previous=previous)
        self.assertEqual(history["assets"], [
            asset("EMPRESA A", "TEST3", ("2026-11-10", 11), ("2026-11-24", 12), ("2026-11-25", 14), ("2026-11-26", 15)),
            unavailable,
        ])
        self.assertEqual([call.args for call in read.call_args_list], [
            ("TEST3", {"range": "7d", "endDate": "2026-11-26"}),
            ("TEST5", {"startDate": "2026-11-19", "endDate": "2026-11-26"}),
        ])

    def test_inconsistent_missing_and_single_point_overlap_leave_previous_company_intact(self):
        old = asset("EMPRESA A", "TEST3", ("2026-11-23", 22), ("2026-11-24", 24), ("2026-11-25", 28))
        previous = snapshot(old)
        for points in (
            (("2026-11-24", 12), ("2026-11-25", 15)),
            (("2026-11-23", 11), ("2026-11-24", 12)),
            (("2026-11-25", 14),),
            (("2026-11-23", 11), ("2026-11-24", None), ("2026-11-25", 14)),
        ):
            with self.subTest(points=points):
                read = Mock(side_effect=[
                    result("TEST3", *points, ("2026-11-26", 16)),
                    result("TEST5", ("2026-11-26", 18)),
                ])
                history = collect_market_history(UNIVERSE, TRADE_DATE, read, previous=previous)
                self.assertEqual(history["assets"], [old, asset("EMPRESA B", "TEST5", ("2026-11-26", 18))])

    def test_first_single_close_can_be_replaced_by_a_complete_series_without_rebasing(self):
        previous = snapshot(asset("EMPRESA A", "TEST3", ("2026-11-25", 24)))
        read = Mock(side_effect=[result("TEST3", ("2026-11-25", 12), ("2026-11-26", 16)), None])
        history = collect_market_history(UNIVERSE, TRADE_DATE, read, previous=previous)
        self.assertEqual(history["assets"], [asset("EMPRESA A", "TEST3", ("2026-11-25", 12), ("2026-11-26", 16))])

    def test_ticker_removed_from_selection_is_replaced_without_stitching_history(self):
        previous = snapshot(asset("EMPRESA A", "TEST3", ("2026-11-24", 22), ("2026-11-25", 24)))
        universe = {
            **UNIVERSE,
            "companies": [
                {**UNIVERSE["companies"][0], "tickers": ["TEST4"]},
                *UNIVERSE["companies"][1:],
            ],
        }
        new_series = result("TEST4", ("2026-11-25", 40), ("2026-11-26", 42))
        read = Mock(side_effect=[new_series, None])

        history = collect_market_history(universe, TRADE_DATE, read, previous=previous)

        self.assertEqual(history["assets"], [
            asset("EMPRESA A", "TEST4", ("2026-11-25", 40), ("2026-11-26", 42)),
        ])
        self.assertEqual(read.call_args_list[0].args, (
            "TEST4", {"range": "3mo", "endDate": "2026-11-26"},
        ))

    def test_missing_expected_session_and_incompatible_cache_fail_before_publication(self):
        previous = snapshot(asset("EMPRESA A", "TEST3", ("2026-11-25", 24)))
        read = Mock(side_effect=[result("TEST3", ("2026-11-25", 24)), None])
        with self.assertRaisesRegex(ValueError, "pregão esperado"):
            collect_market_history(UNIVERSE, TRADE_DATE, read, previous=previous)

        read.reset_mock()
        with self.assertRaisesRegex(ValueError, "origem incompatível"):
            collect_market_history(UNIVERSE, TRADE_DATE, read, previous={**previous, "frequency": "monthly"})
        read.assert_not_called()

    def test_fatal_provider_error_does_not_replace_previous_on_disk(self):
        previous = snapshot(asset("EMPRESA A", "TEST3", ("2026-11-24", 22), ("2026-11-25", 24)))
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "latest.json"
            original = json.dumps(previous)
            output.write_text(original, encoding="utf-8")
            read = Mock(side_effect=[
                result("TEST3", ("2026-11-24", 22), ("2026-11-25", 24), ("2026-11-26", 25)),
                ProviderError("A brapi retornou HTTP 401."),
            ])
            stderr = io.StringIO()
            with (
                patch.object(sys, "argv", ["run_market_history.py", "--output", str(output)]),
                patch.object(run_market_history, "completed_b3_trade_date", return_value=TRADE_DATE),
                patch.object(run_market_history, "brapi_history_reader", return_value=read),
                patch.dict(os.environ, {
                    "BRAPI_TOKEN": "test-secret-value", "MOAT_MARKET_CAP_UNIVERSE": json.dumps(UNIVERSE),
                }),
                contextlib.redirect_stderr(stderr),
            ):
                self.assertEqual(run_market_history.main(), 1)
            self.assertEqual(output.read_text(encoding="utf-8"), original)
            self.assertEqual(read.call_count, 2)
            self.assertIn("HTTP 401", stderr.getvalue())
            self.assertNotIn("test-secret-value", stderr.getvalue())
            self.assertNotIn("EMPRESA A", stderr.getvalue())

    def test_cli_writes_new_snapshot_from_explicit_private_inputs(self):
        old = asset("EMPRESA A", "TEST3", ("2026-11-24", 22), ("2026-11-25", 24))
        with tempfile.TemporaryDirectory() as tmp:
            previous, universe, output = (Path(tmp) / name for name in ("prior.json", "universe.json", "latest.json"))
            previous.write_text(json.dumps(snapshot(old)), encoding="utf-8")
            universe.write_text(json.dumps(UNIVERSE), encoding="utf-8")
            read = Mock(side_effect=[
                result("TEST3", ("2026-11-24", 22), ("2026-11-25", 24), ("2026-11-26", 25)), None,
            ])
            with (
                patch.object(sys, "argv", [
                    "run_market_history.py", "--previous", str(previous), "--universe", str(universe),
                    "--output", str(output),
                ]),
                patch.object(run_market_history, "completed_b3_trade_date", return_value=TRADE_DATE),
                patch.object(run_market_history, "brapi_history_reader", return_value=read),
                patch.dict(os.environ, {
                    "BRAPI_TOKEN": "test-secret-value", "MOAT_MARKET_CAP_UNIVERSE": "ignored",
                }),
                contextlib.redirect_stdout(io.StringIO()),
            ):
                self.assertEqual(run_market_history.main(), 0)
            data = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(data["asOf"], "2026-11-26")
            self.assertEqual(data["assets"][0]["observations"][-1], {"date": "2026-11-26", "level": 25})
            self.assertEqual(json.loads(previous.read_text(encoding="utf-8")), snapshot(old))


if __name__ == "__main__":
    unittest.main()
