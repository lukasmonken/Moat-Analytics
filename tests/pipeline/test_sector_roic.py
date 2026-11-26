"""Testa o ROIC anual com demonstrações financeiras sintéticas."""

import unittest

from test_sector_comparison import account_rows, filing

from apps.pipeline.src.moat_cvm.sector_roic import balance_capital, observe_roic


def by_code(document, accounts, *, end="2025-12-31"):
    return {row["CD_CONTA"]: row for row in account_rows(document, accounts, end=end)}


def balance(document, *, end="2025-12-31"):
    return {
        "BPA": by_code(document, [
            ("1", "Ativo Total", 210),
            ("1.01", "Ativo Circulante", 100),
            ("1.01.01", "Caixa e Equivalentes de Caixa", 20),
            ("1.01.02", "Aplicações Financeiras", 80),
            ("1.02", "Ativo Não Circulante", 110),
        ], end=end),
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
        ], end=end),
    }


def annual_statements(document):
    return {
        "income": {"DRE": by_code(document, [
            ("3.03", "Resultado Bruto", 100),
            ("3.04", "Despesas/Receitas Operacionais", -70),
            ("3.05", "Resultado Antes do Resultado Financeiro e dos Tributos", 30),
        ])},
        "opening": balance(document, end="2024-12-31"),
        "closing": balance(document),
    }


class SectorRoicTest(unittest.TestCase):
    def test_reconciles_ebit_and_uses_reported_equity_debt_and_cash(self):
        document = filing("000111")
        rows = annual_statements(document)
        opening_assets = rows["opening"]["BPA"]
        opening_assets["1.01.01"]["VL_CONTA"] = 40
        opening_assets["1.01.02"]["VL_CONTA"] = 60
        result = observe_roic("000111", 2025, document, rows)
        self.assertAlmostEqual(result["roic"], 19_800 / 170_000)
        inputs = result["inputs"]
        self.assertEqual(inputs["ebitBrl"], 30_000)
        self.assertEqual(inputs["nopatBrl"], 19_800)
        self.assertEqual(inputs["openingCapitalBrl"], 160_000)
        self.assertEqual(inputs["closingCapitalBrl"], 180_000)
        self.assertEqual([(row["key"], row["code"], row["referenceDate"]) for row in inputs["accounts"]], [
            ("ebit", "3.05", "2025-12-31"),
            ("openingEquity", "2.03", "2024-12-31"),
            ("openingShortBorrowings", "2.01.04", "2024-12-31"),
            ("openingLongBorrowings", "2.02.01", "2024-12-31"),
            ("openingCash", "1.01.01", "2024-12-31"),
            ("closingEquity", "2.03", "2025-12-31"),
            ("closingShortBorrowings", "2.01.04", "2025-12-31"),
            ("closingLongBorrowings", "2.02.01", "2025-12-31"),
            ("closingCash", "1.01.01", "2025-12-31"),
        ])

        rows["income"]["DRE"]["3.05"]["VL_CONTA"] = 32
        result = observe_roic("000111", 2025, document, rows)
        self.assertIsNone(result["roic"])
        self.assertIn("diverge dos subtotais da DRE", result["reason"])

    def test_keeps_embedded_leases_and_ignores_other_liabilities(self):
        document = filing("000111")
        statements = balance(document)
        liabilities = statements["BPP"]
        liabilities["2.01.02"]["VL_CONTA"] = 0
        liabilities.update(by_code(document, [
            ("2.01.05", "Outras Obrigações", 10),
            ("2.01.05.02.01", "Arrendamento a pagar", 4),
            ("2.01.05.02.02", "Instrumentos financeiros derivativos", 2),
            ("2.01.05.02.03", "Contas a Pagar por Aquisições", 4),
        ]))
        capital, evidence = balance_capital("closing", statements)
        self.assertEqual(capital, 180_000)
        self.assertEqual([item["amountBrl"] for item in evidence], [120_000, 30_000, 50_000, 20_000])

    def test_accepts_reported_debt_total_without_a_detail_breakdown(self):
        statements = balance(filing("000111"))
        liabilities = statements["BPP"]
        del liabilities["2.01.04.03"]
        liabilities["2.01.04.01"]["VL_CONTA"] = 0
        capital, _ = balance_capital("closing", statements)
        self.assertEqual(capital, 180_000)

    def test_requires_explicit_zero_debt_and_rejects_conflicting_children(self):
        statements = balance(filing("000111"))
        liabilities = statements["BPP"]
        liabilities["2.01.02"]["VL_CONTA"] = 40
        liabilities["2.01.04"]["VL_CONTA"] = 0
        liabilities["2.01.04.01"]["VL_CONTA"] = 0
        liabilities["2.01.04.03"]["VL_CONTA"] = 0
        capital, _ = balance_capital("closing", statements)
        self.assertEqual(capital, 150_000)

        liabilities["2.01.04.03"]["VL_CONTA"] = 6
        with self.assertRaisesRegex(ValueError, "Saldo zerado em BPP 2.01.04"):
            balance_capital("closing", statements)

        del liabilities["2.01.04"]
        with self.assertRaisesRegex(ValueError, "Conta ausente.* BPP 2.01.04"):
            balance_capital("closing", statements)

    def test_keeps_missing_inputs_nonpositive_capital_and_duplicates_unavailable(self):
        document = filing("000111")
        rows = annual_statements(document)
        assets = rows["opening"]["BPA"]
        assets["1.01.01"]["VL_CONTA"] = 200
        assets["1.01.02"]["VL_CONTA"] = 0
        assets["1.01"]["VL_CONTA"] = 200
        assets["1.02"]["VL_CONTA"] = 10
        result = observe_roic("000111", 2025, document, rows)
        self.assertIsNone(result["inputs"])
        self.assertIn("Capital investido incompatível", result["reason"])

        del assets["1.01.01"]
        result = observe_roic("000111", 2025, document, rows)
        self.assertIsNone(result["roic"])
        self.assertIn("BPA 1.01.01", result["reason"])
        self.assertEqual(result["filing"]["filingUrl"], document["LINK_DOC"])

        result = observe_roic("000111", 2025, document, rows, duplicate=True)
        self.assertIsNone(result["roic"])
        self.assertIn("Conta duplicada", result["reason"])

    def test_uses_the_individual_balance_only_for_the_verified_filing(self):
        document = {**filing("018627", version=1), "ID_DOC": "154938"}
        rows = annual_statements(document)
        for period in ("opening", "closing"):
            rows[period]["BPP"]["2.03"]["DS_CONTA"] = "Patrimônio Líquido"
        result = observe_roic("018627", 2025, document, rows)
        self.assertEqual(result["roic"], 0.11)
        self.assertEqual(result["filing"]["basis"], "individual")
        self.assertEqual(result["filing"]["filingUrl"], document["LINK_DOC"])
        self.assertIn("ri.sanepar.com.br", result["filing"]["supportingDocumentUrl"])

        result = observe_roic("018627", 2025, {**document, "ID_DOC": "0"}, rows)
        self.assertIsNone(result["roic"])
        self.assertNotIn("basis", result["filing"])
