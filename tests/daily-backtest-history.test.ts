import { parseBacktestHistory, parseDailyBacktestHistory } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import {
  dailyAssetReturn,
  dailyReturnPeriods,
  monthlyHistoryFromDaily,
} from '../apps/web/src/features/backtest/dailyHistory';

const source = {
  name: 'Fonte de teste',
  url: 'https://example.com/series',
  retrievedAt: '2024-11-27T01:00:00Z',
  methodology: 'Níveis de teste de retorno total em reais.',
};

function series(company: string, instrument: string, points: [date: string, level: number][]) {
  return { company, instrument, observations: points.map(([date, level]) => ({ date, level })) };
}

function dailyFile(assets = [series('A', 'ACAO3', [['2024-11-26', 100]])]) {
  return {
    schemaVersion: '1.0.0',
    frequency: 'daily',
    basis: 'total-return-brl',
    source,
    asOf: '2024-11-26',
    assets,
  };
}

describe('Contrato de histórico diário', () => {
  it('preserva os metadados e aceita cobertura parcial por ativo', () => {
    const file = dailyFile([
      series('A', 'ACAO3', [
        ['2024-11-22', 100],
        ['2024-11-26', 110],
      ]),
      series('B', 'OUTR3', [['2024-11-22', 100]]),
    ]);
    expect(parseDailyBacktestHistory(file)).toEqual(file);
    expect(() => parseBacktestHistory(file)).toThrow('séries mensais');
    expect(
      parseBacktestHistory({ ...file, frequency: 'monthly', assets: dailyFile().assets }).source,
    ).toEqual(source);
  });

  it.each([
    { name: 'base de preços sem proventos', fields: { basis: 'price-only-brl' } },
    { name: 'frequência mensal', fields: { frequency: 'monthly' } },
    { name: 'data-base inválida', fields: { asOf: '2024-02-30' } },
    { name: 'data-base posterior à coleta em São Paulo', fields: { asOf: '2024-11-27' } },
    { name: 'data-base anterior à última observação', fields: { asOf: '2024-11-25' } },
    {
      name: 'data-base sem observação no lote',
      fields: { asOf: '2024-11-26', assets: [series('A', 'ACAO3', [['2024-11-25', 100]])] },
    },
    {
      name: 'data de observação inválida',
      fields: { assets: [series('A', 'ACAO3', [['2024-02-30', 100]])] },
    },
    {
      name: 'observações duplicadas',
      fields: {
        assets: [
          series('A', 'ACAO3', [
            ['2024-11-26', 100],
            ['2024-11-26', 110],
          ]),
        ],
      },
    },
    {
      name: 'observações fora de ordem',
      fields: {
        assets: [
          series('A', 'ACAO3', [
            ['2024-11-26', 110],
            ['2024-11-25', 100],
          ]),
        ],
      },
    },
    {
      name: 'benchmark posterior à data-base',
      fields: {
        benchmarks: [{ symbol: 'IBOV', observations: [{ date: '2024-11-27', level: 100 }] }],
      },
    },
  ])('rejeita $name', ({ fields }) => {
    expect(() => parseDailyBacktestHistory({ ...dailyFile(), ...fields })).toThrow();
  });
});

