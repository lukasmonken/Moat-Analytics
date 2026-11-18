import type { DataProvenance } from './index.ts';
import { isDate, isObject } from './validation.ts';

export interface RiskFreeRate {
  /** Taxa anual em fração. 0,1365 corresponde a 13,65% a.a. */
  value: number;
  provenance: DataProvenance;
}

const brazilianDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function sgsDateToIso(date: string) {
  return date.split('/').reverse().join('-');
}

export function parseCdiRate(input: unknown, retrievedAt: Date): RiskFreeRate | null {
  if (Array.isArray(input) && input.length === 0) return null;

  const row: unknown = Array.isArray(input) && input.length === 1 ? input[0] : null;
  if (
    !isObject(row) ||
    typeof row.data !== 'string' ||
    !/^\d{2}\/\d{2}\/\d{4}$/.test(row.data) ||
    typeof row.valor !== 'string' ||
    !/^-?\d+(\.\d+)?$/.test(row.valor)
  ) {
    throw new Error('Resposta inválida do SGS 4389.');
  }

  const referenceDate = sgsDateToIso(row.data);
  const value = Number(row.valor) / 100;
  if (
    !isDate(referenceDate) ||
    referenceDate > sgsDateToIso(brazilianDate.format(retrievedAt)) ||
    !Number.isFinite(value) ||
    value <= -1
  ) {
    throw new Error('Data ou taxa inválida no SGS 4389.');
  }

  return {
    value,
    provenance: {
      source: 'Banco Central do Brasil · SGS 4389',
      referenceDate,
      retrievedAt: retrievedAt.toISOString(),
      publishedAt: null,
      methodologyVersion: 'cdi-current.v1',
      qualityStatus: 'validated',
    },
  };
}
