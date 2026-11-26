const multipleFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseRatioLimit(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[+-]?(?:\d+(?:[,.]\d+)?|[,.]\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export function formatRatio(value: number | null): string {
  return value === null ? 'Indisponível' : `${multipleFormatter.format(value)}×`;
}
