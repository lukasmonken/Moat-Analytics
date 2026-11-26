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

export interface SectorMarginCompany {
  name: string;
  filing: SectorRoicObservation['filing'];
  reason: string | null;
  inputs: {
    revenueBrl: number;
    grossIncomeBrl: number;
    ebitBrl: number;
    netIncomeBrl: number;
  } | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
}

export interface SectorMarginsSnapshot {
  manifest: Omit<SectorLeverageSnapshot['manifest'], 'methodologyVersion'> & {
    methodologyVersion: 'margins-dfp.v1';
  };
  companies: SectorMarginCompany[];
}

function money(value: unknown): value is number {
  return typeof value === 'number' && Math.abs(value) < 2 ** 53;
}

function agrees(value: unknown, expected: number) {
  return (
    typeof value === 'number' && Math.abs(value - expected) < 1e-8 * Math.max(1, Math.abs(expected))
  );
}

function isCompany(input: unknown, year: number): input is SectorMarginCompany {
  if (
    !isObject(input) ||
    !isText(input.name) ||
    (input.filing !== null && !isSectorRoicFiling(input.filing, year))
  ) {
    return false;
  }
  if (input.inputs === null) {
    return (
      isText(input.reason) &&
      input.grossMargin === null &&
      input.operatingMargin === null &&
      input.netMargin === null
    );
  }
  if (!input.filing || !isObject(input.inputs) || input.reason !== null) return false;
  const { revenueBrl, grossIncomeBrl, ebitBrl, netIncomeBrl } = input.inputs;
  return (
    money(revenueBrl) &&
    revenueBrl > 0 &&
    money(grossIncomeBrl) &&
    money(ebitBrl) &&
    money(netIncomeBrl) &&
    agrees(input.grossMargin, grossIncomeBrl / revenueBrl) &&
    agrees(input.operatingMargin, ebitBrl / revenueBrl) &&
    agrees(input.netMargin, netIncomeBrl / revenueBrl)
  );
}

export function parseSectorMargins(input: unknown): SectorMarginsSnapshot {
  if (!isObject(input) || !isObject(input.manifest)) throw new Error('Lote de margens inválido.');
  const { manifest } = input;
  const { year } = manifest;
  if (
    manifest.schemaVersion !== '1.0.0' ||
    manifest.methodologyVersion !== 'margins-dfp.v1' ||
    !isDate(manifest.asOf) ||
    !isPositiveInteger(year) ||
    !isTimestamp(manifest.generatedAt) ||
    !isCvmSource(manifest.source) ||
    !isSectorDfpArchive(manifest.archive) ||
    manifest.archive.year !== year ||
    Date.parse(manifest.archive.retrievedAt) > Date.parse(manifest.generatedAt) ||
    !isListOf(input.companies, (company): company is SectorMarginCompany =>
      isCompany(company, year),
    ) ||
    input.companies.length === 0 ||
    !unique(input.companies, ({ name }) => name)
  )
    throw new Error('Lote de margens inválido.');
  return { manifest: manifest as SectorMarginsSnapshot['manifest'], companies: input.companies };
}
