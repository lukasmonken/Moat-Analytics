import type {
  SectorComparisonObservation,
  SectorComparisonSnapshot,
  SectorRoicObservation,
  SectorRoicSnapshot,
} from '@moat/data-contracts';
import { compareNames } from '../screener/presentation';

type RoeCompany = { metric: 'ROE' } & SectorComparisonSnapshot['companies'][number];
type RoicCompany = { metric: 'ROIC' } & SectorRoicSnapshot['companies'][number];
export type Company = RoeCompany | RoicCompany;

export interface ComparisonData {
  roe: SectorComparisonSnapshot['manifest'];
  roic: SectorRoicSnapshot['manifest'];
  companies: Company[];
}

export function combineSnapshots(
  roe: SectorComparisonSnapshot,
  roic: SectorRoicSnapshot,
): ComparisonData {
  const companies: Company[] = [
    ...roe.companies.map((company): RoeCompany => ({ ...company, metric: 'ROE' })),
    ...roic.companies.map((company): RoicCompany => ({ ...company, metric: 'ROIC' })),
  ];
  if (
    roe.manifest.asOf !== roic.manifest.asOf ||
    roe.manifest.years.join(',') !== roic.manifest.years.join(',') ||
    new Set(companies.map(({ name }) => name)).size !== companies.length
  ) {
    throw new Error('Lotes de qualidade incompatíveis.');
  }
  companies.sort((left, right) => compareNames(left.name, right.name));
  return { roe: roe.manifest, roic: roic.manifest, companies };
}

export function annualObservation(company: Company, year: number) {
  return company.observations.find((observation) => observation.year === year);
}

export function annualRate(
  observation: SectorComparisonObservation | SectorRoicObservation | undefined,
) {
  if (!observation) return null;
  return 'roe' in observation ? observation.roe : observation.roic;
}
