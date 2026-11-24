import { parseBacktestHistory } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import { prepareBacktest } from '../apps/web/src/features/backtest/history';
import {
  parsePortfolio,
  serializePortfolio,
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
  it('preserva os parâmetros no JSON v1 e descarta campos fora do formato', () => {
    const savedDraft: PortfolioDraft = {
      ...draft,
      method: 'custom',
      positions: [
        { name: 'A', weight: '30,0001' },
        { name: 'B', weight: '69,9999' },
      ],
      maxWeight: '70',
    };
    const file = serializePortfolio(savedDraft);
    expect(file).toBe(JSON.stringify({ schemaVersion: '1.0.0', draft: savedDraft }));
    const legacy = JSON.stringify({
      schemaVersion: '1.0.0',
      unrelated: 'campo extra',
      draft: {
        ...savedDraft,
        unrelated: 'campo extra',
        positions: savedDraft.positions.map((position) => ({ ...position, extra: 'valor' })),
      },
    });
    expect(parsePortfolio(file)).toEqual(savedDraft);
    expect(parsePortfolio(legacy)).toEqual(savedDraft);
  });

  it('rejeita arquivos malformados, versões incompatíveis e carteiras inválidas', () => {
    expect(() => parsePortfolio('{')).toThrow('JSON válido');
    expect(() => parsePortfolio('null')).toThrow('formato de carteira');
    expect(() => parsePortfolio(JSON.stringify({ schemaVersion: '2.0.0', draft }))).toThrow(
      'versão do arquivo',
    );
    const invalid = { ...draft, capital: '0' };
    expect(() => serializePortfolio(invalid)).toThrow('capital inicial positivo');
    expect(() =>
      parsePortfolio(JSON.stringify({ schemaVersion: '1.0.0', draft: invalid })),
    ).toThrow('capital inicial positivo');
  });

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
    expect(output.positions.reduce((total, position) => total + position.costs, 0)).toBeCloseTo(
      output.result.costs,
    );
    expect(
      output.positions.reduce((total, position) => total + position.contribution, 0),
    ).toBeCloseTo(output.result.profit + output.result.tax);
    expect(output.positions[0]?.finalWeight).toBeCloseTo(647.361 / 1186.02);
    expect(output.result.calendarReturns).toHaveLength(1);
    expect(output.result.calendarReturns[0]).toMatchObject({ year: 2024, months: 2 });
    expect(output.result.calendarReturns[0]?.totalReturn).toBe(output.result.totalReturn);
    expect(output.comparisons[0]?.totalReturn).toBeCloseTo(0.1);
    expect(output.comparisons[1]?.totalReturn).toBeNull();
    expect(output.correlations).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it('calcula correlações mensais com a ordem da carteira e a janela avaliada', () => {
    const correlationDates = [...dates, '2024-04-30', '2024-05-31'];
    const asset = (company: string, instrument: string, levels: number[]) => ({
      company,
      instrument,
      observations: correlationDates.map((date, index) => ({ date, level: levels[index] })),
    });
    const { portfolio } = validatePortfolio({
      ...draft,
      customTarget: '4',
      positions: [...draft.positions, { name: 'C', weight: '' }, { name: 'D', weight: '' }],
    });
    if (!portfolio) throw new Error('Carteira de teste inválida.');
    const imported = parseBacktestHistory({
      ...history,
      source: { ...history.source, retrievedAt: '2024-06-01T09:00:00-03:00' },
      assets: [
        asset('D', 'CONS3', [5, 10, 20, 40, 102]),
        asset('B', 'OUTR3', [80, 80, 120, 90, 100]),
        asset('C', 'INVE3', [8, 8, 4, 5, 99]),
        asset('A', 'ACAO3', [4e307, 4e307, 6e307, 4.5e307, 4e307]),
      ],
    });
    const { positions, correlations } = prepareBacktest(
      portfolio,
      imported,
      'custom',
      '2024-01',
      '2024-04',
    );
    expect(
      positions.map(({ company, instrument, targetWeight }) => [company, instrument, targetWeight]),
    ).toEqual([
      ['A', 'ACAO3', 0.25],
      ['B', 'OUTR3', 0.25],
      ['C', 'INVE3', 0.25],
      ['D', 'CONS3', 0.25],
    ]);
    expect(correlations[0]?.[0]).toBe(1);
    expect(correlations[0]?.[1]).toBeCloseTo(1, 12);
    expect(correlations[1]?.[0]).toBe(correlations[0]?.[1]);
    expect(correlations[0]?.[2]).toBeCloseTo(-1, 12);
    expect(correlations[1]?.[2]).toBeCloseTo(-1, 12);
    expect(correlations.map((row) => row[3])).toEqual([null, null, null, null]);
    expect(correlations[3]).toEqual([null, null, null, null]);
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
