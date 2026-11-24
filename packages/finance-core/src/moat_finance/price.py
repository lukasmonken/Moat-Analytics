"""Métricas de preço sobre fechamentos e entradas contábeis validadas."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Iterable, TypeGuard


@dataclass(frozen=True, slots=True)
class ShareClassClose:
    """Fechamento não ajustado e ações fora da tesouraria por classe subjacente."""

    class_id: str
    trade_date: date
    close_brl: Decimal | None
    shares_on_trade_date: int | None


def _finite_decimal(value: object) -> TypeGuard[Decimal]:
    return isinstance(value, Decimal) and value.is_finite()


def market_capitalization(
    classes: Iterable[ShareClassClose], *, expected_classes: Iterable[str], trade_date: date
) -> Decimal | None:
    """Soma fechamentos não ajustados vezes as ações de cada classe no pregão."""
    expected = tuple(expected_classes)
    if type(trade_date) is not date or not expected:
        return None
    if any(not isinstance(class_id, str) or not class_id.strip() for class_id in expected):
        return None
    missing = set(expected)
    if len(missing) != len(expected):
        return None

    total = Decimal(0)
    for share_class in classes:
        close = share_class.close_brl
        shares = share_class.shares_on_trade_date
        if (
            share_class.class_id not in missing
            or share_class.trade_date != trade_date
            or not _finite_decimal(close)
            or close <= 0
            or type(shares) is not int
            or shares <= 0
        ):
            return None
        missing.remove(share_class.class_id)
        total += close * shares
    return None if missing else total


def enterprise_value(
    *,
    market_cap_brl: Decimal | None,
    net_debt_brl: Decimal | None,
    adjustments_brl: Decimal | None,
) -> Decimal | None:
    """Soma capitalização, dívida líquida e ajustes de EV. Ambos os ajustes admitem sinal."""
    if (
        not _finite_decimal(market_cap_brl)
        or market_cap_brl <= 0
        or not _finite_decimal(net_debt_brl)
        or not _finite_decimal(adjustments_brl)
    ):
        return None
    value = market_cap_brl + net_debt_brl + adjustments_brl
    return value if value > 0 else None


def _implied_yield(numerator: Decimal | None, denominator: Decimal | None) -> Decimal | None:
    if not _finite_decimal(numerator) or not _finite_decimal(denominator) or denominator <= 0:
        return None
    return numerator / denominator


def earnings_yield(
    *, parent_net_income_ttm_brl: Decimal | None, market_cap_brl: Decimal | None
) -> Decimal | None:
    """Divide o lucro dos últimos doze meses atribuível à controladora pela capitalização."""
    return _implied_yield(parent_net_income_ttm_brl, market_cap_brl)


def operating_yield(
    *, nopat_ttm_brl: Decimal | None, enterprise_value_brl: Decimal | None
) -> Decimal | None:
    """Divide o NOPAT dos últimos doze meses pelo EV de mercado."""
    return _implied_yield(nopat_ttm_brl, enterprise_value_brl)


def spread_to_cdi(yield_value: Decimal | None, cdi_rate: Decimal | None) -> Decimal | None:
    """Compara rendimento e CDI anualizado contemporâneos em pontos percentuais."""
    if not _finite_decimal(yield_value) or not _finite_decimal(cdi_rate) or cdi_rate <= -1:
        return None
    return (yield_value - cdi_rate) * Decimal(100)
