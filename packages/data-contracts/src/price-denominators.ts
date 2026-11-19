import { isCvmUrl, isProvenance } from './cvm.ts';
import type { DataProvenance } from './index.ts';
import {
  isDate,
  isListOf,
  isObject,
  isPositiveInteger,
  isText,
  isTimestamp,
  unique,
} from './validation.ts';

interface CvmPriceEvidence {
  filingVersion: number;
  receiptDate: string;
  documentUrl: string;
  archiveUrl: string;
  archiveSha256: string;
}

interface PriceBalanceInput {
  key: string;
  statement: 'BPA' | 'BPP';
  code: string;
  label: string;
  referenceDate: string;
  amountBrl: number;
}

export interface PriceBalance extends CvmPriceEvidence {
  borrowingsBrl: number;
  leaseLiabilitiesBrl: number;
  grossDebtBrl: number;
  cashBrl: number;
  netDebtBrl: number;
  nonControllingInterestsBrl: number;
  financialInvestmentsBrl: number;
  provenance: DataProvenance;
  inputs: PriceBalanceInput[];
  limitations: string[];
}

interface ShareClassCount {
  ticker: string;
  kind: 'ON' | 'PN';
  issued: number;
  treasury: number;
  outstanding: number;
}

export interface PriceShareCounts extends CvmPriceEvidence {
  referenceDate: string;
  retrievedAt: string;
  evidenceUrl: string;
  classes: ShareClassCount[];
}

export interface HistoricalMarketPoint {
  referenceDate: string;
  sourceName: string;
  documentUrl: string;
  reusePolicyUrl: string;
  classes: { ticker: string; priceBrl: number }[];
  marketCapBrl: number;
  /** Rendimento em fração. */
  earningsYield: number;
}

const secPolicy = 'https://www.sec.gov/about/webmaster-frequently-asked-questions';

function isFilingEvidence(input: unknown): input is CvmPriceEvidence & Record<string, unknown> {
  return (
    isObject(input) &&
    isPositiveInteger(input.filingVersion) &&
    isDate(input.receiptDate) &&
    isCvmUrl(input.documentUrl) &&
    isCvmUrl(input.archiveUrl) &&
    typeof input.archiveSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(input.archiveSha256)
  );
}

function finite(input: unknown): input is number {
  return typeof input === 'number' && Number.isFinite(input);
}

function nonnegative(input: unknown): input is number {
  return finite(input) && input >= 0;
}

function isBalanceInput(input: unknown): input is PriceBalanceInput {
  return (
    isObject(input) &&
    isText(input.key) &&
    (input.statement === 'BPA' || input.statement === 'BPP') &&
    isText(input.code) &&
    isText(input.label) &&
    isDate(input.referenceDate) &&
    finite(input.amountBrl)
  );
}

export function isPriceBalance(input: unknown): input is PriceBalance {
  if (
    !isFilingEvidence(input) ||
    !nonnegative(input.borrowingsBrl) ||
    !nonnegative(input.leaseLiabilitiesBrl) ||
    !nonnegative(input.grossDebtBrl) ||
    !nonnegative(input.cashBrl) ||
    !finite(input.netDebtBrl) ||
    !finite(input.nonControllingInterestsBrl) ||
    !nonnegative(input.financialInvestmentsBrl) ||
    !isProvenance(input.provenance) ||
    input.provenance.methodologyVersion !== 'price-balance.v1' ||
    input.provenance.qualityStatus !== 'validated' ||
    input.receiptDate < input.provenance.referenceDate ||
    !isListOf(input.inputs, isBalanceInput) ||
    input.inputs.length === 0 ||
    !unique(input.inputs, ({ key }) => key) ||
    !isListOf(input.limitations, isText)
  ) {
    return false;
  }
  const reference = input.provenance.referenceDate;
  return (
    Math.abs(input.grossDebtBrl - (input.borrowingsBrl + input.leaseLiabilitiesBrl)) < 0.005 &&
    Math.abs(input.netDebtBrl - (input.grossDebtBrl - input.cashBrl)) < 0.005 &&
    input.inputs.every(({ referenceDate }) => referenceDate === reference)
  );
}

function isShareClass(input: unknown): input is ShareClassCount {
  return (
    isObject(input) &&
    typeof input.ticker === 'string' &&
    /^[A-Z][A-Z0-9]{3}[0-9]{1,2}$/.test(input.ticker) &&
    (input.kind === 'ON' || input.kind === 'PN') &&
    isPositiveInteger(input.issued) &&
    (input.treasury === 0 || isPositiveInteger(input.treasury)) &&
    isPositiveInteger(input.outstanding) &&
    input.issued - input.treasury === input.outstanding
  );
}

function isEvidenceUrl(input: unknown): input is string {
  if (typeof input !== 'string') return false;
  try {
    const url = new URL(input);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (url.hostname === 'www.sec.gov' || url.hostname === 'api.mziq.com' || isCvmUrl(input))
    );
  } catch {
    return false;
  }
}

export function isPriceShareCounts(input: unknown): input is PriceShareCounts {
  return (
    isFilingEvidence(input) &&
    isDate(input.referenceDate) &&
    input.referenceDate <= input.receiptDate &&
    isTimestamp(input.retrievedAt) &&
    isEvidenceUrl(input.evidenceUrl) &&
    isListOf(input.classes, isShareClass) &&
    input.classes.length > 0 &&
    unique(input.classes, ({ ticker }) => ticker)
  );
}

function isHistoricalClass(input: unknown): input is HistoricalMarketPoint['classes'][number] {
  return isObject(input) && isText(input.ticker) && finite(input.priceBrl) && input.priceBrl > 0;
}

export function isHistoricalMarketPoint(input: unknown): input is HistoricalMarketPoint {
  return (
    isObject(input) &&
    isDate(input.referenceDate) &&
    isText(input.sourceName) &&
    typeof input.documentUrl === 'string' &&
    input.documentUrl.startsWith('https://www.sec.gov/Archives/edgar/') &&
    input.reusePolicyUrl === secPolicy &&
    isListOf(input.classes, isHistoricalClass) &&
    input.classes.length > 0 &&
    unique(input.classes, ({ ticker }) => ticker) &&
    finite(input.marketCapBrl) &&
    input.marketCapBrl > 0 &&
    finite(input.earningsYield)
  );
}
