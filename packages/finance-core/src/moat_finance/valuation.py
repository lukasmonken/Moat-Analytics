"""Valuation nominal em BRL com fluxos no fim de cada ano e perpetuidade de Gordon."""

from dataclasses import dataclass
from decimal import Decimal, DecimalException
from typing import Iterable, TypeGuard


ONE = Decimal(1)


@dataclass(frozen=True, slots=True)
class ValuationResult:
    cash_flows_pv_brl: Decimal
    terminal_value_brl: Decimal
    terminal_pv_brl: Decimal
    enterprise_value_brl: Decimal | None
    equity_value_brl: Decimal
    value_per_share_brl: Decimal


def _finite(value: object) -> TypeGuard[Decimal]:
    return isinstance(value, Decimal) and value.is_finite()


def calculate_fcff(
    *,
    ebit_brl: Decimal | None,
    tax_rate: Decimal | None,
    depreciation_brl: Decimal | None,
    capex_brl: Decimal | None,
    working_capital_change_brl: Decimal | None,
) -> Decimal | None:
    """Aplica a alíquota ao EBIT; Δcapital de giro positivo consome caixa."""
    if (
        not _finite(ebit_brl)
        or not _finite(tax_rate)
        or not 0 <= tax_rate <= ONE
        or not _finite(depreciation_brl)
        or depreciation_brl < 0
        or not _finite(capex_brl)
        or capex_brl < 0
        or not _finite(working_capital_change_brl)
    ):
        return None
    try:
        value = ebit_brl * (ONE - tax_rate) + depreciation_brl - capex_brl - working_capital_change_brl
    except DecimalException:
        return None
    return value if value.is_finite() else None


def _discounted_values(
    flows: tuple[Decimal | None, ...],
    discount_rate: Decimal | None,
    terminal_growth: Decimal | None,
) -> tuple[Decimal, Decimal, Decimal] | None:
    if (
        not flows
        or not _finite(discount_rate)
        or not _finite(terminal_growth)
        or terminal_growth <= -ONE
        or discount_rate <= terminal_growth
    ):
        return None
    terminal_flow = flows[-1]
    if not _finite(terminal_flow) or terminal_flow < 0:
        return None
    try:
        factor = ONE + discount_rate
        cash_flows_pv = Decimal(0)
        for year, flow in enumerate(flows, start=1):
            if not _finite(flow):
                return None
            cash_flows_pv += flow / (factor ** year)
        terminal = terminal_flow * (ONE + terminal_growth) / (discount_rate - terminal_growth)
        terminal_pv = terminal / (factor ** len(flows))
    except DecimalException:
        return None
    values = (cash_flows_pv, terminal, terminal_pv)
    return values if all(value.is_finite() for value in values) else None


def value_dcf(
    annual_fcff_brl: Iterable[Decimal | None],
    *,
    discount_rate: Decimal | None,
    terminal_growth: Decimal | None,
    net_debt_brl: Decimal | None,
    equity_adjustments_brl: Decimal | None,
    outstanding_shares: int | None,
) -> ValuationResult | None:
    """DCF com crescimento estável do último FCFF, que precisa ser não negativo.

    A dívida líquida é subtraída (caixa líquido é uma dívida negativa). Ajustes
    aportam ou retiram valor do patrimônio, como ativos não operacionais positivos
    e participações de não controladores negativas. Os ajustes precisam ser explícitos.
    """
    if (
        not _finite(net_debt_brl)
        or not _finite(equity_adjustments_brl)
        or type(outstanding_shares) is not int
        or outstanding_shares <= 0
    ):
        return None
    values = _discounted_values(tuple(annual_fcff_brl), discount_rate, terminal_growth)
    if values is None:
        return None
    cash_flows_pv, terminal, terminal_pv = values
    try:
        enterprise = cash_flows_pv + terminal_pv
        equity = enterprise - net_debt_brl + equity_adjustments_brl
        per_share = equity / outstanding_shares
    except DecimalException:
        return None
    if not all(value.is_finite() for value in (enterprise, equity, per_share)):
        return None
    return ValuationResult(cash_flows_pv, terminal, terminal_pv, enterprise, equity, per_share)


def value_ddm(
    annual_dividends_brl: Iterable[Decimal | None],
    *,
    discount_rate: Decimal | None,
    terminal_growth: Decimal | None,
    outstanding_shares: int | None,
) -> ValuationResult | None:
    """DDM de dividendos totais não negativos, com último dividendo como base terminal."""
    if type(outstanding_shares) is not int or outstanding_shares <= 0:
        return None
    dividends = tuple(annual_dividends_brl)
    if any(not _finite(dividend) or dividend < 0 for dividend in dividends):
        return None
    values = _discounted_values(dividends, discount_rate, terminal_growth)
    if values is None:
        return None
    cash_flows_pv, terminal, terminal_pv = values
    try:
        equity = cash_flows_pv + terminal_pv
        per_share = equity / outstanding_shares
    except DecimalException:
        return None
    if not equity.is_finite() or not per_share.is_finite():
        return None
    return ValuationResult(cash_flows_pv, terminal, terminal_pv, None, equity, per_share)
