import {
  parseSectorLeverage,
  parseSectorReinvestment,
  parseSectorRoicComparison,
} from '@moat/data-contracts';
import { describe, expect, it } from 'vitest';
import {
  buildAutomaticDcfBase,
  evaluateAutomaticValuation,
  type AutomaticValuationBase,
} from '../apps/web/src/features/valuation/automaticValuation';
import { readCvm2025 } from './fixtures/annual-cvm-2025';

const reference = { referenceDate: '2025-12-31', filingUrl: 'https://example.test/dfp' };
const dcf = {
  ...reference,
  model: 'dcf',
  nopatBrl: 120,
  depreciationBrl: 15,
  capexBrl: 30,
  workingCapitalChangeBrl: 5,
  netDebtBrl: 200,
} satisfies AutomaticValuationBase;
const ddm = { ...reference, model: 'ddm', dividendsJcpBrl: 100 } satisfies AutomaticValuationBase;

function sources() {
  const roic = parseSectorRoicComparison(readCvm2025('cvm-sector-roic'));
  const leverage = parseSectorLeverage(readCvm2025('cvm-sector-leverage'));
  const reinvestment = parseSectorReinvestment(readCvm2025('cvm-sector-reinvestment'));
  const issuer = roic.companies.find(({ name }) => name === 'ALLOS S.A.');
  if (!issuer) throw new Error('Companhia ausente na amostra.');
  const company = { ...issuer, metric: 'ROIC' as const };
  return { company, roic, leverage, reinvestment };
}

