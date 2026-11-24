"""Confere a retrospectiva mensal com valores calculados de forma independente."""

import sys
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "packages/finance-core/src"))

from moat_finance import MonthlyTotalReturnPoint, simulate_portfolio  # noqa: E402


D = Decimal


def observation(day, **levels):
    return MonthlyTotalReturnPoint(
        date.fromisoformat(day), {asset: D(level) for asset, level in levels.items()}
    )


class BacktestTests(unittest.TestCase):
    points = (
        observation("2024-01-31", A=100, B=100),
        observation("2024-02-29", A=120, B=80),
        observation("2024-03-28", A=132, B=72),
    )

    def simulate(self, points=None, **overrides):
        parameters = {
            "weights": {"A": D(".5"), "B": D(".5")},
            "initial_brl": D(1000),
            "monthly_contribution_brl": D(100),
            "rebalance": "hold",
            "transaction_cost_rate": D(0),
            "terminal_tax_rate": D(0),
        }
        return simulate_portfolio(
            self.points if points is None else points, **(parameters | overrides)
        )

    def test_fees_follow_initial_purchase_contributions_and_interim_rebalance(self):
        result = self.simulate(
            rebalance="monthly", transaction_cost_rate=D(".01"), terminal_tax_rate=D(".20")
        )
        self.assertIsNotNone(result)
        # Compra inicial: R$ 10. O primeiro aporte compra R$ 99 e o
        # rebalanceamento de R$ 198 cobra R$ 1,98. No último mês só há aporte.
        self.assertEqual(result.costs_brl, D("13.98"))
        self.assertEqual([point.value_brl for point in result.points], [
            D("990"), D("1087.02"), D("1186.02"),
        ])
        self.assertEqual([point.contributed_brl for point in result.points], [
            D(0), D(100), D(200),
        ])
        self.assertEqual(result.profit_brl, D("-13.98"))
        self.assertEqual(result.tax_brl, D(0))
        self.assertEqual(result.final_value_brl, result.terminal_value_brl)
        self.assertEqual(
            [position.final_weight for position in result.positions],
            [D("647.361") / D("1186.02"), D("538.659") / D("1186.02")],
        )

    def test_position_attribution_reconciles_before_tax_and_allocates_actual_turnover(self):
        history = (
            observation("2024-01-31", A=100, B=100, C=100),
            observation("2024-02-29", A=120, B=80, C=100),
            observation("2024-03-28", A=120, B=80, C=100),
        )
        result = self.simulate(
            history,
            weights={"A": D(".5"), "B": D(".25"), "C": D(".25")},
            rebalance="monthly",
            transaction_cost_rate=D(".01"),
            terminal_tax_rate=D(".20"),
        )
        self.assertIsNotNone(result)
        self.assertEqual([position.asset for position in result.positions], ["A", "B", "C"])
        self.assertEqual(
            [position.market_gain_brl for position in result.positions],
            [D(99), D("-49.5"), D(0)],
        )
        self.assertEqual(
            [position.costs_brl for position in result.positions],
            [D("6.7425"), D("3.61875"), D("3.12375")],
        )
        self.assertEqual(sum(position.costs_brl for position in result.positions), result.costs_brl)
        self.assertEqual(
            sum(position.contribution_brl for position in result.positions),
            result.profit_brl + result.tax_brl,
        )
        self.assertGreater(result.tax_brl, D(0))

    def test_terminal_tax_reduces_net_gain_and_not_unitized_metrics(self):
        gross = self.simulate()
        net = self.simulate(terminal_tax_rate=D(".20"))
        self.assertIsNotNone(gross)
        self.assertIsNotNone(net)
        self.assertEqual(net.initial_brl, D(1000))
        self.assertEqual(net.contributions_brl, D(200))
        self.assertEqual(net.terminal_value_brl, D(1220))
        self.assertEqual(net.tax_brl, D(4))
        self.assertEqual(net.final_value_brl, D(1216))
        self.assertEqual(net.profit_brl, D(16))
        self.assertAlmostEqual(net.total_return, D(20) / D(1100), places=25)
        self.assertEqual(net.points, gross.points)
        self.assertEqual(net.cagr, gross.cagr)
        self.assertEqual(net.annualized_volatility, gross.annualized_volatility)
        self.assertEqual(net.max_drawdown, gross.max_drawdown)

    def test_risk_uses_unitized_monthly_values_without_external_contributions(self):
        history = (
            observation("2024-01-31", A=100),
            observation("2024-02-29", A=80),
            observation("2024-03-28", A=90),
            observation("2024-04-30", A=120),
        )
        result = self.simulate(history, weights={"A": D(1)})
        self.assertIsNotNone(result)
        self.assertEqual(result.points[1].period_return, D("-.20"))
        self.assertEqual(result.points[2].period_return, D(".125"))
        self.assertEqual(result.points[2].drawdown, D(".10"))
        self.assertEqual(result.max_drawdown, D(".20"))
        self.assertAlmostEqual(result.total_return, D(".20"), places=25)
        # CAGR usa os 90 dias entre os pontos extremos e o ano de 365,2425 dias.
        self.assertAlmostEqual(result.cagr, D("1.095739465368650"), places=14)
        self.assertAlmostEqual(result.annualized_volatility, D("0.931098514897561"), places=14)

    def test_two_observations_are_enough_for_return_but_not_for_volatility(self):
        result = self.simulate(self.points[:2])
        self.assertIsNotNone(result)
        self.assertEqual(result.total_return, D(0))
        self.assertEqual(result.points[-1].period_return, D(0))
        self.assertIsNone(result.annualized_volatility)

    def test_rejects_gaps_dates_out_of_order_and_mismatched_series(self):
        for history in (
            [self.points[0]],
            [self.points[0], self.points[2]],
            [self.points[1], self.points[0]],
            [self.points[0], observation("2024-01-30", A=100, B=100)],
            [self.points[0], observation("2024-02-29", A=100)],
            [self.points[0], observation("2024-02-29", A=100, B=100, C=100)],
            [self.points[0], observation("2024-02-29", A=0, B=100)],
            [self.points[0], observation("2024-02-29", A="NaN", B=100)],
        ):
            with self.subTest(history=history):
                self.assertIsNone(self.simulate(history))

    def test_invalid_parameters_and_unusable_net_of_contribution_factor_fail(self):
        for invalid in (
            {"weights": {"A": D(".6"), "B": D(".41")}},
            {"weights": {"A": D(1), "B": D(0)}},
            {"initial_brl": D(0)},
            {"monthly_contribution_brl": D(-1)},
            {"transaction_cost_rate": D(1)},
            {"terminal_tax_rate": D("-0.1")},
            {"rebalance": "unknown"},
            {"monthly_contribution_brl": D(10_000), "transaction_cost_rate": D(".99")},
        ):
            with self.subTest(invalid=invalid):
                self.assertIsNone(self.simulate(**invalid))
