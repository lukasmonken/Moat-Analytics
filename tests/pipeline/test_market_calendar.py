"""Confere a data de pregão e o horário da coleta em São Paulo."""

import sys
import unittest
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps/pipeline"))

from src.moat_market_calendar import completed_b3_trade_date


class MarketCalendarTests(unittest.TestCase):
    def test_waits_for_the_collection_window(self):
        with self.assertRaisesRegex(ValueError, "20h20"):
            completed_b3_trade_date(datetime.fromisoformat("2026-11-26T23:19:59+00:00"))
        self.assertEqual(
            completed_b3_trade_date(datetime.fromisoformat("2026-11-26T23:20:00+00:00")),
            date(2026, 11, 26),
        )

    def test_uses_sao_paulo_date_after_utc_midnight(self):
        self.assertEqual(
            completed_b3_trade_date(datetime.fromisoformat("2027-01-05T00:05:00+00:00")),
            date(2027, 1, 4),
        )

    def test_skips_weekends_and_market_holidays(self):
        for day in ("2026-11-28", "2026-12-24", "2026-12-31", "2027-02-09", "2027-11-15"):
            with self.subTest(day=day):
                self.assertIsNone(completed_b3_trade_date(datetime.fromisoformat(f"{day}T12:00:00-03:00")))

    def test_keeps_ash_wednesday_and_local_holidays_as_sessions(self):
        for day in (date(2026, 2, 18), date(2026, 7, 9), date(2027, 1, 25), date(2027, 2, 10)):
            with self.subTest(day=day):
                self.assertEqual(
                    completed_b3_trade_date(datetime.fromisoformat(f"{day}T20:23:00-03:00")),
                    day,
                )

    def test_requires_a_verified_year_and_timezone(self):
        with self.assertRaisesRegex(ValueError, "2028"):
            completed_b3_trade_date(datetime.fromisoformat("2028-01-03T20:23:00-03:00"))
        with self.assertRaisesRegex(ValueError, "fuso"):
            completed_b3_trade_date(datetime.fromisoformat("2026-11-26T20:23:00"))
