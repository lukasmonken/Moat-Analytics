"""Testa o ROIC com demonstrações consolidadas sintéticas."""

import unittest

from test_sector_comparison import account_rows, filing

from apps.pipeline.src.moat_cvm.sector_roic import balance_capital, observe_roic
from apps.pipeline.src.moat_cvm.sector_roic_notes import ReviewedAccount


def by_code(document, accounts):
    return {row["CD_CONTA"]: row for row in account_rows(document, accounts)}


def balance(document):
    return {
        "BPA": by_code(document, [
            ("1", "Ativo Total", 210),
            ("1.01", "Ativo Circulante", 100),
            ("1.01.01", "Caixa e Equivalentes de Caixa", 20),
            ("1.01.02", "Aplicações Financeiras", 80),
            ("1.02", "Ativo Não Circulante", 110),
        ]),
        "BPP": by_code(document, [
            ("2", "Passivo Total", 210),
            ("2.01", "Passivo Circulante", 40),
            ("2.01.02", "Fornecedores", 10),
            ("2.01.04", "Empréstimos e Financiamentos", 30),
            ("2.01.04.01", "Empréstimos e Financiamentos", 24),
            ("2.01.04.03", "Financiamento por Arrendamento", 6),
            ("2.02", "Passivo Não Circulante", 50),
            ("2.02.01", "Empréstimos e Financiamentos", 50),
            ("2.02.01.01", "Empréstimos e Financiamentos", 40),
            ("2.02.01.03", "Financiamento por Arrendamento", 10),
            ("2.03", "Patrimônio Líquido Consolidado", 120),
            ("2.03.01", "Capital Social Realizado", 120),
        ]),
    }


class SectorRoicTest(unittest.TestCase):
    def test_reconciles_ebit_and_uses_total_equity_debt_and_cash(self):
        document = filing("000111")
        income = by_code(document, [
            ("3.03", "Resultado Bruto", 100),
            ("3.04", "Despesas/Receitas Operacionais", -70),
            ("3.05", "Resultado Antes do Resultado Financeiro e dos Tributos", 30),
        ])
        rows = {"income": {"DRE": income}, "opening": balance(document), "closing": balance(document)}
        result = observe_roic("000111", 2025, document, rows)
        self.assertEqual(result["roic"], 0.11)
        self.assertEqual(result["inputs"]["ebitBrl"], 30_000)
        self.assertEqual(result["inputs"]["nopatBrl"], 19_800)
        self.assertEqual(result["inputs"]["openingCapitalBrl"], 180_000)
        self.assertEqual(result["inputs"]["closingCapitalBrl"], 180_000)

        income["3.05"]["VL_CONTA"] = 32
        result = observe_roic("000111", 2025, document, rows)
        self.assertIsNone(result["roic"])
        self.assertIn("diverge dos subtotais da DRE", result["reason"])

    def test_includes_a_separate_reviewed_lease_once(self):
        document = filing("003069")
        statements = balance(document)
        liabilities = statements["BPP"]
        liabilities["2.01.04"]["VL_CONTA"] = 24
        liabilities["2.01.04.03"]["VL_CONTA"] = 0
        with self.assertRaisesRegex(ValueError, "Arrendamentos não identificados"):
            balance_capital("003069", "closing", statements)

        liabilities.update(by_code(document, [
            ("2.01.05", "Outras Obrigações", 6),
            ("2.01.05.02", "Outros", 6),
            ("2.01.05.02.07", "Arrendamento a pagar", 6),
        ]))
        capital, evidence = balance_capital("003069", "closing", statements)
        self.assertEqual(capital, 180_000)
        self.assertEqual([row["key"] for row in evidence].count("closingShortSeparateLease"), 1)

        liabilities["2.01.04.03"]["VL_CONTA"] = 6
        with self.assertRaisesRegex(ValueError, "dupla contagem"):
            balance_capital("003069", "closing", statements)

    def test_includes_debentures_outside_borrowings_with_reconciled_subtotals(self):
        document = filing("004170")
        statements = balance(document)
        assets, liabilities = statements["BPA"], statements["BPP"]
        assets["1"]["VL_CONTA"] = 215
        assets["1.02"]["VL_CONTA"] = 115
        liabilities["2"]["VL_CONTA"] = 215
        liabilities["2.02"]["VL_CONTA"] = 55
        liabilities.update(by_code(document, [
            ("2.02.04", "Outras Obrigações", 5),
            ("2.02.04.02", "Outros", 5),
            ("2.02.04.02.12", "Debentures participativas", 5),
        ]))
        capital, evidence = balance_capital("004170", "closing", statements)
        self.assertEqual(capital, 185_000)
        self.assertIn("2.02.04.02.12", [row["code"] for row in evidence])

        liabilities["2.02.04.02.12"]["VL_CONTA"] = 3
        with self.assertRaisesRegex(ValueError, "2.02.04.02 diverge"):
            balance_capital("004170", "closing", statements)

    def test_rejects_unreconciled_financing_and_checks_reviewed_supplier_balance(self):
        document = filing("003980")
        statements = balance(document)
        statements["BPP"].update(by_code(document, [
            ("2.01.02.01", "Fornecedores", 10),
            ("2.01.02.01.01", "Fornecedores convencionais", 3),
            ("2.01.02.01.02", "Fornecedores risco sacado", 7),
        ]))
        with self.assertRaisesRegex(ValueError, "Financiamento fora das contas revisadas"):
            balance_capital("003980", "closing", statements)
        with self.assertRaisesRegex(ValueError, "diverge da nota auditada"):
            balance_capital("003980", "closing", statements, 6_000)

        capital, evidence = balance_capital("003980", "closing", statements, 7_000)
        self.assertEqual(capital, 180_000)
        self.assertIn("closingOperatingSupplier", [row["key"] for row in evidence])

    def test_only_includes_separate_financing_verified_for_the_balance_date(self):
        document = filing("000111")
        statements = balance(document)
        statements["BPA"]["1"]["VL_CONTA"] = 217
        statements["BPA"]["1.02"]["VL_CONTA"] = 117
        statements["BPP"]["2"]["VL_CONTA"] = 217
        statements["BPP"]["2.01"]["VL_CONTA"] = 47
        statements["BPP"].update(by_code(document, [
            ("2.01.05", "Outras Obrigações", 7),
            ("2.01.05.02", "Outros", 7),
            ("2.01.05.02.06", "Cessão de direitos creditórios", 5),
            ("2.01.05.02.07", "Contas a pagar por aquisições", 2),
        ]))
        funding = ReviewedAccount("2.01.05.02.06", "Cessão de direitos creditórios", 4_000, 5_000)
        operational = ReviewedAccount("2.01.05.02.07", "Contas a pagar por aquisições", 2_000, 2_000, False)

        with self.assertRaisesRegex(ValueError, "Cessão de direitos creditórios"):
            balance_capital("000111", "closing", statements)
        with self.assertRaisesRegex(ValueError, "Contas a pagar por aquisições"):
            balance_capital("000111", "closing", statements, reviewed_accounts=(funding,))
        with self.assertRaisesRegex(ValueError, "diverge da nota auditada"):
            balance_capital("000111", "opening", statements, reviewed_accounts=(funding, operational))

        capital, evidence = balance_capital(
            "000111", "closing", statements, reviewed_accounts=(funding, operational),
        )
        self.assertEqual(capital, 185_000)
        self.assertIn("closingSeparateDebt1", [row["key"] for row in evidence])
        self.assertIn("closingOperatingSupplier1", [row["key"] for row in evidence])
