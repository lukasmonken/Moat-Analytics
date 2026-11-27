import { parseSectorLeverage } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import {
  formatRatio,
  matchesRatioRange,
  ratioRangeOptions,
} from '../apps/web/src/shared/analytics/ratios';
import { readCvm2025 } from './fixtures/annual-cvm-2025';

function snapshot() {
  const value: unknown = readCvm2025('cvm-sector-leverage');
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
    if (!vale?.inputs?.depreciationAccount || vale.value === null)
      throw new Error('Vale precisa de insumos no lote.');
    const { value, inputs } = vale;
    vale.value = 10;
    expect(() => parseSectorLeverage(data)).toThrow();
    vale.value = value;
    const { ebitdaBrl } = inputs;
    inputs.ebitdaBrl = 1;
    expect(() => parseSectorLeverage(data)).toThrow();
    inputs.ebitdaBrl = ebitdaBrl;
    vale.inputs.depreciationAccount.referenceDate = '2024-12-31';
    expect(() => parseSectorLeverage(data)).toThrow();
  });

  it('valida duas contas irmãs e preserva os insumos quando EBITDA não é positivo', () => {
    const data = snapshot();
    const issuer = data.companies.find(({ name }) => name === 'VALE S.A.');
    const account = issuer?.inputs?.depreciationAccount;
    if (!issuer?.inputs || !account) throw new Error('Conta de depreciação ausente.');
    const amountBrl = issuer.inputs.depreciationBrl;
    data.manifest.methodologyVersion = 'net-debt-ebitda-dfp.v2';
    const components = [
      { ...account, label: 'Depreciação', code: '6.01.01.02', amountBrl: amountBrl - 500_000 },
      { ...account, label: 'Amortização', code: '6.01.01.03', amountBrl: 500_000 },
    ];
    issuer.inputs = {
      ebitBrl: -amountBrl,
      ebitdaBrl: 0,
      netDebtBrl: issuer.inputs.netDebtBrl,
      depreciationBrl: amountBrl,
      depreciationAccounts: components,
    };
    issuer.value = null;
    issuer.reason = 'EBITDA estimado não positivo.';
    expect(() => parseSectorLeverage(data)).not.toThrow();
    const [depreciation, amortization] = components;
    if (!depreciation || !amortization) throw new Error('Componentes de D&A ausentes.');
    amortization.amountBrl += 1;
    expect(() => parseSectorLeverage(data)).toThrow();
    amortization.amountBrl -= 1;
    amortization.code = depreciation.code;
    expect(() => parseSectorLeverage(data)).toThrow();
    amortization.code = '6.01.01.03';
    issuer.value = 0;
    expect(() => parseSectorLeverage(data)).toThrow();
  });

  it('formata o múltiplo em português e mostra dados ausentes', () => {
    expect(formatRatio(-0.3)).toBe('-0,30×');
    expect(formatRatio(null)).toBe('Indisponível');
  });

  it('confere a DVA do exercício quando corrobora a conta de D&A da DFC', () => {
    const data = snapshot();
    const ca = data.companies.find(({ name }) => name === 'C&A MODAS S.A.');
    const confirmation = ca?.inputs?.depreciationDvaAccount;
    if (!confirmation) throw new Error('DVA da C&A ausente.');
    expect(ca.inputs?.depreciationBrl).toBe(344_612_000);
    expect(confirmation).toMatchObject({
      statement: 'DVA',
      code: '7.04.01',
      referenceDate: '2025-12-31',
      amountBrl: -344_612_000,
    });
    confirmation.amountBrl -= 1;
    expect(() => parseSectorLeverage(data)).toThrow();
  });
});

describe('Faixas de múltiplos', () => {
  it.each([
    [-1.25, 'negative'],
    [-0.01, 'negative'],
    [0, '0-1'],
    [0.999, '0-1'],
    [1, '1-2'],
    [2, '2-3'],
    [3, '3-4'],
    [4, '4-5'],
    [4.999, '4-5'],
    [5, '5-plus'],
    [20, '5-plus'],
    [null, 'unavailable'],
    [undefined, 'unavailable'],
    [Infinity, 'unavailable'],
    [NaN, 'unavailable'],
  ] as const)('classifica %s de forma exclusiva em %s', (value, expected) => {
    const matching = ratioRangeOptions
      .map((option) => option.value)
      .filter((range) => matchesRatioRange(value, range));
    expect(matching).toEqual(['all', expected]);
  });
});
