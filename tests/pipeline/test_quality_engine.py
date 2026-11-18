"""Fixtures offline das fórmulas contábeis e convenções da série."""

import sys
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "packages/finance-core/src"))

from moat_finance import (  # noqa: E402
    PeerHistory,
    PeerObservation,
    QualityPoint,
    calculate_roe,
    calculate_roic,
    invested_capital,
    rank_quality,
    spread_to_10y,
    summarize_quality,
)


D = Decimal


class QualityEngineTests(unittest.TestCase):
    def test_roic_uses_nopat_and_average_book_capital(self):
        opening = invested_capital(equity=D(110), debt=D(30), excess_cash=D(40))
        closing = invested_capital(equity=D(150), debt=D(60), excess_cash=D(10))
        result = calculate_roic(
            ebit=D(100),
            tax_rate=D("0.34"),
            capital_open=opening,
            capital_close=closing,
            estimated=True,
        )
        self.assertEqual(opening, D(100))
        self.assertEqual(closing, D(200))
        self.assertEqual(result.numerator, D(66))
        self.assertEqual(result.denominator, D(150))
        self.assertEqual(result.value, D("0.44"))
        self.assertEqual(result.quality_status, "estimated")

    def test_bank_manual_fixture_uses_parent_equity_after_restatement(self):
        # Itaú 2023, DFP mais recente. Valores em R$ milhões, sem participação minoritária.
        # A abertura na coluna comparativa é 177.107 - 9.390.
        result = calculate_roe(net_income=D(33105), equity_open=D(167717), equity_close=D(190177))
        self.assertEqual(result.denominator, D(178947))
        self.assertAlmostEqual(result.value, D("0.184998910292"), places=12)
        self.assertEqual(result.quality_status, "validated")

    def test_retains_losses_and_zero_profit(self):
        for profit, expected in (("-10", "-0.1"), ("0", "0")):
            with self.subTest(profit=profit):
                result = calculate_roe(net_income=D(profit), equity_open=D(100), equity_close=D(100))
                self.assertEqual(result.value, D(expected))

    def test_rejects_incomplete_nonfinite_or_nonpositive_inputs(self):
        self.assertIsNone(invested_capital(equity=D(50), debt=D(0), excess_cash=None))
        self.assertIsNone(invested_capital(equity=D(50), debt=D(-1), excess_cash=D(0)))

        for opening in (None, D(0), D(-1), D("NaN")):
            with self.subTest(opening=opening):
                result = calculate_roe(net_income=D(20), equity_open=opening, equity_close=D(100))
                self.assertIsNone(result.value)
                self.assertEqual(result.quality_status, "unavailable")
                self.assertTrue(result.reasons)

        for tax_rate in (None, D("1.01"), D("-0.01"), D("Infinity")):
            with self.subTest(tax_rate=tax_rate):
                result = calculate_roic(
                    ebit=D(20), tax_rate=tax_rate, capital_open=D(100), capital_close=D(110)
                )
                self.assertIsNone(result.value)
                self.assertTrue(result.reasons)

        self.assertIsNone(
            calculate_roe(
                net_income=D(10),
                equity_open=D(100),
                equity_close=D(100),
                comparable_period=False,
            ).value
        )

    def test_spread_requires_the_same_historical_reference(self):
        end = date(2025, 12, 31)
        self.assertEqual(spread_to_10y(D("0.15"), end, D("0.12"), "2025-12-31"), D(3))
        self.assertIsNone(spread_to_10y(D("0.15"), end, D("0.12"), "2026-12-31"))
        self.assertIsNone(spread_to_10y(D("0.15"), end, None, None))
        self.assertIsNone(spread_to_10y(D("0.15"), "2025-99-99", D("0.12"), "2025-99-99"))

    def test_empty_spread_is_unavailable_and_deltas_do_not_cross_gaps(self):
        summary = summarize_quality(
            [QualityPoint(2025, D("0.20")), QualityPoint(2022, None), QualityPoint(2021, D("0.10"))]
        )
        self.assertEqual(summary.valid_years, 2)
        self.assertEqual(summary.mean, D("0.15"))
        self.assertEqual(summary.median, D("0.15"))
        self.assertEqual(summary.population_stddev, D("0.05"))
        self.assertEqual(summary.amplitude, D("0.10"))
        self.assertEqual(summary.trend_pp_per_year, D("2.5"))
        self.assertEqual(summary.annual_deltas_pp, {2021: None, 2022: None, 2025: None})
        self.assertIsNone(summary.positive_spread_years)
        self.assertIsNone(summary.longest_positive_spread_streak)
        self.assertIsNone(summary.five_consecutive_positive_spreads)

    def test_spread_counts_and_run_use_adjacent_exercises(self):
        summary = summarize_quality(
            [
                QualityPoint(2020, D("0.15"), D(1)),
                QualityPoint(2021, D("0.10"), D(-1)),
                QualityPoint(2022, D("0.14"), D(2)),
                QualityPoint(2024, D("0.14"), D(2)),
                QualityPoint(2025, D("0.18"), D(3)),
                QualityPoint(2026, D("0.18")),
            ]
        )
        self.assertEqual(summary.spread_years, 5)
        self.assertEqual(summary.positive_spread_years, 4)
        self.assertEqual(summary.longest_positive_spread_streak, 2)
        self.assertIsNone(summary.latest_positive_spread_streak)
        self.assertEqual(summary.annual_deltas_pp[2025], D(4))
        self.assertIsNone(summary.five_consecutive_positive_spreads)

    def test_rejects_duplicate_fiscal_years(self):
        with self.assertRaises(ValueError):
            summarize_quality([QualityPoint(2025, None), QualityPoint(2025, D("0.1"))])


