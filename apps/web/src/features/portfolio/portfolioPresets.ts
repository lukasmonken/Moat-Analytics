import {
  annualObservation,
  annualRate,
  comparisonSector,
  orderByAnnualReturn,
  type Company,
  type ComparisonData,
} from '../company/companyQualityData';
import type { PortfolioDraft } from './portfolio';

export type PortfolioPresetId = 'top-roe' | 'top-roic' | 'mixed' | 'sector-roic';

function rankedCompanies(companies: Company[], year: number, metric: Company['metric']) {
  const eligible = companies.filter(
    (company) =>
      company.metric === metric && Number.isFinite(annualRate(annualObservation(company, year))),
  );
  return orderByAnnualReturn(eligible, year);
}

export function buildPortfolioPresets(data: ComparisonData): {
  year: number | null;
  presets: Record<PortfolioPresetId, string[]>;
} {
  const commonYears = data.roe.years.filter((year) => data.roic.years.includes(year));
  if (commonYears.length === 0) {
    return { year: null, presets: { 'top-roe': [], 'top-roic': [], mixed: [], 'sector-roic': [] } };
  }

  const year = Math.max(...commonYears);
  const roe = rankedCompanies(data.companies, year, 'ROE');
  const roic = rankedCompanies(data.companies, year, 'ROIC');
  const sectors = new Set<string>();
  const sectorLeaders = [];
  for (const company of roic) {
    const sector = comparisonSector(company);
    if (sectors.has(sector)) continue;
    sectors.add(sector);
    sectorLeaders.push(company.name);
    if (sectorLeaders.length === 10) break;
  }

  return {
    year,
    presets: {
      'top-roe': roe.slice(0, 10).map(({ name }) => name),
      'top-roic': roic.slice(0, 10).map(({ name }) => name),
      mixed: [...roe.slice(0, 5), ...roic.slice(0, 5)].map(({ name }) => name),
      'sector-roic': sectorLeaders,
    },
  };
}

export function applyPortfolioPreset(draft: PortfolioDraft, names: string[]): PortfolioDraft {
  if (names.length === 0) return draft;
  return {
    ...draft,
    method: 'equal',
    target: names.length === 10 ? '10' : 'custom',
    customTarget: names.length === 10 ? '' : String(names.length),
    positions: names.map((name) => ({ name, weight: '' })),
  };
}
