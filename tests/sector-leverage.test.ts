import { readFileSync } from 'node:fs';
import { parseSectorLeverage } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import { formatRatio, parseRatioLimit } from '../apps/web/src/shared/analytics/ratios';

function snapshot() {
  const value: unknown = JSON.parse(readFileSync('data/public/cvm-sector-leverage.json', 'utf8'));
  return parseSectorLeverage(value);
}

describe('Dívida líquida/EBITDA da CVM', () => {
  it('confere o exercício da DFC e mantém dívida líquida negativa e lacunas', () => {
    const { manifest, companies } = snapshot();
    expect(manifest.year).toBe(2025);
    expect(companies).toHaveLength(129);
    const vale = companies.find(({ name }) => name === 'VALE S.A.');
    expect(vale?.value).toBeCloseTo(1.27638762);
    expect(vale?.inputs).toMatchObject({
      ebitBrl: 31_969_000_000,
      depreciationBrl: 17_306_000_000,
      ebitdaBrl: 49_275_000_000,
      netDebtBrl: 62_894_000_000,
      depreciationAccount: { statement: 'DFC_MI', referenceDate: '2025-12-31' },
    });
    expect(companies.find(({ name }) => name === 'WEG S.A.')?.value).toBeCloseTo(-0.18951878);
    expect(companies.find(({ name }) => name === 'CAMIL ALIMENTOS S.A.')).toMatchObject({
      value: null,
      inputs: null,
      reason: expect.stringContaining('Encerramento fiscal'),
    });
  });

  it('rejeita razão alterada, EBITDA incompatível e contas fora do exercício', () => {
    const data = snapshot();
    const vale = data.companies.find(({ name }) => name === 'VALE S.A.');
    if (!vale?.inputs || vale.value === null) throw new Error('Vale precisa de insumos no lote.');
    const { value, inputs } = vale;
    vale.value = 10;
    expect(() => parseSectorLeverage(data)).toThrow();
    vale.value = value;
    const { ebitdaBrl } = inputs;
    inputs.ebitdaBrl = 1;
    expect(() => parseSectorLeverage(data)).toThrow();
    inputs.ebitdaBrl = ebitdaBrl;
    inputs.depreciationAccount.referenceDate = '2024-12-31';
    expect(() => parseSectorLeverage(data)).toThrow();
  });

  it('aceita limite negativo, zero e vírgula decimal e rejeita texto', () => {
    expect(parseRatioLimit(' -1,25 ')).toBe(-1.25);
    expect(parseRatioLimit('0')).toBe(0);
    expect(parseRatioLimit('2.5')).toBe(2.5);
    expect(parseRatioLimit(',5')).toBe(0.5);
    expect(parseRatioLimit('2,5×')).toBeNull();
    expect(parseRatioLimit('')).toBeNull();
    expect(parseRatioLimit('Infinity')).toBeNull();
    expect(formatRatio(-0.3)).toBe('-0,30×');
    expect(formatRatio(null)).toBe('Indisponível');
  });
});
