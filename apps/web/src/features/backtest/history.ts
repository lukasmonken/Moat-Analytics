import {
  backtestBenchmarks,
  type BacktestHistory,
  type TotalReturnObservation,
} from '@moat/data-contracts';
import { simulatePortfolio, type MonthlyLevels } from '../../shared/analytics/backtest';
import { totalWeightUnits, type SavedPortfolio } from '../portfolio/portfolio';

export const horizons = ['ytd', '2', '3', '4', '5', '6', '7', 'custom'] as const;
export type Horizon = (typeof horizons)[number];

function month(date: string) {
  return date.slice(0, 7);
}

function monthIndex(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return NaN;
  return Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
}

function monthAt(index: number) {
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function byMonth(observations: TotalReturnObservation[]) {
  return new Map(observations.map((entry) => [month(entry.date), entry]));
}

function normalizedReturns(months: readonly MonthlyLevels[], position: number) {
  const returns = months.slice(1).map(({ levels }, index) => {
    const previous = months[index]?.levels[position] ?? NaN;
    return (levels[position] ?? NaN) / previous - 1;
  });
  const scale = Math.max(...returns.map(Math.abs));
  if (!Number.isFinite(scale) || scale === 0) return null;

  // A escala preserva a correlação e evita quadrados de retornos extremos.
  const scaled = returns.map((value) => value / scale);
  const mean = scaled.reduce((sum, value) => sum + value, 0) / scaled.length;
  const centered = scaled.map((value) => value - mean);
  const magnitude = Math.hypot(...centered);
  return magnitude > 0 ? centered.map((value) => value / magnitude) : null;
}

function monthlyReturnCorrelations(months: readonly MonthlyLevels[], positions: number) {
  const series = Array.from({ length: positions }, (_, position) =>
    months.length >= 4 ? normalizedReturns(months, position) : null,
  );
  return series.map((left, row) =>
    series.map((right, column) => {
      if (!left || !right) return null;
      if (row === column) return 1;
      const coefficient = left.reduce(
        (total, value, index) => total + value * (right[index] ?? NaN),
        0,
      );
      return Number.isFinite(coefficient) ? Math.max(-1, Math.min(1, coefficient)) : null;
    }),
  );
}

export function prepareBacktest(
  portfolio: SavedPortfolio,
  history: BacktestHistory,
  horizon: Horizon,
  startMonth: string,
  endMonth: string,
) {
  const assets = new Map(history.assets.map((asset) => [asset.company, asset]));
  const missing = portfolio.positions.filter(({ name }) => !assets.has(name));
  if (missing.length) {
    throw new Error(`Faltam séries para ${missing.map(({ name }) => name).join(', ')}.`);
  }
  const selected = portfolio.positions.flatMap(({ name }) => {
    const asset = assets.get(name);
    return asset ? [asset] : [];
  });
  const indexed = selected.map(({ observations }) => byMonth(observations));
  const latestMonths = indexed.flatMap((entries) => [...entries.keys()]).sort();
  const latest = latestMonths.at(-1) ?? '';
  const end = monthIndex(horizon === 'custom' ? endMonth : latest);
  const start =
    horizon === 'custom'
      ? monthIndex(startMonth)
      : horizon === 'ytd'
        ? Math.floor(end / 12) * 12 - 1
        : end - Number(horizon) * 12;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end - start > 600) {
    throw new Error('Informe uma janela de 1 a 600 meses com o mês inicial anterior ao final.');
  }

  const months = Array.from({ length: end - start + 1 }, (_, index) => {
    const wanted = monthAt(start + index);
    const points = indexed.map((entries, assetIndex) => {
      const observation = entries.get(wanted);
      if (!observation) {
        throw new Error(
          `Falta observação em ${wanted} para ${selected[assetIndex]?.company ?? 'uma companhia'}.`,
        );
      }
      return observation;
    });
    const date = points[0]?.date;
    if (!date || points.some((entry) => entry.date !== date)) {
      throw new Error(`As companhias têm pregões diferentes em ${wanted}.`);
    }
    return { date, levels: points.map(({ level }) => level) };
  });
  const { capital, contribution, rebalance, costRate, gainTaxRate } = portfolio;
  const weights = portfolio.positions.map(({ weightUnits }) => weightUnits / totalWeightUnits);
  const result = simulatePortfolio(months, {
    weights,
    capital,
    contribution,
    rebalance,
    costRate,
    gainTaxRate,
  });
  if (!result) throw new Error('O cálculo ficou inviável com os dados e os custos informados.');

  const positions = selected.map(({ company, instrument }, index) => {
    const targetWeight = weights[index];
    const attribution = result.positions[index];
    if (targetWeight === undefined || !attribution) {
      throw new Error('Não foi possível conciliar as posições da retrospectiva.');
    }
    const { marketGain, costs, contribution, finalWeight } = attribution;
    return { company, instrument, targetWeight, marketGain, costs, contribution, finalWeight };
  });

  const comparisons = backtestBenchmarks.map((symbol) => {
    const benchmark = history.benchmarks?.find((entry) => entry.symbol === symbol);
    if (!benchmark) return { symbol, totalReturn: null, cagr: null };
    const levels = byMonth(benchmark.observations);
    const observations = months.flatMap(({ date }) => {
      const observation = levels.get(month(date));
      return observation?.date === date ? [{ date, levels: [observation.level] }] : [];
    });
    const comparison =
      observations.length === months.length
        ? simulatePortfolio(observations, {
            weights: [1],
            capital: 1,
            contribution: 0,
            rebalance: 'hold',
            costRate: 0,
            gainTaxRate: 0,
          })
        : null;
    return { symbol, totalReturn: comparison?.totalReturn ?? null, cagr: comparison?.cagr ?? null };
  });

  return {
    result,
    comparisons,
    positions,
    correlations: monthlyReturnCorrelations(months, positions.length),
  };
}
