import { isCvmSource, type CvmSource } from './cvm.ts';
import { isDate, isListOf, isObject, isText, unique } from './validation.ts';

export interface CompanyDirectorySnapshot {
  schemaVersion: '1.0.0';
  asOf: string;
  source: CvmSource;
  companies: string[];
}

export function parseCompanyDirectory(input: unknown): CompanyDirectorySnapshot {
  if (
    !isObject(input) ||
    input.schemaVersion !== '1.0.0' ||
    !isDate(input.asOf) ||
    !isCvmSource(input.source) ||
    !isListOf(input.companies, isText) ||
    input.companies.length === 0 ||
    !unique(input.companies, (name) => name)
  ) {
    throw new Error('Diretório de companhias inválido ou versão de esquema incompatível.');
  }

  return {
    schemaVersion: input.schemaVersion,
    asOf: input.asOf,
    source: input.source,
    companies: input.companies,
  };
}
