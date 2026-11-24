"""Testes isolados de capitalização e rendimentos em decimal."""

import sys
import unittest
from dataclasses import replace
from datetime import date
from decimal import Decimal
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "packages/finance-core/src"))

from moat_finance import (  # noqa: E402
    ShareClassClose,
    earnings_yield,
    enterprise_value,
    market_capitalization,
    operating_yield,
    spread_to_cdi,
)


D = Decimal


class PriceEngineTests(unittest.TestCase):
    trade_date = date(2026, 11, 17)

    def setUp(self):
        self.common = ShareClassClose("ON", self.trade_date, D("20.50"), 1_000_000)
        self.preferred = ShareClassClose("PN", self.trade_date, D("25.00"), 500_000)

    def market_cap(self, classes, expected=("ON", "PN")):
        return market_capitalization(classes, expected_classes=expected, trade_date=self.trade_date)

    def test_values_each_share_class_at_its_own_close(self):
        self.assertEqual(self.market_cap([self.common, self.preferred]), D("33000000"))

    def test_requires_complete_nonduplicated_class_coverage_on_the_same_date(self):
        examples = (
            [self.common],
            [self.common, self.common, self.preferred],
            [self.common, self.preferred, replace(self.preferred, class_id="UNIT")],
            [self.common, replace(self.preferred, trade_date=date(2026, 11, 16))],
        )
        for entries in examples:
            with self.subTest(entries=entries):
                self.assertIsNone(self.market_cap(entries))
        self.assertIsNone(self.market_cap([self.common, self.preferred], expected=("ON", "ON", "PN")))

    def test_invalid_or_missing_class_amounts_are_not_treated_as_zero(self):
        for invalid in (
            replace(self.preferred, close_brl=None),
            replace(self.preferred, close_brl=D(0)),
            replace(self.preferred, close_brl=D("NaN")),
            replace(self.preferred, shares_on_trade_date=None),
            replace(self.preferred, shares_on_trade_date=0),
        ):
            with self.subTest(invalid=invalid):
                self.assertIsNone(self.market_cap([self.common, invalid]))

    def test_requires_explicit_ev_components_and_a_positive_denominator(self):
        self.assertEqual(
            enterprise_value(market_cap_brl=D(200), net_debt_brl=D(-40), adjustments_brl=D(10)),
            D(170),
        )
        self.assertIsNone(
            enterprise_value(market_cap_brl=D(200), net_debt_brl=D(-20), adjustments_brl=None)
        )
        self.assertIsNone(
            enterprise_value(market_cap_brl=D(200), net_debt_brl=D(-200), adjustments_brl=D(0))
        )

    def test_yields_preserve_zero_profit_and_losses(self):
        self.assertEqual(earnings_yield(parent_net_income_ttm_brl=D(-12), market_cap_brl=D(100)), D("-.12"))
        self.assertEqual(operating_yield(nopat_ttm_brl=D(0), enterprise_value_brl=D(100)), D(0))
        self.assertIsNone(earnings_yield(parent_net_income_ttm_brl=None, market_cap_brl=D(100)))
        self.assertIsNone(operating_yield(nopat_ttm_brl=D(20), enterprise_value_brl=D(-1)))

    def test_current_cdi_comparison_uses_percentage_points(self):
        self.assertEqual(spread_to_cdi(D("0.10"), D("0.1365")), D("-3.65"))
        self.assertIsNone(spread_to_cdi(D("0.10"), None))
        self.assertIsNone(spread_to_cdi(D("0.10"), D("-1")))
