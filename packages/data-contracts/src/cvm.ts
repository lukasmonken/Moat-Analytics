import type { DataProvenance, SnapshotManifest } from './index.ts';
import {
  isDate,
  isListOf,
  isObject,
  isPositiveInteger,
  isText,
  isTimestamp,
  unique,
} from './validation.ts';

export type CvmCompanyCategory = 'industry' | 'retail' | 'bank';
export type CvmStatement = 'BPA' | 'BPP' | 'DRE';

export interface CvmAccount {
  key: string;
  statement: CvmStatement;
  code: string;
  label: string;
  amountBrl: number | null;
}

export interface CvmReconciliation {
  key: string;
  label: string;
  status: 'passed' | 'unavailable' | 'failed';
  differenceBrl: number | null;
}

export interface CvmObservation {
  fiscalYear: number;
  referenceDate: string;
  periodStart: string;
  filingVersion: number;
  receiptDate: string;
  documentUrl: string;
  archiveUrl: string;
  archiveSha256: string;
  provenance: DataProvenance;
  accounts: CvmAccount[];
  reconciliations: CvmReconciliation[];
}

export interface CvmCompany {
  companyId: string;
  cvmCode: number;
  name: string;
  category: CvmCompanyCategory;
  observations: CvmObservation[];
}

export interface CvmSource {
  name: string;
  datasetUrl: string;
  license: 'ODbL-1.0';
  licenseUrl: string;
}

export interface CvmSnapshot {
  manifest: SnapshotManifest & {
    schemaVersion: '1.0.0';
    coverage: { eligibleCompanies: null; includedCompanies: number };
    source: CvmSource;
  };
  companies: CvmCompany[];
  issues: { companyId: string; fiscalYear: number; message: string }[];
}

export interface CvmTradingCode {
  ticker: string;
  kind: 'ON' | 'PN' | 'UNIT';
}

export interface CvmCompanyIdentity {
  companyId: string;
  cvmCode: number;
  referenceDate: string;
  receiptDate: string;
  filingVersion: number;
  tickers: CvmTradingCode[];
}

export interface CvmIdentitySnapshot {
  schemaVersion: '1.0.0';
  source: CvmSource;
  archiveUrl: string;
  archiveSha256: string;
  retrievedAt: string;
  companies: CvmCompanyIdentity[];
}

export function isCvmUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      url.hostname.endsWith('.cvm.gov.br')
    );
  } catch {
    return false;
  }
}

