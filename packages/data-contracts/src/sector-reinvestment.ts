import { isCvmSource } from './cvm.ts';
import { isSectorRoicFiling, type SectorRoicObservation } from './sector-comparison.ts';
import { isSectorDfpArchive, type SectorLeverageSnapshot } from './sector-leverage.ts';
import {
  isDate,
  isListOf,
  isObject,
  isPositiveInteger,
  isText,
  isTimestamp,
  unique,
} from './validation.ts';

interface ReinvestmentAccount {
  key: string;
  statement: 'BPA' | 'BPP' | 'DFC_MI' | 'DFC_MD';
  code: string;
  label: string;
  referenceDate: string;
  amountBrl: number;
}

interface ReinvestmentInputs {
  nopatBrl: number;
  openingWorkingCapitalBrl: number;
  closingWorkingCapitalBrl: number;
  capexBrl: number;
  reinvestmentBrl: number;
  accounts: ReinvestmentAccount[];
}

export interface SectorReinvestmentCompany {
  name: string;
  value: number | null;
  reason: string | null;
  filing: SectorRoicObservation['filing'];
  inputs: ReinvestmentInputs | null;
}

export interface SectorReinvestmentSnapshot {
  manifest: Omit<SectorLeverageSnapshot['manifest'], 'methodologyVersion'> & {
    methodologyVersion: 'nopat-reinvestment-dfp.v1';
  };
  companies: SectorReinvestmentCompany[];
}

function isMoney(value: unknown): value is number {
  return typeof value === 'number' && Math.abs(value) < 2 ** 53;
}

function isAccount(value: unknown): value is ReinvestmentAccount {
  return (
    isObject(value) &&
    isText(value.key) &&
    ['BPA', 'BPP', 'DFC_MI', 'DFC_MD'].some((statement) => value.statement === statement) &&
    typeof value.code === 'string' &&
    /^\d(?:\.\d{2})+$/.test(value.code) &&
    isText(value.label) &&
    isDate(value.referenceDate) &&
    isMoney(value.amountBrl)
  );
}

function isInputs(value: unknown, year: number): value is ReinvestmentInputs {
  if (
    !isObject(value) ||
    !isMoney(value.nopatBrl) ||
    !isMoney(value.openingWorkingCapitalBrl) ||
    !isMoney(value.closingWorkingCapitalBrl) ||
    !isMoney(value.capexBrl) ||
    value.capexBrl < 0 ||
    !isMoney(value.reinvestmentBrl) ||
    !isListOf(value.accounts, isAccount) ||
    !unique(
      value.accounts,
      ({ statement, code, referenceDate }) => `${statement}/${code}/${referenceDate}`,
    )
  )
    return false;

  const { accounts } = value;
  const closing = `${year}-12-31`;
  const opening = `${year - 1}-12-31`;
  const capex = accounts.filter(({ statement }) => statement.startsWith('DFC_'));
  const workingCapital = (referenceDate: string) => {
    const receivables = accounts.find(
      (account) =>
        account.referenceDate === referenceDate &&
        account.statement === 'BPA' &&
        account.code === '1.01.03',
    );
    const inventories = accounts.find(
      (account) =>
        account.referenceDate === referenceDate &&
        account.statement === 'BPA' &&
        account.code === '1.01.04',
    );
    const suppliers = accounts.find(
      (account) =>
        account.referenceDate === referenceDate &&
        account.statement === 'BPP' &&
        account.code === '2.01.02',
    );
    return receivables && inventories && suppliers
      ? receivables.amountBrl + inventories.amountBrl - suppliers.amountBrl
      : NaN;
  };
  return (
    capex.length > 0 &&
    accounts.length === capex.length + 6 &&
    capex.every(
      ({ referenceDate, amountBrl, code }) =>
        referenceDate === closing && amountBrl <= 0 && code.startsWith('6.02.'),
    ) &&
    Math.abs(value.capexBrl + capex.reduce((sum, { amountBrl }) => sum + amountBrl, 0)) < 0.005 &&
    Math.abs(value.openingWorkingCapitalBrl - workingCapital(opening)) < 0.005 &&
    Math.abs(value.closingWorkingCapitalBrl - workingCapital(closing)) < 0.005 &&
    Math.abs(
      value.reinvestmentBrl -
        (value.closingWorkingCapitalBrl - value.openingWorkingCapitalBrl + value.capexBrl),
    ) < 0.005
  );
}

function isCompany(input: unknown, year: number): input is SectorReinvestmentCompany {
  if (
    !isObject(input) ||
    !isText(input.name) ||
    (input.filing !== null && !isSectorRoicFiling(input.filing, year)) ||
    (input.inputs !== null && (!input.filing || !isInputs(input.inputs, year)))
  )
    return false;
  if (input.value === null) return isText(input.reason);
  if (
    typeof input.value !== 'number' ||
    !Number.isFinite(input.value) ||
    input.reason !== null ||
    input.inputs === null ||
    input.inputs.reinvestmentBrl <= 0
  )
    return false;
  const expected = input.inputs.nopatBrl / input.inputs.reinvestmentBrl;
  return Math.abs(input.value - expected) < 1e-8 * Math.max(1, Math.abs(expected));
}

export function parseSectorReinvestment(input: unknown): SectorReinvestmentSnapshot {
  if (!isObject(input) || !isObject(input.manifest)) {
    throw new Error('Lote de NOPAT/reinvestimento inválido.');
  }
  const { manifest } = input;
  const { year } = manifest;
  if (
    manifest.schemaVersion !== '1.0.0' ||
    manifest.methodologyVersion !== 'nopat-reinvestment-dfp.v1' ||
    !isDate(manifest.asOf) ||
    !isPositiveInteger(year) ||
    !isTimestamp(manifest.generatedAt) ||
    !isCvmSource(manifest.source) ||
    !isSectorDfpArchive(manifest.archive) ||
    manifest.archive.year !== year ||
    Date.parse(manifest.archive.retrievedAt) > Date.parse(manifest.generatedAt) ||
    !isListOf(input.companies, (company): company is SectorReinvestmentCompany =>
      isCompany(company, year),
    ) ||
    input.companies.length === 0 ||
    !unique(input.companies, ({ name }) => name)
  )
    throw new Error('Lote de NOPAT/reinvestimento inválido.');
  return {
    manifest: manifest as SectorReinvestmentSnapshot['manifest'],
    companies: input.companies,
  };
}
