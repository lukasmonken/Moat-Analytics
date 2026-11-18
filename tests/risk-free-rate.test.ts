import { parseCdiRate } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import { spreadToRiskFreeRate } from '../apps/web/src/shared/analytics/riskFreeRate';

const retrievedAt = new Date('2026-11-19T01:00:00Z');

describe('CDI atual', () => {
  it('lê a taxa anual divulgada pelo SGS e conserva a data de referência', () => {
    const rate = parseCdiRate([{ data: '17/11/2026', valor: '13.65' }], retrievedAt);
    expect(rate?.value).toBe(0.1365);
    expect(rate?.provenance).toMatchObject({
      referenceDate: '2026-11-17',
      retrievedAt: '2026-11-19T01:00:00.000Z',
      publishedAt: null,
    });
    expect(spreadToRiskFreeRate(0.21587089, rate)).toBeCloseTo(7.937089);
    expect(spreadToRiskFreeRate(0.10435513, rate)).toBeCloseTo(-3.214487);
    expect(spreadToRiskFreeRate(null, rate)).toBeNull();
  });

  it('distingue ausência de dados de respostas inválidas', () => {
    expect(parseCdiRate([], retrievedAt)).toBeNull();
    expect(spreadToRiskFreeRate(0.2, null)).toBeNull();
    expect(() => parseCdiRate([{ data: '19/11/2026', valor: '13.65' }], retrievedAt)).toThrow();
    expect(() => parseCdiRate([{ data: '31/11/2026', valor: '13.65' }], retrievedAt)).toThrow();
    expect(() => parseCdiRate([{ data: '17/11/2026', valor: '' }], retrievedAt)).toThrow();
  });
});
