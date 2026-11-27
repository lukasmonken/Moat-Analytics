import { isDate, isListOf, isObject, isText, isTimestamp, unique } from './validation.ts';

export const backtestBenchmarks = ['IBOV', 'IDIV', 'SMAL11'] as const;
export type BacktestBenchmark = (typeof backtestBenchmarks)[number];

export interface TotalReturnObservation {
  date: string;
  level: number;
}

export interface BacktestHistory {
  schemaVersion: '1.0.0';
  frequency?: 'monthly';
  basis: 'total-return-brl';
  source: { name: string; url?: string; retrievedAt: string; methodology: string };
  assets: { company: string; instrument: string; observations: TotalReturnObservation[] }[];
  benchmarks?: { symbol: BacktestBenchmark; observations: TotalReturnObservation[] }[];
}

export interface DailyBacktestHistory extends Omit<BacktestHistory, 'frequency'> {
  frequency: 'daily';
  /** Último pregão registrado no lote, no formato YYYY-MM-DD. */
  asOf: string;
}

type SeriesValidator = (input: unknown) => input is TotalReturnObservation[];

const brazilianDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

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

function isMonthlySeries(input: unknown): input is TotalReturnObservation[] {
  return (
    isListOf(input, isObservation) &&
    input.length > 0 &&
    unique(input, ({ date }) => date.slice(0, 7))
  );
}

function isDailySeries(input: unknown): input is TotalReturnObservation[] {
  return (
    isListOf(input, isObservation) &&
    input.length > 0 &&
    input.every(({ date }, index) => date > (input[index - 1]?.date ?? ''))
  );
}

function isAsset(
  input: unknown,
  isSeries: SeriesValidator,
): input is BacktestHistory['assets'][number] {
  return (
    isObject(input) &&
    isText(input.company) &&
    input.company.length <= 250 &&
    isText(input.instrument) &&
    input.instrument.length <= 50 &&
    isSeries(input.observations)
  );
}

function isBenchmark(
  input: unknown,
  isSeries: SeriesValidator,
): input is NonNullable<BacktestHistory['benchmarks']>[number] {
  return (
    isObject(input) &&
    backtestBenchmarks.some((symbol) => symbol === input.symbol) &&
    isSeries(input.observations)
  );
}

function isHistory(
  input: Record<string, unknown>,
  isSeries: SeriesValidator,
): input is Record<string, unknown> & Omit<BacktestHistory, 'frequency'> {
  return (
    input.schemaVersion === '1.0.0' &&
    input.basis === 'total-return-brl' &&
    isSource(input.source) &&
    isListOf(input.assets, (asset) => isAsset(asset, isSeries)) &&
    input.assets.length > 0 &&
    unique(input.assets, ({ company }) => company) &&
    unique(input.assets, ({ instrument }) => instrument.trim().toUpperCase()) &&
    (input.benchmarks === undefined ||
      (isListOf(input.benchmarks, (benchmark) => isBenchmark(benchmark, isSeries)) &&
        unique(input.benchmarks, ({ symbol }) => symbol)))
  );
}

export function parseBacktestHistory(input: unknown): BacktestHistory {
  if (!isObject(input) || input.frequency === 'daily' || !isHistory(input, isMonthlySeries)) {
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

export function parseDailyBacktestHistory(input: unknown): DailyBacktestHistory {
  if (
    !isObject(input) ||
    input.frequency !== 'daily' ||
    !isDate(input.asOf) ||
    !isHistory(input, isDailySeries)
  ) {
    throw new Error('O arquivo não segue o formato de séries diárias de retorno total em reais.');
  }
  const { asOf, source, assets, benchmarks } = input;
  const collectionDate = brazilianDate
    .format(new Date(source.retrievedAt))
    .split('/')
    .reverse()
    .join('-');
  if (asOf > collectionDate) {
    throw new Error('A data-base é posterior à coleta informada.');
  }

  const lastDates = [...assets, ...(benchmarks ?? [])].map(
    ({ observations }) => observations.at(-1)?.date ?? '',
  );
  if (lastDates.some((date) => date > asOf) || !lastDates.includes(asOf)) {
    throw new Error('A data-base deve corresponder ao último pregão do histórico diário.');
  }
  return {
    schemaVersion: '1.0.0',
    basis: 'total-return-brl',
    frequency: 'daily',
    asOf,
    source,
    assets,
    ...(benchmarks && { benchmarks }),
  };
}
