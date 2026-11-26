import {
  parseSectorComparison,
  parseSectorLeverage,
  parseSectorReinvestment,
  parseSectorRoicComparison,
  type MarketYieldsSnapshot,
} from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import { combineSnapshots } from '../apps/web/src/features/company/companyQualityData';
import {
  accountingFactors,
  buildFundamentalRanks,
  orderFundamentalRanks,
} from '../apps/web/src/features/ranking/fundamentalRanks';
import { readCvm2025 } from './fixtures/annual-cvm-2025';

function sources() {
  const roe = parseSectorComparison(readCvm2025('cvm-sector-comparison'));
  const roic = parseSectorRoicComparison(readCvm2025('cvm-sector-roic'));
  const leverage = parseSectorLeverage(readCvm2025('cvm-sector-leverage'));
  const reinvestment = parseSectorReinvestment(readCvm2025('cvm-sector-reinvestment'));
  return { roe, roic, leverage, reinvestment, data: combineSnapshots(roe, roic) };
}

describe('Rankings de fundamentos', () => {
  it('anualiza NOPAT e lucro atribuível na janela de cinco exercícios', () => {
    const { data, leverage, reinvestment } = sources();
    const { rows, years } = buildFundamentalRanks(data, leverage, reinvestment);
    expect(years).toEqual([2021, 2022, 2023, 2024, 2025]);
    const weg = rows.find(({ name }) => name === 'WEG S.A.');
    expect(weg?.growth).toBeCloseTo(0.1776746624, 8);
    expect(weg?.growthBaseBrl).toBe(2_744_506_380);
    const itau = rows.find(({ name }) => name === 'ITAU UNIBANCO HOLDING S.A.');
    expect(itau?.growth).toBeGreaterThan(0);
    expect(itau?.metric).toBe('ROE');
    expect(itau?.score).toBeNull();
    const camil = rows.find(({ name }) => name === 'CAMIL ALIMENTOS S.A.');
    expect(camil).toMatchObject({ growth: null, score: null, validYears: 0 });
  });

  it('usa somente a amostra completa na pontuação e ordena alavancagem e drawdown do menor para o maior', () => {
    const { data, leverage, reinvestment } = sources();
    const { rows } = buildFundamentalRanks(data, leverage, reinvestment);
    const included = rows.filter(({ accountingScore }) => accountingScore !== null);
    expect(included.length).toBeGreaterThan(2);
    expect(rows.every(({ score }) => score === null)).toBe(true);
    expect(
      included.every((row) => row.validYears === 5 && row.leverage !== null && row.moat !== null),
    ).toBe(true);
    for (const row of included) {
      const expected =
        accountingFactors.reduce((total, factor) => total + (row.zScores[factor] ?? NaN), 0) / 5;
      expect(row.accountingScore).toBeCloseTo(expected, 10);
    }
    for (const factor of ['leverage', 'risk'] as const) {
      const ranked = orderFundamentalRanks(rows, factor).flatMap((row) => row[factor] ?? []);
      expect(ranked).toEqual([...ranked].sort((a, b) => a - b));
    }
    const withoutReinvestment = buildFundamentalRanks(data, leverage, null);
    expect(withoutReinvestment.rows.every(({ accountingScore }) => accountingScore === null)).toBe(
      true,
    );
  });
  it('só calcula a pontuação final com preço, usa métricas distintas e inclui os mesmos Z-scores exibidos', () => {
    const { data, leverage, reinvestment } = sources();
    const base = buildFundamentalRanks(data, leverage, reinvestment).rows;
    const corporates = base.filter(({ accountingScore }) => accountingScore !== null).slice(0, 2);
    const financials = base
      .filter(({ metric, growth }) => metric === 'ROE' && growth !== null)
      .slice(0, 2);
    const market: MarketYieldsSnapshot = {
      selectionAsOf: data.roic.asOf,
      tradeDate: '2026-11-25',
      companies: [...corporates, ...financials].map(({ name, metric }, index) => ({
        name,
        valuation: {
          metric: metric === 'ROIC' ? 'operatingYield' : 'earningsYield',
          value: 0.1 + index * 0.01,
          accounting: { referenceDate: '2025-12-31' },
          reason: null,
        },
      })),
    };
    const result = buildFundamentalRanks(data, leverage, reinvestment, market);
    const rated = result.rows.filter(({ score }) => score !== null);
    expect(rated).toHaveLength(4);
    expect(result.marketTradeDate).toBe(market.tradeDate);
    for (const row of rated) {
      const factors =
        row.metric === 'ROIC'
          ? [...accountingFactors, 'price' as const]
          : (['profitability', 'growth', 'price'] as const);
      const expected =
        factors.reduce((total, factor) => total + (row.zScores[factor] ?? NaN), 0) / factors.length;
      expect(row.score).toBeCloseTo(expected, 10);
      expect(Math.abs(row.zScores.price ?? 0)).toBeCloseTo(1, 10);
    }
    expect(result.rows.find(({ name }) => name === corporates[0]?.name)?.zScores.price).toBeCloseTo(
      -1,
      10,
    );
  });
});
