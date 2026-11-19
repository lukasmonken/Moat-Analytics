"""Testa os insumos do valor da firma sobre balanços ITR temporários."""

import hashlib
import os
import sys
import tempfile
import unittest
from datetime import UTC, date, datetime
from pathlib import Path
from zipfile import ZipFile

from test_cvm_pipeline import ACCOUNT_FIELDS, FILING_FIELDS, csv_bytes

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(REPO / "apps/pipeline"), str(REPO / "packages/finance-core/src")]
from src.moat_cvm.price_balance import read_price_balances

REFERENCE = date(2026, 9, 30)
COLLECTED = datetime(2026, 11, 16, tzinfo=UTC).timestamp()
ASSETS = (
    ("1", "Ativo Total", 25),
    ("1.01", "Ativo Circulante", 17),
    ("1.01.01", "Caixa e Equivalentes de Caixa", 12),
    ("1.01.02", "Aplicações Financeiras", 5),
    ("1.02", "Ativo Não Circulante", 8),
)
LIABILITIES = (
    ("2", "Passivo Total", 25),
    ("2.01", "Passivo Circulante", 6),
    ("2.01.04", "Empréstimos e Financiamentos", 4),
    ("2.01.04.01", "Empréstimos e Financiamentos", 4),
    ("2.01.04.03", "Financiamento por Arrendamento", 0),
    ("2.01.05.02", "Outros", 2),
    ("2.01.05.02.07", "Arrendamentos", 2),
    ("2.02", "Passivo Não Circulante", 5),
    ("2.02.01", "Empréstimos e Financiamentos", 3),
    ("2.02.01.01", "Empréstimos e Financiamentos", 3),
    ("2.02.01.03", "Financiamento por Arrendamento", 0),
    ("2.02.02.02", "Outros", 2),
    ("2.02.02.02.05", "Arrendamentos", 1),
    ("2.02.02.02.06", "Outros", 1),
    ("2.03", "Patrimônio Líquido Consolidado", 14),
    ("2.03.01", "Capital Social Realizado", 13),
    ("2.03.09", "Participação dos Acionistas Não Controladores", 1),
)


class PriceBalanceTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.itr = Path(temporary.name) / "itr_cia_aberta_2026.zip"

    def create_archive(self, *, include_statements=True, override=None):
        filings = []
        records = {"BPA": [], "BPP": []}
        for version in (1, 2):
            identity = {
                "CD_CVM": "005410",
                "CNPJ_CIA": "TESTE-005410",
                "DT_REFER": REFERENCE.isoformat(),
                "VERSAO": version,
            }
            filings.append({
                **identity,
                "DENOM_CIA": "Companhia de teste",
                "CATEG_DOC": "ITR",
                "DT_RECEB": "2026-11-01",
                "LINK_DOC": f"http://www.rad.cvm.gov.br/ITR-teste-v{version}",
            })
            for statement, accounts in (("BPA", ASSETS), ("BPP", LIABILITIES)):
                for code, label, value in accounts:
                    if version == 2 and override and code == override[0]:
                        value = override[1]
                    records[statement].append({
                        **identity,
                        "ORDEM_EXERC": "ÚLTIMO",
                        "DT_INI_EXERC": "",
                        "DT_FIM_EXERC": REFERENCE.isoformat(),
                        "MOEDA": "REAL",
                        "ESCALA_MOEDA": "MIL",
                        "CD_CONTA": code,
                        "DS_CONTA": label,
                        "VL_CONTA": value if version == 2 else 10 * value,
                    })
        with ZipFile(self.itr, "w") as archive:
            archive.writestr(
                "itr_cia_aberta_2026.csv", csv_bytes((*FILING_FIELDS, "CATEG_DOC"), filings)
            )
            if include_statements:
                for statement, rows in records.items():
                    archive.writestr(
                        f"itr_cia_aberta_{statement}_con_2026.csv", csv_bytes(ACCOUNT_FIELDS, rows)
                    )
        os.utime(self.itr, (COLLECTED, COLLECTED))

    def test_simplified_net_debt_uses_latest_version_and_solely_cash_equivalents(self):
        self.create_archive()
        balances, issues = read_price_balances(self.itr, REFERENCE)
        self.assertEqual(set(issues), {"cvm:8133"})
        balance = balances["cvm:5410"]
        self.assertEqual(balance["filingVersion"], 2)
        self.assertEqual(balance["borrowingsBrl"], 7000)
        self.assertEqual(balance["leaseLiabilitiesBrl"], 3000)
        self.assertEqual(balance["netDebtBrl"], -2000)
        self.assertEqual(balance["nonControllingInterestsBrl"], 1000)
        self.assertEqual(balance["financialInvestmentsBrl"], 5000)
        self.assertEqual(balance["provenance"]["referenceDate"], REFERENCE.isoformat())
        self.assertEqual(balance["archiveSha256"], hashlib.sha256(self.itr.read_bytes()).hexdigest())

    def test_rejects_overlap_and_unreconciled_balance_without_using_old_version(self):
        for override, expected in (
            (("2.01.04.03", 1), "dupla contagem"),
            (("2.01.05.02.07", 10), "diverge de seus subtotais"),
        ):
            with self.subTest(account=override[0]):
                self.create_archive(override=override)
                balances, issues = read_price_balances(self.itr, REFERENCE)
                self.assertEqual(balances, {})
                self.assertIn(expected, issues["cvm:5410"])

    def test_missing_balances_keep_reportable_issues(self):
        self.create_archive(include_statements=False)
        balances, issues = read_price_balances(self.itr, REFERENCE)
        self.assertEqual(balances, {})
        self.assertEqual(set(issues), {"cvm:5410", "cvm:8133"})
        self.assertIn("não contém os balanços consolidados", issues["cvm:5410"])
