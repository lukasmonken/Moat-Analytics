import {
  isCvmSource,
  isCvmUrl,
  isProvenance,
  type CvmCompanyCategory,
  type CvmSource,
} from './cvm.ts';
import type { DataProvenance, SnapshotManifest } from './index.ts';
import {
  isHistoricalMarketPoint,
  isPriceBalance,
  isPriceShareCounts,
  type HistoricalMarketPoint,
  type PriceBalance,
  type PriceShareCounts,
} from './price-denominators.ts';
import {
  isDate,
  isListOf,
  isObject,
  isPositiveInteger,
  isText,
  isTimestamp,
  unique,
} from './validation.ts';

export interface PriceFundamentalInput {
  role: 'annual' | 'currentYtd' | 'priorYtd';
  accountCode: string;
  accountLabel: string;
  periodStart: string;
  periodEnd: string;
  amountBrl: number;
  filingVersion: number;
  receiptDate: string;
  documentUrl: string;
  archiveUrl: string;
  archiveSha256: string;
  retrievedAt: string;
}

export interface PriceFundamental {
  companyId: string;
  name: string;
  category: CvmCompanyCategory;
  metric: 'nopat' | 'parentNetIncome';
  periodStart: string;
  periodEnd: string;
  amountBrl: number;
  incomeTtmBrl: number;
  taxRate: number | null;
  provenance: DataProvenance;
  inputs: PriceFundamentalInput[];
  balance?: PriceBalance;
  shares?: PriceShareCounts;
  denominatorIssues?: { balance?: string; shares?: string };
  historicalMarketPoint?: HistoricalMarketPoint;
}

export interface PriceFundamentalsSnapshot {
  manifest: SnapshotManifest & {
    schemaVersion: '1.0.0';
    coverage: { eligibleCompanies: number; includedCompanies: number };
    sources: CvmSource[];
  };
  companies: PriceFundamental[];
  issues: { companyId: string; message: string }[];
}

function isCompanyId(input: unknown): input is string {
  return typeof input === 'string' && /^cvm:[1-9][0-9]*$/.test(input);
}

function isMoney(input: unknown): input is number {
  return typeof input === 'number' && Number.isFinite(input);
}

function isInput(input: unknown): input is PriceFundamentalInput {
  return (
    isObject(input) &&
    (input.role === 'annual' || input.role === 'currentYtd' || input.role === 'priorYtd') &&
    isText(input.accountCode) &&
    isText(input.accountLabel) &&
    isDate(input.periodStart) &&
    isDate(input.periodEnd) &&
    input.periodStart <= input.periodEnd &&
    isMoney(input.amountBrl) &&
    isPositiveInteger(input.filingVersion) &&
    isDate(input.receiptDate) &&
    input.periodEnd <= input.receiptDate &&
    isCvmUrl(input.documentUrl) &&
    isCvmUrl(input.archiveUrl) &&
    typeof input.archiveSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(input.archiveSha256) &&
    isTimestamp(input.retrievedAt)
  );
}

function isDenominatorIssue(input: unknown) {
  return (
    isObject(input) &&
    (input.balance === undefined || isText(input.balance)) &&
    (input.shares === undefined || isText(input.shares))
  );
}

function isFundamental(input: unknown): input is PriceFundamental {
  if (!(
    isObject(input) &&
    isCompanyId(input.companyId) &&
    isText(input.name) &&
    isDate(input.periodStart) &&
    isDate(input.periodEnd) &&
    input.periodStart < input.periodEnd &&
    isMoney(input.amountBrl) &&
    isMoney(input.incomeTtmBrl) &&
    isProvenance(input.provenance) &&
    input.provenance.referenceDate === input.periodEnd &&
    input.provenance.methodologyVersion === 'price-fundamentals.v1' &&
    ((input.category === 'bank' &&
      input.metric === 'parentNetIncome' &&
      input.taxRate === null &&
      input.provenance.qualityStatus === 'validated') ||
      ((input.category === 'industry' || input.category === 'retail') &&
        input.metric === 'nopat' &&
        input.taxRate === 0.34 &&
        input.provenance.qualityStatus === 'estimated')) &&
    isListOf(input.inputs, isInput) &&
    input.inputs.length === 3 &&
    unique(input.inputs, ({ role }) => role) &&
    (input.balance === undefined ||
      (input.category !== 'bank' &&
        isPriceBalance(input.balance) &&
        input.balance.provenance.referenceDate === input.periodEnd)) &&
    (input.shares === undefined ||
      (isPriceShareCounts(input.shares) && input.shares.referenceDate <= input.periodEnd)) &&
    (input.denominatorIssues === undefined || isDenominatorIssue(input.denominatorIssues)) &&
    (input.historicalMarketPoint === undefined ||
      isHistoricalMarketPoint(input.historicalMarketPoint))
  )) {
    return false;
  }
  const currentItr = input.inputs.find(({ role }) => role === 'currentYtd');
  const { historicalMarketPoint, shares } = input;
  if (
    historicalMarketPoint !== undefined &&
    (input.metric !== 'parentNetIncome' ||
      shares === undefined ||
      historicalMarketPoint.referenceDate !== input.periodEnd ||
      historicalMarketPoint.referenceDate !== shares.referenceDate ||
      historicalMarketPoint.documentUrl !== shares.evidenceUrl ||
      historicalMarketPoint.classes.length !== shares.classes.length ||
      historicalMarketPoint.classes.some(
        ({ ticker }) => !shares.classes.some((row) => row.ticker === ticker),
      ))
  ) {
    return false;
  }
  return (
    currentItr !== undefined &&
    [input.balance, input.shares].every(
      (evidence) =>
        evidence === undefined ||
        (evidence.filingVersion === currentItr.filingVersion &&
          evidence.archiveSha256 === currentItr.archiveSha256 &&
          evidence.documentUrl === currentItr.documentUrl),
    )
  );
}

function isManifest(input: unknown): input is PriceFundamentalsSnapshot['manifest'] {
  return (
    isObject(input) &&
    input.schemaVersion === '1.0.0' &&
    isDate(input.asOf) &&
    isTimestamp(input.generatedAt) &&
    isListOf(input.sources, isCvmSource) &&
    input.sources.length === 2 &&
    unique(input.sources, ({ datasetUrl }) => datasetUrl) &&
    isObject(input.coverage) &&
    isPositiveInteger(input.coverage.eligibleCompanies) &&
    isPositiveInteger(input.coverage.includedCompanies)
  );
}

function isIssue(input: unknown): input is PriceFundamentalsSnapshot['issues'][number] {
  return isObject(input) && isCompanyId(input.companyId) && isText(input.message);
}

export function parsePriceFundamentalsSnapshot(input: unknown): PriceFundamentalsSnapshot {
  if (
    !isObject(input) ||
    !isManifest(input.manifest) ||
    !isListOf(input.companies, isFundamental) ||
    !isListOf(input.issues, isIssue) ||
    !unique([...input.companies, ...input.issues], ({ companyId }) => companyId) ||
    input.manifest.coverage.includedCompanies !== input.companies.length ||
    input.manifest.coverage.eligibleCompanies !== input.companies.length + input.issues.length
  ) {
    throw new Error('Lote de resultados dos últimos 12 meses inválido.');
  }
  const { manifest, companies, issues } = input;
  if (companies.some(({ periodEnd }) => periodEnd !== manifest.asOf)) {
    throw new Error('O encerramento do período diverge da data-base do lote.');
  }
  return { manifest, companies, issues };
}
