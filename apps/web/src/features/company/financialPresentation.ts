import type { CvmSnapshot } from '@moat/data-contracts';

export type CvmCompany = CvmSnapshot['companies'][number];
export type CvmObservation = CvmCompany['observations'][number];

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const instantFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const amountFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const categories = {
  industry: 'Indústria',
  retail: 'Varejo',
  bank: 'Banco',
} satisfies Record<CvmCompany['category'], string>;

export const statementNames = {
  BPA: 'Balanço patrimonial ativo',
  BPP: 'Balanço patrimonial passivo',
  DRE: 'Demonstração do resultado',
} satisfies Record<CvmObservation['accounts'][number]['statement'], string>;

export const checkLabels = {
  passed: 'Conciliado',
  failed: 'Divergência',
  unavailable: 'Indisponível',
} satisfies Record<CvmObservation['reconciliations'][number]['status'], string>;

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatInstant(value: string) {
  return instantFormatter.format(new Date(value));
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatAmount(value: number) {
  return amountFormatter.format(value);
}
