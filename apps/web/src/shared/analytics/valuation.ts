interface Projection {
  flows: readonly number[];
  discount: number;
  growth: number;
  shares: number;
}

export type ValuationInput = Projection &
  ({ model: 'dcf'; netDebt: number; equityAdjustments: number } | { model: 'ddm' });

export function discountValuationFlows(flows: readonly number[], discount: number) {
  const years = flows.map((flow, index) => ({
    flow,
    presentValue: flow / (1 + discount) ** (index + 1),
  }));
  const presentYears = years.reduce((sum, year) => sum + year.presentValue, 0);
  return { years, presentYears };
}

export function valuePerpetuity(
  finalFlow: number,
  discount: number,
  growth: number,
  years: number,
) {
  const terminal = (finalFlow * (1 + growth)) / (discount - growth);
  const presentTerminal = terminal / (1 + discount) ** years;
  return { terminal, presentTerminal };
}

export function valueScenario(input: ValuationInput) {
  const { flows, discount, growth, shares } = input;
  const finalFlow = flows.at(-1);
  if (
    finalFlow === undefined ||
    ![...flows, discount, growth, shares].every(Number.isFinite) ||
    finalFlow < 0 ||
    growth <= -1 ||
    discount <= growth ||
    shares <= 0 ||
    (input.model === 'ddm' && flows.some((flow) => flow < 0))
  ) {
    return null;
  }
  const { years, presentYears } = discountValuationFlows(flows, discount);
  const { terminal, presentTerminal } = valuePerpetuity(finalFlow, discount, growth, flows.length);
  const businessValue = presentYears + presentTerminal;
  const equityValue =
    input.model === 'dcf' ? businessValue - input.netDebt + input.equityAdjustments : businessValue;
  const perShare = equityValue / shares;
  if (![terminal, presentTerminal, businessValue, equityValue, perShare].every(Number.isFinite)) {
    return null;
  }
  return {
    years,
    terminal,
    presentTerminal,
    presentYears,
    enterpriseValue: input.model === 'dcf' ? businessValue : null,
    equityValue,
    perShare,
  };
}

export function projectFcff(
  revenue: number,
  ebitMargin: number,
  tax: number,
  depreciation: number,
  capex: number,
  workingCapitalChange: number,
) {
  const ebit = revenue * ebitMargin;
  return ebit * (1 - tax) + depreciation - capex - workingCapitalChange;
}
