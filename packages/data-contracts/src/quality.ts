import {
  isCvmSource,
  isCvmUrl,
  isProvenance,
  type CvmCompanyCategory,
  type CvmSource,
  type CvmStatement,
} from './cvm.ts';
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

export interface QualityInput {
  key: string;
  label: string;
  statement: CvmStatement;
  code: string;
  referenceDate: string;
  amountBrl: number;
}

export interface QualityObservation {
  fiscalYear: number;
  /** Fração. 0,12 corresponde a 12%. */
  value: number | null;
  changePp: number | null;
  spreadPp: null;
  numeratorBrl: number | null;
  openingCapitalBrl: number | null;
  closingCapitalBrl: number | null;
  averageCapitalBrl: number | null;
  filingVersion: number;
  archiveUrl: string;
  archiveSha256: string;
  provenance: DataProvenance;
  reasons: string[];
  inputs: QualityInput[];
}

export interface QualitySummary {
  validYears: number;
  mean: number | null;
  median: number | null;
  populationStddev: number | null;
  amplitude: number | null;
  trendPpPerYear: number | null;
}

export interface QualityCompany {
  companyId: string;
  name: string;
  category: CvmCompanyCategory;
  metric: 'roic' | 'roe';
  observations: QualityObservation[];
  summary: QualitySummary;
}

interface QualityAvailability {
  status: 'unavailable';
  reason: string;
}

export interface QualitySnapshot {
  manifest: SnapshotManifest & {
    schemaVersion: '1.0.0';
    coverage: { eligibleCompanies: null; includedCompanies: number };
    source: CvmSource;
  };
  methodologyVersion: 'quality-dfp-m2.v1';
  roicTaxRate: 0.34;
  benchmark: QualityAvailability;
  ranking: QualityAvailability;
  companies: QualityCompany[];
}

function isFiniteNumber(input: unknown): input is number {
  return typeof input === 'number' && Number.isFinite(input);
}

function isOptionalNumber(input: unknown): input is number | null {
  return input === null || isFiniteNumber(input);
}

function isInput(input: unknown): input is QualityInput {
  return (
    isObject(input) &&
    isText(input.key) &&
    isText(input.label) &&
    (input.statement === 'BPA' || input.statement === 'BPP' || input.statement === 'DRE') &&
    isText(input.code) &&
    isDate(input.referenceDate) &&
    isFiniteNumber(input.amountBrl)
  );
}

function isObservation(input: unknown): input is QualityObservation {
  return (
    isObject(input) &&
    isPositiveInteger(input.fiscalYear) &&
    isOptionalNumber(input.value) &&
    isOptionalNumber(input.changePp) &&
    input.spreadPp === null &&
    isOptionalNumber(input.numeratorBrl) &&
    isOptionalNumber(input.openingCapitalBrl) &&
    isOptionalNumber(input.closingCapitalBrl) &&
    isOptionalNumber(input.averageCapitalBrl) &&
    isPositiveInteger(input.filingVersion) &&
    isCvmUrl(input.archiveUrl) &&
    typeof input.archiveSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(input.archiveSha256) &&
    isProvenance(input.provenance) &&
    Number(input.provenance.referenceDate.slice(0, 4)) === input.fiscalYear &&
    (input.provenance.qualityStatus === 'unavailable') === (input.value === null) &&
    isListOf(input.reasons, isText) &&
    isListOf(input.inputs, isInput) &&
    unique(input.inputs, ({ key, referenceDate }) => key + '/' + referenceDate)
  );
}

function isSummary(input: unknown): input is QualitySummary {
  return (
    isObject(input) &&
    (input.validYears === 0 || isPositiveInteger(input.validYears)) &&
    isOptionalNumber(input.mean) &&
    isOptionalNumber(input.median) &&
    isOptionalNumber(input.populationStddev) &&
    isOptionalNumber(input.amplitude) &&
    isOptionalNumber(input.trendPpPerYear)
  );
}

function isCompany(input: unknown): input is QualityCompany {
  return (
    isObject(input) &&
    typeof input.companyId === 'string' &&
    /^cvm:[1-9][0-9]*$/.test(input.companyId) &&
    isText(input.name) &&
    ((input.category === 'bank' && input.metric === 'roe') ||
      ((input.category === 'industry' || input.category === 'retail') &&
        input.metric === 'roic')) &&
    isListOf(input.observations, isObservation) &&
    unique(input.observations, ({ fiscalYear }) => fiscalYear) &&
    isSummary(input.summary) &&
    input.summary.validYears === input.observations.filter(({ value }) => value !== null).length
  );
}

function isAvailability(input: unknown): input is QualityAvailability {
  return isObject(input) && input.status === 'unavailable' && isText(input.reason);
}

function isManifest(input: unknown): input is QualitySnapshot['manifest'] {
  return (
    isObject(input) &&
    input.schemaVersion === '1.0.0' &&
    isTimestamp(input.generatedAt) &&
    isDate(input.asOf) &&
    isObject(input.coverage) &&
    input.coverage.eligibleCompanies === null &&
    isPositiveInteger(input.coverage.includedCompanies) &&
    isCvmSource(input.source)
  );
}

export function parseQualitySnapshot(input: unknown): QualitySnapshot {
  if (
    !isObject(input) ||
    !isManifest(input.manifest) ||
    input.methodologyVersion !== 'quality-dfp-m2.v1' ||
    input.roicTaxRate !== 0.34 ||
    !isAvailability(input.benchmark) ||
    !isAvailability(input.ranking) ||
    !isListOf(input.companies, isCompany) ||
    !unique(input.companies, ({ companyId }) => companyId) ||
    input.manifest.coverage.includedCompanies !== input.companies.length
  ) {
    throw new Error('Séries de qualidade inválidas ou versão de esquema incompatível.');
  }

  return {
    manifest: input.manifest,
    methodologyVersion: input.methodologyVersion,
    roicTaxRate: input.roicTaxRate,
    benchmark: input.benchmark,
    ranking: input.ranking,
    companies: input.companies,
  };
}
