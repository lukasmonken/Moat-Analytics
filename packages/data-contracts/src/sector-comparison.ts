import { isCvmSource, isCvmUrl, type CvmSource } from './cvm.ts';
import { isQualityInput, isSupportingDocumentUrl, type QualityInput } from './quality.ts';
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

interface ComparisonManifest {
  schemaVersion: '1.0.0';
  asOf: string;
  generatedAt: string;
  years: number[];
  source: CvmSource;
  archives: SectorComparisonArchive[];
}

export interface SectorComparisonSnapshot {
  manifest: ComparisonManifest & {
    methodologyVersion: 'roe-dfp-comparisons.v1';
    sectorSource: CvmSource;
  };
  companies: SectorComparisonCompany[];
}

interface RoicInputs {
  ebitBrl: number;
  nopatBrl: number;
  openingCapitalBrl: number;
  closingCapitalBrl: number;
  accounts: QualityInput[];
}

export interface SectorRoicObservation {
  year: number;
  roic: number | null;
  reason: string | null;
  filing: (ComparisonFiling & { publishedAt: null; supportingDocumentUrl?: string }) | null;
  inputs: RoicInputs | null;
}

export interface SectorRoicCompany {
  name: string;
  sector: string;
  observations: SectorRoicObservation[];
}

export interface SectorRoicSnapshot {
  manifest: ComparisonManifest & {
    methodologyVersion: 'roic-dfp-comparisons.v1';
    taxRate: 0.34;
    sectorSource: CvmSource;
  };
  companies: SectorRoicCompany[];
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

function isComparisonManifest(
  value: unknown,
): value is ComparisonManifest & Record<string, unknown> {
  if (
    !isObject(value) ||
    value.schemaVersion !== '1.0.0' ||
    !isDate(value.asOf) ||
    !isTimestamp(value.generatedAt) ||
    !isCvmSource(value.source) ||
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

function isManifest(value: unknown): value is SectorComparisonSnapshot['manifest'] {
  return (
    isComparisonManifest(value) &&
    value.methodologyVersion === 'roe-dfp-comparisons.v1' &&
    isCvmSource(value.sectorSource)
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

function numbersAgree(value: number, expected: number) {
  return Math.abs(value - expected) <= 1e-8 * Math.max(1, Math.abs(expected));
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
  return numbersAgree(value.roe, expected);
}

function isRoicInputs(value: unknown): value is RoicInputs {
  return (
    isObject(value) &&
    isMoney(value.ebitBrl) &&
    isMoney(value.nopatBrl) &&
    isMoney(value.openingCapitalBrl) &&
    value.openingCapitalBrl > 0 &&
    isMoney(value.closingCapitalBrl) &&
    value.closingCapitalBrl > 0 &&
    isListOf(value.accounts, isQualityInput) &&
    value.accounts.length > 0 &&
    unique(value.accounts, ({ key, referenceDate }) => `${key}/${referenceDate}`)
  );
}

function isRoicSupportingDocumentUrl(value: unknown): value is string {
  return (
    value === 'https://vale.com/documents/d/guest/form-20-f-2025-en' ||
    value ===
      'https://api.mziq.com/mzfilemanager/v2/d/1c41fa99-efe7-4e72-81dd-5b571f5aa376/fcad7df5-9607-78ed-3455-ffa6e0470211?origin=2' ||
    (typeof value === 'string' &&
      (/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/(909327|917851|1073404)\/\d{18}\/[\w.-]+\.html?$/.test(
        value,
      ) ||
        /^https:\/\/api\.mziq\.com\/mzfilemanager\/v2\/d\/13154776-9416-4fce-8c46-3e54d45b03a3\/[a-f0-9-]{36}\?origin=[12]$/.test(
          value,
        )))
  );
}

function isRoicObservation(value: unknown): value is SectorRoicObservation {
  if (
    !isObject(value) ||
    !isPositiveInteger(value.year) ||
    (value.filing !== null &&
      (!isFiling(value.filing) ||
        value.filing.publishedAt !== null ||
        (value.filing.supportingDocumentUrl !== undefined &&
          !isRoicSupportingDocumentUrl(value.filing.supportingDocumentUrl)) ||
        value.filing.referenceDate !== `${value.year}-12-31`))
  )
    return false;
  if (value.roic === null) return value.inputs === null && isText(value.reason);
  if (
    typeof value.roic !== 'number' ||
    !Number.isFinite(value.roic) ||
    value.reason !== null ||
    value.filing === null ||
    !isRoicInputs(value.inputs)
  )
    return false;

  const { ebitBrl, nopatBrl, openingCapitalBrl, closingCapitalBrl, accounts } = value.inputs;
  const ebit = accounts.find(({ statement, code }) => statement === 'DRE' && code === '3.05');
  return (
    ebit?.amountBrl === ebitBrl &&
    ebit.referenceDate === value.filing.referenceDate &&
    numbersAgree(nopatBrl, ebitBrl * 0.66) &&
    numbersAgree(value.roic, nopatBrl / ((openingCapitalBrl + closingCapitalBrl) / 2))
  );
}

function isRoicCompany(value: unknown): value is SectorRoicCompany {
  return (
    isObject(value) &&
    isText(value.name) &&
    isText(value.sector) &&
    isListOf(value.observations, isRoicObservation)
  );
}

function isRoicManifest(value: unknown): value is SectorRoicSnapshot['manifest'] {
  return (
    isComparisonManifest(value) &&
    value.methodologyVersion === 'roic-dfp-comparisons.v1' &&
    value.taxRate === 0.34 &&
    isCvmSource(value.sectorSource) &&
    value.archives.some(({ kind }) => kind === 'fca')
  );
}

export function parseSectorRoicComparison(value: unknown): SectorRoicSnapshot {
  if (
    !isObject(value) ||
    !isRoicManifest(value.manifest) ||
    !isListOf(value.companies, isRoicCompany) ||
    value.companies.length === 0 ||
    !unique(value.companies, ({ name }) => name)
  )
    throw new Error('Snapshot de ROIC setorial inválido ou versão incompatível.');

  const { manifest, companies } = value;
  const collected = new Map(
    manifest.archives
      .filter(({ kind }) => kind === 'dfp')
      .map(({ year, retrievedAt }) => [year, retrievedAt.slice(0, 10)]),
  );
  if (
    !companies.every(
      ({ observations }) =>
        observations.length === manifest.years.length &&
        observations.every(
          ({ year, filing }, index) =>
            year === manifest.years[index] &&
            (filing === null || filing.receivedAt <= (collected.get(year) ?? '')),
        ),
    )
  )
    throw new Error('Períodos ou arquivos de origem incompatíveis no ROIC setorial.');

  return { manifest, companies };
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
