import type { SectorComparisonSnapshot, SectorRoicSnapshot } from '@moat/data-contracts';
import { compareNames } from '../screener/presentation';

type RoeCompany = SectorComparisonSnapshot['companies'][number];
type RoicCompany = SectorRoicSnapshot['companies'][number];
type FiscalObservation = { year: number };
type Company<Observation> = { name: string; sector: string; observations: Observation[] };

interface SectorRow<Observation extends FiscalObservation, Entry extends Company<Observation>> {
  company: Entry;
  current: Observation | null;
  validYears: number;
  mean: number | null;
  peers: number;
  percentile: number | null;
}

export type SectorComparisonRow = SectorRow<RoeCompany['observations'][number], RoeCompany>;
export type SectorRoicRow = SectorRow<RoicCompany['observations'][number], RoicCompany>;

export const minimumSectorPeers = 5;

function buildRows<Observation extends FiscalObservation, Entry extends Company<Observation>>(
  companies: Entry[],
  years: number[],
  year: number,
  readMetric: (observation: Observation) => number | null,
): SectorRow<Observation, Entry>[] {
  const rows = companies.map((company): SectorRow<Observation, Entry> => {
    const observations = new Map(company.observations.map((entry) => [entry.year, entry]));
    const values = years.flatMap((referenceYear) => {
      const observation = observations.get(referenceYear);
      const metric = observation ? readMetric(observation) : null;
      return metric === null ? [] : [metric];
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

  const sectors = new Map<string, SectorRow<Observation, Entry>[]>();
  for (const row of rows) {
    const members = sectors.get(row.company.sector);
    if (members) members.push(row);
    else sectors.set(row.company.sector, [row]);
  }
  for (const members of sectors.values()) {
    const complete = members
      .filter((row): row is SectorRow<Observation, Entry> & { mean: number } => row.mean !== null)
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

export function buildSectorRows(
  snapshot: SectorComparisonSnapshot,
  year: number,
): SectorComparisonRow[] {
  return buildRows<RoeCompany['observations'][number], RoeCompany>(
    snapshot.companies,
    snapshot.manifest.years,
    year,
    (observation) => observation.roe,
  );
}

export function buildSectorRoicRows(snapshot: SectorRoicSnapshot, year: number): SectorRoicRow[] {
  return buildRows<RoicCompany['observations'][number], RoicCompany>(
    snapshot.companies,
    snapshot.manifest.years,
    year,
    (observation) => observation.roic,
  );
}
