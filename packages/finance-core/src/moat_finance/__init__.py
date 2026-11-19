"""API canônica do motor financeiro do Moat Analytics."""

from .price import (
    ShareClassClose,
    earnings_yield,
    enterprise_value,
    market_capitalization,
    operating_yield,
    spread_to_cdi,
)
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
    return_percentiles,
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
    "ShareClassClose",
    "calculate_roe",
    "calculate_roic",
    "earnings_yield",
    "enterprise_value",
    "invested_capital",
    "market_capitalization",
    "operating_yield",
    "rank_quality",
    "return_percentiles",
    "spread_to_10y",
    "spread_to_cdi",
    "summarize_quality",
)
