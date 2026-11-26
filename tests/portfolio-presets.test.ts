import { parseSectorComparison, parseSectorRoicComparison } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import {
  combineSnapshots,
  comparisonSector,
  type Company,
} from '../apps/web/src/features/company/companyQualityData';
import {
  validatePortfolio,
  type PortfolioDraft,
} from '../apps/web/src/features/portfolio/portfolio';
import {
  applyPortfolioPreset,
  buildPortfolioPresets,
} from '../apps/web/src/features/portfolio/portfolioPresets';
import { readCvm2025 } from './fixtures/annual-cvm-2025';

const comparison = combineSnapshots(
  parseSectorComparison(readCvm2025('cvm-sector-comparison')),
  parseSectorRoicComparison(readCvm2025('cvm-sector-roic')),
);

function company(
  name: string,
  metric: Company['metric'],
  value: number | null,
  year = 2025,
  sector = 'Setor A',
): Company {
  const template = comparison.companies.find((entry) => entry.metric === metric);
  if (!template) throw new Error(`A base precisa incluir ${metric}.`);
  const observation = { year, reason: null, filing: null, inputs: null };
  return template.metric === 'ROE'
    ? { ...template, name, sector, observations: [{ ...observation, roe: value }] }
    : { ...template, name, sector, observations: [{ ...observation, roic: value }] };
}

describe('Carteiras predefinidas', () => {
  it('usa até dez nomes, combina cinco de cada indicador e escolhe um líder por setor', () => {
    const { year, presets } = buildPortfolioPresets(comparison);
    expect(year).toBe(2025);
    for (const companies of Object.values(presets)) expect(companies).toHaveLength(10);
    expect(presets['top-roe'][0]).toBe('BB SEGURIDADE PARTICIPAÇÕES S.A.');
    expect(presets['top-roic'][0]).toBe('CSN MINERAÇÃO S.A.');
    expect(presets.mixed).toEqual([
      ...presets['top-roe'].slice(0, 5),
      ...presets['top-roic'].slice(0, 5),
    ]);

    const sectorWinners = presets['sector-roic'];
    expect(sectorWinners.slice(0, 2)).toEqual([
      'CSN MINERAÇÃO S.A.',
      'CURY CONSTRUTORA E INCORPORADORA S.A.',
    ]);
    expect(sectorWinners).not.toContain('PLANO & PLANO DESENVOLVIMENTO IMOBILIÁRIO S.A.');
    const sectors = comparison.companies
      .filter(({ name }) => sectorWinners.includes(name))
      .map(comparisonSector);
    expect(new Set(sectors).size).toBe(sectorWinners.length);
  });

  it('respeita o exercício comum, lacunas, empates e o limite por indicador', () => {
    const { year, presets } = buildPortfolioPresets({
      roe: { ...comparison.roe, years: [2024, 2025, 2026] },
      roic: { ...comparison.roic, years: [2025, 2024] },
      companies: [
        company('ROE futuro', 'ROE', 10, 2026),
        company('ROIC anterior', 'ROIC', 10, 2024),
        company('ROIC sem dado', 'ROIC', null),
        company('ROIC infinito', 'ROIC', Infinity),
        company('ROE sem número', 'ROE', NaN),
        company('Banco B', 'ROE', 0.2),
        company('Banco A', 'ROE', 0.2),
        company('Banco C', 'ROE', 0.18),
        company('Banco D', 'ROE', 0.17),
        company('Banco E', 'ROE', 0.16),
        company('Banco F', 'ROE', 0.15),
        company('ROIC mais alto', 'ROIC', 0),
        company('ROIC seguinte', 'ROIC', -0.01),
        company('ROIC de outro setor', 'ROIC', -0.02, 2025, 'Setor B'),
      ],
    });
    expect(year).toBe(2025);
    expect(presets['top-roe']).toEqual([
      'Banco A',
      'Banco B',
      'Banco C',
      'Banco D',
      'Banco E',
      'Banco F',
    ]);
    expect(presets['top-roic']).toEqual(['ROIC mais alto', 'ROIC seguinte', 'ROIC de outro setor']);
    expect(presets.mixed).toEqual([
      'Banco A',
      'Banco B',
      'Banco C',
      'Banco D',
      'Banco E',
      'ROIC mais alto',
      'ROIC seguinte',
      'ROIC de outro setor',
    ]);
    expect(presets['sector-roic']).toEqual(['ROIC mais alto', 'ROIC de outro setor']);
  });

  it('deixa os modelos vazios quando a base não tem exercício comum', () => {
    expect(
      buildPortfolioPresets({ ...comparison, roe: { ...comparison.roe, years: [2030] } }),
    ).toEqual({
      year: null,
      presets: { 'top-roe': [], 'top-roic': [], mixed: [], 'sector-roic': [] },
    });
  });

  it('ajusta a quantidade e usa pesos iguais com os parâmetros existentes', () => {
    const draft: PortfolioDraft = {
      target: '15',
      customTarget: '',
      method: 'custom',
      positions: [{ name: 'Companhia manual', weight: '100' }],
      capital: '2350,00',
      contribution: '135,90',
      rebalance: 'monthly',
      cost: '0,5',
      gainTax: '15',
      maxWeight: '60',
    };
    expect(applyPortfolioPreset(draft, [])).toBe(draft);
    const selected = applyPortfolioPreset(draft, ['Companhia A', 'Companhia B', 'Companhia C']);
    expect(selected).toEqual({
      ...draft,
      target: 'custom',
      customTarget: '3',
      method: 'equal',
      positions: ['Companhia A', 'Companhia B', 'Companhia C'].map((name) => ({
        name,
        weight: '',
      })),
    });
    expect(
      validatePortfolio(selected).portfolio?.positions.map(({ weightUnits }) => weightUnits),
    ).toEqual([333_334, 333_333, 333_333]);
    const names = buildPortfolioPresets(comparison).presets.mixed;
    expect(applyPortfolioPreset(selected, names)).toMatchObject({ target: '10', customTarget: '' });
  });
});
