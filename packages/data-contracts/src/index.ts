export const INDEX_CODES = ['IBOV', 'SMLL', 'IDIV'] as const;

export type IndexCode = (typeof INDEX_CODES)[number];
export type QualityStatus = 'validated' | 'estimated' | 'unavailable';

export interface DataProvenance {
  source: string;
  /** Data a que o dado se refere, no formato YYYY-MM-DD. */
  referenceDate: string;
  /** Instante de publicação com fuso. Null indica que o instante é desconhecido. */
  publishedAt: string | null;
  /** Instante de coleta com fuso. */
  retrievedAt: string;
  methodologyVersion: string;
  qualityStatus: QualityStatus;
}

export interface Company {
  /** Identificador estável, como código CVM ou CNPJ. */
  companyId: string;
  name: string;
  sector: string | null;
  representativeTicker: string | null;
  indexMemberships: IndexCode[];
}

export interface FundamentalAnnual {
  companyId: string;
  fiscalYear: number;
  nopat?: number | null;
  investedCapitalAverage?: number | null;
  roic?: number | null;
  roe?: number | null;
  riskFree10y?: number | null;
  spreadTo10y?: number | null;
  provenance: DataProvenance;
}

export interface MarketClose {
  ticker: string;
  /** Data do pregão, no formato YYYY-MM-DD. */
  tradeDate: string;
  close: number;
  currency: 'BRL';
  provenance: DataProvenance;
}

export interface SnapshotCoverage {
  /** Null indica que o tamanho do universo ainda é desconhecido. */
  eligibleCompanies: number | null;
  includedCompanies: number;
}

export interface SnapshotManifest {
  schemaVersion: string;
  /** Instante em que o lote foi gerado, com fuso. */
  generatedAt: string;
  /** Data-base do lote, no formato YYYY-MM-DD. */
  asOf: string;
  coverage: SnapshotCoverage;
}

export * from './cvm.ts';
export * from './index-universe.ts';
export * from './company-directory.ts';
export * from './quality.ts';
export * from './risk-free-rate.ts';
export * from './market-close.ts';
export * from './market-yields.ts';
export * from './price-fundamentals.ts';
export * from './backtest-history.ts';
export * from './sector-comparison.ts';
export * from './sector-leverage.ts';
export * from './sector-reinvestment.ts';
export * from './sector-margins.ts';
