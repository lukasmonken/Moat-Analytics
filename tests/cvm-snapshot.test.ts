import { parseCvmIdentity, parseCvmSnapshot } from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import { readCvmIdentity, readCvmSample } from './cvm-snapshot';

describe('Contrato da amostra DFP da CVM', () => {
  it('valida a cobertura do lote e a proveniência dos exercícios', () => {
    const snapshot = parseCvmSnapshot(readCvmSample());
    expect(snapshot.manifest.coverage).toEqual({ eligibleCompanies: null, includedCompanies: 3 });
    expect(snapshot.manifest.source.license).toBe('ODbL-1.0');
    expect(snapshot.companies.map(({ cvmCode }) => cvmCode).sort((a, b) => a - b)).toEqual([
      5410, 8133, 19348,
    ]);
    for (const company of snapshot.companies) {
      expect(company.observations.map(({ fiscalYear }) => fiscalYear).sort()).toEqual([
        2021, 2022, 2023, 2024, 2025,
      ]);
      for (const observation of company.observations) {
        expect(observation.provenance.qualityStatus).toBe('validated');
        expect(observation.reconciliations.length).toBeGreaterThan(0);
        expect(observation.reconciliations.some(({ status }) => status === 'failed')).toBe(false);
      }
    }
  });

  it('rejeita versão desconhecida, divergência de cobertura e URL insegura', () => {
    const sample = parseCvmSnapshot(readCvmSample());
    expect(() =>
      parseCvmSnapshot({ ...sample, manifest: { ...sample.manifest, schemaVersion: '2.0.0' } }),
    ).toThrow();
    expect(() => parseCvmSnapshot({ ...sample, companies: [] })).toThrow();

    const company = sample.companies[0];
    const observation = company?.observations[0];
    expect(observation).toBeDefined();
    if (observation) {
      observation.documentUrl = 'javascript:alert(1)';
    }
    expect(() => parseCvmSnapshot(sample)).toThrow();
  });

  it('preserva a escala em BRL e as versões recebidas do DFP de 2025', () => {
    const sample = parseCvmSnapshot(readCvmSample());
    const expected = [
      [5410, 1, 42_645_030_000],
      [8133, 2, 19_626_027_000],
      [19348, 2, 3_066_169_000_000],
    ] as const;
    for (const [code, version, assets] of expected) {
      const company = sample.companies.find(({ cvmCode }) => cvmCode === code);
      const filing = company?.observations.find(({ fiscalYear }) => fiscalYear === 2025);
      expect(filing?.filingVersion).toBe(version);
      const account = filing?.accounts.find(
        ({ statement, code }) => statement === 'BPA' && code === '1',
      );
      expect(account?.amountBrl).toBe(assets);
    }
  });

  it('mantém as classes declaradas no FCA e a licença próprias do cadastro', () => {
    const identity = parseCvmIdentity(readCvmIdentity());
    expect(identity.source.datasetUrl).toBe('https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca');
    const issuer = identity.companies.find(({ cvmCode }) => cvmCode === 19348);
    expect(issuer?.filingVersion).toBe(2);
    expect(issuer?.tickers).toEqual([
      { ticker: 'ITUB3', kind: 'ON' },
      { ticker: 'ITUB4', kind: 'PN' },
    ]);
  });
});
