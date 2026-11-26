interface AnnualGrowthSource {
  year: number;
  valueBrl: number | null;
  filingUrl: string | null;
  reason: string | null;
}

export interface GrowthHistory {
  points: (AnnualGrowthSource & { changeBrl: number | null; changeRate: number | null })[];
  comparableYears: number;
  upYears: number;
  lowBase: boolean;
}

export function buildGrowthHistory(series: AnnualGrowthSource[]): GrowthHistory {
  const points = series.map((point, index) => {
    const previous = series[index - 1];
    const priorValue = previous?.year === point.year - 1 ? previous.valueBrl : null;
    const changeBrl =
      priorValue !== null && point.valueBrl !== null ? point.valueBrl - priorValue : null;
    const rate =
      changeBrl !== null && priorValue !== null && priorValue > 0 ? changeBrl / priorValue : null;
    return {
      ...point,
      changeBrl,
      changeRate: rate !== null && Number.isFinite(rate) ? rate : null,
    };
  });
  const changes = points.flatMap(({ changeBrl }) => changeBrl ?? []);
  const base = series[0]?.valueBrl;
  const laterValues = series
    .slice(1)
    .flatMap(({ valueBrl }) => valueBrl ?? [])
    .sort((a, b) => a - b);
  const middle = Math.floor(laterValues.length / 2);
  const median =
    ((laterValues[middle] ?? 0) + (laterValues[Math.floor((laterValues.length - 1) / 2)] ?? 0)) / 2;
  return {
    points,
    comparableYears: changes.length,
    upYears: changes.filter((change) => change > 0).length,
    lowBase: base != null && base > 0 && laterValues.length >= 3 && base < median / 2,
  };
}
