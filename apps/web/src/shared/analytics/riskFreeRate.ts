import type { RiskFreeRate } from '@moat/data-contracts';

export function spreadToRiskFreeRate(value: number | null, rate: RiskFreeRate | null) {
  return value === null || rate === null ? null : (value - rate.value) * 100;
}
