import type {
  SectorLeverageSnapshot,
  SectorReinvestmentSnapshot,
  SectorRoicObservation,
  SectorRoicSnapshot,
} from '@moat/data-contracts';
import { discountValuationFlows, valuePerpetuity } from '../../shared/analytics/valuation';
import type { Company } from '../company/companyQualityData';

interface ValuationReference {
  referenceDate: string;
  filingUrl: string;
}

interface DcfBase extends ValuationReference {
  model: 'dcf';
  nopatBrl: number;
  depreciationBrl: number;
  depreciationExcludesSeparateRightOfUse?: true;
  capexBrl: number;
  workingCapitalChangeBrl: number;
  netDebtBrl: number | null;
}

export type AutomaticValuationBase =
  DcfBase | (ValuationReference & { model: 'ddm'; dividendsJcpBrl: number });

type Unavailable = { status: 'unavailable'; reason: string };

function unavailable(reason: string): Unavailable {
  return { status: 'unavailable', reason };
}

function sameFiling(
  filing: NonNullable<SectorRoicObservation['filing']>,
  candidate: SectorRoicObservation['filing'],
) {
  return (
    candidate !== null &&
    candidate.filingUrl === filing.filingUrl &&
    candidate.referenceDate === filing.referenceDate &&
    candidate.receivedAt === filing.receivedAt &&
    candidate.version === filing.version &&
    candidate.basis === filing.basis &&
    candidate.supportingDocumentUrl === filing.supportingDocumentUrl
  );
}

export function buildAutomaticDcfBase(
  company: Company,
  year: number,
  roicManifest: SectorRoicSnapshot['manifest'],
  leverage: SectorLeverageSnapshot | null,
  reinvestment: SectorReinvestmentSnapshot | null,
): { status: 'ready'; base: DcfBase } | Unavailable {
  if (company.metric !== 'ROIC') return unavailable('O DCF usa dados de empresas de ROIC.');
  const observation = company.observations.find((item) => item.year === year);
  if (!observation?.filing || !observation.inputs) {
    return unavailable(observation?.reason ?? 'NOPAT indisponível no exercício.');
  }
  if (!leverage || !reinvestment) {
    return unavailable('Lotes de depreciação, CAPEX ou capital de giro indisponíveis.');
  }

  const roicArchive = roicManifest.archives.find(
    (item) => item.kind === 'dfp' && item.year === year,
  );
  if (
    !roicArchive ||
    [leverage.manifest, reinvestment.manifest].some(
      (manifest) =>
        manifest.asOf !== roicManifest.asOf ||
        manifest.year !== year ||
        manifest.archive.url !== roicArchive.url ||
        manifest.archive.sha256 !== roicArchive.sha256,
    )
  ) {
    return unavailable('Os lotes contábeis precisam corresponder à mesma seleção e DFP anual.');
  }

  const leverageCompany = leverage.companies.find((item) => item.name === company.name);
  const reinvestmentCompany = reinvestment.companies.find((item) => item.name === company.name);
  if (!leverageCompany?.inputs) {
    return unavailable(leverageCompany?.reason ?? 'Depreciação e amortização indisponíveis.');
  }
  if (!reinvestmentCompany?.inputs) {
    return unavailable(reinvestmentCompany?.reason ?? 'CAPEX ou capital de giro indisponíveis.');
  }

  const { filing, inputs } = observation;
  if (
    !sameFiling(filing, leverageCompany.filing) ||
    !sameFiling(filing, reinvestmentCompany.filing) ||
    leverageCompany.inputs.ebitBrl !== inputs.ebitBrl ||
    reinvestmentCompany.inputs.nopatBrl !== inputs.nopatBrl
  ) {
    return unavailable(
      'As contas do fluxo de caixa precisam corresponder à mesma DFP da companhia.',
    );
  }
  const { depreciationBrl, depreciationDvaAccount, netDebtBrl } = leverageCompany.inputs;
  const { capexBrl, closingWorkingCapitalBrl, openingWorkingCapitalBrl } =
    reinvestmentCompany.inputs;
  return {
    status: 'ready',
    base: {
      model: 'dcf',
      referenceDate: filing.referenceDate,
      filingUrl: filing.filingUrl,
      nopatBrl: inputs.nopatBrl,
      depreciationBrl,
      ...(depreciationDvaAccount && { depreciationExcludesSeparateRightOfUse: true as const }),
      capexBrl,
      workingCapitalChangeBrl: closingWorkingCapitalBrl - openingWorkingCapitalBrl,
      netDebtBrl,
    },
  };
}

const projectionYears = 10;

export type AutomaticValuationResult =
  | Unavailable
  | {
      status: 'ready';
      baseFlow: number;
      years: { year: number; flow: number; presentValue: number }[];
      presentYears: number;
      terminal: number | null;
      presentTerminal: number | null;
      enterpriseValue: number | null;
      equityValue: number | null;
      terminalReason: string | null;
    };

export function evaluateAutomaticValuation(
  base: AutomaticValuationBase | null,
  inflation: number | null,
  discount: number | null,
): AutomaticValuationResult {
  if (!base) return unavailable('Fluxo de caixa do exercício indisponível.');
  if (inflation === null || !Number.isFinite(inflation) || inflation <= -1) {
    return unavailable('IPCA acumulado em 12 meses indisponível ou inválido.');
  }
  if (discount === null || !Number.isFinite(discount) || discount <= -1) {
    return unavailable('CDI anualizado indisponível ou inválido.');
  }
  const baseFlow =
    base.model === 'dcf'
      ? base.nopatBrl + base.depreciationBrl - base.capexBrl - base.workingCapitalChangeBrl
      : base.dividendsJcpBrl;
  if (!Number.isFinite(baseFlow) || (base.model === 'ddm' && baseFlow < 0)) {
    return unavailable('Fluxo de caixa do exercício inválido.');
  }
  const flows = Array.from(
    { length: projectionYears },
    (_, index) => baseFlow * (1 + inflation) ** (index + 1),
  );
  const { years, presentYears } = discountValuationFlows(flows, discount);
  if (
    !Number.isFinite(presentYears) ||
    years.some(({ flow, presentValue }) => !Number.isFinite(flow) || !Number.isFinite(presentValue))
  ) {
    return unavailable('Os fluxos projetados estão fora da faixa suportada.');
  }
  const result: AutomaticValuationResult = {
    status: 'ready',
    baseFlow,
    years: years.map((row, index) => ({ year: index + 1, ...row })),
    presentYears,
    terminal: null,
    presentTerminal: null,
    enterpriseValue: null,
    equityValue: null,
    terminalReason: null,
  };
  if (baseFlow <= 0) {
    return { ...result, terminalReason: 'A perpetuidade exige um fluxo do exercício positivo.' };
  }
  if (discount <= inflation) {
    return { ...result, terminalReason: 'A perpetuidade exige CDI superior ao IPCA.' };
  }
  const last = flows[projectionYears - 1]!;
  const { terminal, presentTerminal } = valuePerpetuity(last, discount, inflation, projectionYears);
  const total = presentYears + presentTerminal;
  if (![terminal, presentTerminal, total].every(Number.isFinite)) {
    return { ...result, terminalReason: 'O valor terminal está fora da faixa suportada.' };
  }
  const equityValue =
    base.model === 'ddm' ? total : base.netDebtBrl === null ? null : total - base.netDebtBrl;
  return {
    ...result,
    terminal,
    presentTerminal,
    enterpriseValue: base.model === 'dcf' ? total : null,
    equityValue: equityValue !== null && Number.isFinite(equityValue) ? equityValue : null,
  };
}
