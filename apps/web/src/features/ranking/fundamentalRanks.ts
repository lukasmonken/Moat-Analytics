import type {
  MarketYieldsSnapshot,
  SectorLeverageSnapshot,
  SectorReinvestmentSnapshot,
} from '@moat/data-contracts';
import {
  annualObservation,
  annualRate,
  comparisonSector,
  type Company,
  type ComparisonData,
} from '../company/companyQualityData';
import { compareNames } from '../screener/presentation';
import { rankRoicDrawdown } from './roicDrawdown';

export const accountingFactors = ['profitability', 'moat', 'leverage', 'risk', 'growth'] as const;
const corporateFactors = [...accountingFactors, 'price'] as const;
const financialFactors = ['profitability', 'growth', 'price'] as const;
type ScoreFactor = (typeof corporateFactors)[number];
export type FundamentalFactor = ScoreFactor | 'accountingScore' | 'score';

export interface FundamentalRow extends Record<FundamentalFactor, number | null> {
  name: string;
  sector: string;
  metric: Company['metric'];
  validYears: number;
  growthBaseBrl: number | null;
  growthFinalBrl: number | null;
  growthReason: string | null;
  zScores: Partial<Record<ScoreFactor, number>>;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function annualEarnings(company: Company, year: number) {
  const inputs = annualObservation(company, year)?.inputs;
  if (!inputs) return null;
  return 'nopatBrl' in inputs ? inputs.nopatBrl : inputs.netIncomeBrl;
}

function growthIn(company: Company, years: number[]) {
  const points = years.map((year) => annualEarnings(company, year));
  const base = points[0] ?? null;
  const final = points.at(-1) ?? null;
  const coverage = { growthBaseBrl: base, growthFinalBrl: final };
  if (years.length !== 5 || !points.every(isNumber) || base === null || final === null) {
    return { ...coverage, growth: null, growthReason: 'Histórico contábil incompleto.' };
  }
  if (base <= 0 || final <= 0) {
    return { ...coverage, growth: null, growthReason: 'Base inicial ou final não positiva.' };
  }
  const growth = (final / base) ** (1 / (years.length - 1)) - 1;
  return isNumber(growth)
    ? { ...coverage, growth, growthReason: null }
    : {
        ...coverage,
        growth: null,
        growthReason: 'Crescimento anualizado fora do intervalo numérico.',
      };
}

function matchingValues(
  snapshot: SectorLeverageSnapshot | SectorReinvestmentSnapshot | null,
  asOf: string,
  year: number | undefined,
) {
  if (!snapshot || snapshot.manifest.asOf !== asOf || snapshot.manifest.year !== year) {
    return new Map<string, number | null>();
  }
  return new Map(snapshot.companies.map(({ name, value }) => [name, value]));
}

export function signedDirection(factor: FundamentalFactor) {
  return factor === 'leverage' || factor === 'risk' ? -1 : 1;
}

export function availableFactorCount(row: FundamentalRow, includePrice = true): number {
  const factors = row.metric === 'ROIC' ? corporateFactors : financialFactors;
  return factors.filter((factor) => (includePrice || factor !== 'price') && isNumber(row[factor]))
    .length;
}

function normalizeGroup(rows: FundamentalRow[], factors: readonly ScoreFactor[]) {
  for (const factor of factors) {
    const observed = rows.flatMap((row) => {
      const value = row[factor];
      return isNumber(value) ? [{ row, value }] : [];
    });
    if (observed.length < 2) continue;
    const mean = observed.reduce((sum, { value }) => sum + value, 0) / observed.length;
    const variance =
      observed.reduce((sum, { value }) => sum + (value - mean) ** 2, 0) / observed.length;
    const deviation = Math.sqrt(variance);
    for (const { row, value } of observed) {
      row.zScores[factor] =
        deviation === 0 ? 0 : signedDirection(factor) * ((value - mean) / deviation);
    }
  }
}

function aggregate(row: FundamentalRow, factors: readonly ScoreFactor[]): number | null {
  const zScores = factors.map((factor) => row.zScores[factor]);
  return zScores.every(isNumber)
    ? zScores.reduce((sum, score) => sum + score, 0) / factors.length
    : null;
}

export function buildFundamentalRanks(
  data: ComparisonData,
  leverage: SectorLeverageSnapshot | null,
  reinvestment: SectorReinvestmentSnapshot | null,
  marketYields: MarketYieldsSnapshot | null = null,
) {
  const comparison = rankRoicDrawdown({
    manifest: data.roic,
    companies: data.companies.filter((company) => company.metric === 'ROIC'),
  });
  const { years } = comparison;
  const riskByName = new Map(comparison.rows.map(({ name, drawdownPp }) => [name, drawdownPp]));
  const latest = years.at(-1);
  const sourceYears = years.filter((year) => data.roic.years.includes(year));
  const leverageByName = matchingValues(leverage, data.roic.asOf, latest);
  const moatByName = matchingValues(reinvestment, data.roic.asOf, latest);
  const market = marketYields?.selectionAsOf === data.roic.asOf ? marketYields : null;
  const yieldByName = new Map(market?.companies.map(({ name, valuation }) => [name, valuation]));
  const rows = data.companies.map((company): FundamentalRow => {
    const { name, metric } = company;
    const latestRate = latest === undefined ? null : annualRate(annualObservation(company, latest));
    const marketYield = yieldByName.get(name);
    const expectedYield = metric === 'ROIC' ? 'operatingYield' : 'earningsYield';
    return {
      name,
      sector: comparisonSector(company),
      metric,
      profitability: isNumber(latestRate) ? latestRate : null,
      moat: metric === 'ROIC' ? (moatByName.get(name) ?? null) : null,
      leverage: metric === 'ROIC' ? (leverageByName.get(name) ?? null) : null,
      risk: metric === 'ROIC' ? (riskByName.get(name) ?? null) : null,
      price: marketYield?.metric === expectedYield ? marketYield.value : null,
      validYears: sourceYears.filter((year) =>
        isNumber(annualRate(annualObservation(company, year))),
      ).length,
      ...growthIn(company, sourceYears),
      score: null,
      accountingScore: null,
      zScores: {},
    };
  });
  normalizeGroup(
    rows.filter(({ metric }) => metric === 'ROIC'),
    corporateFactors,
  );
  normalizeGroup(
    rows.filter(({ metric }) => metric === 'ROE'),
    financialFactors,
  );
  for (const row of rows) {
    row.score = aggregate(row, row.metric === 'ROIC' ? corporateFactors : financialFactors);
    if (row.metric === 'ROIC') row.accountingScore = aggregate(row, accountingFactors);
  }
  return { years, rows, marketTradeDate: market?.tradeDate ?? null };
}

export function orderFundamentalRanks(rows: FundamentalRow[], factor: FundamentalFactor) {
  return [...rows].sort((left, right) => {
    const a = left[factor];
    const b = right[factor];
    if (a === b) return compareNames(left.name, right.name);
    if (a === null) return 1;
    if (b === null) return -1;
    return (b - a) * signedDirection(factor);
  });
}
