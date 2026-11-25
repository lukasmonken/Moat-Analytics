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

interface LeaseNoteBalances {
  note: string;
  openingBrl: number;
  closingBrl: number;
}

interface RoicInputs {
  ebitBrl: number;
  nopatBrl: number;
  openingCapitalBrl: number;
  closingCapitalBrl: number;
  accounts: QualityInput[];
  embeddedLeases?: LeaseNoteBalances;
  separateLeases?: LeaseNoteBalances;
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

function isLeaseNote(value: unknown): value is LeaseNoteBalances {
  return (
    isObject(value) &&
    typeof value.note === 'string' &&
    /^\d+(?:\.\d+)*$/.test(value.note) &&
    isMoney(value.openingBrl) &&
    value.openingBrl > 0 &&
    isMoney(value.closingBrl) &&
    value.closingBrl > 0
  );
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
    unique(value.accounts, ({ key, referenceDate }) => `${key}/${referenceDate}`) &&
    (value.embeddedLeases === undefined || isLeaseNote(value.embeddedLeases)) &&
    (value.separateLeases === undefined || isLeaseNote(value.separateLeases)) &&
    (value.embeddedLeases === undefined || value.separateLeases === undefined)
  );
}

const saneparIndividualDocument =
  'https://ri.sanepar.com.br/docs/DFP-Sanepar-2025-12-31-BjdwmKcn.pdf';

const roicSupportingDocuments = new Set([
  saneparIndividualDocument,
  'https://vale.com/documents/d/guest/form-20-f-2025-en',
  'https://api.mziq.com/mzfilemanager/v2/d/1c41fa99-efe7-4e72-81dd-5b571f5aa376/fcad7df5-9607-78ed-3455-ffa6e0470211?origin=2',
  'https://api.mziq.com/mzfilemanager/v2/d/24165f81-24d6-4648-bf9f-66712905d5a2/197836af-54b5-cff0-af1e-de97ad340f36?origin=2',
  'https://api.mziq.com/mzfilemanager/v2/d/330c258b-6212-45ce-8c13-557ea46cc23a/ec0bffc6-8050-2a0b-1e23-5a3890c7c7d5?origin=2',
  'https://api.mziq.com/mzfilemanager/v2/d/61a4df2d-a461-44d6-9128-da74058019db/0cfe19b8-158f-39a5-8750-42ffc2c71a54?origin=2',
  'https://api.mziq.com/mzfilemanager/v2/d/6b90b8ef-4914-4021-8296-c5aca7b388eb/332513a1-ba6f-da78-df8f-6c5de67a33d1?origin=2',
  'https://api.mziq.com/mzfilemanager/v2/d/7c109ecb-88c9-441f-91cb-66a8db417120/297cd69b-7cfb-d469-55f1-3d8418bf4b76?origin=2',
  'https://s3.glbimg.com/v1/AUTH_63b422c2caee4269b8b34177e8876b93/valorri-uploads/bs/2026/p/P/HKWA55Sxyc8CKT7gPtWg/tupy1588252920032026.pdf',
  'https://vipfiles.valor.com.br/BDEmpresas/bfc245c3-7342-4b02-a2ff-96206f033415.pdf',
  'https://api.mziq.com/mzfilemanager/v2/d/aa331a3b-0a4a-4acc-a70e-512ff88e3c02/b12fda81-2659-40c5-b3af-864331bb8306?origin=2',
  'https://www.engie.com.br/wp-content/uploads/2026/02/260225-Release-de-Resultados-4T25.pdf',
  'https://s3.glbimg.com/v1/AUTH_63b422c2caee4269b8b34177e8876b93/valorri-uploads/bs/2026/B/J/FM69NZR6q0cYQrnkrlfQ/orizon1588484430032026.pdf',
  'https://api.mziq.com/mzfilemanager/v2/d/0e58d869-d438-4c13-9d23-c24d27e72c47/5a4823f5-8d3a-e293-d50e-1d0a3f3fd666?origin=2',
  'https://s3.glbimg.com/v1/AUTH_63b422c2caee4269b8b34177e8876b93/valorri-uploads/bs/2026/i/O/BTns0RTJmg2u8z8TMWmQ/fleury1587954506032026.pdf',
  'https://docs.publicnow.com/viewDoc?filename=181596%5CEXT%5C68E8D496F18E08B133AA0A4DBD124B4F1E75E8E4_F89C0AE6A61C8E006DF1ED9EB03E1BF7DBFFBAAA.PDF',
  'https://ri.rdsaude.com.br/Download.aspx?Arquivo=pvBQW9Dgna5MufaSF4UDNQ%3D%3D',
  'https://filemanager-cdn.mziq.com/published/e71f73d4-4d0a-41fb-8e5b-8d7f3660b6ad/8ae66756-4990-4c23-93bc-ed92ade88e68',
  'https://ads.clicrbs.com.br/PUBLICIDADE-LEGAL/PIO/Publicidade_Legal_PIO_190326_2%20ass.pdf?project=rbs-gauchazh-prd',
  'https://s3.glbimg.com/v1/AUTH_63b422c2caee4269b8b34177e8876b93/valorri-uploads/bs/2026/5/e/UXkrknS4Sp23N0L6P8Bw/hypera1588156716032026.pdf',
  'https://www.rad.cvm.gov.br/ENET/frmGerenciaPaginaFRE.aspx?CodigoTipoInstituicao=1&NumeroSequencialDocumento=155072',
  'https://www.rad.cvm.gov.br/ENET/frmGerenciaPaginaFRE.aspx?CodigoTipoInstituicao=1&NumeroSequencialDocumento=155361',
]);

function isRoicSupportingDocumentUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (roicSupportingDocuments.has(value) ||
      /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/(909327|917851|1073404|1355444|1565025)\/\d{18}\/[\w.-]+\.html?$/.test(
        value,
      ) ||
      /^https:\/\/api\.mziq\.com\/mzfilemanager\/v2\/d\/13154776-9416-4fce-8c46-3e54d45b03a3\/[a-f0-9-]{36}\?origin=[12]$/.test(
        value,
      ))
  );
}

function isRoicObservation(value: unknown): value is SectorRoicObservation {
  if (
    !isObject(value) ||
    !isPositiveInteger(value.year) ||
    (value.filing !== null &&
      (!isFiling(value.filing) ||
        value.filing.publishedAt !== null ||
        (value.filing.basis !== undefined &&
          (value.filing.basis !== 'individual' ||
            value.filing.supportingDocumentUrl !== saneparIndividualDocument)) ||
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

  const {
    ebitBrl,
    nopatBrl,
    openingCapitalBrl,
    closingCapitalBrl,
    accounts,
    embeddedLeases,
    separateLeases,
  } = value.inputs;
  const ebit = accounts.find(({ statement, code }) => statement === 'DRE' && code === '3.05');
  return (
    ebit?.amountBrl === ebitBrl &&
    ebit.referenceDate === value.filing.referenceDate &&
    ((!embeddedLeases && !separateLeases) || value.filing.supportingDocumentUrl !== undefined) &&
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
