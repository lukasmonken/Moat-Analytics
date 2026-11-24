import { isProvenance } from './cvm.ts';
import type { MarketClose } from './index.ts';
import { isDate, isListOf, isObject, isText, unique } from './validation.ts';

export interface MarketCloseSnapshot {
  schemaVersion: '1.0.0';
  expectedTradeDate: string;
  source: { name: string; url: string; redistributionBasis: string | null };
  quotes: MarketClose[];
}

function isSource(input: unknown): input is MarketCloseSnapshot['source'] {
  if (
    !isObject(input) ||
    !isText(input.name) ||
    typeof input.url !== 'string' ||
    (input.redistributionBasis !== null && !isText(input.redistributionBasis))
  ) {
    return false;
  }
  try {
    const url = new URL(input.url);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isQuote(input: unknown): input is MarketClose {
  return (
    isObject(input) &&
    typeof input.ticker === 'string' &&
    /^[A-Z][A-Z0-9]{3}[0-9]{1,2}$/.test(input.ticker) &&
    isDate(input.tradeDate) &&
    typeof input.close === 'number' &&
    Number.isFinite(input.close) &&
    input.close > 0 &&
    input.currency === 'BRL' &&
    isProvenance(input.provenance) &&
    input.provenance.referenceDate === input.tradeDate &&
    input.provenance.methodologyVersion === 'market-close.v1' &&
    input.provenance.qualityStatus === 'validated'
  );
}

export function parseMarketCloseSnapshot(input: unknown): MarketCloseSnapshot {
  if (
    !isObject(input) ||
    input.schemaVersion !== '1.0.0' ||
    !isDate(input.expectedTradeDate) ||
    !isSource(input.source) ||
    !isListOf(input.quotes, isQuote) ||
    input.quotes.length === 0 ||
    !unique(input.quotes, ({ ticker }) => ticker)
  ) {
    throw new Error('Lote de fechamentos inválido ou versão de esquema incompatível.');
  }
  const { source, expectedTradeDate, quotes } = input;
  if (
    quotes.some(
      ({ tradeDate, provenance }) =>
        tradeDate > expectedTradeDate || provenance.source !== source.name,
    )
  ) {
    throw new Error('Data de pregão ou fonte divergente do lote.');
  }
  return { schemaVersion: '1.0.0', expectedTradeDate, source, quotes };
}
