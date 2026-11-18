"""Métricas de qualidade econômica sobre entradas contábeis normalizadas."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from statistics import mean, median, pstdev
from typing import Iterable, Literal


HUNDRED = Decimal(100)
TWO = Decimal(2)
QualityStatus = Literal["validated", "estimated", "unavailable"]


@dataclass(frozen=True, slots=True)
class QualityResult:
    value: Decimal | None
    numerator: Decimal | None
    denominator: Decimal | None
    quality_status: QualityStatus
    reasons: tuple[str, ...] = ()


def _available(value: Decimal | None) -> bool:
    return value is not None and value.is_finite()


def invested_capital(
    *,
    equity: Decimal | None,
    debt: Decimal | None,
    excess_cash: Decimal | None,
) -> Decimal | None:
    """PL ajustado mais dívida onerosa menos caixa excedente."""
    if equity is None or debt is None or excess_cash is None:
        return None
    if not all(_available(value) for value in (equity, debt, excess_cash)):
        return None
    if debt < 0 or excess_cash < 0:
        return None
    return equity + debt - excess_cash


def _unavailable(reason: str) -> QualityResult:
    return QualityResult(None, None, None, "unavailable", (reason,))


def _capital_return(
    numerator: Decimal | None,
    opening: Decimal | None,
    closing: Decimal | None,
    estimated: bool,
) -> QualityResult:
    if numerator is None or opening is None or closing is None:
        return _unavailable("Entradas contábeis incompletas.")
    if not all(_available(value) for value in (numerator, opening, closing)):
        return _unavailable("Entradas contábeis inválidas.")
    denominator = (opening + closing) / TWO
    if opening <= 0 or closing <= 0:
        return QualityResult(
            None,
            numerator,
            denominator,
            "unavailable",
            ("A base de abertura e a de encerramento precisam ser positivas.",),
        )
    return QualityResult(
        numerator / denominator,
        numerator,
        denominator,
        "estimated" if estimated else "validated",
    )


def calculate_roic(
    *,
    ebit: Decimal | None,
    tax_rate: Decimal | None,
    capital_open: Decimal | None,
    capital_close: Decimal | None,
    estimated: bool = False,
    comparable_period: bool = True,
) -> QualityResult:
    """NOPAT do exercício dividido pelo capital investido médio."""
    if not comparable_period:
        return _unavailable("Período ou saldos de capital investido não comparáveis.")
    if ebit is None or tax_rate is None:
        return _unavailable("EBIT ou alíquota tributária indisponível.")
    if not tax_rate.is_finite() or not (0 <= tax_rate <= 1):
        return _unavailable("Alíquota tributária fora do intervalo de 0% a 100%.")
    if not ebit.is_finite():
        return _unavailable("EBIT inválido.")

    nopat = ebit * (Decimal(1) - tax_rate)
    return _capital_return(nopat, capital_open, capital_close, estimated)


def calculate_roe(
    *,
    net_income: Decimal | None,
    equity_open: Decimal | None,
    equity_close: Decimal | None,
    estimated: bool = False,
    comparable_period: bool = True,
) -> QualityResult:
    """Lucro atribuível dividido pelo patrimônio médio de mesma titularidade."""
    if not comparable_period:
        return _unavailable("Período ou saldos de patrimônio líquido não comparáveis.")
    return _capital_return(net_income, equity_open, equity_close, estimated)


def _as_date(value: date | str | None) -> date | None:
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return value


def spread_to_10y(
    value: Decimal | None,
    reference_date: date | str | None,
    benchmark_rate: Decimal | None,
    benchmark_reference_date: date | str | None,
) -> Decimal | None:
    """Compara taxas fracionárias da mesma referência e retorna pontos percentuais."""
    reference = _as_date(reference_date)
    if reference is None or reference != _as_date(benchmark_reference_date):
        return None
    if value is None or benchmark_rate is None:
        return None
    if not _available(value) or not _available(benchmark_rate):
        return None
    return (value - benchmark_rate) * HUNDRED


@dataclass(frozen=True, slots=True)
class QualityPoint:
    fiscal_year: int
    value: Decimal | None
    spread_pp: Decimal | None = None


@dataclass(frozen=True, slots=True)
class QualitySummary:
    valid_years: int
    mean: Decimal | None
    median: Decimal | None
    population_stddev: Decimal | None
    minimum: Decimal | None
    maximum: Decimal | None
    amplitude: Decimal | None
    trend_pp_per_year: Decimal | None
    annual_deltas_pp: dict[int, Decimal | None]
    spread_years: int
    positive_spread_years: int | None
    longest_positive_spread_streak: int | None
    latest_positive_spread_streak: int | None
    five_consecutive_positive_spreads: bool | None
    mean_spread_pp: Decimal | None
    population_stddev_spread_pp: Decimal | None


def _trend_pp_per_year(series: dict[int, Decimal]) -> Decimal | None:
    if len(series) < 2:
        return None
    first_year = min(series)
    years = [Decimal(year - first_year) for year in series]
    middle = mean(years)
    centered = [year - middle for year in years]
    covariance = sum(offset * rate for offset, rate in zip(centered, series.values()))
    return covariance / sum(offset**2 for offset in centered) * HUNDRED


def _spread_streaks(spreads: dict[int, Decimal], latest_year: int | None) -> tuple[int, int | None]:
    longest = 0
    current = 0
    prior_year = None
    for year, spread in spreads.items():
        if spread <= 0:
            current = 0
        elif prior_year is None or year != prior_year + 1:
            current = 1
        else:
            current += 1
        longest = max(longest, current)
        prior_year = year
    return longest, current if prior_year is not None and prior_year == latest_year else None


def summarize_quality(points: Iterable[QualityPoint]) -> QualitySummary:
    """Resume apenas observações finitas e evita preencher lacunas da série."""
    ordered = sorted(points, key=lambda point: point.fiscal_year)
    years = [point.fiscal_year for point in ordered]
    if len(set(years)) != len(years):
        raise ValueError("Há mais de uma observação para o mesmo exercício.")

    rates = {
        point.fiscal_year: point.value
        for point in ordered
        if point.value is not None and _available(point.value)
    }
    spreads = {
        point.fiscal_year: point.spread_pp
        for point in ordered
        if point.fiscal_year in rates
        and point.spread_pp is not None
        and _available(point.spread_pp)
    }
    deltas = {
        year: (rates[year] - rates[year - 1]) * HUNDRED
        if year in rates and year - 1 in rates
        else None
        for year in years
    }

    minimum = min(rates.values()) if rates else None
    maximum = max(rates.values()) if rates else None
    longest, latest = _spread_streaks(spreads, years[-1] if years else None)
    full_window = bool(years) and len(spreads) == years[-1] - years[0] + 1 and len(spreads) >= 5
    five_positive = True if longest >= 5 else False if full_window else None
    return QualitySummary(
        valid_years=len(rates),
        mean=mean(rates.values()) if rates else None,
        median=median(rates.values()) if rates else None,
        population_stddev=pstdev(rates.values()) if rates else None,
        minimum=minimum,
        maximum=maximum,
        amplitude=maximum - minimum if maximum is not None and minimum is not None else None,
        trend_pp_per_year=_trend_pp_per_year(rates),
        annual_deltas_pp=deltas,
        spread_years=len(spreads),
        positive_spread_years=sum(spread > 0 for spread in spreads.values()) if spreads else None,
        longest_positive_spread_streak=longest if spreads else None,
        latest_positive_spread_streak=latest,
        five_consecutive_positive_spreads=five_positive,
        mean_spread_pp=mean(spreads.values()) if spreads else None,
        population_stddev_spread_pp=pstdev(spreads.values()) if spreads else None,
    )
