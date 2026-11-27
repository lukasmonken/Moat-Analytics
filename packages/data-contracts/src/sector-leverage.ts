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

interface DepreciationAccount {
  statement: 'DFC_MI' | 'DFC_MD';
  code: string;
  label: string;
  referenceDate: string;
}

interface DepreciationDvaAccount {
  statement: 'DVA';
  code: '7.04.01';
  label: string;
  referenceDate: string;
  amountBrl: number;
}

type LeverageInputs = {
  ebitBrl: number;
  depreciationBrl: number;
  ebitdaBrl: number;
  netDebtBrl: number;
} & (
  | {
      depreciationAccount: DepreciationAccount;
      depreciationAccounts?: never;
      depreciationDvaAccount?: DepreciationDvaAccount;
    }
  | {
      depreciationAccount?: never;
      depreciationAccounts: (DepreciationAccount & { amountBrl: number })[];
      depreciationDvaAccount?: never;
    }
);

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
    methodologyVersion: 'net-debt-ebitda-dfp.v1' | 'net-debt-ebitda-dfp.v2';
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
    (input.methodologyVersion === 'net-debt-ebitda-dfp.v1' ||
      input.methodologyVersion === 'net-debt-ebitda-dfp.v2') &&
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

function isDepreciationAccount(
  account: unknown,
  referenceDate: string,
): account is DepreciationAccount {
  return (
    isObject(account) &&
    (account.statement === 'DFC_MI' || account.statement === 'DFC_MD') &&
    typeof account.code === 'string' &&
    /^6\.01(?:\.\d{2})+$/.test(account.code) &&
    isText(account.label) &&
    account.referenceDate === referenceDate
  );
}

function confirmsDepreciation(account: unknown, referenceDate: string, depreciationBrl: number) {
  return (
    isObject(account) &&
    account.statement === 'DVA' &&
    account.code === '7.04.01' &&
    isText(account.label) &&
    account.referenceDate === referenceDate &&
    account.amountBrl === -depreciationBrl
  );
}

function isLeverageInputs(input: unknown, referenceDate: string): input is LeverageInputs {
  if (
    !isObject(input) ||
    !isAmount(input.ebitBrl) ||
    !isAmount(input.depreciationBrl) ||
    input.depreciationBrl < 0 ||
    !isAmount(input.ebitdaBrl) ||
    !isAmount(input.netDebtBrl) ||
    Math.abs(input.ebitdaBrl - (input.ebitBrl + input.depreciationBrl)) >= 0.005
  ) {
    return false;
  }
  if (input.depreciationAccounts === undefined) {
    return (
      isDepreciationAccount(input.depreciationAccount, referenceDate) &&
      (input.depreciationDvaAccount === undefined ||
        confirmsDepreciation(input.depreciationDvaAccount, referenceDate, input.depreciationBrl))
    );
  }
  if (
    input.depreciationAccount !== undefined ||
    input.depreciationDvaAccount !== undefined ||
    !Array.isArray(input.depreciationAccounts) ||
    input.depreciationAccounts.length !== 2
  ) {
    return false;
  }
  const components = input.depreciationAccounts as unknown[];
  const [left, right] = components;
  if (
    !isObject(left) ||
    !isObject(right) ||
    !isAmount(left.amountBrl) ||
    !isAmount(right.amountBrl) ||
    !isDepreciationAccount(left, referenceDate) ||
    !isDepreciationAccount(right, referenceDate)
  ) {
    return false;
  }
  return (
    left.amountBrl >= 0 &&
    right.amountBrl >= 0 &&
    left.statement === right.statement &&
    left.code !== right.code &&
    left.code.slice(0, -3) === right.code.slice(0, -3) &&
    Math.abs(input.depreciationBrl - (left.amountBrl + right.amountBrl)) < 0.005
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
  if (input.inputs === null) return input.value === null && isText(input.reason);
  if (input.filing === null || !isLeverageInputs(input.inputs, input.filing.referenceDate))
    return false;
  const { depreciationAccounts, depreciationDvaAccount, ebitdaBrl, netDebtBrl } = input.inputs;
  if (
    manifest.methodologyVersion === 'net-debt-ebitda-dfp.v1' &&
    (depreciationAccounts || depreciationDvaAccount || ebitdaBrl <= 0)
  )
    return false;
  if (ebitdaBrl <= 0) return input.value === null && isText(input.reason);
  if (typeof input.value !== 'number' || !Number.isFinite(input.value) || input.reason !== null) {
    return false;
  }
  const expected = netDebtBrl / ebitdaBrl;
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
