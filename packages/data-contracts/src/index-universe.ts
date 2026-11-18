import { INDEX_CODES, type IndexCode } from './index.ts';
import {
  isDate,
  isListOf,
  isObject,
  isPositiveInteger,
  isText,
  isTimestamp,
  unique,
} from './validation.ts';

export interface IndexUniverseSecurity {
  ticker: string;
  kind: 'ON' | 'PN' | 'UNIT';
  indexMemberships: IndexCode[];
}

export interface IndexUniverseCompany {
  companyId: string;
  cvmCode: number;
  name: string;
  indexMemberships: IndexCode[];
  securities: IndexUniverseSecurity[];
  representativeTicker: null;
}

export interface IndexUniverseSnapshot {
  schemaVersion: '1.0.0';
  asOf: string;
  importedAt: string;
  source: { name: string; url: string | null; redistributionBasis: string | null };
  coverage: { includedCompanies: number; byIndex: Record<IndexCode, number> };
  companies: IndexUniverseCompany[];
}

function isIndexCode(value: unknown): value is IndexCode {
  return INDEX_CODES.some((index) => index === value);
}

function isMembership(value: unknown): value is IndexCode[] {
  return isListOf(value, isIndexCode) && value.length > 0 && new Set(value).size === value.length;
}

function isSecurity(value: unknown): value is IndexUniverseSecurity {
  return (
    isObject(value) &&
    typeof value.ticker === 'string' &&
    /^[A-Z][A-Z0-9]{3}[0-9]{1,2}$/.test(value.ticker) &&
    (value.kind === 'ON' || value.kind === 'PN' || value.kind === 'UNIT') &&
    isMembership(value.indexMemberships)
  );
}

function isCompany(value: unknown): value is IndexUniverseCompany {
  if (
    !isObject(value) ||
    !isPositiveInteger(value.cvmCode) ||
    value.companyId !== 'cvm:' + value.cvmCode ||
    !isText(value.name) ||
    !isMembership(value.indexMemberships) ||
    !isListOf(value.securities, isSecurity) ||
    !unique(value.securities, ({ ticker }) => ticker) ||
    value.representativeTicker !== null
  ) {
    return false;
  }

  const fromSecurities = new Set(
    value.securities.flatMap(({ indexMemberships }) => indexMemberships),
  );
  return (
    fromSecurities.size === value.indexMemberships.length &&
    value.indexMemberships.every((index) => fromSecurities.has(index))
  );
}

function isSourceUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isSource(value: unknown): value is IndexUniverseSnapshot['source'] {
  return (
    isObject(value) &&
    isText(value.name) &&
    isSourceUrl(value.url) &&
    (value.redistributionBasis === null || isText(value.redistributionBasis))
  );
}

function isCoverage(value: unknown): value is IndexUniverseSnapshot['coverage'] {
  return (
    isObject(value) &&
    isPositiveInteger(value.includedCompanies) &&
    isObject(value.byIndex) &&
    isPositiveInteger(value.byIndex.IBOV) &&
    isPositiveInteger(value.byIndex.SMLL) &&
    isPositiveInteger(value.byIndex.IDIV)
  );
}

export function parseIndexUniverse(input: unknown): IndexUniverseSnapshot {
  if (
    !isObject(input) ||
    input.schemaVersion !== '1.0.0' ||
    !isDate(input.asOf) ||
    !isTimestamp(input.importedAt) ||
    !isSource(input.source) ||
    !isCoverage(input.coverage) ||
    !isListOf(input.companies, isCompany)
  ) {
    throw new Error('Composição anual inválida ou versão de esquema incompatível.');
  }

  const { companies, coverage } = input;
  const securities = companies.flatMap((company) => company.securities);
  const countMismatch = INDEX_CODES.some(
    (index) =>
      coverage.byIndex[index] !==
      companies.filter(({ indexMemberships }) => indexMemberships.includes(index)).length,
  );
  if (
    coverage.includedCompanies !== companies.length ||
    !unique(companies, (company) => company.companyId) ||
    !unique(securities, (security) => security.ticker) ||
    countMismatch
  ) {
    throw new Error('A cobertura da composição anual diverge dos registros.');
  }

  return {
    schemaVersion: input.schemaVersion,
    asOf: input.asOf,
    importedAt: input.importedAt,
    source: input.source,
    coverage,
    companies,
  };
}
