"""Percentis de qualidade para grupos com cobertura comparável."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from itertools import groupby
from typing import Iterable, Literal, Mapping

from .quality import QualityPoint, QualityResult, summarize_quality


Metric = Literal["roic", "roe"]
MINIMUM_PEERS = 5
MINIMUM_YEARS = 5
QUALITY_WEIGHTS = (30, 25, 20)


@dataclass(frozen=True, slots=True)
class PeerObservation:
    reference_date: date
    result: QualityResult
    spread_pp: Decimal | None


@dataclass(frozen=True, slots=True)
class PeerHistory:
    company_id: str
    metric: Metric
    segment: str
    observations: tuple[PeerObservation, ...]


@dataclass(frozen=True, slots=True)
class PeerRank:
    company_id: str
    position: int
    quality_score: Decimal
    return_percentile: Decimal
    spread_percentile: Decimal
    stability_percentile: Decimal


def _midrank_points(
    values: Mapping[str, Decimal], *, higher_is_better: bool
) -> dict[str, int]:
    """Posição média da faixa empatada, em unidades de meia posição."""
    ordered = sorted(values.items(), key=lambda item: item[1], reverse=higher_is_better)
    points = {}
    offset = 0
    for _, group in groupby(ordered, key=lambda item: item[1]):
        ties = list(group)
        midpoint_twice = 2 * offset + len(ties) - 1
        for company_id, _ in ties:
            points[company_id] = 2 * (len(ordered) - 1) - midpoint_twice
        offset += len(ties)
    return points


def _comparable_metrics(
    history: PeerHistory, dates: tuple[date, ...]
) -> tuple[Decimal, Decimal, Decimal] | None:
    relevant = [entry for entry in history.observations if entry.reference_date in dates]
    by_date = {entry.reference_date: entry for entry in relevant}
    if len(by_date) != len(relevant):
        raise ValueError(f"Observações duplicadas para {history.company_id}.")

    points = []
    for end in dates:
        observation = by_date.get(end)
        if observation is None or observation.result.quality_status != "validated":
            return None
        points.append(QualityPoint(end.year, observation.result.value, observation.spread_pp))

    summary = summarize_quality(points)
    if summary.mean is None or summary.mean_spread_pp is None or summary.population_stddev is None:
        return None
    if summary.valid_years != len(dates) or summary.spread_years != len(dates):
        return None
    return summary.mean, summary.mean_spread_pp, summary.population_stddev


def rank_quality(
    peers: Iterable[PeerHistory],
    *,
    metric: Metric,
    segment: str,
    fiscal_dates: Iterable[date],
) -> tuple[PeerRank, ...] | None:
    """Classifica retorno, spread e estabilidade em uma janela comum de cinco ou mais anos."""
    dates = tuple(sorted(fiscal_dates))
    if len(dates) < MINIMUM_YEARS:
        return None
    years = {end.year for end in dates}
    if len(years) != len(dates) or max(years) - min(years) + 1 != len(years):
        return None

    levels = {}
    spreads = {}
    deviations = {}
    seen = set()
    for peer in peers:
        if peer.metric != metric or peer.segment != segment:
            continue
        if peer.company_id in seen:
            raise ValueError(f"Companhia repetida no grupo: {peer.company_id}.")
        seen.add(peer.company_id)
        metrics = _comparable_metrics(peer, dates)
        if metrics is not None:
            levels[peer.company_id], spreads[peer.company_id], deviations[peer.company_id] = metrics

    if len(levels) < MINIMUM_PEERS:
        return None

    factors = (
        _midrank_points(levels, higher_is_better=True),
        _midrank_points(spreads, higher_is_better=True),
        _midrank_points(deviations, higher_is_better=False),
    )
    total_points = Decimal(2 * (len(levels) - 1))

    def weighted_points(company_id: str) -> int:
        return sum(weight * points[company_id] for weight, points in zip(QUALITY_WEIGHTS, factors))

    def percentile(points: int) -> Decimal:
        return Decimal(points) * 100 / total_points

    ordered = sorted(levels, key=lambda company_id: (-weighted_points(company_id), company_id))
    ranks = []
    previous_points = None
    position = 1
    for index, company_id in enumerate(ordered, start=1):
        points = weighted_points(company_id)
        if points != previous_points:
            position = index
        ranks.append(
            PeerRank(
                company_id=company_id,
                position=position,
                quality_score=percentile(points) / sum(QUALITY_WEIGHTS),
                return_percentile=percentile(factors[0][company_id]),
                spread_percentile=percentile(factors[1][company_id]),
                stability_percentile=percentile(factors[2][company_id]),
            )
        )
        previous_points = points
    return tuple(ranks)
