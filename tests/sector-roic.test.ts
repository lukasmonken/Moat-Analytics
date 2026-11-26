import { readFileSync } from 'node:fs';
import { parseSectorRoicComparison } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';

function readSnapshot() {
  return parseSectorRoicComparison(
    JSON.parse(readFileSync('data/public/cvm-sector-roic.json', 'utf8')),
  );
}

describe('ROIC setorial estimado da CVM', () => {
  it('inclui todas as 129 companhias de ROIC, mesmo quando o exercício fica indisponível', () => {
    const snapshot = readSnapshot();
    expect(snapshot.manifest.methodologyVersion).toEqual('roic-dfp-comparisons.v2');
    expect(snapshot.companies).toHaveLength(129);
    expect(snapshot.companies.every(({ observations }) => observations.length === 5)).toBe(true);
    const camil = snapshot.companies.find(({ name }) => name === 'CAMIL ALIMENTOS S.A.');
    expect(camil?.observations.at(-1)).toMatchObject({
      roic: null,
      reason: expect.stringMatching(/31\/12/),
    });
    const assai = snapshot.companies.find(({ name }) => name.startsWith('SENDAS'));
    expect(assai?.observations.at(-1)).toMatchObject({
      roic: null,
      reason: expect.stringMatching(/consolidada/),
    });
  });

  it.each([
    ['VALE S.A.', 0.07948877432042209, 31_969_000_000, 279_061_000_000, 251_820_000_000],
    ['GERDAU S.A.', 0.03914201006682899, 3_739_068_000, 64_042_457_000, 62_051_470_000],
    ['LOJAS RENNER S.A.', 0.12072260399784615, 1_797_160_000, 9_792_341_000, 9_858_090_000],
    ['AMBEV S.A.', 0.20896627114433958, 23_423_386_000, 74_437_576_000, 73_523_477_000],
    ['TUPY S.A.', -0.019397756957106764, -156_481_000, 5_893_456_000, 4_754_936_000],
    ['DEXCO S.A.', 0.039002982818291315, 740_303_000, 12_443_270_000, 12_611_223_000],
    ['VALID SOLUÇÕES S.A.', 0.10747721857023788, 297_853_000, 1_851_841_000, 1_806_292_000],
  ])(
    'confere EBIT, capital e ROIC de 2025 da companhia %s',
    (name, roic, ebit, opening, closing) => {
      const company = readSnapshot().companies.find((candidate) => candidate.name === name);
      const observation = company?.observations.at(-1);
      expect(observation?.year).toBe(2025);
      expect(observation?.roic).toBeCloseTo(roic, 12);
      expect(observation?.inputs).toMatchObject({
        ebitBrl: ebit,
        openingCapitalBrl: opening,
        closingCapitalBrl: closing,
      });
    },
  );

  it('expõe somente as contas usadas e identifica a base individual auditada', () => {
    const { companies } = readSnapshot();
    const iochpe = companies.find(({ name }) => name === 'IOCHPE MAXION S.A.')?.observations.at(-1);
    expect(iochpe?.inputs?.accounts.map(({ key, code }) => [key, code])).toEqual([
      ['ebit', '3.05'],
      ['openingEquity', '2.03'],
      ['openingShortBorrowings', '2.01.04'],
      ['openingLongBorrowings', '2.02.01'],
      ['openingCash', '1.01.01'],
      ['closingEquity', '2.03'],
      ['closingShortBorrowings', '2.01.04'],
      ['closingLongBorrowings', '2.02.01'],
      ['closingCash', '1.01.01'],
    ]);
    const tim = companies.find(({ name }) => name === 'TIM S.A.')?.observations.at(-1);
    expect(tim?.filing?.basis).toBe('individual');
    expect(tim?.roic).toBeCloseTo(0.169766882294, 10);
    const sanepar = companies.find(({ name }) => name.endsWith(' - SANEPAR'))?.observations.at(-1);
    expect(sanepar?.filing?.basis).toBe('individual');
    expect(sanepar?.inputs?.accounts).toContainEqual(
      expect.objectContaining({ key: 'closingEquity', label: 'Patrimônio Líquido' }),
    );
  });

  it('rejeita NOPAT incompatível com o EBIT e capital incompatível com as contas', () => {
    const snapshot = readSnapshot();
    const observed = snapshot.companies
      .flatMap(({ observations }) => observations)
      .find(({ roic }) => roic !== null);
    if (!observed?.inputs) throw new Error('O lote precisa conter uma estimativa com insumos.');
    const { inputs } = observed;
    inputs.nopatBrl += 1_000_000;
    expect(() => parseSectorRoicComparison(snapshot)).toThrow();
    inputs.nopatBrl -= 1_000_000;
    inputs.closingCapitalBrl += 1_000_000;
    observed.roic = inputs.nopatBrl / ((inputs.openingCapitalBrl + inputs.closingCapitalBrl) / 2);
    expect(() => parseSectorRoicComparison(snapshot)).toThrow();
  });
});
