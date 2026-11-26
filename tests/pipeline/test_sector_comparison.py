"""Testa a comparação civil de ROE com demonstrações sintéticas."""

import csv
import io
import os
import sys
import tempfile
import unittest
from contextlib import nullcontext
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "packages/finance-core/src"))

from apps.pipeline.src.moat_cvm.sector_comparison import (
    ITAU_EQUITY_COMPONENTS,
    annual_window,
    comparison_years,
    create_sector_comparison,
    year_comparison,
)
from apps.pipeline.src.moat_cvm.sector_roic import create_sector_roic


def csv_bytes(rows, fields):
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fields, delimiter=";")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("latin-1")


def filing(code, version=2, reference="2025-12-31"):
    return {
        "CD_CVM": code,
        "CNPJ_CIA": f"01.234.567/{code[-4:]}-99",
        "DT_REFER": reference,
        "DT_RECEB": "2026-03-31",
        "VERSAO": version,
        "CATEG_DOC": "DFP",
        "LINK_DOC": f"http://www.rad.cvm.gov.br/dfp-{code}-v{version}",
    }


def account_rows(document, accounts, *, period="ÚLTIMO", end="2025-12-31", start=""):
    return [
        {
            **{key: document[key] for key in ("CD_CVM", "CNPJ_CIA", "DT_REFER", "VERSAO")},
            "ORDEM_EXERC": period,
            "DT_INI_EXERC": start,
            "DT_FIM_EXERC": end,
            "MOEDA": "REAL",
            "ESCALA_MOEDA": "MIL",
            "CD_CONTA": code,
            "DS_CONTA": label,
            "VL_CONTA": value,
        }
        for code, label, value in accounts
    ]


def profit(document, *, layout="3.11", total=25, parent=20, minority=5):
    return account_rows(
        document,
        [
            (layout, "Lucro/Prejuízo Consolidado do Período", total),
            (f"{layout}.01", "Atribuído a Sócios da Empresa Controladora", parent),
            (f"{layout}.02", "Atribuído a Sócios Não Controladores", minority),
        ],
        start="2025-01-01",
    )


def equity(document, layout, *, parent_open=80, parent_close=120):
    rows = []
    for period, end, parent in (
        ("PENÚLTIMO", "2024-12-31", parent_open),
        ("ÚLTIMO", "2025-12-31", parent_close),
    ):
        minority = 30
        accounts = [(layout, "Patrimônio Líquido Consolidado", parent + minority)]
        if layout == "2.07":
            accounts.extend([
                ("2.07.01", "Patrimônio Líquido Atribuído ao Controlador", parent),
                ("2.07.02", "Patrimônio Líquido Atribuído aos Não Controladores", minority),
            ])
        else:
            accounts.extend(
                (f"{layout}.{index:02}", label, parent if index == 1 else 0)
                for index, label in enumerate(ITAU_EQUITY_COMPONENTS, 1)
            )
            accounts.append((f"{layout}.09", "Participação dos Acionistas Não Controladores", minority))
        rows.extend(account_rows(document, accounts, period=period, end=end))
    return rows


def dmpl(document, *, parent=20, minority=5, total=25):
    rows = account_rows(
        document,
        [("5.05.01", "Lucro Líquido do Período", value) for value in (parent, minority, total)],
        start="2025-01-01",
    )
    for row, column in zip(rows, (
        "Patrimônio Líquido", "Participação dos Não Controladores", "Patrimônio Líquido Consolidado",
    )):
        row["COLUNA_DF"] = column
    return rows


