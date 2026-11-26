"""Testa a alavancagem anual nas mesmas demonstrações do ROIC."""

import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from test_sector_comparison import account_rows, csv_bytes, filing
from test_sector_roic import annual_statements

from apps.pipeline.src.moat_cvm.comparison_identity import classification_url
from apps.pipeline.src.moat_cvm.sector_leverage import _depreciation, _leverage, create_sector_leverage
from apps.pipeline.src.moat_cvm.sector_roic import observe_roic


def dfc(document, accounts):
    return account_rows(document, accounts, start="2025-01-01")


class SectorLeverageTest(unittest.TestCase):
    def test_total_adds_only_depreciation_amortization_and_exhaustion(self):
        document = filing("000111")
        rows = dfc(document, [
            ("6.01.01.02", "Depreciações, amortizações e exaustões", 15),
            ("6.01.01.02.03", "Depreciação do direito de uso", 3),
            ("6.01.01.03", "Amortização de custos de transação", 9),
        ])
        observation = observe_roic("000111", 2025, {**document, "LINK_DOC": classification_url(document["LINK_DOC"])},
                                   annual_statements(document))
        result = _leverage("EMPRESA", observation, [("DFC_MI", row) for row in rows])
        self.assertAlmostEqual(result["value"], 60_000 / 45_000)
        self.assertEqual(result["inputs"], {
            "ebitBrl": 30_000, "depreciationBrl": 15_000, "ebitdaBrl": 45_000, "netDebtBrl": 60_000,
            "depreciationAccount": {
                "statement": "DFC_MI", "code": "6.01.01.02",
                "label": "Depreciações, amortizações e exaustões", "referenceDate": "2025-12-31",
            },
        })

    def test_rejects_missing_aggregates_duplicate_totals_and_separate_components(self):
        document = filing("000111")
        for entries, reason in (
            ([("6.01.01.02", "Depreciação, amortização e impairment", 15)], "indisponível"),
            ([
                ("6.01.01.02", "Depreciação e amortização", 15),
                ("6.01.01.03", "Depreciação e amortização", 15),
            ], "Mais de uma"),
            ([
                ("6.01.01.02", "Depreciação e amortização", 15),
                ("6.01.01.03", "Amortização dos direitos de uso", 6),
            ], "contas separadas"),
        ):
            with self.subTest(entries=entries), self.assertRaisesRegex(ValueError, reason):
                _depreciation([("DFC_MI", row) for row in dfc(document, entries)])

    def test_latest_same_filing_and_preserves_individual_provenance(self):
        document = {**filing("018627", version=1), "ID_DOC": "154938"}
        annual = annual_statements(document)
        for stage in ("opening", "closing"):
            annual[stage]["BPP"]["2.03"]["DS_CONTA"] = "Patrimônio Líquido"
        observation = observe_roic("018627", 2025, {
            **document, "LINK_DOC": classification_url(document["LINK_DOC"]),
        }, annual)
        self.assertEqual(observation["filing"]["basis"], "individual")
        roic = {
            "manifest": {"asOf": "2026-11-18", "years": [2024, 2025], "methodologyVersion": "roic-dfp-comparisons.v2"},
            "companies": [{"name": "COMPANHIA", "observations": [observation]}],
        }
        selection = {"schemaVersion": "1.0.0", "asOf": "2026-11-18", "companies": [{"cvmCode": 18627, "name": "COMPANHIA"}]}
        directory = {"schemaVersion": "1.0.0", "asOf": "2026-11-18", "companies": ["COMPANHIA"]}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "dfp_cia_aberta_2025.zip"
            target = dfc(document, [("6.01.02", "Amortização e depreciação", 12)])
            older = dfc({**document, "VERSAO": 2}, [("6.01.02", "Depreciação e amortização", 98)])
            wrong_basis = dfc(document, [("6.01.01.02", "Depreciação e amortização", 77)])
            with ZipFile(path, "w") as archive:
                archive.writestr("dfp_cia_aberta_2025.csv", csv_bytes([document], document))
                archive.writestr("dfp_cia_aberta_DFC_MD_ind_2025.csv", csv_bytes(target + older, target[0]))
                archive.writestr("dfp_cia_aberta_DFC_MI_con_2025.csv", csv_bytes(wrong_basis, wrong_basis[0]))
            snapshot = create_sector_leverage(selection, directory, roic, Path(tmp))
        self.assertEqual(snapshot["manifest"]["year"], 2025)
        result = snapshot["companies"][0]
        self.assertEqual(result["filing"], observation["filing"])
        self.assertEqual(result["inputs"]["depreciationBrl"], 12_000)
        self.assertEqual(result["inputs"]["depreciationAccount"]["statement"], "DFC_MD")

    def test_negative_net_debt_allowed_and_nonpositive_ebitda_unavailable(self):
        document = filing("000111")
        observation = observe_roic("000111", 2025, document, annual_statements(document))
        observation["inputs"]["accounts"][-1]["amountBrl"] = 100_000
        rows = [("DFC_MI", row) for row in dfc(document, [("6.01.01.02", "Depreciação e amortização", 15)])]
        self.assertLess(_leverage("EMPRESA", observation, rows)["value"], 0)
        observation["inputs"]["ebitBrl"] = -15_000
        result = _leverage("EMPRESA", observation, rows)
        self.assertIsNone(result["value"])
        self.assertIsNone(result["inputs"])
        self.assertIn("EBITDA", result["reason"])
