import { readFileSync } from 'node:fs';
import { parseCompanyDirectory, parseSectorComparison } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import { buildSectorRows } from '../apps/web/src/features/company/sectorComparisonRows';

function snapshot() {
  return parseSectorComparison(
    JSON.parse(readFileSync('data/public/cvm-sector-comparison.json', 'utf8')),
  );
}

describe('Comparativos setoriais da CVM', () => {
  it('cobre toda a seleção anual, com lacunas e sem afiliações ou tickers', () => {
    const directory = parseCompanyDirectory(
      JSON.parse(readFileSync('data/public/cvm-company-selection.json', 'utf8')),
    );
    const { manifest, companies } = snapshot();
    expect(manifest.asOf).toBe(directory.asOf);
    expect(companies.map(({ name }) => name).sort()).toEqual([...directory.companies].sort());
    for (const company of companies) {
      expect(Object.keys(company).sort()).toEqual([
        'classification',
        'name',
        'observations',
        'sector',
      ]);
      expect(company.observations.map(({ year }) => year)).toEqual(manifest.years);
    }
    const camil = companies.find(({ name }) => name === 'CAMIL ALIMENTOS S.A.');
    expect(camil?.observations.at(-1)).toMatchObject({
      roe: null,
      reason: expect.stringMatching(/31\/12/),
    });
    const sanepar = companies.find(({ name }) => name === 'CIA SANEAMENTO DO PARANA - SANEPAR');
    expect(sanepar?.observations.at(-1)).toMatchObject({
      roe: null,
      reason: expect.stringMatching(/consolidada/),
    });
  });

  it('confere o ROE de Itaú com a série previamente auditada e exclui séries incompletas do percentil', () => {
    const comparison = snapshot();
    const rows = buildSectorRows(comparison, 2025);
    const itau = rows.find(({ company }) => company.name === 'ITAU UNIBANCO HOLDING S.A.');
    expect(itau?.company.sector).toBe('Bancos');
    expect(itau?.validYears).toBe(5);
    expect(itau?.current?.roe).toBeCloseTo(0.215870892296, 9);
    expect(itau?.percentile).not.toBeNull();
    for (const row of rows) {
      if (row.validYears < 5 || row.peers < 5) expect(row.percentile).toBeNull();
    }
  });

  it('preserva a DMPL na atribuição de lucro e sinaliza divergências entre formulários', () => {
    const { companies } = snapshot();
    const csn = companies.find(({ name }) => name === 'CSN MINERAÇÃO S.A.');
    expect(csn?.observations.find(({ year }) => year === 2022)?.inputs).toMatchObject({
      incomeStatement: 'DMPL',
      incomeCode: '5.05.01',
      netIncomeBrl: 2_950_298_000,
    });
    const simpar = companies.find(({ name }) => name === 'SIMPAR S.A.');
    expect(simpar?.observations.at(-1)).toMatchObject({ roe: null, reason: expect.any(String) });
  });

  it('rejeita ROE inconsistente com os saldos, empresa duplicada e ZIP ausente', () => {
    const data = snapshot();
    const observed = data.companies
      .flatMap(({ observations }) => observations)
      .find(({ roe }) => roe !== null);
    if (!observed) throw new Error('ROE esperado no lote.');
    observed.roe = 100;
    expect(() => parseSectorComparison(data)).toThrow();

    const valid = snapshot();
    expect(() =>
      parseSectorComparison({ ...valid, companies: [...valid.companies, valid.companies[0]] }),
    ).toThrow();
    const archives = valid.manifest.archives.filter(
      ({ kind, year }) => kind !== 'dfp' || year !== 2025,
    );
    expect(() =>
      parseSectorComparison({ ...valid, manifest: { ...valid.manifest, archives } }),
    ).toThrow();
  });
});
