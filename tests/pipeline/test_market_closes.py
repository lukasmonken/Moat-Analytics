"""Verifica a importação local e a preservação do último fechamento válido."""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "apps/pipeline/run_market_closes.py"


class MarketCloseImportTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.csv = Path(temp.name) / "closes.csv"
        self.snapshot = Path(temp.name) / "market-closes.json"

    def source_csv(self, rows, collected="2025-12-15T19:00:00+00:00"):
        self.csv.write_text("ticker,tradeDate,closeBrl\n" + rows, encoding="utf-8")
        timestamp = datetime.fromisoformat(collected).timestamp()
        os.utime(self.csv, (timestamp, timestamp))

    def run_import(self, expected="2025-12-15", **options):
        arguments = {
            "input": self.csv,
            "source-name": "Fonte de teste",
            "source-url": "https://example.com/source",
            "expected-trade-date": expected,
            "output": self.snapshot,
        } | options
        command = [sys.executable, str(SCRIPT)]
        for flag, value in arguments.items():
            command.extend((f"--{flag}", str(value)))
        return subprocess.run(command, capture_output=True, text=True, timeout=10)

    def test_properties_and_fallback_for_a_partial_update(self):
        self.source_csv("TEST3,2025-12-15,23.50\nTEST4,2025-12-12,31\nTEST3,2025-12-12,21\n")
        result = self.run_import()
        self.assertEqual(result.returncode, 0, result.stderr)
        original = json.loads(self.snapshot.read_text())
        self.assertEqual(original["schemaVersion"], "1.0.0")
        self.assertIsNone(original["source"]["redistributionBasis"])
        self.assertEqual(
            original["quotes"][0],
            {
                "ticker": "TEST3",
                "tradeDate": "2025-12-15",
                "close": 23.50,
                "currency": "BRL",
                "provenance": {
                    "source": "Fonte de teste",
                    "referenceDate": "2025-12-15",
                    "publishedAt": None,
                    "retrievedAt": "2025-12-15T19:00:00+00:00",
                    "methodologyVersion": "market-close.v1",
                    "qualityStatus": "validated",
                },
            },
        )

        self.source_csv("TEST3,2025-12-16,24.00\n", "2025-12-16T19:00:00+00:00")
        result = self.run_import(expected="2025-12-16")
        self.assertEqual(result.returncode, 0, result.stderr)
        updated = json.loads(self.snapshot.read_text())
        self.assertEqual(updated["expectedTradeDate"], "2025-12-16")
        self.assertEqual(updated["quotes"][0]["close"], 24.0)
        self.assertEqual(updated["quotes"][1], original["quotes"][1])

        modified = self.snapshot.stat().st_mtime_ns
        result = self.run_import(expected="2025-12-16")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.snapshot.stat().st_mtime_ns, modified)

    def test_rejected_rows_preserve_the_previous_bytes(self):
        self.source_csv("TEST3,2025-12-15,23.50\n")
        self.assertEqual(self.run_import().returncode, 0)
        original = self.snapshot.read_bytes()

        for rows in (
            "TEST3,2025-12-15,30\ntest3,2025-12-15,30\n",
            "TEST3,2025-12-16,23.50\n",
            "TEST3,2025-12-15,0\n",
            "TEST3,2025-12-15,23,50\n",
        ):
            with self.subTest(rows=rows):
                self.source_csv(rows)
                result = self.run_import()
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertEqual(self.snapshot.read_bytes(), original)

    def test_latest_read_of_a_session_rejects_a_stale_correction(self):
        for collected, value in (("19:00:00", 20), ("19:10:00", 20), ("19:05:00", 27)):
            self.source_csv(f"TEST3,2025-12-15,{value}\n", f"2025-12-15T{collected}+00:00")
            result = self.run_import()
            self.assertEqual(result.returncode, 0, result.stderr)
        quote = json.loads(self.snapshot.read_text())["quotes"][0]
        self.assertEqual(quote["close"], 20.0)
        self.assertEqual(quote["provenance"]["retrievedAt"], "2025-12-15T19:10:00+00:00")

    def test_rejects_invalid_source_and_repo_output(self):
        self.source_csv("TEST3,2025-12-15,23.50\n")
        for source in ("https://bad host.test", "https://example.com:99999", "http://example.com"):
            with self.subTest(source=source):
                self.assertEqual(self.run_import(**{"source-url": source}).returncode, 1)
                self.assertFalse(self.snapshot.exists())

        denied = REPO / "data/public/market-closes-test.json"
        self.assertFalse(denied.exists())
        result = self.run_import(output=denied)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertFalse(denied.exists())
