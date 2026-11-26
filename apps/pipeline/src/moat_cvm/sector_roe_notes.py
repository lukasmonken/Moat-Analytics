"""Insumos de ROE conferidos em demonstrações consolidadas auditadas."""

from datetime import date
from decimal import Decimal
from typing import NamedTuple


class AttributedAmount(NamedTuple):
    total_brl: int
    minority_brl: int
    parent_brl: int

    def reconciled_parent(self) -> Decimal:
        if self.total_brl != self.minority_brl + self.parent_brl:
            raise ValueError("O resultado ou patrimônio não concilia com o demonstrativo auditado.")
        return Decimal(self.parent_brl)


class AuditedRoeReview(NamedTuple):
    url: str
    page: int
    opening_date: date
    profit: AttributedAmount
    opening_equity: AttributedAmount
    closing_equity: AttributedAmount


AUDITED_ROE_REVIEWS = {
    # Banco ABC Brasil. A DMPL consolidada mostra a abertura de 1º de janeiro de
    # 2025 após os ajustes da Resolução CMN 4.966, que rege o exercício inteiro.
    ("020958", "2025-12-31", "154619", "1"): AuditedRoeReview(
        "https://filemanager-cdn.mziq.com/published/6298ef6f-2b75-43f8-b2ab-99e3fe33e809/"
        "cf4c1a42-971e-42e9-8d93-507270859bec_df_banco_abc_pt_122025.pdf",
        18,
        date(2025, 1, 1),
        AttributedAmount(1_019_581_000, 17_581_000, 1_002_000_000),
        AttributedAmount(6_401_725_000, 23_767_000, 6_377_958_000),
        AttributedAmount(6_776_126_000, 17_178_000, 6_758_948_000),
    ),
}
