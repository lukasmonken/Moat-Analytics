import { readFileSync } from 'node:fs';
import { parseBankRoeSnapshot, parseQualitySnapshot } from '@moat/data-contracts';
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

describe('Comparação de ROE entre bancos', () => {
  it('confere os ROEs de 2025 contra o cálculo independente das DFPs', () => {
    const sample = parseBankRoeSnapshot(
      JSON.parse(readFileSync('data/public/cvm-bank-roe.json', 'utf8')),
    );
    const expected = {
      'cvm:906': 0.13651103,
      'cvm:1023': 0.07427866,
      'cvm:1210': 0.156688,
      'cvm:19348': 0.21587089,
      'cvm:20532': 0.10435513,
    };
    expect(sample.comparison.period).toEqual({ startYear: 2021, endYear: 2025 });
    expect(sample.excluded).toEqual([]);
    expect(sample.companies).toHaveLength(5);

    const sortedByMean = [...sample.companies].sort(
      (a, b) => (a.summary.mean ?? 0) - (b.summary.mean ?? 0),
    );
    for (const [index, company] of sortedByMean.entries()) {
      expect(company.observations.find(({ fiscalYear }) => fiscalYear === 2025)?.value).toBeCloseTo(
        expected[company.companyId as keyof typeof expected],
        7,
      );
      expect(sample.comparison.percentiles?.[company.companyId]).toBe(index * 25);
    }

    const companies = sample.companies.slice(0, 4);
    const manifest = {
      ...sample.manifest,
      coverage: { eligibleCompanies: null, includedCompanies: 4 },
    };
    expect(() => parseBankRoeSnapshot({ ...sample, manifest, companies })).toThrow();
    expect(
      parseBankRoeSnapshot({
        ...sample,
        manifest,
        companies,
        comparison: { ...sample.comparison, percentiles: null },
      }).comparison.percentiles,
    ).toBeNull();
  });
});
