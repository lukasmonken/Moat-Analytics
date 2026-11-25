import { isCvmSource, isCvmUrl, type CvmSource } from './cvm.ts';
import { isSupportingDocumentUrl } from './quality.ts';
import {
  isDate,
  isListOf,
  isObject,
  isPositiveInteger,
  isText,
  isTimestamp,
  unique,
} from './validation.ts';

interface SectorComparisonArchive {
  kind: 'dfp' | 'fca';
  year: number;
  url: string;
  sha256: string;
  retrievedAt: string;
}

interface ComparisonFiling {
  referenceDate: string;
  receivedAt: string;
  version: number;
  filingUrl: string;
}

interface RoeInputs {
  netIncomeBrl: number;
  openingEquityBrl: number;
  closingEquityBrl: number;
  incomeStatement: 'DRE' | 'DMPL';
  incomeCode: string;
  equityCodes: string[];
}

export interface SectorComparisonObservation {
  year: number;
  roe: number | null;
  reason: string | null;
  filing: (ComparisonFiling & { publishedAt: null; supportingDocumentUrl?: string }) | null;
  inputs: RoeInputs | null;
}

export interface SectorComparisonCompany {
  name: string;
  sector: string;
  classification: ComparisonFiling & { archiveYear: number };
  observations: SectorComparisonObservation[];
}

export interface SectorComparisonSnapshot {
  manifest: {
    schemaVersion: '1.0.0';
    methodologyVersion: 'roe-dfp-comparisons.v1';
    asOf: string;
    generatedAt: string;
    years: number[];
    source: CvmSource;
    sectorSource: CvmSource;
    archives: SectorComparisonArchive[];
  };
  companies: SectorComparisonCompany[];
}

function isArchive(value: unknown): value is SectorComparisonArchive {
  return (
    isObject(value) &&
    (value.kind === 'dfp' || value.kind === 'fca') &&
    isPositiveInteger(value.year) &&
    isCvmUrl(value.url) &&
    typeof value.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(value.sha256) &&
    isTimestamp(value.retrievedAt)
  );
}

function isManifest(value: unknown): value is SectorComparisonSnapshot['manifest'] {
  if (
    !isObject(value) ||
    value.schemaVersion !== '1.0.0' ||
    value.methodologyVersion !== 'roe-dfp-comparisons.v1' ||
    !isDate(value.asOf) ||
    !isTimestamp(value.generatedAt) ||
    !isCvmSource(value.source) ||
    !isCvmSource(value.sectorSource) ||
    !isListOf(value.archives, isArchive) ||
    !unique(value.archives, (archive) => `${archive.kind}/${archive.year}`) ||
    !isListOf(value.years, isPositiveInteger) ||
    value.years.length !== 5
  ) {
    return false;
  }

  const generatedAt = Date.parse(value.generatedAt);
  const archives = new Set(value.archives.map(({ kind, year }) => `${kind}/${year}`));
  const firstYear = value.years[0] ?? NaN;
  return (
    value.years.every((year, index) => year === firstYear + index && archives.has(`dfp/${year}`)) &&
    value.archives.every(({ retrievedAt }) => Date.parse(retrievedAt) <= generatedAt)
  );
}

function isFiling(value: unknown): value is ComparisonFiling & Record<string, unknown> {
  return (
    isObject(value) &&
    isDate(value.referenceDate) &&
    isDate(value.receivedAt) &&
    value.referenceDate <= value.receivedAt &&
    isPositiveInteger(value.version) &&
    isCvmUrl(value.filingUrl)
  );
}

function isMoney(value: unknown): value is number {
  return typeof value === 'number' && Math.abs(value) < 2 ** 53;
}

function isAccountCode(value: unknown): value is string {
  return typeof value === 'string' && /^\d(?:\.\d{2})+$/.test(value);
}

function isInputs(value: unknown): value is RoeInputs {
  return (
    isObject(value) &&
    isMoney(value.netIncomeBrl) &&
    isMoney(value.openingEquityBrl) &&
    isMoney(value.closingEquityBrl) &&
    isAccountCode(value.incomeCode) &&
    ((value.incomeStatement === 'DRE' && value.incomeCode.startsWith('3.')) ||
      (value.incomeStatement === 'DMPL' && value.incomeCode === '5.05.01')) &&
    isListOf(value.equityCodes, isAccountCode) &&
    value.equityCodes.length > 0 &&
    unique(value.equityCodes, (code) => code)
  );
}

function isObservation(value: unknown): value is SectorComparisonObservation {
  if (
    !isObject(value) ||
    !isPositiveInteger(value.year) ||
    (value.filing !== null &&
      (!isFiling(value.filing) ||
        value.filing.publishedAt !== null ||
        (value.filing.supportingDocumentUrl !== undefined &&
          !isSupportingDocumentUrl(value.filing.supportingDocumentUrl)) ||
        !value.filing.referenceDate.startsWith(`${value.year}-`))) ||
    (value.inputs !== null && (!isInputs(value.inputs) || value.filing === null))
  ) {
    return false;
  }
  if (value.roe === null) return isText(value.reason);
  if (
    typeof value.roe !== 'number' ||
    !Number.isFinite(value.roe) ||
    value.reason !== null ||
    value.filing?.referenceDate !== `${value.year}-12-31` ||
    !value.inputs ||
    value.inputs.openingEquityBrl <= 0 ||
    value.inputs.closingEquityBrl <= 0
  ) {
    return false;
  }

  const inputs = value.inputs;
  const expected = inputs.netIncomeBrl / ((inputs.openingEquityBrl + inputs.closingEquityBrl) / 2);
  return Math.abs(value.roe - expected) <= 1e-8 * Math.max(1, Math.abs(expected));
}

function isCompany(value: unknown): value is SectorComparisonCompany {
  return (
    isObject(value) &&
    isText(value.name) &&
    isText(value.sector) &&
    isFiling(value.classification) &&
    isPositiveInteger(value.classification.archiveYear) &&
    isListOf(value.observations, isObservation)
  );
}

export function parseSectorComparison(value: unknown): SectorComparisonSnapshot {
  if (
    !isObject(value) ||
    !isManifest(value.manifest) ||
    !isListOf(value.companies, isCompany) ||
    value.companies.length === 0 ||
    !unique(value.companies, ({ name }) => name)
  ) {
    throw new Error('Snapshot de comparativos CVM inválido ou versão incompatível.');
  }

  const { manifest, companies } = value;
  const byArchive = new Map(
    manifest.archives.map((archive) => [`${archive.kind}/${archive.year}`, archive]),
  );
  const matchesArchives = companies.every(({ classification, observations }) => {
    const sector = byArchive.get(`fca/${classification.archiveYear}`);
    return (
      sector &&
      classification.receivedAt <= manifest.asOf &&
      classification.receivedAt <= sector.retrievedAt.slice(0, 10) &&
      observations.length === manifest.years.length &&
      observations.every(({ year, filing }, index) => {
        const archive = byArchive.get(`dfp/${year}`);
        return (
          year === manifest.years[index] &&
          archive &&
          (filing === null || filing.receivedAt <= archive.retrievedAt.slice(0, 10))
        );
      })
    );
  });
  if (!matchesArchives)
    throw new Error('Períodos ou arquivos de origem incompatíveis no comparativo.');

  return { manifest, companies };
}
