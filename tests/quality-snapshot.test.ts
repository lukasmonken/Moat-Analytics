import { readFileSync } from 'node:fs';
import { parseQualitySnapshot } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';

function snapshot() {
  return parseQualitySnapshot(JSON.parse(readFileSync('data/public/cvm-quality.json', 'utf8')));
}

describe('Séries de qualidade da CVM', () => {
  it('confere os retornos de cinco exercícios contra os cálculos independentes', () => {
    const expected = [
      [
        'cvm:5410',
        'estimated',
        [0.234371505171, 0.236335341612, 0.288517416075, 0.2904223523, 0.278651657365],
      ],
      [
        'cvm:8133',
        'estimated',
        [0.056171507833, 0.080773313114, 0.047439194944, 0.067552663157, 0.095704172772],
      ],
      [
        'cvm:19348',
        'validated',
        [0.1808982042, 0.185164751244, 0.184998910292, 0.204776370845, 0.215870892296],
      ],
    ] as const;
    const sample = snapshot();
    expect(sample.manifest.coverage.includedCompanies).toBe(3);
    expect(sample.benchmark.status).toBe('unavailable');
    expect(sample.ranking.status).toBe('unavailable');

    for (const [id, status, values] of expected) {
      const company = sample.companies.find(({ companyId }) => companyId === id);
      expect(company?.summary.validYears).toBe(5);
      const observations = [...(company?.observations ?? [])].sort(
        (a, b) => a.fiscalYear - b.fiscalYear,
      );
      expect(observations.map(({ fiscalYear }) => fiscalYear)).toEqual([
        2021, 2022, 2023, 2024, 2025,
      ]);
      expect(
        observations[0]?.inputs.some(({ referenceDate }) => referenceDate === '2020-12-31'),
      ).toBe(true);
      for (const [index, observation] of observations.entries()) {
        expect(observation.provenance.qualityStatus).toBe(status);
        expect(observation.spreadPp).toBeNull();
        expect(observation.value).toBeCloseTo(values[index] ?? 0, 9);
      }
    }
  });

  it('usa o patrimônio comparativo reapresentado de Itaú para 2023', () => {
    const itau = snapshot().companies.find(({ companyId }) => companyId === 'cvm:19348');
    const observation = itau?.observations.find(({ fiscalYear }) => fiscalYear === 2023);
    expect(observation?.openingCapitalBrl).toBe(167_717_000_000);
    expect(observation?.closingCapitalBrl).toBe(190_177_000_000);
    expect(observation?.numeratorBrl).toBe(33_105_000_000);
  });

  it('rejeita métrica incompatível e spread sem benchmark', () => {
    const sample = snapshot();
    const bank = sample.companies.find(({ category }) => category === 'bank');
    expect(bank).toBeDefined();
    expect(() =>
      parseQualitySnapshot({
        ...sample,
        companies: sample.companies.map((company) =>
          company === bank ? { ...company, metric: 'roic' } : company,
        ),
      }),
    ).toThrow();

    const companies = sample.companies.map((company) => ({
      ...company,
      observations: company.observations.map((observation) => ({ ...observation, spreadPp: 0 })),
    }));
    expect(() => parseQualitySnapshot({ ...sample, companies })).toThrow();
  });
});