function isMoney(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isAccount(value: unknown): value is CvmAccount {
  return (
    isObject(value) &&
    isText(value.key) &&
    (value.statement === 'BPA' || value.statement === 'BPP' || value.statement === 'DRE') &&
    isText(value.code) &&
    isText(value.label) &&
    isMoney(value.amountBrl)
  );
}

function isReconciliation(value: unknown): value is CvmReconciliation {
  return (
    isObject(value) &&
    isText(value.key) &&
    isText(value.label) &&
    (value.status === 'passed' || value.status === 'unavailable' || value.status === 'failed') &&
    isMoney(value.differenceBrl) &&
    (value.status === 'unavailable') === (value.differenceBrl === null)
  );
}

export function isProvenance(value: unknown): value is DataProvenance {
  return (
    isObject(value) &&
    isText(value.source) &&
    isDate(value.referenceDate) &&
    (value.publishedAt === null || isTimestamp(value.publishedAt)) &&
    isTimestamp(value.retrievedAt) &&
    isText(value.methodologyVersion) &&
    (value.qualityStatus === 'validated' ||
      value.qualityStatus === 'estimated' ||
      value.qualityStatus === 'unavailable')
  );
}

function isObservation(value: unknown): value is CvmObservation {
  return (
    isObject(value) &&
    isPositiveInteger(value.fiscalYear) &&
    isDate(value.referenceDate) &&
    Number(value.referenceDate.slice(0, 4)) === value.fiscalYear &&
    isDate(value.periodStart) &&
    value.periodStart <= value.referenceDate &&
    isPositiveInteger(value.filingVersion) &&
    isDate(value.receiptDate) &&
    value.receiptDate >= value.referenceDate &&
    isCvmUrl(value.documentUrl) &&
    isCvmUrl(value.archiveUrl) &&
    isSha256(value.archiveSha256) &&
    isProvenance(value.provenance) &&
    value.provenance.referenceDate === value.referenceDate &&
    isListOf(value.accounts, isAccount) &&
    value.accounts.length > 0 &&
    unique(value.accounts, (account) => account.key) &&
    isListOf(value.reconciliations, isReconciliation) &&
    value.reconciliations.length > 0 &&
    unique(value.reconciliations, (reconciliation) => reconciliation.key)
  );
}

function isCompany(value: unknown): value is CvmCompany {
  return (
    isObject(value) &&
    isPositiveInteger(value.cvmCode) &&
    value.companyId === 'cvm:' + value.cvmCode &&
    isText(value.name) &&
    (value.category === 'industry' || value.category === 'retail' || value.category === 'bank') &&
    isListOf(value.observations, isObservation) &&
    unique(value.observations, (observation) => observation.fiscalYear)
  );
}

type CvmIssue = CvmSnapshot['issues'][number];

function isIssue(value: unknown): value is CvmIssue {
  return (
    isObject(value) &&
    isText(value.companyId) &&
    isPositiveInteger(value.fiscalYear) &&
    isText(value.message)
  );
}

export function isCvmSource(value: unknown): value is CvmSource {
  return (
    isObject(value) &&
    isText(value.name) &&
    isCvmUrl(value.datasetUrl) &&
    value.license === 'ODbL-1.0' &&
    value.licenseUrl === 'https://opendatacommons.org/licenses/odbl/1-0/'
  );
}

function isManifest(value: unknown): value is CvmSnapshot['manifest'] {
  return (
    isObject(value) &&
    value.schemaVersion === '1.0.0' &&
    isTimestamp(value.generatedAt) &&
    isDate(value.asOf) &&
    isObject(value.coverage) &&
    value.coverage.eligibleCompanies === null &&
    typeof value.coverage.includedCompanies === 'number' &&
    Number.isSafeInteger(value.coverage.includedCompanies) &&
    value.coverage.includedCompanies >= 0 &&
    isCvmSource(value.source)
  );
}

export function parseCvmSnapshot(input: unknown): CvmSnapshot {
  if (
    !isObject(input) ||
    !isManifest(input.manifest) ||
    !isListOf(input.companies, isCompany) ||
    !unique(input.companies, (company) => company.companyId) ||
    input.manifest.coverage.includedCompanies !== input.companies.length ||
    !isListOf(input.issues, isIssue)
  ) {
    throw new Error('Snapshot CVM inválido ou versão de esquema incompatível.');
  }

  return { manifest: input.manifest, companies: input.companies, issues: input.issues };
}

function isTradingCode(value: unknown): value is CvmTradingCode {
  return (
    isObject(value) &&
    typeof value.ticker === 'string' &&
    /^[A-Z][A-Z0-9]{3}[0-9]{1,2}$/.test(value.ticker) &&
    (value.kind === 'ON' || value.kind === 'PN' || value.kind === 'UNIT')
  );
}

function isIdentity(value: unknown): value is CvmCompanyIdentity {
  return (
    isObject(value) &&
    isPositiveInteger(value.cvmCode) &&
    value.companyId === 'cvm:' + value.cvmCode &&
    isDate(value.referenceDate) &&
    isDate(value.receiptDate) &&
    value.receiptDate >= value.referenceDate &&
    isPositiveInteger(value.filingVersion) &&
    isListOf(value.tickers, isTradingCode) &&
    unique(value.tickers, (entry) => entry.ticker)
  );
}

export function parseCvmIdentity(input: unknown): CvmIdentitySnapshot {
  if (
    !isObject(input) ||
    input.schemaVersion !== '1.0.0' ||
    !isCvmSource(input.source) ||
    !isCvmUrl(input.archiveUrl) ||
    !isSha256(input.archiveSha256) ||
    !isTimestamp(input.retrievedAt) ||
    !isListOf(input.companies, isIdentity) ||
    !unique(input.companies, (company) => company.companyId)
  ) {
    throw new Error('Snapshot cadastral da CVM inválido ou versão de esquema incompatível.');
  }

  return {
    schemaVersion: input.schemaVersion,
    source: input.source,
    archiveUrl: input.archiveUrl,
    archiveSha256: input.archiveSha256,
    retrievedAt: input.retrievedAt,
    companies: input.companies,
  };
}
