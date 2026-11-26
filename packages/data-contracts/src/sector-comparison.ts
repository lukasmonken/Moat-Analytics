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
  basis?: 'individual';
}

interface RoeInputs {
  netIncomeBrl: number;
  openingEquityBrl: number;
  closingEquityBrl: number;
  incomeStatement: 'DRE' | 'DMPL';
  incomeCode: string | null;
  equityCodes: string[];
  auditedStatementPage?: number;
  openingEquityDate?: string;
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
  comparisonGroup?: 'Bancos' | 'Seguros e Resseguros';
  comparisonContext?: { throughYear: number; note: string; sourceUrl: string };
  classification: ComparisonFiling & { archiveYear: number };
  observations: SectorComparisonObservation[];
}

interface ComparisonManifest {
  schemaVersion: '1.0.0';
  asOf: string;
  generatedAt: string;
  verifiedOn?: string;
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
    methodologyVersion: 'roic-dfp-comparisons.v2';
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
    (value.verifiedOn !== undefined &&
      (!isDate(value.verifiedOn) ||
        value.verifiedOn < value.asOf ||
        value.verifiedOn > value.generatedAt.slice(0, 10))) ||
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

const abcAuditedStatement =
  'https://filemanager-cdn.mziq.com/published/6298ef6f-2b75-43f8-b2ab-99e3fe33e809/cf4c1a42-971e-42e9-8d93-507270859bec_df_banco_abc_pt_122025.pdf';

function isInputs(value: unknown): value is RoeInputs {
  if (
    !isObject(value) ||
    !isMoney(value.netIncomeBrl) ||
    !isMoney(value.openingEquityBrl) ||
    !isMoney(value.closingEquityBrl) ||
    !isListOf(value.equityCodes, isAccountCode) ||
    !unique(value.equityCodes, (code) => code)
  ) {
    return false;
  }
  if (value.incomeCode === null) {
    return (
      value.incomeStatement === 'DMPL' &&
      value.equityCodes.length === 0 &&
      isPositiveInteger(value.auditedStatementPage) &&
      isDate(value.openingEquityDate)
    );
  }
  return (
    isAccountCode(value.incomeCode) &&
    ((value.incomeStatement === 'DRE' && value.incomeCode.startsWith('3.')) ||
      (value.incomeStatement === 'DMPL' && value.incomeCode === '5.05.01')) &&
    value.equityCodes.length > 0 &&
    value.auditedStatementPage === undefined &&
    value.openingEquityDate === undefined
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
          value.filing.supportingDocumentUrl !== abcAuditedStatement &&
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
  if (
    inputs.incomeCode === null &&
    (inputs.openingEquityDate !== `${value.year}-01-01` ||
      value.filing.supportingDocumentUrl !== abcAuditedStatement)
  ) {
    return false;
  }
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
    value.accounts.length === 9 &&
    unique(value.accounts, ({ key }) => key)
  );
}

const individualFilingDocuments = new Map([
  [
    'https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=154938',
    'https://ri.sanepar.com.br/docs/DFP-Sanepar-2025-12-31-BjdwmKcn.pdf',
  ],
  [
    'https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=154688',
    'https://api.mziq.com/mzfilemanager/v2/d/4c4aa51f-1235-4aa1-8b83-adc92e8dacc3/197553f9-c229-4f09-b201-bcf48f2026d6?origin=2',
  ],
]);

function capitalOn(
  accounts: QualityInput[],
  period: 'opening' | 'closing',
  date: string,
): number | null {
  const definitions = [
    ['Equity', 'BPP', '2.03'],
    ['ShortBorrowings', 'BPP', '2.01.04'],
    ['LongBorrowings', 'BPP', '2.02.01'],
    ['Cash', 'BPA', '1.01.01'],
  ] as const;
  const [equity, shortDebt, longDebt, cash] = definitions.map(([suffix, statement, code]) => {
    const account = accounts.find(({ key }) => key === `${period}${suffix}`);
    if (
      account?.statement === statement &&
      account.code === code &&
      account.referenceDate === date &&
      isMoney(account.amountBrl)
    ) {
      return account.amountBrl;
    }
    return undefined;
  });
  if (
    equity === undefined ||
    shortDebt === undefined ||
    longDebt === undefined ||
    cash === undefined ||
    shortDebt < 0 ||
    longDebt < 0 ||
    cash < 0
  ) {
    return null;
  }
  return equity + shortDebt + longDebt - cash;
}

export function isSectorRoicFiling(
  value: unknown,
  year: number,
): value is NonNullable<SectorRoicObservation['filing']> {
  return (
    isFiling(value) &&
    value.publishedAt === null &&
    (value.basis === undefined
      ? value.supportingDocumentUrl === undefined
      : value.basis === 'individual' &&
        typeof value.supportingDocumentUrl === 'string' &&
        value.supportingDocumentUrl === individualFilingDocuments.get(value.filingUrl)) &&
    value.referenceDate === `${year}-12-31`
  );
}

function isRoicObservation(value: unknown): value is SectorRoicObservation {
  if (
    !isObject(value) ||
    !isPositiveInteger(value.year) ||
    (value.filing !== null && !isSectorRoicFiling(value.filing, value.year))
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
  const ebit = accounts.find(({ key }) => key === 'ebit');
  const opening = capitalOn(accounts, 'opening', `${value.year - 1}-12-31`);
  const closing = capitalOn(accounts, 'closing', value.filing.referenceDate);
  return (
    ebit?.statement === 'DRE' &&
    ebit.code === '3.05' &&
    ebit.amountBrl === ebitBrl &&
    ebit.referenceDate === value.filing.referenceDate &&
    opening !== null &&
    Math.abs(opening - openingCapitalBrl) < 0.005 &&
    closing !== null &&
    Math.abs(closing - closingCapitalBrl) < 0.005 &&
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
    value.methodologyVersion === 'roic-dfp-comparisons.v2' &&
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
    (value.comparisonGroup === undefined ||
      value.comparisonGroup === 'Bancos' ||
      value.comparisonGroup === 'Seguros e Resseguros') &&
    (value.comparisonContext === undefined ||
      (isObject(value.comparisonContext) &&
        isPositiveInteger(value.comparisonContext.throughYear) &&
        isText(value.comparisonContext.note) &&
        isCvmUrl(value.comparisonContext.sourceUrl))) &&
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
