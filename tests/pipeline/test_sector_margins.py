"""Testa as margens baseadas nas mesmas demonstrações anuais do ROIC."""

import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from test_sector_comparison import account_rows, csv_bytes, filing
from test_sector_roic import annual_statements

from apps.pipeline.src.moat_cvm.archives import archive_sha256
from apps.pipeline.src.moat_cvm.comparison_identity import classification_url
from apps.pipeline.src.moat_cvm.sector_margins import _margins, create_sector_margins
from apps.pipeline.src.moat_cvm.sector_roic import observe_roic


def income_rows(document, *, revenue=100, ebit=30, individual=False):
    net_label = "Lucro/Prejuízo do Período" if individual else "Lucro/Prejuízo Consolidado do Período"
    return account_rows(document, [
        ("3.01", "Receita de Venda de Bens e/ou Serviços", revenue),
        ("3.03", "Resultado Bruto", 46),
        ("3.05", "Resultado Antes do Resultado Financeiro e dos Tributos", ebit),
        ("3.11", net_label, -10),
        ("3.11.01", "Atribuído a Sócios da Empresa Controladora", -7),
    ], start="2025-01-01")


def by_code(rows):
    return {row["CD_CONTA"]: row for row in rows}


class SectorMarginsTest(unittest.TestCase):
    def test_margins_use_reported_revenue_operating_income_and_total_loss(self):
        document = filing("000111")
        observation = observe_roic("000111", 2025, document, annual_statements(document))
        margins = _margins("COMPANHIA", observation, by_code(income_rows(document)), False)
        self.assertEqual(margins["filing"], observation["filing"])
        self.assertIsNone(margins["reason"])
        self.assertEqual(margins["inputs"], {
            "revenueBrl": 100_000, "grossIncomeBrl": 46_000, "ebitBrl": 30_000, "netIncomeBrl": -10_000,
        })
        self.assertEqual(margins["grossMargin"], 0.46)
        self.assertEqual(margins["operatingMargin"], 0.3)
        self.assertEqual(margins["netMargin"], -0.1)

    def test_invalid_denominator_disagreement_and_conflicts_keep_explicit_gaps(self):
        document = filing("000111")
        observation = observe_roic("000111", 2025, document, annual_statements(document))
        for rows, conflict, reason in (
            (income_rows(document, revenue=0), False, "3.01"),
            (income_rows(document, ebit=29), False, "diverge"),
            (income_rows(document)[:3], False, "3.11"),
            (income_rows(document, individual=True), False, "3.11"),
            (income_rows(document), True, "conflitantes"),
        ):
            with self.subTest(reason=reason):
                result = _margins("COMPANHIA", observation, by_code(rows), conflict)
                self.assertIsNone(result["inputs"])
                self.assertIsNone(result["grossMargin"])
                self.assertIsNone(result["operatingMargin"])
                self.assertIsNone(result["netMargin"])
                self.assertIn(reason, result["reason"])

    def test_uses_same_archive_dated_individual_filing_and_current_year(self):
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
            target = income_rows(document, individual=True)
            new_version = income_rows({**document, "VERSAO": 2}, revenue=150, individual=True)
            late_start = [{**row, "DT_INI_EXERC": "2025-03-01"} for row in target]
            wrong_basis = income_rows(document, revenue=200)
            with ZipFile(path, "w") as archive:
                archive.writestr("dfp_cia_aberta_2025.csv", csv_bytes([document], document))
                archive.writestr("dfp_cia_aberta_DRE_con_2025.csv", csv_bytes(wrong_basis, wrong_basis[0]))
                archive.writestr("dfp_cia_aberta_DRE_ind_2025.csv", csv_bytes(target + new_version + late_start, target[0]))
            roic["manifest"]["archives"] = [{"kind": "dfp", "year": 2025, "sha256": archive_sha256(path)}]
            snapshot = create_sector_margins(selection, directory, roic, Path(tmp))
            roic["manifest"]["archives"][0]["sha256"] = "0" * 64
            with self.assertRaisesRegex(ValueError, "difere"):
                create_sector_margins(selection, directory, roic, Path(tmp))
        self.assertEqual(snapshot["manifest"]["year"], 2025)
        result = snapshot["companies"][0]
        self.assertEqual(result["filing"], observation["filing"])
        self.assertEqual(result["filing"]["basis"], "individual")
        self.assertEqual(result["operatingMargin"], 0.3)
