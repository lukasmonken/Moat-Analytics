"""Fixtures manuais dos modelos nominais de valuation e suas entradas-limite."""

import sys
import unittest
from decimal import Decimal
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "packages/finance-core/src"))

from moat_finance import calculate_fcff, value_dcf, value_ddm  # noqa: E402


D = Decimal


class ValuationTests(unittest.TestCase):
    discount = D(".10")
    growth = D(".02")

    def value_dcf(self, flows, **overrides):
        assumptions = {
            "discount_rate": self.discount,
            "terminal_growth": self.growth,
            "net_debt_brl": D(200),
            "equity_adjustments_brl": D(-25),
            "outstanding_shares": 100,
        }
        return value_dcf(flows, **(assumptions | overrides))

    def value_ddm(self, dividends, **overrides):
        assumptions = {
            "discount_rate": self.discount,
            "terminal_growth": self.growth,
            "outstanding_shares": 10,
        }
        return value_ddm(dividends, **(assumptions | overrides))

    def test_dcf_discounts_end_of_year_flows_and_bridges_enterprise_to_equity(self):
        result = self.value_dcf([D(100), D(110)])
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result.cash_flows_pv_brl, D("181.818181818181818"), places=15)
        self.assertEqual(result.terminal_value_brl, D("1402.5"))
        self.assertAlmostEqual(result.terminal_pv_brl, D("1159.090909090909091"), places=15)
        self.assertAlmostEqual(result.enterprise_value_brl, D("1340.909090909090909"), places=15)
        self.assertAlmostEqual(result.equity_value_brl, D("1115.909090909090909"), places=15)
        self.assertAlmostEqual(result.value_per_share_brl, D("11.159090909090909"), places=15)

    def test_ddm_discounts_total_dividends_directly_to_equity(self):
        result = self.value_ddm([D(10), D(11)])
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result.cash_flows_pv_brl, D("18.181818181818182"), places=15)
        self.assertEqual(result.terminal_value_brl, D("140.25"))
        self.assertAlmostEqual(result.terminal_pv_brl, D("115.909090909090909"), places=15)
        self.assertIsNone(result.enterprise_value_brl)
        self.assertAlmostEqual(result.equity_value_brl, D("134.090909090909091"), places=15)
        self.assertAlmostEqual(result.value_per_share_brl, D("13.409090909090909"), places=15)

    def test_dcf_preserves_interim_losses_zero_terminal_flow_and_signed_adjustments(self):
        result = self.value_dcf(
            [D(-110), D(0)],
            net_debt_brl=D(-300),
            equity_adjustments_brl=D(20),
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.terminal_pv_brl, D(0))
        self.assertEqual(result.enterprise_value_brl, D(-100))
        self.assertEqual(result.equity_value_brl, D(220))
        self.assertEqual(result.value_per_share_brl, D("2.20"))

    def test_ddm_allows_zero_dividends_and_negative_growth_above_minus_one(self):
        result = self.value_ddm([D(0), D(12)], terminal_growth=D("-.02"))
        self.assertIsNotNone(result)
        self.assertEqual(result.terminal_value_brl, D(98))
        self.assertEqual(self.value_ddm([D(0)]).value_per_share_brl, D(0))

    def test_incomplete_and_invalid_perpetuities_are_unavailable(self):
        for values in ([], [D(1), D(-1)], [None, D(1)], [D("NaN")], [D("Infinity")]):
            with self.subTest(values=values):
                self.assertIsNone(self.value_dcf(values))
                self.assertIsNone(self.value_ddm(values))
        self.assertIsNone(self.value_ddm([D(-1), D(1)]))
        for rates in (
            {"discount_rate": D(".02")},
            {"discount_rate": D(".01")},
            {"discount_rate": None},
            {"discount_rate": D("NaN")},
            {"discount_rate": D("-1"), "terminal_growth": D("-1.1")},
            {"terminal_growth": D("-1")},
            {"terminal_growth": D("-Infinity")},
        ):
            with self.subTest(rates=rates):
                self.assertIsNone(self.value_dcf([D(1)], **rates))
                self.assertIsNone(self.value_ddm([D(1)], **rates))

    def test_shares_and_dcf_adjustments_must_be_known(self):
        for share_count in (None, False, 0, -1, D("1.5")):
            with self.subTest(share_count=share_count):
                self.assertIsNone(self.value_dcf([D(1)], outstanding_shares=share_count))
                self.assertIsNone(self.value_ddm([D(1)], outstanding_shares=share_count))
        self.assertIsNone(self.value_dcf([D(1)], net_debt_brl=None))
        self.assertIsNone(self.value_dcf([D(1)], equity_adjustments_brl=None))

    def test_fcff_applies_normalized_tax_and_signed_working_capital_change(self):
        assumptions = {
            "ebit_brl": D(100),
            "tax_rate": D(".25"),
            "depreciation_brl": D(12),
            "capex_brl": D(20),
            "working_capital_change_brl": D(-4),
        }
        self.assertEqual(calculate_fcff(**assumptions), D(71))
        self.assertEqual(calculate_fcff(**(assumptions | {"working_capital_change_brl": D(4)})), D(63))
        self.assertIsNone(calculate_fcff(**(assumptions | {"capex_brl": None})))
        self.assertIsNone(calculate_fcff(**(assumptions | {"tax_rate": D("1.25")})))
        self.assertIsNone(calculate_fcff(**(assumptions | {"depreciation_brl": D(-1)})))
