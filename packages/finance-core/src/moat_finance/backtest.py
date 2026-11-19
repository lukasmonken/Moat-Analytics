"""Retrospectiva mensal de uma carteira selecionada de antemão."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, DecimalException
from statistics import stdev
from typing import Iterable, Literal, Mapping, TypeGuard


ZERO = Decimal(0)
ONE = Decimal(1)
WEIGHT_TOLERANCE = Decimal("1e-12")
DAYS_PER_YEAR = Decimal("365.2425")


@dataclass(frozen=True, slots=True)
class MonthlyTotalReturnPoint:
    """Níveis de retorno total de todos os ativos no mesmo pregão de referência."""

    reference_date: date
    levels: Mapping[str, Decimal]


@dataclass(frozen=True, slots=True)
class BacktestPoint:
    reference_date: date
    value_brl: Decimal
    contributed_brl: Decimal
    period_return: Decimal | None
    total_return: Decimal
    drawdown: Decimal


@dataclass(frozen=True, slots=True)
class BacktestResult:
    initial_brl: Decimal
    contributions_brl: Decimal
    terminal_value_brl: Decimal
    final_value_brl: Decimal
    profit_brl: Decimal
    costs_brl: Decimal
    tax_brl: Decimal
    total_return: Decimal
    cagr: Decimal
    annualized_volatility: Decimal | None
    max_drawdown: Decimal
    points: tuple[BacktestPoint, ...]


def _finite(value: object) -> TypeGuard[Decimal]:
    return isinstance(value, Decimal) and value.is_finite()


def _month(value: date) -> int:
    return value.year * 12 + value.month


def _valid_inputs(points: tuple[MonthlyTotalReturnPoint, ...], weights: Mapping[str, Decimal]) -> bool:
    if len(points) < 2 or not weights:
        return False
    if any(not isinstance(key, str) or not key.strip() for key in weights):
        return False
    if any(not _finite(weight) or weight <= ZERO for weight in weights.values()):
        return False
    if abs(sum(weights.values()) - ONE) > WEIGHT_TOLERANCE:
        return False
    expected = set(weights)
    for point in points:
        if type(point.reference_date) is not date or set(point.levels) != expected:
            return False
        if any(not _finite(level) or level <= ZERO for level in point.levels.values()):
            return False
    return all(
        _month(current.reference_date) - _month(previous.reference_date) == 1
        for previous, current in zip(points, points[1:])
    )


def simulate_portfolio(
    points: Iterable[MonthlyTotalReturnPoint],
    *,
    weights: Mapping[str, Decimal],
    initial_brl: Decimal,
    monthly_contribution_brl: Decimal,
    rebalance: Literal["hold", "monthly"],
    transaction_cost_rate: Decimal,
    terminal_tax_rate: Decimal,
) -> BacktestResult | None:
    """Simula retorno total reinvestido em uma janela mensal contígua.

    Compra inicial e aportes mensais são alocados aos pesos-alvo após pagar a
    taxa de negociação sobre o caixa bruto. Aportes ocorrem após o retorno
    mensal. O rebalanceamento, quando selecionado, ocorre depois do aporte e
    somente nos meses intermediários. Seu custo usa o giro bruto pré-custo.
    TWR, CAGR e risco incluem custos de negociação. Um imposto ilustrativo
    sobre o ganho positivo é deduzido apenas do patrimônio final e do lucro.
    """
    if (
        not _finite(initial_brl) or initial_brl <= ZERO
        or not _finite(monthly_contribution_brl) or monthly_contribution_brl < ZERO
        or not _finite(transaction_cost_rate) or not ZERO <= transaction_cost_rate < ONE
        or not _finite(terminal_tax_rate) or not ZERO <= terminal_tax_rate < ONE
        or rebalance not in ("hold", "monthly")
    ):
        return None

    history = tuple(points)
    try:
        if not _valid_inputs(history, weights):
            return None
        total_weight = sum(weights.values())
        target = {key: weight / total_weight for key, weight in weights.items()}
        costs = initial_brl * transaction_cost_rate
        value = initial_brl - costs
        holdings = {key: value * weight for key, weight in target.items()}
        unit_value = value / initial_brl
        peak = ONE
        contributions = ZERO
        deposit_cost = monthly_contribution_brl * transaction_cost_rate
        net_deposit = monthly_contribution_brl - deposit_cost
        periods = []
        output = [BacktestPoint(history[0].reference_date, value, ZERO, None, unit_value - ONE, ONE - unit_value)]

        for index, (previous, current) in enumerate(zip(history, history[1:]), start=1):
            previous_value = value
            holdings = {
                key: position * current.levels[key] / previous.levels[key] + net_deposit * target[key]
                for key, position in holdings.items()
            }
            value = sum(holdings.values(), ZERO)
            contributions += monthly_contribution_brl
            costs += deposit_cost
            if rebalance == "monthly" and index < len(history) - 1:
                turnover = sum(abs(position - value * target[key]) for key, position in holdings.items())
                rebalance_cost = turnover * transaction_cost_rate
                value -= rebalance_cost
                costs += rebalance_cost
                holdings = {key: value * weight for key, weight in target.items()}

            factor = (value - monthly_contribution_brl) / previous_value
            if factor <= ZERO:
                return None
            period_return = factor - ONE
            periods.append(period_return)
            unit_value *= factor
            peak = max(peak, unit_value)
            output.append(
                BacktestPoint(
                    current.reference_date, value, contributions, period_return,
                    unit_value - ONE, ONE - unit_value / peak,
                )
            )

        gain = value - initial_brl - contributions
        tax = max(gain, ZERO) * terminal_tax_rate
        days = Decimal((history[-1].reference_date - history[0].reference_date).days)
        return BacktestResult(
            initial_brl=initial_brl,
            contributions_brl=contributions,
            terminal_value_brl=value,
            final_value_brl=value - tax,
            profit_brl=gain - tax,
            costs_brl=costs,
            tax_brl=tax,
            total_return=unit_value - ONE,
            cagr=unit_value ** (DAYS_PER_YEAR / days) - ONE,
            annualized_volatility=stdev(periods) * Decimal(12).sqrt() if len(periods) >= 2 else None,
            max_drawdown=max(point.drawdown for point in output),
            points=tuple(output),
        )
    except DecimalException:
        return None
