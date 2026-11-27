import {
  parseCompanyDirectory,
  parseSectorComparison,
  parseSectorRoicComparison,
} from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import { readCvm2025 } from './fixtures/annual-cvm-2025';
function snapshot() {
  return parseSectorComparison(readCvm2025('cvm-sector-comparison'));
}

describe('Comparativos setoriais da CVM', () => {
  it('divide toda a seleção anual em ROE para bancos e seguradoras e ROIC para as demais', () => {
    const directory = parseCompanyDirectory(readCvm2025('cvm-company-selection'));
    const { manifest, companies } = snapshot();
    const roic = parseSectorRoicComparison(readCvm2025('cvm-sector-roic'));
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
      'BRADSAÚDE S.A.',
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
      expect(
        Object.keys(company)
          .filter((key) => key !== 'comparisonContext')
          .sort(),
      ).toEqual([
        'classification',
        'comparisonGroup',
        'dividends',
        'name',
        'observations',
        'sector',
      ]);
      expect(company.observations.map(({ year }) => year)).toEqual(manifest.years);
    }
    const abc = companies.find(({ name }) => name === 'BCO ABC BRASIL S.A.');
    expect(abc?.observations.find(({ year }) => year === 2024)).toMatchObject({
      roe: null,
      reason: expect.stringMatching(/consolidada/),
    });
    expect(companies.every(({ observations }) => observations.at(-1)?.roe !== null)).toBe(true);
  });

  it('agrupa Bradsaúde com Porto Seguro e identifica o perímetro da Odontoprev', () => {
    const { companies } = snapshot();
    const bradsaude = companies.find(({ name }) => name === 'BRADSAÚDE S.A.');
    const portoSeguro = companies.find(({ name }) => name === 'PORTO SEGURO S.A.');
    expect(bradsaude?.comparisonGroup).toBe('Seguros e Resseguros');
    expect(bradsaude?.comparisonGroup).toBe(portoSeguro?.comparisonGroup);
    expect(bradsaude?.sector).toBe('Serviços médicos');
    expect(bradsaude?.comparisonContext).toMatchObject({
      throughYear: 2025,
      note: expect.stringContaining('Odontoprev'),
    });
    expect(bradsaude?.observations.at(-1)?.roe).toBeCloseTo(0.4642765209505009, 10);
    expect(bradsaude?.observations.find(({ year }) => year === 2023)?.roe).toBeCloseTo(
      0.40670991754762337,
      10,
    );
  });

  it('usa a abertura e a página auditadas quando a DFP estruturada do ABC está ausente', () => {
    const data = snapshot();
    const abc = data.companies
      .find(({ name }) => name === 'BCO ABC BRASIL S.A.')
      ?.observations.at(-1);
    expect(abc?.roe).toBeCloseTo(0.15254733496608713, 10);
    expect(abc?.inputs).toMatchObject({
      incomeCode: null,
      auditedStatementPage: 18,
      openingEquityDate: '2025-01-01',
    });
    if (!abc?.filing) throw new Error('DFP esperada para o Banco ABC.');
    delete abc.filing.supportingDocumentUrl;
    expect(() => parseSectorComparison(data)).toThrow();
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

  it('valida o exercício e o sinal dos dividendos e aceita lotes anteriores sem o campo', () => {
    const data = snapshot();
    const irb = data.companies.find(({ name }) => name.startsWith('IRB -'));
    if (!irb?.dividends) throw new Error('Dividendos esperados para o IRB.');
    expect(irb.dividends).toMatchObject({ year: 2025, paidBrl: 0, reason: null });
    irb.dividends.year = 2024;
    expect(() => parseSectorComparison(data)).toThrow();
    irb.dividends.year = 2025;
    irb.dividends.paidBrl = -1;
    expect(() => parseSectorComparison(data)).toThrow();
    delete irb.dividends;
    expect(() => parseSectorComparison(data)).not.toThrow();
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
