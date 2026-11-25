import type { SectorComparisonSnapshot, SectorRoicSnapshot } from '@moat/data-contracts';
import { compareNames } from '../screener/presentation';

type RoeCompany = SectorComparisonSnapshot['companies'][number];
type RoeObservation = RoeCompany['observations'][number];
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

export type SectorComparisonRow = SectorRow<RoeObservation, RoeCompany>;
export type SectorRoicRow = SectorRow<RoicCompany['observations'][number], RoicCompany>;

export const minimumSectorPeers = 5;
export const maximumSideBySideCompanies = 4;

interface SideBySideObservation {
  year: number;
  observation: RoeObservation | null;
  deltaPp: number | null;
  sectorMedian: number | null;
  sectorPeers: number;
}

export interface SideBySideRoe {
  years: number[];
  companies: {
    company: RoeCompany;
    mean: number | null;
    validYears: number;
    observations: SideBySideObservation[];
  }[];
}

function meanForCompleteWindow(values: number[], years: number[]) {
  return values.length === years.length
    ? values.reduce((sum, value) => sum + value, 0) / years.length
    : null;
}

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
      mean: meanForCompleteWindow(values, years),
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
  return buildRows<RoeObservation, RoeCompany>(
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

function sectorMedian(values: number[]) {
  if (values.length < minimumSectorPeers) return null;

  const ordered = values.sort((left, right) => left - right);
  const lower = ordered[Math.floor((ordered.length - 1) / 2)];
  const upper = ordered[Math.floor(ordered.length / 2)];
  return lower === undefined || upper === undefined ? null : (lower + upper) / 2;
}

export function buildSideBySideRoe(
  snapshot: SectorComparisonSnapshot,
  selectedNames: readonly string[],
): SideBySideRoe {
  const { years } = snapshot.manifest;
  const byName = new Map(snapshot.companies.map((company) => [company.name, company]));
  const selected = [...new Set(selectedNames)]
    .map((name) => byName.get(name))
    .filter((company) => company !== undefined)
    .slice(0, maximumSideBySideCompanies);
  const sectors = new Set(selected.map(({ sector }) => sector));
  const sectorStats = new Map(
    [...sectors].map((sector) => {
      const peers = snapshot.companies.filter((company) => company.sector === sector);
      const statsByYear = new Map(
        years.map((year) => {
          const values = peers.flatMap((peer) => {
            const roe = peer.observations.find((observation) => observation.year === year)?.roe;
            return roe === undefined || roe === null ? [] : [roe];
          });
          return [year, { median: sectorMedian(values), count: values.length }];
        }),
      );
      return [sector, statsByYear];
    }),
  );

  return {
    years,
    companies: selected.map((company) => {
      const byYear = new Map(
        company.observations.map((observation) => [observation.year, observation]),
      );
      const statsByYear = sectorStats.get(company.sector);
      const observations = years.map((year) => {
        const observation = byYear.get(year) ?? null;
        const roe = observation?.roe ?? null;
        const previousRoe = byYear.get(year - 1)?.roe ?? null;
        const stats = statsByYear?.get(year);
        return {
          year,
          observation,
          deltaPp: roe === null || previousRoe === null ? null : (roe - previousRoe) * 100,
          sectorMedian: stats?.median ?? null,
          sectorPeers: stats?.count ?? 0,
        };
      });
      const values = observations.flatMap(({ observation }) =>
        observation?.roe === null || observation?.roe === undefined ? [] : [observation.roe],
      );
      return {
        company,
        mean: meanForCompleteWindow(values, years),
        validYears: values.length,
        observations,
      };
    }),
  };
}