describe('Valuation automático', () => {
  it('reajusta os dez fluxos pelo IPCA e desconta os fluxos e a perpetuidade pelo CDI', () => {
    const result = evaluateAutomaticValuation(dcf, 0.04, 0.12);
    if (result.status !== 'ready') throw new Error(result.reason);
    expect(result.baseFlow).toBe(100);
    expect(result.years).toHaveLength(10);
    expect(result.years[0]).toEqual({ year: 1, flow: 104, presentValue: 104 / 1.12 });
    expect(result.years[9]?.flow).toBeCloseTo(148.0244284918344, 9);
    expect(result.presentYears).toBeCloseTo(680.4212436319482, 9);
    expect(result.terminal).toBeCloseTo(1924.317570393847, 9);
    expect(result.presentTerminal).toBeCloseTo(619.5787563680518, 9);
    expect(result.enterpriseValue).toBeCloseTo(1300, 9);
    expect(result.equityValue).toBeCloseTo(1100, 9);
  });

  it('usa os proventos realizados no DDM e preserva EV quando falta dívida líquida no DCF', () => {
    const bank = evaluateAutomaticValuation(ddm, 0.04, 0.12);
    const operating = evaluateAutomaticValuation({ ...dcf, netDebtBrl: null }, 0.04, 0.12);
    if (bank.status !== 'ready' || operating.status !== 'ready')
      throw new Error('Cálculo ausente.');
    expect(bank.baseFlow).toBe(ddm.dividendsJcpBrl);
    expect(bank.enterpriseValue).toBeNull();
    expect(bank.equityValue).toBeCloseTo(1300, 9);
    expect(operating.enterpriseValue).toBeCloseTo(1300, 9);
    expect(operating.equityValue).toBeNull();
  });

  it.each([
    [dcf, 0.12, 0.12, 1000, 'CDI superior ao IPCA'],
    [dcf, 0.04, 0.03, 1054.983955671297, 'CDI superior ao IPCA'],
    [{ ...dcf, capexBrl: 200 }, 0.04, 0.12, -476.29487054236, 'fluxo do exercício positivo'],
    [{ ...ddm, dividendsJcpBrl: 0 }, 0.04, 0.12, 0, 'fluxo do exercício positivo'],
  ] as const)(
    'separa fluxos explícitos de perpetuidade indisponível',
    (base, ipca, cdi, present, reason) => {
      const result = evaluateAutomaticValuation(base, ipca, cdi);
      if (result.status !== 'ready') throw new Error(result.reason);
      expect(result.years).toHaveLength(10);
      expect(result.presentYears).toBeCloseTo(present, 5);
      expect(result).toMatchObject({
        terminal: null,
        presentTerminal: null,
        enterpriseValue: null,
        equityValue: null,
        terminalReason: expect.stringContaining(reason),
      });
    },
  );

  it('indica a fonte ou a taxa ausente sem substituir por zero', () => {
    expect(evaluateAutomaticValuation(null, 0.04, 0.12)).toMatchObject({
      status: 'unavailable',
      reason: expect.stringContaining('Fluxo de caixa'),
    });
    expect(evaluateAutomaticValuation(dcf, null, 0.12)).toMatchObject({
      status: 'unavailable',
      reason: expect.stringContaining('IPCA'),
    });
    expect(evaluateAutomaticValuation(dcf, 0.04, null)).toMatchObject({
      status: 'unavailable',
      reason: expect.stringContaining('CDI'),
    });
  });

  it('combina as contas de uma mesma DFP e preserva caixa líquido e liberação de capital de giro', () => {
    const { company, roic, leverage, reinvestment } = sources();
    const result = buildAutomaticDcfBase(company, 2025, roic.manifest, leverage, reinvestment);
    if (result.status !== 'ready') throw new Error(result.reason);
    expect(result.base).toMatchObject({
      referenceDate: '2025-12-31',
      filingUrl: expect.stringContaining('NumeroSequencialDocumento=155236'),
      nopatBrl: 1_015_977_600,
      depreciationBrl: 634_825_000,
      capexBrl: 128_137_000,
      workingCapitalChangeBrl: -15_022_000,
      netDebtBrl: -60_570_000,
    });
    const valuation = evaluateAutomaticValuation(result.base, 0.04, 0.12);
    expect(valuation).toMatchObject({ status: 'ready', baseFlow: 1_537_687_600 });
    if (valuation.status !== 'ready' || valuation.enterpriseValue === null)
      throw new Error('EV ausente.');
    expect(valuation.equityValue).toBe(valuation.enterpriseValue + 60_570_000);
  });

  it('reaproveita CAPEX segregado e D&A documentada, inclusive com EBITDA não positivo', () => {
    const { roic, leverage, reinvestment } = sources();
    const cases = [
      ['AMBEV S.A.', 16_906_925_760],
      ['CYRELA BRAZIL REALTY S.A.EMPREEND E PART', -899_457_540],
      ['TUPY S.A.', 200_511_540],
      ['VALE S.A.', 7_227_540_000],
      ['B3 S.A. - BRASIL, BOLSA, BALCÃO', 4_425_259_420],
      ['C&A MODAS S.A.', -12_236_660],
      ['LAVVI EMPREENDIMENTOS IMOBILIÁRIOS S.A.', -434_962_740],
      ['SLC AGRICOLA S.A.', 687_030_720],
      ['TEGMA GESTAO LOGISTICA S.A.', 143_106_440],
      ['CONSTRUTORA TENDA S.A.', -225_741_000],
      ['EMBRAER S.A.', 1_866_098_240],
      ['JSL S.A.', 1_053_887_620],
      ['MÉLIUZ S.A.', -371_790_960],
      ['INTELBRAS S.A. IND. DE TELECOMUNICAÇÃO ELETRÔNICA BRASILEIRA', 489_279_320],
      ['VALID SOLUÇÕES S.A.', 251_150_980],
      ['LWSA S/A', -248_089_940],
      ['USINAS SID DE MINAS GERAIS S.A.-USIMINAS', 454_023_240],
      ['CIA SANEAMENTO DE MINAS GERAIS-COPASA MG', 1_369_489_940],
      ['GERDAU S.A.', 730_243_880],
      ['METALURGICA GERDAU S.A.', 722_858_480],
    ] as const;

    for (const [name, expectedFlow] of cases) {
      const company = roic.companies.find((entry) => entry.name === name);
      if (!company) throw new Error(`Companhia ausente na amostra: ${name}.`);
      const input = buildAutomaticDcfBase(
        { ...company, metric: 'ROIC' },
        2025,
        roic.manifest,
        leverage,
        reinvestment,
      );
      if (input.status !== 'ready') throw new Error(`${name} — ${input.reason}`);
      const result = evaluateAutomaticValuation(input.base, 0.04, 0.12);
      if (result.status !== 'ready') throw new Error(`${name} — ${result.reason}`);
      expect(result.baseFlow, name).toBe(expectedFlow);
      expect(result.years).toHaveLength(10);
      expect(result.equityValue !== null, name).toBe(expectedFlow > 0);
    }

    for (const name of ['LWSA S/A', 'USINAS SID DE MINAS GERAIS S.A.-USIMINAS']) {
      expect(leverage.companies.find((entry) => entry.name === name)?.value).toBeNull();
    }
  });

  it('recusa contas de outro exercício, arquivo, seleção, emissor ou versão da DFP', () => {
    const { company, roic, leverage, reinvestment } = sources();
    const otherYear = buildAutomaticDcfBase(company, 2024, roic.manifest, leverage, reinvestment);
    expect(otherYear).toMatchObject({ status: 'unavailable' });
    const anotherFile = structuredClone(reinvestment);
    anotherFile.manifest.archive.sha256 = '0'.repeat(64);
    const anotherSelection = structuredClone(reinvestment);
    anotherSelection.manifest.asOf = '2026-11-17';
    const anotherIssuer = structuredClone(reinvestment);
    anotherIssuer.companies = anotherIssuer.companies.filter(({ name }) => name !== company.name);
    const anotherVersion = structuredClone(reinvestment);
    const entry = anotherVersion.companies.find(({ name }) => name === company.name);
    if (!entry?.filing) throw new Error('DFP ausente.');
    entry.filing.version += 1;
    for (const mismatch of [anotherFile, anotherSelection, anotherIssuer, anotherVersion]) {
      expect(buildAutomaticDcfBase(company, 2025, roic.manifest, leverage, mismatch)).toMatchObject(
        { status: 'unavailable' },
      );
    }
  });
});
