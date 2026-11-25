import { readFileSync } from 'node:fs';
import { parseCompanyDirectory, parseSectorComparison } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import { sideBySideRoeReport } from '../apps/web/src/features/company/sectorComparisonReport';
import {
  buildSectorRows,
  buildSideBySideRoe,
} from '../apps/web/src/features/company/sectorComparisonRows';

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

describe('ROE lado a lado', () => {
  const itau = 'ITAU UNIBANCO HOLDING S.A.';
  const bradespar = 'BRADESPAR S.A.';
  const armac = 'ARMAC LOCAÇÃO, LOGÍSTICA E SERVIÇOS S.A.';
  const camil = 'CAMIL ALIMENTOS S.A.';

  it('mantém até quatro companhias válidas na ordem em que foram escolhidas', () => {
    const data = snapshot();
    const comparison = buildSideBySideRoe(data, [
      bradespar,
      'Empresa que não consta na seleção',
      itau,
      bradespar,
      armac,
      camil,
      'CSN MINERAÇÃO S.A.',
    ]);
    expect(comparison.years).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(comparison.companies.map(({ company }) => company.name)).toEqual([
      bradespar,
      itau,
      armac,
      camil,
    ]);
    expect(buildSideBySideRoe(data, []).companies).toEqual([]);
  });

  it('usa uma mediana por setor e exercício e preserva lacunas na variação anual', () => {
    const data = snapshot();
    const { companies } = buildSideBySideRoe(data, [itau, bradespar, armac]);
    const bank = companies[0];
    expect(bank).toMatchObject({
      company: { sector: 'Bancos' },
      mean: buildSectorRows(data, 2025).find(({ company }) => company.name === itau)?.mean,
      validYears: 5,
    });
    expect(bank?.observations[0]?.deltaPp).toBeNull();
    expect(bank?.observations.at(-1)).toMatchObject({ year: 2025, sectorPeers: 8 });
    expect(bank?.observations.at(-1)?.sectorMedian).toBeCloseTo(0.146599517381, 10);
    expect(bank?.observations.at(-1)?.deltaPp).toBeCloseTo(1.10945214502, 9);
    expect(companies[1]?.observations.at(-1)).toMatchObject({
      sectorPeers: 0,
      sectorMedian: null,
      observation: { roe: null },
    });
    expect(companies[2]).toMatchObject({ mean: null, validYears: 4 });
    expect(companies[2]?.observations[2]).toMatchObject({
      observation: { roe: null },
      deltaPp: null,
    });
    expect(companies[2]?.observations[3]?.observation?.roe).not.toBeNull();
    expect(companies[2]?.observations[3]?.deltaPp).toBeNull();
  });

  it('mantém os valores numéricos, as datas e as fontes no descritor Excel', () => {
    const data = snapshot();
    const comparison = buildSideBySideRoe(data, [itau, bradespar]);
    const report = sideBySideRoeReport(data, comparison);
    const annual = report.sheets[0];
    const mean = report.sheets[1];
    expect(annual?.name).toBe('ROE lado a lado');
    expect(annual?.rows).toHaveLength(10);
    const lastItauRow = annual?.rows[4];
    expect(lastItauRow?.slice(0, 3)).toEqual([itau, 'Bancos', 2025]);
    expect(lastItauRow?.[3]).toBeCloseTo(0.215870892296, 10);
    expect(lastItauRow?.[7]).toEqual(new Date('2025-12-31'));
    expect(lastItauRow?.[10]).toBe(
      comparison.companies[0]?.observations[4]?.observation?.filing?.filingUrl,
    );
    expect(annual?.rows[9]?.slice(3, 7)).toEqual([null, null, null, 0]);
    expect(mean?.rows[1]?.slice(2, 4)).toEqual([null, 3]);
  });
});
