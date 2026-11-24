import { parseBacktestHistory } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import { prepareBacktest } from '../apps/web/src/features/backtest/history';
import {
  validatePortfolio,
  type PortfolioDraft,
} from '../apps/web/src/features/portfolio/portfolio';

const draft: PortfolioDraft = {
  target: 'custom',
  customTarget: '2',
  method: 'equal',
  positions: [
    { name: 'A', weight: '' },
    { name: 'B', weight: '' },
  ],
  capital: '1000,00',
  contribution: '100,00',
  rebalance: 'monthly',
  cost: '1',
  gainTax: '20',
  maxWeight: '',
};
const dates = ['2024-01-31', '2024-02-29', '2024-03-28'];
const observations = (levels: number[]) =>
  levels.map((level, index) => ({ date: dates[index], level }));
const history = {
  schemaVersion: '1.0.0',
  basis: 'total-return-brl',
  source: {
    name: 'Fixture',
    retrievedAt: '2024-04-01T09:00:00-03:00',
    methodology: 'Níveis mensais de teste.',
  },
  assets: [
    { company: 'A', instrument: 'ACAO3', observations: observations([100, 120, 132]) },
    { company: 'B', instrument: 'OUTR3', observations: observations([100, 80, 72]) },
  ],
  benchmarks: [{ symbol: 'IBOV', observations: observations([100, 90, 110]) }],
};

describe('Backtest e carteira', () => {
  it('mantém a paridade com a retrospectiva de custos e rebalanceamento em Decimal', () => {
    const { portfolio } = validatePortfolio(draft);
    if (!portfolio) throw new Error('Carteira de teste inválida.');
    const output = prepareBacktest(
      portfolio,
      parseBacktestHistory(history),
      'custom',
      '2024-01',
      '2024-03',
    );
    expect(output.result.finalValue).toBeCloseTo(1186.02);
    expect(output.result.contributions).toBe(200);
    expect(output.result.costs).toBeCloseTo(13.98);
    expect(output.result.profit).toBeCloseTo(-13.98);
    expect(output.result.calendarReturns).toHaveLength(1);
    expect(output.result.calendarReturns[0]).toMatchObject({ year: 2024, months: 2 });
    expect(output.result.calendarReturns[0]?.totalReturn).toBe(output.result.totalReturn);
    expect(output.comparisons[0]?.totalReturn).toBeCloseTo(0.1);
    expect(output.comparisons[1]?.totalReturn).toBeNull();
  });

  it('rejeita mês ausente e pregões diferentes no mesmo mês', () => {
    const { portfolio } = validatePortfolio(draft);
    if (!portfolio) throw new Error('Carteira de teste inválida.');
    const incomplete = structuredClone(history);
    incomplete.assets[1]?.observations.splice(1, 1);
    expect(() =>
      prepareBacktest(portfolio, parseBacktestHistory(incomplete), 'custom', '2024-01', '2024-03'),
    ).toThrow(/Falta observação em 2024-02 para B/);
    const different = structuredClone(history);
    const row = different.assets[1]?.observations[1];
    if (row) row.date = '2024-02-28';
    expect(() =>
      prepareBacktest(portfolio, parseBacktestHistory(different), 'custom', '2024-01', '2024-03'),
    ).toThrow(/pregões diferentes/);
  });

  it('valida pesos de quatro casas decimais sem arredondar a soma', () => {
    const custom: PortfolioDraft = {
      ...draft,
      method: 'custom',
      positions: [
        { name: 'A', weight: '33,3333' },
        { name: 'B', weight: '66,6667' },
      ],
    };
    expect(
      validatePortfolio(custom).portfolio?.positions.map(({ weightUnits }) => weightUnits),
    ).toEqual([333333, 666667]);
    expect(validatePortfolio({ ...custom, maxWeight: '66,6666' }).errors).toContain(
      'Uma ou mais posições excedem o limite por companhia.',
    );
    expect(
      validatePortfolio({
        ...custom,
        positions: [
          { name: 'A', weight: '33,3333' },
          { name: 'B', weight: '66,6666' },
        ],
      }).portfolio,
    ).toBeNull();
  });
});
