"""API canônica do motor financeiro do Moat Analytics."""

from .quality import (
    QualityPoint,
    QualityResult,
    QualitySummary,
    calculate_roe,
    calculate_roic,
    invested_capital,
    spread_to_10y,
    summarize_quality,
)

from .ranking import (
    MINIMUM_PEERS,
    MINIMUM_YEARS,
    PeerHistory,
    PeerObservation,
    PeerRank,
    rank_quality,
)

__all__ = (
    "MINIMUM_PEERS",
    "MINIMUM_YEARS",
    "PeerHistory",
    "PeerObservation",
    "PeerRank",
    "QualityPoint",
    "QualityResult",
    "QualitySummary",
    "calculate_roe",
    "calculate_roic",
    "invested_capital",
    "rank_quality",
    "spread_to_10y",
    "summarize_quality",
)