class PeerRankingTests(unittest.TestCase):
    dates = tuple(date(year, 12, 31) for year in range(2021, 2026))

    def peer(self, company_id, profits, spread, *, estimated=False, segment="bancos"):
        series = tuple(
            PeerObservation(
                end,
                calculate_roe(
                    net_income=D(profit), equity_open=D(100), equity_close=D(100),
                    estimated=estimated,
                ),
                D(spread) if spread is not None else None,
            )
            for end, profit in zip(self.dates, profits)
        )
        return PeerHistory(company_id, "roe", segment, series)

    def test_uses_pooled_ties_and_rewards_lower_dispersion(self):
        peers = [
            self.peer("a", [20] * 5, 10),
            self.peer("b", [18] * 5, 8),
            self.peer("c", [12, 20, 16, 12, 20], 6),
            self.peer("d", [10] * 5, 1),
            self.peer("e", [10] * 5, 1),
        ]
        ranks = rank_quality(peers, metric="roe", segment="bancos", fiscal_dates=self.dates)
        self.assertEqual([row.company_id for row in ranks], ["a", "b", "c", "d", "e"])
        self.assertEqual([row.position for row in ranks], [1, 2, 3, 4, 4])
        self.assertEqual(ranks[0].return_percentile, D(100))
        self.assertEqual(ranks[2].stability_percentile, D(0))
        self.assertEqual(ranks[3].return_percentile, D("12.5"))
        self.assertEqual(ranks[3].quality_score, ranks[4].quality_score)

    def test_requires_five_valid_peers_with_a_common_complete_history(self):
        peers = [self.peer(str(index), [10] * 5, 3) for index in range(4)]
        peers.extend(
            [
                self.peer("sem-curva", [10] * 5, None),
                self.peer("estimativa", [10] * 5, 3, estimated=True),
                self.peer("poucos-anos", [10] * 4, 3),
                self.peer("outro-setor", [10] * 5, 3, segment="varejo"),
            ]
        )
        self.assertIsNone(
            rank_quality(peers, metric="roe", segment="bancos", fiscal_dates=self.dates)
        )
        self.assertIsNone(
            rank_quality(peers, metric="roe", segment="bancos", fiscal_dates=self.dates[:4])
        )
