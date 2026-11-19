"""Confere a leitura das posições de capital na data-base revisada."""

import os
import sys
import tempfile
import unittest
from datetime import UTC, date, datetime
from pathlib import Path
from zipfile import ZipFile

from test_cvm_pipeline import FILING_FIELDS, csv_bytes

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "apps/pipeline"))
sys.path.insert(0, str(REPO / "packages/finance-core/src"))

from src.moat_cvm.price_shares import read_share_counts


REFERENCE = date(2026, 9, 30)
COLLECTED = datetime(2026, 11, 16, tzinfo=UTC).timestamp()
CAPITAL_FIELDS = (
    "CNPJ_CIA",
    "DT_REFER",
    "VERSAO",
    "DENOM_CIA",
    "QT_ACAO_ORDIN_CAP_INTEGR",
    "QT_ACAO_PREF_CAP_INTEGR",
    "QT_ACAO_TOTAL_CAP_INTEGR",
    "QT_ACAO_ORDIN_TESOURO",
    "QT_ACAO_PREF_TESOURO",
    "QT_ACAO_TOTAL_TESOURO",
)


class PriceSharesTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.itr = Path(temp.name) / "itr_cia_aberta_2026.zip"

    def make_itr(self, *, total_itau=11_026_869, weg_version=1, duplicate_weg=False):
        companies = [
            ("005410", "84.429.695/0001-11", "WEG S.A.", weg_version, 161774),
            ("019348", "60.872.504/0001-23", "ITAU UNIBANCO HOLDING S.A.", 1, 161944),
        ]
        filings = [
            {
                "CD_CVM": code,
                "CNPJ_CIA": cnpj,
                "DENOM_CIA": name,
                "DT_REFER": REFERENCE.isoformat(),
                "VERSAO": version,
                "CATEG_DOC": "ITR",
                "ID_DOC": number,
                "LINK_DOC": "https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx",
                "DT_RECEB": "2026-11-03",
            }
            for code, cnpj, name, version, number in companies
        ]
        counts = [
            (4_197_317_998, 0, 4_197_317_998, 1_488_307, 0, 1_488_307),
            (5_617_743, 5_409_126, total_itau, 0, 4_843, 4_843),
        ]
        capital = [
            {**{field: filing[field] for field in CAPITAL_FIELDS[:4]},
             **dict(zip(CAPITAL_FIELDS[4:], row))}
            for filing, row in zip(filings, counts)
        ]
        if duplicate_weg:
            capital.append(capital[0].copy())
        with ZipFile(self.itr, "w") as archive:
            archive.writestr(
                "itr_cia_aberta_2026.csv",
                csv_bytes((*FILING_FIELDS, "CATEG_DOC", "ID_DOC"), filings),
            )
            archive.writestr(
                "itr_cia_aberta_composicao_capital_2026.csv", csv_bytes(CAPITAL_FIELDS, capital)
            )
        os.utime(self.itr, (COLLECTED, COLLECTED))

    def test_keeps_exact_underlying_class_counts_and_evidence(self):
        self.make_itr()

        shares, issues = read_share_counts(self.itr, REFERENCE)

        self.assertEqual(set(shares), {"cvm:5410", "cvm:19348"})
        self.assertEqual(set(issues), {"cvm:8133"})
        self.assertIn("milhares", issues["cvm:8133"])
        self.assertEqual(shares["cvm:5410"]["referenceDate"], "2026-09-30")
        self.assertEqual(shares["cvm:5410"]["classes"][0]["outstanding"], 4_195_829_691)
        self.assertIn("161774", shares["cvm:5410"]["documentUrl"])
        self.assertEqual(len(shares["cvm:5410"]["archiveSha256"]), 64)
        self.assertEqual(
            [(row["ticker"], row["outstanding"]) for row in shares["cvm:19348"]["classes"]],
            [("ITUB3", 5_617_742_977), ("ITUB4", 5_404_282_925)],
        )
        self.assertTrue(shares["cvm:19348"]["evidenceUrl"].startswith("https://www.sec.gov/"))

    def test_rejects_mismatched_counts_and_unreviewed_restatement(self):
        self.make_itr(total_itau=11_026_868, weg_version=2)

        shares, issues = read_share_counts(self.itr, REFERENCE)

        self.assertEqual(shares, {})
        self.assertIn("diverge", issues["cvm:19348"])
        self.assertIn("versão do ITR", issues["cvm:5410"])

    def test_rejects_duplicate_capital_records_and_other_dates(self):
        self.make_itr(duplicate_weg=True)

        shares, issues = read_share_counts(self.itr, REFERENCE)

        self.assertNotIn("cvm:5410", shares)
        self.assertIn("ambígua", issues["cvm:5410"])
        later, later_issues = read_share_counts(self.itr, date(2026, 11, 18))
        self.assertEqual(later, {})
        self.assertIn("aguarda validação", later_issues["cvm:5410"])
