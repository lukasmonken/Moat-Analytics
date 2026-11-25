import { readFileSync } from 'node:fs';
import { parseSectorComparison, parseSectorRoicComparison } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';

function readSnapshot() {
  return parseSectorRoicComparison(
    JSON.parse(readFileSync('data/public/cvm-sector-roic.json', 'utf8')),
  );
}

describe('ROIC setorial estimado da CVM', () => {
  it('mantém os oito nomes e setores do FCA, sem misturar bancos ou holdings na amostra', () => {
    const snapshot = readSnapshot();
    const roe = parseSectorComparison(
      JSON.parse(readFileSync('data/public/cvm-sector-comparison.json', 'utf8')),
    );
    const sectors = new Set(['Extração Mineral', 'Metalurgia e Siderurgia']);
    expect(snapshot.manifest.asOf).toBe(roe.manifest.asOf);
    expect(snapshot.companies).toHaveLength(8);
    expect(snapshot.companies.map(({ name, sector }) => [name, sector])).toEqual(
      roe.companies
        .filter(({ sector }) => sectors.has(sector))
        .map(({ name, sector }) => [name, sector]),
    );
    expect(snapshot.companies.every(({ observations }) => observations.length === 5)).toBe(true);
  });

  it.each([
    ['VALE S.A.', 0.07575986829703543, 31_969_000_000, 292_788_000_000, 264_223_000_000],
    ['GERDAU S.A.', 0.03833042678305822, 3_739_068_000, 65_323_126_000, 63_440_631_000],
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
