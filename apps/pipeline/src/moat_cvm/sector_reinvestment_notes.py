"""Escopo de contas de CAPEX confirmado em demonstrações auditadas."""

from typing import NamedTuple


class AuditedCapexReview(NamedTuple):
    document_id: str
    account_code: str
    csv_label: str
    amount_brl: int
    document_url: str
    page: int


AUDITED_CAPEX_REVIEWS = {
    # A DFC auditada da Vale identifica imobilizado e intangível no valor
    # de 6.02.05. A versão 2 da DFP reapresenta o relatório da administração.
    ("004170", "2025-12-31", 2): AuditedCapexReview(
        "155313", "6.02.05", "Adições ao Imobilizado", -33_390_000_000,
        "https://vipfiles.valor.com.br/BDEmpresas/3e5fc308-60c2-477c-a9e7-7d2cfc52d411.pdf",
        5,
    ),
    # A DFC auditada da Tupy identifica imobilizado e intangível na linha
    # de adições, com remissão às notas 13 e 14.
    ("006343", "2025-12-31", 1): AuditedCapexReview(
        "155493", "6.02.02", "Adições ao Imobilizado", -447_934_000,
        "https://api.mziq.com/mzfilemanager/v2/d/5ab6a371-dd2f-452a-b6b2-22c97ed0abbb/"
        "e1a13af4-e0af-5e7e-c099-6a2d3ace78ea?origin=2",
        23,
    ),
}
