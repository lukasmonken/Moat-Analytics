import { parseIpcaRate } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';

const retrievedAt = new Date('2026-11-27T11:27:42Z');

describe('IPCA acumulado em 12 meses', () => {
  it('converte o percentual do SGS em fração e conserva a referência mensal', () => {
    expect(parseIpcaRate([{ data: '01/10/2026', valor: '4.63' }], retrievedAt)).toMatchObject({
      value: 0.0463,
      provenance: {
        source: 'Banco Central do Brasil · SGS 13522',
        referenceDate: '2026-10-01',
        retrievedAt: '2026-11-27T11:27:42.000Z',
        publishedAt: null,
        qualityStatus: 'validated',
      },
    });
  });

  it('aceita inflação zero e deflação', () => {
    expect(parseIpcaRate([{ data: '01/10/2026', valor: '0' }], retrievedAt)?.value).toBe(0);
    expect(parseIpcaRate([{ data: '01/10/2026', valor: '-0.5' }], retrievedAt)?.value).toBe(-0.005);
  });

  it('distingue ausência de observação de uma resposta inválida', () => {
    expect(parseIpcaRate([], retrievedAt)).toBeNull();
    expect(() => parseIpcaRate([{ data: '01/10/2026', valor: '' }], retrievedAt)).toThrow();
    expect(() => parseIpcaRate([{ data: '01/10/2026', valor: '-100' }], retrievedAt)).toThrow();
    expect(() => parseIpcaRate([{ data: '31/09/2026', valor: '4.63' }], retrievedAt)).toThrow();
    expect(() => parseIpcaRate([{ data: '01/12/2026', valor: '4.63' }], retrievedAt)).toThrow();
  });
});
