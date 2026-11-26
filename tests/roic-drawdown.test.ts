import { readFileSync } from 'node:fs';
import { parseSectorRoicComparison, type SectorRoicCompany } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import { rankRoicDrawdown } from '../apps/web/src/features/ranking/roicDrawdown';

const snapshot = parseSectorRoicComparison(
  JSON.parse(readFileSync('data/public/cvm-sector-roic.json', 'utf8')),
);

function company(
  name: string,
  values: (number | null | undefined)[],
  from = 2021,
): SectorRoicCompany {
  return {
    name,
    sector: 'Setor de teste',
    observations: values.flatMap((roic, index) =>
      roic === undefined
        ? []
        : [{ year: from + index, roic, reason: null, filing: null, inputs: null }],
    ),
  };
}

describe('Drawdown do ROIC', () => {
  it('mede a maior queda de pico a fundo posterior em pontos percentuais', () => {
    const result = rankRoicDrawdown({
      ...snapshot,
      companies: [
        company('Pico mais recente', [0.1, 0.02, 0.2, 0.19, 0.4]),
        company('Cruzou zero', [0.25, 0.18, -0.1, 0.05, 0.12]),
        company('ROIC negativo', [-0.1, -0.2, -0.05, -0.245, -0.1]),
      ],
    });
    expect(result.years).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(result.rows.map(({ name }) => name)).toEqual([
      'Cruzou zero',
      'ROIC negativo',
      'Pico mais recente',
    ]);
    expect(result.rows[0]).toMatchObject({ validYears: 5, peakYear: 2021, troughYear: 2023 });
    expect(result.rows[0]?.drawdownPp).toBeCloseTo(35);
    expect(result.rows[1]).toMatchObject({ validYears: 5, peakYear: 2023, troughYear: 2024 });
    expect(result.rows[1]?.drawdownPp).toBeCloseTo(19.5);
    expect(result.rows[2]).toMatchObject({ validYears: 5, peakYear: 2021, troughYear: 2022 });
    expect(result.rows[2]?.drawdownPp).toBeCloseTo(8);
  });

  it('desempata por nome, distingue zero de lacunas e preserva contagem', () => {
    const { rows } = rankRoicDrawdown({
      ...snapshot,
      companies: [
        company('Zulu', [0.25, 0.125, 0.2, 0.4, 0.4]),
        company('Sem dados', [null, undefined, 0.6, NaN, Infinity]),
        company('Sem queda', [-0.2, -0.2, -0.1, 0, 0.2]),
        company('Ágata', [0.25, 0.125, 0.2, 0.4, 0.4]),
      ],
    });
    expect(rows.map(({ name }) => name)).toEqual(['Ágata', 'Zulu', 'Sem queda', 'Sem dados']);
    expect(rows[2]).toMatchObject({
      validYears: 5,
      drawdownPp: 0,
      peakYear: null,
      troughYear: null,
    });
    expect(rows[3]).toMatchObject({
      validYears: 1,
      drawdownPp: null,
      peakYear: null,
      troughYear: null,
    });
  });

  it('usa os últimos cinco exercícios consecutivos da fonte', () => {
    const companies = [company('Negócio', [0.9, 0.1, 0.2, 0.3, 0.2, 0.1])];
    const current = rankRoicDrawdown({
      manifest: { ...snapshot.manifest, years: [2021, 2022, 2023, 2024, 2025, 2026] },
      companies,
    });
    expect(current.years).toEqual([2022, 2023, 2024, 2025, 2026]);
    expect(current.rows[0]?.drawdownPp).toBeCloseTo(20);
    expect(current.rows[0]).toMatchObject({ peakYear: 2024, troughYear: 2026 });

    const incomplete = rankRoicDrawdown({
      manifest: { ...snapshot.manifest, years: [2021, 2022, 2024, 2025, 2026] },
      companies,
    });
    expect(incomplete.years).toEqual([2022, 2023, 2024, 2025, 2026]);
    expect(incomplete.rows[0]).toMatchObject({ validYears: 4, drawdownPp: null });
  });

  it('classifica o lote real do ROIC e preserva todas as séries incompletas', () => {
    const { rows } = rankRoicDrawdown(snapshot);
    expect(rows).toHaveLength(129);
    expect(rows.filter(({ drawdownPp }) => drawdownPp !== null)).toHaveLength(114);
    expect(rows[0]).toMatchObject({
      name: 'UNIPAR CARBOCLORO S.A.',
      peakYear: 2021,
      troughYear: 2024,
    });
    expect(rows[0]?.drawdownPp).toBeCloseTo(66.77604, 5);
    expect(rows.at(-1)?.drawdownPp).toBeNull();
  });
});
