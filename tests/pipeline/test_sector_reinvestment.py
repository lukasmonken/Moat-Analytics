"""Testa os insumos contábeis do NOPAT sobre reinvestimento."""

import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from test_sector_comparison import account_rows, csv_bytes, filing
from test_sector_roic import annual_statements

from apps.pipeline.src.moat_cvm.archives import archive_sha256
from apps.pipeline.src.moat_cvm.comparison_identity import classification_url
from apps.pipeline.src.moat_cvm.sector_roic import observe_roic
from apps.pipeline.src.moat_sector_reinvestment import _capex, _reinvestment, create_sector_reinvestment


def cash_flows(document, accounts):
    return account_rows(document, accounts, start="2025-01-01")


def balance_accounts(document, *, inventories=8):
    opening = {"period": "PENÚLTIMO", "end": "2024-12-31"}
    assets = [
        *account_rows(document, [
            ("1.01.03", "Contas a Receber", 12), ("1.01.04", "Estoques", inventories),
        ], **opening),
        *account_rows(document, [("1.01.03", "Contas a Receber", 15), ("1.01.04", "Estoques", 9)]),
    ]
    liabilities = [
        *account_rows(document, [("2.01.02", "Fornecedores", 7)], **opening),
        *account_rows(document, [("2.01.02", "Fornecedores", 8)]),
    ]
    return assets, liabilities


class SectorReinvestmentTest(unittest.TestCase):
    def test_combined_capex_does_not_double_count_its_parts_or_net_disposals(self):
        rows = cash_flows(filing("000111"), [
            ("6.02.01", "Aquisições de imobilizado e intangível", -9),
            ("6.02.01.01", "Aquisição de imobilizado", -8),
            ("6.02.01.02", "Aquisição de intangível", -1),
            ("6.02.02", "Venda de imobilizado", 5),
            ("6.02.03", "Aquisição de controladas", -30),
        ])
        value, accounts = _capex([("DFC_MI", row) for row in rows])
        self.assertEqual(value, 9_000)
        self.assertEqual([(row["code"], row["amountBrl"]) for row in accounts], [("6.02.01", -9_000)])

    def test_requires_gross_capex_for_both_asset_classes_and_preserves_reported_zero(self):
        document = filing("000111")
        property_only = [("6.02.01", "Imobilizado", -9)]
        for rows, reason in (
            (property_only, "indisponíveis"),
            (property_only + [("6.02.02", "Aquisição e venda de intangível", -2)], "outros fluxos"),
            ([("6.02.01", "Adições ao imobilizado, intangível e investimentos", -14)], "outros fluxos"),
            (property_only + [("6.02.02", "Aquisição de intangível", 2)], "entrada de caixa"),
            (property_only + [("6.02.01", "Aquisição de intangível", -2)], "conflitantes"),
        ):
            with self.subTest(rows=rows), self.assertRaisesRegex(ValueError, reason):
                _capex([("DFC_MD", row) for row in cash_flows(document, rows)])
        value, _ = _capex([("DFC_MD", row) for row in cash_flows(document, [
            *property_only, ("6.02.02", "Aquisição de intangível", 0),
        ])])
        self.assertEqual(value, 9_000)

    def test_uses_exact_roic_archive_filing_scope_and_demonstrated_opening(self):
        document = {**filing("018627", version=1), "ID_DOC": "154938"}
        annual = annual_statements(document)
        for stage in ("opening", "closing"):
            annual[stage]["BPP"]["2.03"]["DS_CONTA"] = "Patrimônio Líquido"
        observation = observe_roic("018627", 2025, {
            **document, "LINK_DOC": classification_url(document["LINK_DOC"]),
        }, annual)
        roic = {
            "manifest": {"asOf": "2026-11-18", "years": [2024, 2025], "methodologyVersion": "roic-dfp-comparisons.v2"},
            "companies": [{"name": "COMPANHIA", "observations": [observation]}],
        }
        selection = {"schemaVersion": "1.0.0", "asOf": "2026-11-18", "companies": [{"cvmCode": 18627, "name": "COMPANHIA"}]}
        directory = {"schemaVersion": "1.0.0", "asOf": "2026-11-18", "companies": ["COMPANHIA"]}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "dfp_cia_aberta_2025.zip"
            assets, liabilities = balance_accounts(document)
            target = cash_flows(document, [("6.02.02", "Aquisição de imobilizado e intangível", -4)])
            wrong_version = cash_flows({**document, "VERSAO": 2}, [("6.02.02", "Aquisição de imobilizado e intangível", -60)])
            wrong_period = [{**target[0], "ORDEM_EXERC": "PENÚLTIMO", "VL_CONTA": -100}]
            wrong_basis = [{**target[0], "VL_CONTA": -75}]
            with ZipFile(path, "w") as archive:
                archive.writestr("dfp_cia_aberta_2025.csv", csv_bytes([document], document))
                archive.writestr("dfp_cia_aberta_BPA_ind_2025.csv", csv_bytes(assets, assets[0]))
                archive.writestr("dfp_cia_aberta_BPP_ind_2025.csv", csv_bytes(liabilities, liabilities[0]))
                archive.writestr("dfp_cia_aberta_DFC_MD_ind_2025.csv", csv_bytes(target + wrong_version + wrong_period, target[0]))
                archive.writestr("dfp_cia_aberta_DFC_MI_con_2025.csv", csv_bytes(wrong_basis, wrong_basis[0]))
            roic["manifest"]["archives"] = [{"kind": "dfp", "year": 2025, "sha256": archive_sha256(path)}]
            snapshot = create_sector_reinvestment(selection, directory, roic, Path(tmp))
            roic["manifest"]["archives"][0]["sha256"] = "0" * 64
            with self.assertRaisesRegex(ValueError, "difere"):
                create_sector_reinvestment(selection, directory, roic, Path(tmp))
        result = snapshot["companies"][0]
        self.assertEqual(result["filing"], observation["filing"])
        self.assertEqual(result["inputs"]["nopatBrl"], 19_800)
        self.assertEqual(result["inputs"]["openingWorkingCapitalBrl"], 13_000)
        self.assertEqual(result["inputs"]["closingWorkingCapitalBrl"], 16_000)
        self.assertEqual(result["inputs"]["reinvestmentBrl"], 7_000)
        self.assertAlmostEqual(result["value"], 19_800 / 7_000)

    def test_retains_negative_reinvestment_amounts_and_requires_all_balance_lines(self):
        document = filing("000111")
        observation = observe_roic("000111", 2025, document, annual_statements(document))
        assets, liabilities = balance_accounts(document, inventories=30)
        account_keys = {"1.01.03": "Receivables", "1.01.04": "Inventories", "2.01.02": "Suppliers"}
        accounts = {}
        for statement, rows in (("BPA", assets), ("BPP", liabilities)):
            for row in rows:
                stage = "opening" if row["ORDEM_EXERC"] == "PENÚLTIMO" else "closing"
                accounts[stage + account_keys[row["CD_CONTA"]]] = (statement, row)
        capex = [("DFC_MI", row) for row in cash_flows(document, [("6.02.02", "Aquisição de imobilizado e intangível", -4)])]
        result = _reinvestment("COMPANHIA", observation, accounts, capex, False)
        self.assertIsNone(result["value"])
        self.assertEqual(result["inputs"]["reinvestmentBrl"], -15_000)
        self.assertIn("menor ou igual a zero", result["reason"])
        del accounts["openingInventories"]
        result = _reinvestment("COMPANHIA", observation, accounts, capex, False)
        self.assertIsNone(result["inputs"])
        self.assertIn("1.01.04", result["reason"])
