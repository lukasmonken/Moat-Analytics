"""API canônica do motor financeiro do Moat Analytics."""

from .backtest import BacktestPoint, BacktestResult, MonthlyTotalReturnPoint, simulate_portfolio
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
from .valuation import ValuationResult, calculate_fcff, value_dcf, value_ddm

__all__ = (
    "BacktestPoint",
    "BacktestResult",
    "MINIMUM_PEERS",
    "MINIMUM_YEARS",
    "MonthlyTotalReturnPoint",
    "PeerHistory",
    "PeerObservation",
    "PeerRank",
    "QualityPoint",
    "QualityResult",
    "QualitySummary",
    "ShareClassClose",
    "ValuationResult",
    "calculate_fcff",
    "calculate_roe",
    "calculate_roic",
    "earnings_yield",
    "enterprise_value",
    "invested_capital",
    "market_capitalization",
    "operating_yield",
    "rank_quality",
    "return_percentiles",
    "simulate_portfolio",
    "spread_to_10y",
    "spread_to_cdi",
    "summarize_quality",
    "value_dcf",
    "value_ddm",
)
