import { describe, expect, it } from 'vitest';
import { buildGrowthHistory } from '../apps/web/src/features/ranking/growthHistory';

function growth(...values: (number | null)[]) {
  return buildGrowthHistory(
    values.map((valueBrl, index) => ({
      year: 2021 + index,
      valueBrl,
      filingUrl: null,
      reason: valueBrl === null ? 'DFP indisponível.' : null,
    })),
  );
}

describe('diagnóstico de crescimento', () => {
  it('conta altas reais e mantém percentual indisponível após uma base não positiva', () => {
    const result = growth(-40, 0, 100, 90, 100);
    expect(result.upYears).toBe(3);
    expect(result.comparableYears).toBe(4);
    expect(result.points.map(({ changeBrl }) => changeBrl)).toEqual([null, 40, 100, -10, 10]);
    expect(result.points.map(({ changeRate }) => changeRate)).toEqual([
      null,
      null,
      null,
      -0.1,
      1 / 9,
    ]);
    expect(result.lowBase).toBe(false);
  });

  it('mantém lacunas e não calcula alterações entre anos afastados', () => {
    const result = growth(100, null, 300, 300, 150);
    expect(result.points.map(({ changeBrl }) => changeBrl)).toEqual([null, null, null, 0, -150]);
    expect(result.points[1]?.reason).toBe('DFP indisponível.');
    expect(result.comparableYears).toBe(2);
    expect(result.upYears).toBe(0);
  });

  it('exige três valores posteriores e sinaliza estritamente abaixo de meia mediana', () => {
    expect(growth(20, 60, 72, 80, 120).lowBase).toBe(true);
    expect(growth(38, 60, 72, 80, 120).lowBase).toBe(false);
    expect(growth(20, 60, null, 80, null).lowBase).toBe(false);
  });
});
