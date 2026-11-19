import { isDate, isListOf, isObject, isText, isTimestamp, unique } from './validation.ts';

export const backtestBenchmarks = ['IBOV', 'IDIV', 'SMAL11'] as const;
export type BacktestBenchmark = (typeof backtestBenchmarks)[number];

export interface TotalReturnObservation {
  date: string;
  level: number;
}

export interface BacktestHistory {
  schemaVersion: '1.0.0';
  basis: 'total-return-brl';
  source: { name: string; url?: string; retrievedAt: string; methodology: string };
  assets: { company: string; instrument: string; observations: TotalReturnObservation[] }[];
  benchmarks?: { symbol: BacktestBenchmark; observations: TotalReturnObservation[] }[];
}

function isSafeHttps(input: unknown): input is string {
  if (typeof input !== 'string') return false;
  try {
    const parsed = new URL(input);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function isSource(input: unknown): input is BacktestHistory['source'] {
  return (
    isObject(input) &&
    isText(input.name) &&
    input.name.length <= 180 &&
    isText(input.methodology) &&
    input.methodology.length <= 1600 &&
    isTimestamp(input.retrievedAt) &&
    (input.url === undefined || isSafeHttps(input.url))
  );
}

function isObservation(input: unknown): input is TotalReturnObservation {
  return (
    isObject(input) &&
    isDate(input.date) &&
    typeof input.level === 'number' &&
    Number.isFinite(input.level) &&
    input.level > 0
  );
}

function isSeries(input: unknown): input is TotalReturnObservation[] {
  return (
    isListOf(input, isObservation) &&
    input.length > 0 &&
    unique(input, ({ date }) => date.slice(0, 7))
  );
}

function isAsset(input: unknown): input is BacktestHistory['assets'][number] {
  return (
    isObject(input) &&
    isText(input.company) &&
    input.company.length <= 250 &&
    isText(input.instrument) &&
    input.instrument.length <= 50 &&
    isSeries(input.observations)
  );
}

function isBenchmark(input: unknown): input is NonNullable<BacktestHistory['benchmarks']>[number] {
  return (
    isObject(input) &&
    backtestBenchmarks.some((symbol) => symbol === input.symbol) &&
    isSeries(input.observations)
  );
}

export function parseBacktestHistory(input: unknown): BacktestHistory {
  if (
    !isObject(input) ||
    input.schemaVersion !== '1.0.0' ||
    input.basis !== 'total-return-brl' ||
    !isSource(input.source) ||
    !isListOf(input.assets, isAsset) ||
    input.assets.length === 0 ||
    !unique(input.assets, ({ company }) => company) ||
    !unique(input.assets, ({ instrument }) => instrument.trim().toUpperCase()) ||
    (input.benchmarks !== undefined &&
      (!isListOf(input.benchmarks, isBenchmark) ||
        !unique(input.benchmarks, ({ symbol }) => symbol)))
  ) {
    throw new Error('O arquivo não segue o formato de séries mensais de retorno total em reais.');
  }
  const { source, assets, benchmarks } = input;
  const latestDate = new Date(source.retrievedAt).toISOString().slice(0, 10);
  if (
    [...assets, ...(benchmarks ?? [])].some(({ observations }) =>
      observations.some(({ date }) => date > latestDate),
    )
  ) {
    throw new Error('Há observações com data posterior à coleta informada.');
  }
  return {
    schemaVersion: '1.0.0',
    basis: 'total-return-brl',
    source,
    assets,
    ...(benchmarks && { benchmarks }),
  };
}
