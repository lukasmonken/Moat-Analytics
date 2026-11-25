import { readFileSync } from 'node:fs';
import { parseSectorRoicComparison } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';

function readSnapshot() {
  return parseSectorRoicComparison(
    JSON.parse(readFileSync('data/public/cvm-sector-roic.json', 'utf8')),
  );
}

describe('ROIC setorial estimado da CVM', () => {
  it('inclui todas as 129 companhias que devem usar ROIC, inclusive quando faltam contas', () => {
    const snapshot = readSnapshot();
    expect(snapshot.companies).toHaveLength(129);
    expect(snapshot.companies.every(({ observations }) => observations.length === 5)).toBe(true);
    const camil = snapshot.companies.find(({ name }) => name === 'CAMIL ALIMENTOS S.A.');
    expect(camil?.observations.at(-1)).toMatchObject({
      roic: null,
      reason: expect.stringMatching(/31\/12/),
    });
    const qualicorp = snapshot.companies.find(({ name }) => name.startsWith('QUALICORP'));
    expect(qualicorp?.observations.at(-1)?.reason).toBeTruthy();
  });

  it.each([
    ['VALE S.A.', 0.07575986829703543, 31_969_000_000, 292_788_000_000, 264_223_000_000],
    ['GERDAU S.A.', 0.03833042678305822, 3_739_068_000, 65_323_126_000, 63_440_631_000],
    ['SER EDUCACIONAL S.A.', 0.11438815801653988, 444_661_000, 2_586_576_000, 2_544_659_000],
    ['TEGMA GESTAO LOGISTICA S.A.', 0.23740197861171464, 326_884_000, 857_147_000, 960_390_000],
    ['SUZANO S.A.', 0.05354438651537135, 10_649_009_000, 131_925_693_000, 130_598_407_000],
    ['LOJAS RENNER S.A.', 0.09570417277243985, 1_797_160_000, 12_423_752_000, 12_363_581_000],
    ['AMBEV S.A.', 0.20896627114433958, 23_423_386_000, 74_437_576_000, 73_523_477_000],
    ['TUPY S.A.', -0.019397756957106764, -156_481_000, 5_893_456_000, 4_754_936_000],
    ['IOCHPE MAXION S.A.', 0.06869579774991107, 941_914_000, 9_099_524_000, 8_999_494_000],
    [
      'ENGIE BRASIL ENERGIA S.A.',
      0.11342962979108943,
      6_268_325_000,
      32_810_573_000,
      40_134_997_000,
    ],
    [
      'CIA SANEAMENTO DO PARANA - SANEPAR',
      0.10356973185628607,
      2_337_506_000,
      15_659_285_000,
      14_132_314_000,
    ],
  ])('confere 2025 da companhia %s com a DFP consolidada', (name, roic, ebit, opening, closing) => {
    const company = readSnapshot().companies.find((candidate) => candidate.name === name);
    const observation = company?.observations.at(-1);
    expect(observation?.year).toBe(2025);
    expect(observation?.roic).toBeCloseTo(roic, 12);
    expect(observation?.inputs).toMatchObject({
      ebitBrl: ebit,
      openingCapitalBrl: opening,
      closingCapitalBrl: closing,
    });
  });

  it('identifica os arrendamentos fora da dívida e a base individual auditada', () => {
    const { companies } = readSnapshot();
    const iochpe = companies.find(({ name }) => name === 'IOCHPE MAXION S.A.')?.observations.at(-1);
    expect(iochpe?.inputs?.separateLeases).toEqual({
      note: '14',
      openingBrl: 103_258_000,
      closingBrl: 115_932_000,
    });
    expect(iochpe?.inputs?.embeddedLeases).toBeUndefined();
    const sanepar = companies.find(({ name }) => name.endsWith(' - SANEPAR'))?.observations.at(-1);
    expect(sanepar?.filing?.basis).toBe('individual');
    expect(sanepar?.inputs?.accounts).toContainEqual(
      expect.objectContaining({ key: 'closingEquity', label: 'Patrimônio Líquido' }),
    );
  });

  it('preserva os arrendamentos da nota e exige uma fonte de apoio', () => {
    const snapshot = readSnapshot();
    const b3 = snapshot.companies
      .find(({ name }) => name.startsWith('B3 S.A.'))
      ?.observations.at(-1);
    expect(b3?.inputs?.embeddedLeases).toEqual({
      note: '9',
      openingBrl: 33_715_000,
      closingBrl: 30_563_000,
    });
    if (!b3?.filing) throw new Error('DFP esperada para a B3.');
    delete b3.filing.supportingDocumentUrl;
    expect(() => parseSectorRoicComparison(snapshot)).toThrow();
  });

  it('mostra as fontes para passivos revisados e preserva lacunas entre exercícios válidos', () => {
    const { companies } = readSnapshot();
    const suzano = companies.find(({ name }) => name === 'SUZANO S.A.');
    expect(suzano?.observations.map(({ roic }) => roic !== null)).toEqual([
      true,
      false,
      false,
      true,
      true,
    ]);
    expect(suzano?.observations[1]?.reason).toContain('Compromissos com Aquisição de Ativos');
    expect(suzano?.observations.at(-1)?.filing?.supportingDocumentUrl).toContain('sec.gov');

    const klabin = companies.find(({ name }) => name === 'KLABIN S.A.')?.observations.at(-1);
    expect(klabin?.roic).toBeCloseTo(0.06690518047130901, 12);
    expect(klabin?.filing?.supportingDocumentUrl).toContain('api.mziq.com');
    expect(klabin?.inputs?.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'closingOperatingSupplier1', amountBrl: 658_466_000 }),
        expect.objectContaining({ key: 'closingSeparateDebt1', amountBrl: 1_118_187_000 }),
        expect.objectContaining({ key: 'closingSeparateDebt2', amountBrl: 233_784_000 }),
      ]),
    );
  });

  it('rejeita estimativa fora da metodologia declarada', () => {
    const snapshot = readSnapshot();
    const observed = snapshot.companies
      .flatMap(({ observations }) => observations)
      .find(({ roic }) => roic !== null);
    if (!observed?.inputs) throw new Error('O lote precisa conter uma estimativa com insumos.');
    observed.inputs.nopatBrl += Math.max(1, Math.abs(observed.inputs.nopatBrl));
    expect(() => parseSectorRoicComparison(snapshot)).toThrow();
  });
});
