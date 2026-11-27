"""Confere a revisão da DFC da Cyrela restrita ao exercício auditado."""

import unittest
from decimal import Decimal

from apps.pipeline.src.moat_cvm.sector_leverage_notes import (
    CYRELA_FILING,
    CYRELA_REVIEW,
    review_cyrela_depreciation,
)


ISSUER = "014460"
FILING = {
    "referenceDate": "2025-12-31",
    "receivedAt": "2026-03-19",
    "version": 1,
    "filingUrl": CYRELA_FILING,
}


def account(code, label, value):
    return "DFC_MI", {
        "CD_CVM": ISSUER,
        "CNPJ_CIA": "73.178.600/0001-18",
        "GRUPO_DFP": "DF Consolidado - Demonstração do Fluxo de Caixa (Método Indireto)",
        "VERSAO": "1",
        "DT_REFER": "2025-12-31",
        "ORDEM_EXERC": "ÚLTIMO",
        "DT_INI_EXERC": "2025-01-01",
        "DT_FIM_EXERC": "2025-12-31",
        "CD_CONTA": code,
        "DS_CONTA": label,
        "VL_CONTA": value,
        "MOEDA": "REAL",
        "ESCALA_MOEDA": "MIL",
    }


class CyrelaDepreciationReviewTest(unittest.TestCase):
    def setUp(self):
        self.rows = [
            account("6.01.01.01", "Depreciação de Bens do Ativo Imobilizado", "79338"),
            account("6.01.01.02", "Amortização de Mais Valia de Ativos", "53237"),
            account("6.01.01.03", "Equivalência Patrimonial", "-548106"),
        ]

    def test_uses_the_reported_depreciation_and_records_the_note(self):
        value, evidence = review_cyrela_depreciation(ISSUER, FILING, self.rows)
        self.assertEqual(value, Decimal(79_338_000))
        self.assertEqual(evidence, {
            "depreciationAccount": {
                "statement": "DFC_MI",
                "code": "6.01.01.01",
                "label": "Depreciação de Bens do Ativo Imobilizado",
                "referenceDate": "2025-12-31",
            },
            "depreciationReview": {
                "documentUrl": CYRELA_REVIEW, "page": 67, "accountCode": "6.01.01.01",
            },
        })

    def test_requires_the_audited_issuer_and_document(self):
        self.assertIsNone(review_cyrela_depreciation("014461", FILING, self.rows))
        for changed in (
            {"referenceDate": "2026-12-31"}, {"version": 2},
            {"filingUrl": CYRELA_FILING.replace("155491", "155492")},
            {"receivedAt": "2026-03-20"}, {"basis": "individual"},
        ):
            with self.subTest(changed=changed):
                self.assertIsNone(review_cyrela_depreciation(ISSUER, {**FILING, **changed}, self.rows))

    def test_rejects_incomplete_changed_and_ambiguous_accounts(self):
        statement, depreciation = self.rows[0]
        _, step_up = self.rows[1]
        failures = [
            [self.rows[0]],
            [*self.rows, self.rows[0]],
            [*self.rows, account("6.01.01.04", "Amortização de direitos de uso", "6976")],
            [(statement, {**depreciation, "VL_CONTA": "79339"}), *self.rows[1:]],
            [self.rows[0], (statement, {**step_up, "VL_CONTA": "53236"})],
            [(statement, {**depreciation, "DT_INI_EXERC": "2025-04-01"}), *self.rows[1:]],
            [(statement, {**depreciation, "GRUPO_DFP": "DF Individual"}), *self.rows[1:]],
            [("DFC_MD", depreciation), *self.rows[1:]],
        ]
        for rows in failures:
            with self.subTest(rows=rows):
                self.assertIsNone(review_cyrela_depreciation(ISSUER, FILING, rows))
