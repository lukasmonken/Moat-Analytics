import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(REPO / 'apps/pipeline'), str(REPO / 'packages/finance-core/src')]

from src.moat_cvm import annual_refresh as refresh

DIRECTORY = {"asOf": "2026-11-18", "companies": ["EMPRESA A", "BANCO B"]}
YEARS = list(range(2021, 2026))
PREVIOUS = {
    name: {"manifest": {"years": YEARS, "archives": []}}
    for name in (refresh.ROE, refresh.ROIC)
}


def snapshot(name, metric, archives, available):
    years = sorted(archives)
    return {
        "manifest": {"years": years},
        "companies": [{
            "name": name,
            "observations": [{
                "year": year,
                metric: 0.10 if year in available else None,
            } for year in years],
        }],
    }


class AnnualRefreshTest(unittest.TestCase):
    def generate(self, upcoming_available: bool):
        base = Path('/armazem')
        filings = {2025, 2026} if upcoming_available else {2025}
        with (
            patch.object(refresh, 'acquire_archive', side_effect=lambda directory, name, *_args, **_kwargs: directory / name) as acquire,
            patch.object(refresh, 'build_refresh_selection', return_value={}),
            patch.object(refresh, 'create_sector_comparison', side_effect=lambda *args: snapshot('BANCO B', 'roe', args[-1], {2025})),
            patch.object(refresh, 'create_sector_roic', side_effect=lambda *args: snapshot('EMPRESA A', 'roic', args[-1], filings)),
            patch.object(refresh, 'create_sector_leverage', side_effect=lambda _sel, _dir, roic, _raw: {'year': roic['manifest']['years'][-1]}),
            patch.object(refresh, 'create_sector_margins', side_effect=lambda _sel, _dir, roic, _raw: {'year': roic['manifest']['years'][-1]}),
            patch.object(refresh, 'create_sector_reinvestment', side_effect=lambda _sel, _dir, roic, _raw: {'year': roic['manifest']['years'][-1]}),
        ):
            snapshots = refresh.refresh_annual_snapshots(
                DIRECTORY, PREVIOUS, base, target_year=2026, offline=False, verified_on='2027-03-02',
            )
        calls = {call.args[1]: call.args[2] for call in acquire.call_args_list}
        self.assertEqual(acquire.call_count, len(calls))
        self.assertEqual(calls['fca_cia_aberta_2026.zip'], refresh.FCA_ORIGIN + 'fca_cia_aberta_2026.zip')
        self.assertEqual(calls['dfp_cia_aberta_2026.zip'], refresh.DFP_ORIGIN + 'dfp_cia_aberta_2026.zip')
        self.assertEqual(set(snapshots), set(refresh.SNAPSHOTS))
        return snapshots, calls

    def test_advances_all_outputs_together_when_the_first_result_is_available(self):
        snapshots, calls = self.generate(upcoming_available=True)
        self.assertNotIn('dfp_cia_aberta_2021.zip', calls)
        self.assertEqual(snapshots[refresh.ROIC]['manifest'], {
            'years': [2022, 2023, 2024, 2025, 2026], 'verifiedOn': '2027-03-02',
        })
        self.assertEqual(snapshots[refresh.ROE]['manifest'], snapshots[refresh.ROIC]['manifest'])
        self.assertTrue(all(snapshots[name]['year'] == 2026 for name in (refresh.LEV, refresh.MARGINS, refresh.REINVESTMENT)))

    def test_keeps_previous_window_when_new_year_has_no_usable_december_results(self):
        snapshots, calls = self.generate(upcoming_available=False)
        self.assertIn('dfp_cia_aberta_2021.zip', calls)
        self.assertEqual(snapshots[refresh.ROIC]['manifest']['years'], YEARS)
        self.assertEqual(snapshots[refresh.ROE]['manifest']['verifiedOn'], '2027-03-02')
        self.assertTrue(all(snapshots[name]['year'] == 2025 for name in (refresh.LEV, refresh.MARGINS, refresh.REINVESTMENT)))

    def test_does_not_allow_the_published_window_to_regress(self):
        with self.assertRaisesRegex(ValueError, 'anterior'):
            refresh.refresh_annual_snapshots(DIRECTORY, PREVIOUS, Path('/sem-zips'), target_year=2024, offline=True)


if __name__ == '__main__':
    unittest.main()
