import { isCvmSource, isCvmUrl, type CvmSource } from './cvm.ts';
import { isSectorRoicFiling, type SectorRoicObservation } from './sector-comparison.ts';
import { isDate, isObject, isPositiveInteger, isText, isTimestamp, unique } from './validation.ts';

export interface SectorDfpArchive {
  kind: 'dfp';
  year: number;
  url: string;
  sha256: string;
  retrievedAt: string;
}

interface LeverageInputs {
  ebitBrl: number;
  depreciationBrl: number;
  ebitdaBrl: number;
  netDebtBrl: number;
  depreciationAccount: {
    statement: 'DFC_MI' | 'DFC_MD';
    code: string;
    label: string;
    referenceDate: string;
  };
}

export interface SectorLeverageCompany {
  name: string;
  value: number | null;
  reason: string | null;
  filing: SectorRoicObservation['filing'];
  inputs: LeverageInputs | null;
}

export interface SectorLeverageSnapshot {
  manifest: {
    schemaVersion: '1.0.0';
    methodologyVersion: 'net-debt-ebitda-dfp.v1';
    asOf: string;
    year: number;
    generatedAt: string;
    source: CvmSource;
    archive: SectorDfpArchive;
  };
  companies: SectorLeverageCompany[];
}

export function isSectorDfpArchive(input: unknown): input is SectorDfpArchive {
  return (
    isObject(input) &&
    input.kind === 'dfp' &&
    isPositiveInteger(input.year) &&
    isCvmUrl(input.url) &&
    typeof input.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(input.sha256) &&
    isTimestamp(input.retrievedAt)
  );
}

function isManifest(input: unknown): input is SectorLeverageSnapshot['manifest'] {
  return (
    isObject(input) &&
    input.schemaVersion === '1.0.0' &&
    input.methodologyVersion === 'net-debt-ebitda-dfp.v1' &&
    isDate(input.asOf) &&
    isPositiveInteger(input.year) &&
    isTimestamp(input.generatedAt) &&
    isCvmSource(input.source) &&
    isSectorDfpArchive(input.archive) &&
    input.archive.year === input.year &&
    Date.parse(input.archive.retrievedAt) <= Date.parse(input.generatedAt)
  );
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Math.abs(value) < 2 ** 53;
}

function isLeverageInputs(input: unknown, referenceDate: string): input is LeverageInputs {
  if (
    !isObject(input) ||
    !isAmount(input.ebitBrl) ||
    !isAmount(input.depreciationBrl) ||
    input.depreciationBrl < 0 ||
    !isAmount(input.ebitdaBrl) ||
    input.ebitdaBrl <= 0 ||
    !isAmount(input.netDebtBrl) ||
    Math.abs(input.ebitdaBrl - (input.ebitBrl + input.depreciationBrl)) >= 0.005
  ) {
    return false;
  }
  const account = input.depreciationAccount;
  return (
    isObject(account) &&
    (account.statement === 'DFC_MI' || account.statement === 'DFC_MD') &&
    typeof account.code === 'string' &&
    /^6\.01(?:\.\d{2})+$/.test(account.code) &&
    isText(account.label) &&
    account.referenceDate === referenceDate
  );
}

function isCompany(
  input: unknown,
  manifest: SectorLeverageSnapshot['manifest'],
): input is SectorLeverageCompany {
  if (!isObject(input) || !isText(input.name)) return false;
  if (
    input.filing !== null &&
    (!isSectorRoicFiling(input.filing, manifest.year) ||
      input.filing.receivedAt > manifest.archive.retrievedAt.slice(0, 10))
  ) {
    return false;
  }
  if (input.value === null) return isText(input.reason) && input.inputs === null;
  if (
    typeof input.value !== 'number' ||
    !Number.isFinite(input.value) ||
    input.reason !== null ||
    input.filing === null ||
    !isLeverageInputs(input.inputs, input.filing.referenceDate)
  ) {
    return false;
  }
  const expected = input.inputs.netDebtBrl / input.inputs.ebitdaBrl;
  return Math.abs(input.value - expected) <= 1e-8 * Math.max(1, Math.abs(expected));
}

export function parseSectorLeverage(input: unknown): SectorLeverageSnapshot {
  if (!isObject(input) || !isManifest(input.manifest) || !Array.isArray(input.companies)) {
    throw new Error('Lote de dívida líquida/EBITDA da CVM inválido.');
  }
  const { manifest, companies } = input;
  if (
    companies.length === 0 ||
    !companies.every((entry: unknown) => isCompany(entry, manifest)) ||
    !unique(companies, ({ name }) => name)
  ) {
    throw new Error('Indicadores de dívida líquida/EBITDA inválidos ou duplicados.');
  }
  return { manifest, companies };
}
