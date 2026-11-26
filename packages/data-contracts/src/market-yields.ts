import { isDate, isListOf, isObject, isText, unique } from './validation.ts';

interface CompanyYield {
  name: string;
  valuation: {
    metric: 'operatingYield' | 'earningsYield' | null;
    value: number | null;
    accounting: { referenceDate: string } | null;
    reason: string | null;
  };
}

export interface MarketYieldsSnapshot {
  tradeDate: string;
  selectionAsOf: string;
  companies: CompanyYield[];
}

function isCompanyYield(value: unknown): value is CompanyYield {
  if (!isObject(value) || !isText(value.name) || !isObject(value.valuation)) return false;
  const { value: yieldValue, accounting, metric, reason } = value.valuation;
  return (
    (metric === 'operatingYield' || metric === 'earningsYield' || metric === null) &&
    (accounting === null || (isObject(accounting) && isDate(accounting.referenceDate))) &&
    (yieldValue === null
      ? isText(reason)
      : typeof yieldValue === 'number' &&
        Number.isFinite(yieldValue) &&
        metric !== null &&
        accounting !== null &&
        reason === null)
  );
}

export function parseMarketYieldsSnapshot(input: unknown): MarketYieldsSnapshot {
  if (!isObject(input) || !isObject(input.manifest)) {
    throw new Error('Lote de rendimento implícito inválido.');
  }
  const { tradeDate, selectionAsOf, schemaVersion, valuationMethodologyVersion } = input.manifest;
  if (
    schemaVersion !== '1.0.0' ||
    valuationMethodologyVersion !== 'market-yields-dfp.v1' ||
    !isDate(tradeDate) ||
    !isDate(selectionAsOf) ||
    tradeDate < selectionAsOf ||
    !isListOf(input.companies, isCompanyYield) ||
    input.companies.length === 0 ||
    !unique(input.companies, ({ name }) => name) ||
    input.companies.some(
      ({ valuation }) => valuation.accounting && valuation.accounting.referenceDate > tradeDate,
    )
  ) {
    throw new Error('Lote de rendimento implícito inválido.');
  }
  return { tradeDate, selectionAsOf, companies: input.companies };
}
