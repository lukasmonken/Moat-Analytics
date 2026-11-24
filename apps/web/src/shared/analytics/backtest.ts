export interface MonthlyLevels {
  date: string;
  levels: readonly number[];
}

export interface BacktestParameters {
  weights: readonly number[];
  capital: number;
  contribution: number;
  rebalance: 'hold' | 'monthly';
  costRate: number;
  gainTaxRate: number;
}

interface BacktestPoint {
  date: string;
  value: number;
  contributions: number;
  periodReturn: number | null;
  totalReturn: number;
  drawdown: number;
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function monthIndex(date: string) {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
}

export function simulatePortfolio(months: readonly MonthlyLevels[], params: BacktestParameters) {
  const { weights, capital, contribution, rebalance, costRate, gainTaxRate } = params;
  const first = months[0];
  const last = months.at(-1);
  const totalWeight = sum(weights);
  if (
    months.length < 2 ||
    !first ||
    !last ||
    !weights.length ||
    ![capital, contribution, costRate, gainTaxRate].every(Number.isFinite) ||
    capital <= 0 ||
    contribution < 0 ||
    costRate < 0 ||
    costRate >= 1 ||
    gainTaxRate < 0 ||
    gainTaxRate >= 1 ||
    weights.some((weight) => !Number.isFinite(weight) || weight <= 0) ||
    Math.abs(totalWeight - 1) > 1e-12 ||
    months.some(
      ({ date, levels }, index) =>
        monthIndex(date) !== monthIndex(first.date) + index ||
        levels.length !== weights.length ||
        levels.some((value) => !Number.isFinite(value) || value <= 0),
    )
  )
    return null;

  const calendarReturns = new Map<number, { factor: number; months: number }>();
  const allocation = weights.map((weight) => weight / totalWeight);
  let costs = capital * costRate;
  let value = capital - costs;
  let holdings = allocation.map((weight) => weight * value);
  const attribution = allocation.map((weight) => ({
    weight,
    marketGain: 0,
    costs: costs * weight,
  }));
  let returnIndex = value / capital;
  let peak = 1;
  let maxDrawdown = 1 - returnIndex;
  let contributions = 0;
  const points: BacktestPoint[] = [
    {
      date: first.date,
      value,
      contributions,
      periodReturn: null,
      totalReturn: returnIndex - 1,
      drawdown: maxDrawdown,
    },
  ];
  const returns: number[] = [];
  let prior = first;
  const contributionCost = contribution * costRate;
  const netContribution = contribution - contributionCost;

  for (const month of months.slice(1)) {
    holdings = attribution.map((position, index) => {
      const opening = holdings[index] ?? NaN;
      const afterReturn = opening * ((month.levels[index] ?? NaN) / (prior.levels[index] ?? NaN));
      position.marketGain += afterReturn - opening;
      position.costs += contributionCost * position.weight;
      return afterReturn + netContribution * position.weight;
    });
    contributions += contribution;
    costs += contributionCost;
    let closing = sum(holdings);
    if (rebalance === 'monthly' && month !== last) {
      const turnover = sum(
        attribution.map((position, index) => {
          const traded = Math.abs((holdings[index] ?? NaN) - position.weight * closing);
          position.costs += traded * costRate;
          return traded;
        }),
      );
      const rebalanceCost = turnover * costRate;
      costs += rebalanceCost;
      closing -= rebalanceCost;
      holdings = allocation.map((weight) => weight * closing);
    }
    const factor = (closing - contribution) / value;
    if (!Number.isFinite(factor) || factor <= 0 || !Number.isFinite(closing)) return null;
    const periodReturn = factor - 1;
    returns.push(periodReturn);
    const year = Number(month.date.slice(0, 4));
    const calendar = calendarReturns.get(year) ?? {
      factor: returns.length === 1 ? 1 - costRate : 1,
      months: 0,
    };
    calendarReturns.set(year, { factor: calendar.factor * factor, months: calendar.months + 1 });
    returnIndex *= factor;
    peak = Math.max(peak, returnIndex);
    const drawdown = 1 - returnIndex / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    value = closing;
    prior = month;
    points.push({
      date: month.date,
      value,
      contributions,
      periodReturn,
      totalReturn: returnIndex - 1,
      drawdown,
    });
  }

  const gains = value - capital - contributions;
  const tax = Math.max(0, gains) * gainTaxRate;
  const elapsedDays = (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000;
  const cagr = returnIndex ** (365.2425 / elapsedDays) - 1;
  const mean = sum(returns) / returns.length;
  const annualizedVolatility =
    returns.length < 2
      ? null
      : Math.sqrt((12 * sum(returns.map((entry) => (entry - mean) ** 2))) / (returns.length - 1));
  const positions = attribution.map(({ marketGain, costs }, index) => ({
    marketGain,
    costs,
    contribution: marketGain - costs,
    finalWeight: (holdings[index] ?? NaN) / value,
  }));
  if (
    elapsedDays <= 0 ||
    ![costs, tax, value, gains, returnIndex, cagr, maxDrawdown].every(Number.isFinite) ||
    returnIndex <= 0 ||
    (annualizedVolatility !== null && !Number.isFinite(annualizedVolatility)) ||
    positions.some((position) => !Object.values(position).every(Number.isFinite))
  )
    return null;

  return {
    capital,
    contributions,
    costs,
    tax,
    terminalValue: value,
    finalValue: value - tax,
    profit: gains - tax,
    totalReturn: returnIndex - 1,
    cagr,
    annualizedVolatility,
    maxDrawdown,
    points,
    positions,
    calendarReturns: [...calendarReturns].map(([year, entry]) => ({
      year,
      months: entry.months,
      totalReturn: entry.factor - 1,
    })),
  };
}
