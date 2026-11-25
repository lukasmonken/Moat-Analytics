import { readFileSync } from 'node:fs';
import {
  parseCompanyDirectory,
  parseSectorComparison,
  parseSectorRoicComparison,
} from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
function snapshot() {
  return parseSectorComparison(
    JSON.parse(readFileSync('data/public/cvm-sector-comparison.json', 'utf8')),
  );
}

describe('Comparativos setoriais da CVM', () => {
  it('divide toda a seleção anual em ROE para bancos e seguradoras e ROIC para as demais', () => {
    const directory = parseCompanyDirectory(
      JSON.parse(readFileSync('data/public/cvm-company-selection.json', 'utf8')),
    );
    const { manifest, companies } = snapshot();
    const roic = parseSectorRoicComparison(
      JSON.parse(readFileSync('data/public/cvm-sector-roic.json', 'utf8')),
    );
    expect(manifest.asOf).toBe(directory.asOf);
    expect(roic.manifest.asOf).toBe(directory.asOf);
    expect(companies.map(({ name }) => name).sort()).toEqual([
      'BANCO BMG S/A',
      'BANCO DO ESTADO DO RIO GRANDE DO SUL SA',
      'BB SEGURIDADE PARTICIPAÇÕES S.A.',
      'BCO ABC BRASIL S.A.',
      'BCO BRADESCO S.A.',
      'BCO BRASIL S.A.',
      'BCO BTG PACTUAL S.A.',
      'BCO PINE S.A',
      'BCO SANTANDER (BRASIL) S.A.',
      'BRBI BR PARTNERS S.A',
      'CAIXA SEGURIDADE PARTICIPAÇÕES S.A.',
      'IRB - BRASIL RESSEGUROS S.A.',
      'ITAU UNIBANCO HOLDING S.A.',
      'PORTO SEGURO S.A.',
    ]);
    expect([...companies, ...roic.companies].map(({ name }) => name).sort()).toEqual(
      [...directory.companies].sort(),
    );
    for (const company of companies) {
      expect(Object.keys(company).sort()).toEqual([
        'classification',
        'name',
        'observations',
        'sector',
      ]);
      expect(company.observations.map(({ year }) => year)).toEqual(manifest.years);
    }
    const abc = companies.find(({ name }) => name === 'BCO ABC BRASIL S.A.');
    expect(abc?.observations.at(-1)).toMatchObject({
      roe: null,
      reason: expect.stringMatching(/consolidada/),
    });
  });

  it('confere o ROE de Itaú com a série previamente auditada', () => {
    const itau = snapshot().companies.find(({ name }) => name === 'ITAU UNIBANCO HOLDING S.A.');
    expect(itau?.sector).toBe('Bancos');
    expect(itau?.observations.every(({ roe }) => roe !== null)).toBe(true);
    expect(itau?.observations.at(-1)?.roe).toBeCloseTo(0.215870892296, 9);
  });

  it('confere o resultado de seguradoras pela DRE ou pela DMPL conciliada', () => {
    const { companies } = snapshot();
    const irb = companies.find(({ name }) => name.startsWith('IRB -'));
    expect(irb?.observations.at(-1)?.roe).toBeCloseTo(0.076590187495, 10);
    expect(irb?.observations.at(-1)?.inputs).toMatchObject({
      incomeStatement: 'DMPL',
      incomeCode: '5.05.01',
      netIncomeBrl: 390_945_000,
    });
    const bb = companies.find(({ name }) => name.startsWith('BB SEGURIDADE'));
    expect(bb?.observations.at(-1)?.roe).toBeCloseTo(0.89814865815, 10);
    expect(bb?.observations.at(-1)?.inputs).toMatchObject({
      incomeStatement: 'DRE',
      incomeCode: '3.13.01',
      netIncomeBrl: 9_017_329_000,
    });
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
