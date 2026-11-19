import { describe, expect, it } from 'vitest';
import { projectFcff, valueScenario } from '../apps/web/src/shared/analytics/valuation';
import {
  createDraft,
  createScenarios,
  parseScenarios,
  scenarioInput,
  serializeScenarios,
} from '../apps/web/src/features/valuation/scenario';

describe('Valuation no navegador', () => {
  it('reproduz as referências do motor Decimal para DCF e DDM', () => {
    const common = { discount: 0.1, growth: 0.02 };
    const dcf = valueScenario({
      ...common,
      model: 'dcf',
      flows: [100, 110],
      shares: 100,
      netDebt: 200,
      equityAdjustments: -25,
    });
    expect(dcf?.enterpriseValue).toBeCloseTo(1340.90909090909, 9);
    expect(dcf?.equityValue).toBeCloseTo(1115.90909090909, 9);
    expect(dcf?.perShare).toBeCloseTo(11.15909090909, 9);

    const ddm = valueScenario({ ...common, model: 'ddm', flows: [10, 11], shares: 10 });
    expect(ddm?.enterpriseValue).toBeNull();
    expect(ddm?.perShare).toBeCloseTo(13.40909090909, 9);
    expect(projectFcff(500, 0.2, 0.25, 20, 30, -10)).toBe(75);
  });

  it('preserva lacunas e só calcula com perpetuidade e dividendos válidos', () => {
    const base = {
      model: 'ddm' as const,
      flows: [10, 11],
      shares: 10,
      discount: 0.1,
      growth: 0.02,
    };
    expect(valueScenario({ ...base, growth: 0.1 })).toBeNull();
    expect(valueScenario({ ...base, flows: [-1, 10] })).toBeNull();
    expect(valueScenario({ ...base, flows: [0, 0] })?.perShare).toBe(0);
    expect(() => scenarioInput('ddm', createDraft())).toThrow(/taxa de desconto/);
    const draft = { ...createDraft(), discountRate: '13,65', terminalGrowth: '2', shares: '10' };
    expect(() => scenarioInput('ddm', draft)).toThrow(/lucro líquido/);
    draft.years = draft.years.map((row) => ({ ...row, netIncome: '20,5', payout: '50' }));
    const { input, referencePrice } = scenarioInput('ddm', draft);
    expect(input.discount).toBe(0.1365);
    expect(input.flows).toEqual(Array<number>(10).fill(10.25));
    expect(referencePrice).toBeNull();
  });

  it('preserva os cenários por modelo e rejeita importação incompleta', () => {
    const scenarios = createScenarios();
    scenarios.ddm.base.discountRate = '13,65';
    const restored = parseScenarios(serializeScenarios(scenarios));
    expect(restored.ddm.base.discountRate).toBe('13,65');
    expect(restored.dcf.base.discountRate).toBe('');
    expect(restored.ddm.otimista.discountRate).toBe('');
    expect(() => parseScenarios('{"schemaVersion":"1.0.0","scenarios":{}}')).toThrow();
  });
});
