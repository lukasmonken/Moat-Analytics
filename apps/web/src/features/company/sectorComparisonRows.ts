import type { SectorComparisonSnapshot } from '@moat/data-contracts';
import { compareNames } from '../screener/presentation';

type Company = SectorComparisonSnapshot['companies'][number];
type Observation = Company['observations'][number];

export interface SectorComparisonRow {
  company: Company;
  current: Observation | null;
  validYears: number;
  mean: number | null;
  peers: number;
  percentile: number | null;
}

export const minimumSectorPeers = 5;

export function buildSectorRows(
  snapshot: SectorComparisonSnapshot,
  year: number,
): SectorComparisonRow[] {
  const { years } = snapshot.manifest;
  const rows = snapshot.companies.map((company): SectorComparisonRow => {
    const observations = new Map(company.observations.map((entry) => [entry.year, entry]));
    const values = years.flatMap((entry) => {
      const roe = observations.get(entry)?.roe;
      return roe === undefined || roe === null ? [] : [roe];
    });
    return {
      company,
      current: observations.get(year) ?? null,
      validYears: values.length,
      mean:
        values.length === years.length
          ? values.reduce((sum, value) => sum + value, 0) / years.length
          : null,
      peers: 0,
      percentile: null,
    };
  });

  const sectors = new Map<string, SectorComparisonRow[]>();
  for (const row of rows) {
    const members = sectors.get(row.company.sector);
    if (members) members.push(row);
    else sectors.set(row.company.sector, [row]);
  }
  for (const members of sectors.values()) {
    const complete = members
      .filter((row): row is SectorComparisonRow & { mean: number } => row.mean !== null)
      .sort((left, right) => left.mean - right.mean);
    for (const row of members) row.peers = complete.length;
    if (complete.length < minimumSectorPeers) continue;

    for (let first = 0; first < complete.length;) {
      const mean = complete[first]?.mean;
      let next = first + 1;
      while (next < complete.length && complete[next]?.mean === mean) next += 1;
      const percentile = ((first + next - 1) * 50) / (complete.length - 1);
      for (const row of complete.slice(first, next)) row.percentile = percentile;
      first = next;
    }
  }
  return rows.sort((left, right) => compareNames(left.company.name, right.company.name));
}