describe('Retorno por janelas de pregões', () => {
  it('alinha os períodos ao último pregão registrado antes de cada limite', () => {
    const dates = [
      '2019-11-26',
      '2020-11-26',
      '2021-11-26',
      '2022-11-25',
      '2022-12-29',
      '2023-11-24',
      '2023-12-28',
      '2024-09-30',
      '2024-10-25',
      '2024-10-31',
      '2024-11-22',
      '2024-11-26',
    ];
    const history = parseDailyBacktestHistory(
      dailyFile([
        series(
          'A',
          'ACAO3',
          dates.map((date) => [date, 100]),
        ),
      ]),
    );
    expect(dailyReturnPeriods(history).map(({ id, start, end }) => [id, start, end])).toEqual([
      ['week', '2024-11-22', '2024-11-26'],
      ['month', '2024-10-31', '2024-11-26'],
      ['last-month', '2024-09-30', '2024-10-31'],
      ['year', '2023-12-28', '2024-11-26'],
      ['last-year', '2022-12-29', '2023-12-28'],
      ['1m', '2024-10-25', '2024-11-26'],
      ['12m', '2023-11-24', '2024-11-26'],
      ['2y', '2022-11-25', '2024-11-26'],
      ['3y', '2021-11-26', '2024-11-26'],
      ['4y', '2020-11-26', '2024-11-26'],
      ['5y', '2019-11-26', '2024-11-26'],
    ]);
  });

  it('mantém o aniversário de fevereiro em ano sem dia 29', () => {
    const asset = series('A', 'ACAO3', [
      ['2023-02-28', 100],
      ['2023-03-01', 150],
      ['2024-02-29', 125],
    ]);
    const history = parseDailyBacktestHistory({ ...dailyFile([asset]), asOf: '2024-02-29' });
    const period = dailyReturnPeriods(history).find(({ id }) => id === '12m');
    expect(period).toMatchObject({ start: '2023-02-28', end: '2024-02-29' });
    expect(period && dailyAssetReturn(asset.observations, period)).toBe(0.25);
  });

  it('limita a janela móvel de um mês ao último dia de um mês mais curto', () => {
    const asset = series('A', 'ACAO3', [
      ['2021-02-26', 100],
      ['2021-03-01', 150],
      ['2021-03-31', 125],
    ]);
    const history = parseDailyBacktestHistory({ ...dailyFile([asset]), asOf: '2021-03-31' });
    const period = dailyReturnPeriods(history).find(({ id }) => id === '1m');
    expect(period).toMatchObject({ start: '2021-02-26', end: '2021-03-31' });
    expect(period && dailyAssetReturn(asset.observations, period)).toBe(0.25);
  });

  it('retorna ausência se faltarem os mesmos pregões de início ou fim', () => {
    const complete = series('A', 'ACAO3', [
      ['2024-11-22', 100],
      ['2024-11-26', 110],
    ]);
    const missingStart = series('B', 'OUTR3', [
      ['2024-11-21', 100],
      ['2024-11-26', 120],
    ]);
    const missingEnd = series('C', 'CONS3', [
      ['2024-11-22', 100],
      ['2024-11-25', 130],
    ]);
    const history = parseDailyBacktestHistory(dailyFile([complete, missingStart, missingEnd]));
    const [week, month] = dailyReturnPeriods(history);
    expect(week).toMatchObject({ start: '2024-11-22', end: '2024-11-26' });
    expect(week && dailyAssetReturn(complete.observations, week)).toBeCloseTo(0.1);
    expect(week && dailyAssetReturn(missingStart.observations, week)).toBeNull();
    expect(week && dailyAssetReturn(missingEnd.observations, week)).toBeNull();
    expect(month).toMatchObject({ start: null, end: '2024-11-26' });
    expect(month && dailyAssetReturn(complete.observations, month)).toBeNull();
  });

  it('exclui o mês em aberto e usa o mesmo pregão de fechamento para ativos e benchmarks', () => {
    const first = series('A', 'ACAO3', [
      ['2024-07-15', 90],
      ['2024-08-30', 100],
      ['2024-09-30', 110],
      ['2024-11-26', 130],
    ]);
    const second = series('B', 'OUTR3', [
      ['2024-08-29', 100],
      ['2024-09-30', 120],
      ['2024-10-30', 125],
      ['2024-11-26', 140],
    ]);
    const observations = [
      { date: '2024-08-30', level: 100 },
      { date: '2024-10-31', level: 120 },
      { date: '2024-11-26', level: 130 },
    ];
    const history = parseDailyBacktestHistory({
      ...dailyFile([first, second]),
      benchmarks: [{ symbol: 'IBOV', observations }],
    });
    const monthly = monthlyHistoryFromDaily(history);
    expect(monthly.source).toEqual(source);
    expect(monthly.assets.map((asset) => asset.observations.map(({ date }) => date))).toEqual([
      ['2024-08-30', '2024-09-30'],
      ['2024-09-30'],
    ]);
    expect(monthly.benchmarks?.[0]?.observations).toEqual(observations.slice(0, 2));
  });

  it('inclui o mês quando a data-base coincide com seu último dia civil', () => {
    const asset = series('A', 'ACAO3', [
      ['2024-09-27', 100],
      ['2024-09-30', 120],
    ]);
    const history = parseDailyBacktestHistory({ ...dailyFile([asset]), asOf: '2024-09-30' });
    expect(monthlyHistoryFromDaily(history).assets[0]?.observations).toEqual([
      { date: '2024-09-30', level: 120 },
    ]);
  });

  it.each([
    { date: '2024-06-28', completed: true },
    { date: '2024-08-30', completed: true },
    { date: '2024-08-29', completed: false },
  ])('verifica se o mês terminou na data-base $date', ({ date, completed }) => {
    const asset = series('A', 'ACAO3', [[date, 120]]);
    const history = parseDailyBacktestHistory({ ...dailyFile([asset]), asOf: date });
    expect(monthlyHistoryFromDaily(history).assets[0]?.observations).toEqual(
      completed ? asset.observations : [],
    );
  });
});
