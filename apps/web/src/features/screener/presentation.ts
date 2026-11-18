export const pageSizes = ['5', '10', '20', '30', '40', '50'] as const;
export const defaultPageSize = '10';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});
const numberFormatter = new Intl.NumberFormat('pt-BR');

export const compareNames = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
  .compare;
export const formatNumber = numberFormatter.format;

export function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

export function formatCompanyCount(matches: number, total: number) {
  return `${formatNumber(matches)} de ${formatNumber(total)} companhias`;
}

export function normalizeSearch(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}