class SectorComparisonTest(unittest.TestCase):
    def test_builders_roll_to_five_exercises_ending_in_2026(self):
        years = annual_window(2026)
        archives = {year: Path(f"{year}.zip") for year in reversed(years)}
        selection = {"asOf": "2026-11-18"}
        identities = {
            111: {"name": "Banco Exemplo", "sector": "Bancos", "classification": {}},
            222: {"name": "Indústria Exemplo", "sector": "Metalurgia"},
        }
        roe_module = "apps.pipeline.src.moat_cvm.sector_comparison"
        roic_module = "apps.pipeline.src.moat_cvm.sector_roic"
        with (
            patch(f"{roe_module}.comparison_identities", return_value=(identities, [])),
            patch(f"{roe_module}.year_comparison") as year_comparison_mock,
        ):
            year_comparison_mock.side_effect = lambda path, year, companies: (
                {"kind": "dfp", "year": year}, {"000111": {"year": year, "roe": None}},
            )
            roe = create_sector_comparison(selection, {}, [], archives)
        collected = datetime(2027, 4, 1, tzinfo=UTC)
        with (
            patch(f"{roic_module}.comparison_identities", return_value=(identities, [])),
            patch(f"{roic_module}.read_archive", return_value=nullcontext((None, "hash", collected))),
            patch(f"{roic_module}.selected_filings", return_value=({}, {"000222": "Ausente"})),
            patch(f"{roic_module}.read_accounts", return_value=({}, set())),
        ):
            roic = create_sector_roic(selection, {}, [], archives)

        for snapshot in (roe, roic):
            self.assertEqual(snapshot["manifest"]["years"], [2022, 2023, 2024, 2025, 2026])
            self.assertEqual([row["year"] for row in snapshot["manifest"]["archives"]], list(years))
            self.assertEqual([row["year"] for row in snapshot["companies"][0]["observations"]], list(years))
        self.assertTrue(roic["manifest"]["archives"][-1]["url"].endswith("dfp_cia_aberta_2026.zip"))

    def test_rejects_gaps_or_missing_archives(self):
        for years in ((2023, 2024, 2025, 2026), (2021, 2023, 2024, 2025, 2026)):
            with self.assertRaisesRegex(ValueError, "cinco ZIPs de exercícios consecutivos"):
                comparison_years({year: Path(f"{year}.zip") for year in years})

    def build_year(self, filings, income, equity_rows, *, individual_equity=(), dmpl_rows=()):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        path = Path(temp.name) / "dfp_cia_aberta_2025.zip"
        fields = ("CD_CVM", "CNPJ_CIA", "DT_REFER", "VERSAO", "ORDEM_EXERC", "DT_INI_EXERC",
                  "DT_FIM_EXERC", "MOEDA", "ESCALA_MOEDA", "CD_CONTA", "DS_CONTA", "VL_CONTA")
        with ZipFile(path, "w") as archive:
            archive.writestr("dfp_cia_aberta_2025.csv", csv_bytes(filings, filings[0]))
            archive.writestr("dfp_cia_aberta_DRE_con_2025.csv", csv_bytes(income, fields))
            archive.writestr("dfp_cia_aberta_BPP_con_2025.csv", csv_bytes(equity_rows, fields))
            archive.writestr("dfp_cia_aberta_BPP_ind_2025.csv", csv_bytes(individual_equity, fields))
            archive.writestr("dfp_cia_aberta_DMPL_con_2025.csv", csv_bytes(dmpl_rows, (*fields, "COLUNA_DF")))
        collected = datetime(2026, 11, 18, tzinfo=UTC).timestamp()
        os.utime(path, (collected, collected))
        identities = {row["CD_CVM"]: {"cnpj": row["CNPJ_CIA"]} for row in filings}
        source, observations = year_comparison(path, 2025, identities)
        self.assertEqual(source["kind"], "dfp")
        self.assertEqual(len(source["sha256"]), 64)
        return observations

    def test_valid_roe_uses_same_latest_filing_and_parent_equity(self):
        old, operating, bank, alternative = (
            filing("000111", 1), filing("000111"), filing("000222"), filing("000333"),
        )
        results = self.build_year(
            [old, operating, bank, alternative],
            profit(old, total=110, parent=105) + profit(operating) + profit(bank)
            + profit(alternative, layout="3.09"),
            equity(old, "2.03", parent_open=1, parent_close=1) + equity(operating, "2.03")
            + equity(bank, "2.07") + equity(alternative, "2.08"),
        )
        for code, roe in results.items():
            with self.subTest(code=code):
                self.assertEqual(roe["roe"], 0.2)
                self.assertIsNone(roe["reason"])
                self.assertEqual(roe["filing"]["version"], 2)
                self.assertTrue(roe["filing"]["filingUrl"].startswith("https://"))
                self.assertIsNone(roe["filing"]["publishedAt"])
                self.assertEqual(roe["inputs"]["netIncomeBrl"], 20_000)
                self.assertEqual(roe["inputs"]["openingEquityBrl"], 80_000)
                self.assertEqual(roe["inputs"]["closingEquityBrl"], 120_000)
        self.assertEqual(results["000111"]["inputs"]["equityCodes"], ["2.03", "2.03.09"])
        self.assertEqual(results["000222"]["inputs"]["equityCodes"], ["2.07.01"])
        self.assertEqual(results["000333"]["inputs"]["incomeCode"], "3.09.01")
        self.assertEqual(results["000333"]["inputs"]["incomeStatement"], "DRE")

    def test_lacunas_remain_unavailable_without_individual_or_unreconciled_data(self):
        individual, divergent, noncivil, adverse, good = (
            filing("000111"), filing("000222"), filing("000333", reference="2025-03-31"),
            filing("000444"), filing("000555"),
        )
        results = self.build_year(
            [individual, divergent, noncivil, adverse, good],
            profit(individual) + profit(divergent, total=31) + profit(adverse) + profit(good),
            equity(divergent, "2.07")
            + equity(adverse, "2.03", parent_open=-1)
            + equity(good, "2.03"),
            individual_equity=equity(individual, "2.03"),
        )
        self.assertEqual(results["000555"]["roe"], 0.2)
        for code, phrase in (
            ("000111", "DFP consolidada indisponível"),
            ("000222", "Lucro consolidado diverge"),
            ("000333", "Encerramento fiscal diferente de 31/12"),
            ("000444", "precisam ser positivas"),
        ):
            with self.subTest(code=code):
                self.assertIn(phrase, results[code]["reason"])
                self.assertIsNone(results[code]["roe"])
                self.assertIsNone(results[code]["inputs"])
        self.assertIsNone(results["000333"]["filing"])
        self.assertIsNotNone(results["000111"]["filing"])

    def test_matches_audited_abc_dmpl_to_the_exact_missing_consolidated_filing(self):
        abc = {**filing("020958", 1), "ID_DOC": "154619"}
        observation = self.build_year([abc], [], [])["020958"]
        self.assertAlmostEqual(observation["roe"], 0.15254733496608714)
        self.assertEqual(observation["inputs"], {
            "netIncomeBrl": 1_002_000_000,
            "openingEquityBrl": 6_377_958_000,
            "closingEquityBrl": 6_758_948_000,
            "incomeCode": None,
            "incomeStatement": "DMPL",
            "equityCodes": [],
            "auditedStatementPage": 18,
            "openingEquityDate": "2025-01-01",
        })
        self.assertTrue(observation["filing"]["supportingDocumentUrl"].endswith("abc_pt_122025.pdf"))

        for changed in ({**abc, "ID_DOC": "654321"}, {**abc, "VERSAO": 2}):
            observation = self.build_year([changed], [], [])["020958"]
            self.assertIsNone(observation["roe"])
            self.assertIn("DFP consolidada indisponível", observation["reason"])

        observation = self.build_year([abc], profit(abc), [])["020958"]
        self.assertIsNone(observation["roe"])

    def test_uses_consistent_dmpl_from_same_filing_to_resolve_attribution(self):
        absent, matching_parent, conflicting_parent, conflicting_total, old_only = (
            filing("000111"), filing("000222"), filing("000333"), filing("000444"),
            filing("000555"),
        )
        documents = [absent, matching_parent, conflicting_parent, conflicting_total, old_only]
        results = self.build_year(
            documents,
            profit(absent, parent=0, minority=0)
            + profit(matching_parent, minority=-5)
            + profit(conflicting_parent, parent=16, minority=-5)
            + profit(conflicting_total, total=31, parent=0, minority=0)
            + profit(old_only, parent=0, minority=0),
            [row for document in documents for row in equity(document, "2.03")],
            dmpl_rows=[row for document in documents[:-1] for row in dmpl(document)]
            + dmpl(filing("000555", version=1)),
        )
        self.assertEqual(results["000111"]["roe"], 0.2)
        self.assertEqual(results["000111"]["inputs"]["incomeStatement"], "DMPL")
        self.assertEqual(results["000111"]["inputs"]["incomeCode"], "5.05.01")
        self.assertEqual(results["000222"]["roe"], 0.2)
        self.assertEqual(results["000222"]["inputs"]["incomeStatement"], "DRE")
        for code in ("000333", "000444", "000555"):
            with self.subTest(code=code):
                self.assertIn("Lucro consolidado diverge", results[code]["reason"])
                self.assertIsNone(results[code]["roe"])
