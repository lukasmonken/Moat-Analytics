const multipleFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ranges = {
  negative: [-Infinity, 0],
  '0-1': [0, 1],
  '1-2': [1, 2],
  '2-3': [2, 3],
  '3-4': [3, 4],
  '4-5': [4, 5],
  '5-plus': [5, Infinity],
} as const;

export type RatioRange = keyof typeof ranges | 'all' | 'unavailable';

export const ratioRangeOptions = [
  { value: 'all', label: 'Todas as faixas' },
  { value: 'negative', label: 'Abaixo de 0×' },
  { value: '0-1', label: '0 a menos de 1×' },
  { value: '1-2', label: '1 a menos de 2×' },
  { value: '2-3', label: '2 a menos de 3×' },
  { value: '3-4', label: '3 a menos de 4×' },
  { value: '4-5', label: '4 a menos de 5×' },
  { value: '5-plus', label: '5× ou mais' },
  { value: 'unavailable', label: 'Indisponível' },
] as const satisfies readonly { value: RatioRange; label: string }[];

export function matchesRatioRange(value: number | null | undefined, range: RatioRange): boolean {
  if (range === 'all') return true;
  const available = typeof value === 'number' && Number.isFinite(value);
  if (range === 'unavailable') return !available;
  const [lower, upper] = ranges[range];
  return available && value >= lower && value < upper;
}

export function formatRatio(value: number | null): string {
  return value === null ? 'Indisponível' : `${multipleFormatter.format(value)}×`;
}
