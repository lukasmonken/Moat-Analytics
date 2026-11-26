import type { SectorRoicCompany, SectorRoicSnapshot } from '@moat/data-contracts';
import { compareNames } from '../screener/presentation';

const windowSize = 5;

export interface RoicDrawdownRow {
  name: string;
  sector: string;
  drawdownPp: number | null;
  peakYear: number | null;
  troughYear: number | null;
  validYears: number;
}

function companyDrawdown(company: SectorRoicCompany, years: number[]): RoicDrawdownRow {
  const points = years.flatMap((year) => {
    const value = company.observations.find((observation) => observation.year === year)?.roic;
    return typeof value === 'number' && Number.isFinite(value) ? [{ year, value }] : [];
  });
  const row: RoicDrawdownRow = {
    name: company.name,
    sector: company.sector,
    drawdownPp: null,
    peakYear: null,
    troughYear: null,
    validYears: points.length,
  };
  if (points.length !== windowSize) return row;

  row.drawdownPp = 0;
  let peak = points[0];
  for (const point of points) {
    if (!peak || point.value > peak.value) peak = point;
    const lossPp = (peak.value - point.value) * 100;
    if (lossPp > row.drawdownPp) {
      row.drawdownPp = lossPp;
      row.peakYear = peak.year;
      row.troughYear = point.year;
    }
  }
  return row;
}

export function rankRoicDrawdown(snapshot: SectorRoicSnapshot): {
  years: number[];
  rows: RoicDrawdownRow[];
} {
  const lastYear = snapshot.manifest.years.at(-1);
  const years =
    lastYear === undefined
      ? []
      : Array.from({ length: windowSize }, (_, index) => lastYear - windowSize + 1 + index);
  const sourceYears = years.filter((year) => snapshot.manifest.years.includes(year));
  const rows = snapshot.companies.map((company) => companyDrawdown(company, sourceYears));
  rows.sort(
    (left, right) =>
      (right.drawdownPp ?? -1) - (left.drawdownPp ?? -1) || compareNames(left.name, right.name),
  );
  return { years, rows };
}
