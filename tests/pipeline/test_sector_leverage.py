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

    def test_accepts_operating_totals_with_explicit_expense_notes_and_documented_typo(self):
        document = filing("000111")
        for label in (
            "Despesas com depreciação e amortização",
            "Depreciação e amortização (Nota 9 e 10)",
            "Depreciação e amotização",
            "Depreciação de bens do ativo imobilizado e intangível",
            "Depreciação e amortização de bens ativo imobilizado e intangível",
        ):
            with self.subTest(label=label):
                rows = dfc(document, [("6.01.01.02", label, 15)])
                value, evidence = _depreciation([("DFC_MI", row) for row in rows])
                self.assertEqual(value, 15_000)
                self.assertEqual(evidence["depreciationAccount"]["label"], label)

    def test_dva_corroborates_dfc_amount_without_adding_right_of_use(self):
        document = filing("000111")
        rows = [("DFC_MI", row) for row in dfc(document, [
            ("6.01.01.02", "Depreciação e amortização", 15),
            ("6.01.01.03", "Amortização do direito de uso", 6),
            ("6.01.01.04", "Amortização de intangível", 0),
        ])]
        label = "Depreciação, Amortização e Exaustão"
        evidence_row = dfc(document, [("7.04.01", label, -15)])[0]
        value, evidence = _depreciation(rows, (evidence_row,))
        self.assertEqual(value, 15_000)
        self.assertEqual(evidence["depreciationDvaAccount"], {
            "statement": "DVA", "code": "7.04.01", "label": label,
            "referenceDate": "2025-12-31", "amountBrl": -15_000,
        })

        for dva_rows in (
            (), ({**evidence_row, "VL_CONTA": "-21"},),
            ({**evidence_row, "VL_CONTA": "15"},),
            ({**evidence_row, "DS_CONTA": "Retenções"},),
            (evidence_row, {**evidence_row, "VL_CONTA": "-14"}),
        ):
            with self.subTest(dva_rows=dva_rows), self.assertRaisesRegex(ValueError, "contas separadas"):
                _depreciation(rows, dva_rows)

        alternative = dfc(document, [("6.01.01.05", "Amortiz. com perda recuperável", 8)])[0]
        with self.assertRaisesRegex(ValueError, "contas separadas"):
            _depreciation([*rows, ("DFC_MI", alternative)], (evidence_row,))

    def test_conciles_only_separate_depreciation_and_amortization_siblings(self):
        document = filing("000111")
        rows = dfc(document, [
            ("6.01.01.03", "Depreciação", 12),
            ("6.01.01.04", "Amortização", 4),
            ("6.01.01.04.01", "Amortização do intangível", 4),
            ("6.01.01.05", "Amortização de custos de transação", 20),
        ])
        value, evidence = _depreciation([("DFC_MI", row) for row in rows])
        self.assertEqual(value, 16_000)
        self.assertEqual(
            [(item["code"], item["amountBrl"]) for item in evidence["depreciationAccounts"]],
            [("6.01.01.03", 12_000), ("6.01.01.04", 4_000)],
        )
        with self.assertRaisesRegex(ValueError, "sem conciliação"):
            _depreciation([("DFC_MI", rows[0]), ("DFC_MD", rows[1])])
        with self.assertRaisesRegex(ValueError, "sem conciliação"):
            _depreciation([("DFC_MI", rows[0]), ("DFC_MI", {**rows[1], "CD_CONTA": "6.01.01.03.01"})])
        with self.assertRaisesRegex(ValueError, "contas separadas"):
            _depreciation([
                *[("DFC_MI", row) for row in rows],
                ("DFC_MI", {**rows[2], "CD_CONTA": "6.01.01.06"}),
            ])

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
            target = dfc(document, [
                ("6.01.02", "Amortização e depreciação", 12),
                ("6.01.03", "Amortização direito de uso", 4),
            ])
            older = dfc({**document, "VERSAO": 2}, [("6.01.02", "Depreciação e amortização", 98)])
            wrong_basis = dfc(document, [("6.01.01.02", "Depreciação e amortização", 77)])
            dva_label = "Depreciação, Amortização e Exaustão"
            supporting = dfc(document, [("7.04.01", dva_label, -12)])
            wrong_version = dfc({**document, "VERSAO": 2}, [("7.04.01", dva_label, -98)])
            wrong_period = [{**supporting[0], "DT_INI_EXERC": "2025-06-01", "VL_CONTA": "-4"}]
            consolidated = dfc(document, [("7.04.01", dva_label, -77)])
            with ZipFile(path, "w") as archive:
                archive.writestr("dfp_cia_aberta_2025.csv", csv_bytes([document], document))
                archive.writestr("dfp_cia_aberta_DFC_MD_ind_2025.csv", csv_bytes(target + older, target[0]))
                archive.writestr("dfp_cia_aberta_DFC_MI_con_2025.csv", csv_bytes(wrong_basis, wrong_basis[0]))
                archive.writestr(
                    "dfp_cia_aberta_DVA_ind_2025.csv",
                    csv_bytes(supporting + wrong_version + wrong_period, supporting[0]),
                )
                archive.writestr("dfp_cia_aberta_DVA_con_2025.csv", csv_bytes(consolidated, consolidated[0]))
            snapshot = create_sector_leverage(selection, directory, roic, Path(tmp))
        self.assertEqual(snapshot["manifest"]["year"], 2025)
        result = snapshot["companies"][0]
        self.assertEqual(result["filing"], observation["filing"])
        self.assertEqual(result["inputs"]["depreciationBrl"], 12_000)
        self.assertEqual(result["inputs"]["depreciationAccount"]["statement"], "DFC_MD")
        self.assertEqual(result["inputs"]["depreciationDvaAccount"]["amountBrl"], -12_000)

    def test_negative_net_debt_allowed_and_nonpositive_ebitda_unavailable(self):
        document = filing("000111")
        observation = observe_roic("000111", 2025, document, annual_statements(document))
        observation["inputs"]["accounts"][-1]["amountBrl"] = 100_000
        rows = [("DFC_MI", row) for row in dfc(document, [("6.01.01.02", "Depreciação e amortização", 15)])]
        self.assertLess(_leverage("EMPRESA", observation, rows)["value"], 0)
        observation["inputs"]["ebitBrl"] = -15_000
        result = _leverage("EMPRESA", observation, rows)
        self.assertIsNone(result["value"])
        self.assertEqual(result["inputs"]["depreciationBrl"], 15_000)
        self.assertEqual(result["inputs"]["ebitdaBrl"], 0)
        self.assertLess(result["inputs"]["netDebtBrl"], 0)
        self.assertIn("EBITDA", result["reason"])
