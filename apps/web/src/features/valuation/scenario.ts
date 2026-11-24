import { projectFcff, valueScenario, type ValuationInput } from '../../shared/analytics/valuation';

export type ValuationModel = 'dcf' | 'ddm';

export interface ValuationYear {
  revenue: string;
  ebitMargin: string;
  taxRate: string;
  depreciation: string;
  capex: string;
  workingCapitalChange: string;
  netIncome: string;
  payout: string;
}

const sourcedFields = ['discountRate', 'shares', 'netDebt', 'equityAdjustments'] as const;
export type SourcedField = (typeof sourcedFields)[number];

interface PremiseSource {
  source: string;
  url: string;
  referenceDate: string;
  retrievedAt: string;
}

export type ValuationSources = Partial<Record<SourcedField, PremiseSource>>;

export interface ValuationDraft {
  discountRate: string;
  terminalGrowth: string;
  shares: string;
  netDebt: string;
  equityAdjustments: string;
  referencePrice: string;
  years: ValuationYear[];
  sources?: ValuationSources;
}

export const valuationHorizon = 10;
export const cases = ['conservador', 'base', 'otimista'] as const;
export type ValuationCase = (typeof cases)[number];
export const caseLabels = { conservador: 'Conservador', base: 'Base', otimista: 'Otimista' };
export type Scenarios = Record<ValuationModel, Record<ValuationCase, ValuationDraft>>;
const storedKey = 'moat-valuation-scenarios-v1';
const draftKeys = [
  'discountRate',
  'terminalGrowth',
  'shares',
  'netDebt',
  'equityAdjustments',
  'referencePrice',
] as const;
const yearKeys = [
  'revenue',
  'ebitMargin',
  'taxRate',
  'depreciation',
  'capex',
  'workingCapitalChange',
  'netIncome',
  'payout',
] as const;

function createYear(): ValuationYear {
  return {
    revenue: '',
    ebitMargin: '',
    taxRate: '',
    depreciation: '',
    capex: '',
    workingCapitalChange: '',
    netIncome: '',
    payout: '',
  };
}

export function createDraft(): ValuationDraft {
  return {
    discountRate: '',
    terminalGrowth: '',
    shares: '',
    netDebt: '',
    equityAdjustments: '',
    referencePrice: '',
    years: Array.from({ length: valuationHorizon }, createYear),
  };
}

export function createScenarios(): Scenarios {
  return {
    dcf: { conservador: createDraft(), base: createDraft(), otimista: createDraft() },
    ddm: { conservador: createDraft(), base: createDraft(), otimista: createDraft() },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFieldText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 48;
}

function isPremiseSource(value: unknown) {
  if (
    !isObject(value) ||
    typeof value.source !== 'string' ||
    !value.source.trim() ||
    value.source.length > 160 ||
    typeof value.url !== 'string' ||
    value.url.length > 512 ||
    typeof value.referenceDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.referenceDate) ||
    !Number.isFinite(Date.parse(value.referenceDate)) ||
    new Date(value.referenceDate).toISOString().slice(0, 10) !== value.referenceDate ||
    typeof value.retrievedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value.retrievedAt,
    ) ||
    !Number.isFinite(Date.parse(value.retrievedAt))
  ) {
    return false;
  }
  try {
    const url = new URL(value.url);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isValuationSources(value: unknown) {
  return (
    isObject(value) &&
    sourcedFields.every((field) => value[field] === undefined || isPremiseSource(value[field]))
  );
}

function isDraft(value: unknown): value is ValuationDraft {
  return (
    isObject(value) &&
    draftKeys.every((key) => isFieldText(value[key])) &&
    (value.sources === undefined || isValuationSources(value.sources)) &&
    Array.isArray(value.years) &&
    value.years.length === valuationHorizon &&
    value.years.every(
      (row: unknown) => isObject(row) && yearKeys.every((key) => isFieldText(row[key])),
    )
  );
}

export function preserveUntouchedSources(
  previous: ValuationDraft,
  draft: ValuationDraft,
): ValuationDraft {
  const sources = { ...previous.sources };
  for (const field of sourcedFields) {
    if (previous[field] !== draft[field]) delete sources[field];
  }
  return { ...draft, sources };
}

export function parseScenarios(text: string): Scenarios {
  const payload: unknown = JSON.parse(text);
  if (!isObject(payload) || payload.schemaVersion !== '1.0.0' || !isObject(payload.scenarios)) {
    throw new Error('Arquivo de premissas incompatível.');
  }
  const { dcf, ddm } = payload.scenarios;
  if (
    !isObject(dcf) ||
    !isObject(ddm) ||
    !isDraft(dcf.base) ||
    !isDraft(dcf.conservador) ||
    !isDraft(dcf.otimista) ||
    !isDraft(ddm.base) ||
    !isDraft(ddm.conservador) ||
    !isDraft(ddm.otimista)
  ) {
    throw new Error('Arquivo de premissas incompatível.');
  }
  return {
    dcf: { base: dcf.base, conservador: dcf.conservador, otimista: dcf.otimista },
    ddm: { base: ddm.base, conservador: ddm.conservador, otimista: ddm.otimista },
  };
}

export function serializeScenarios(scenarios: Scenarios) {
  return JSON.stringify({ schemaVersion: '1.0.0', scenarios }, null, 2);
}

export function readStoredScenarios() {
  try {
    const raw = window.localStorage.getItem(storedKey);
    if (raw !== null) return parseScenarios(raw);
  } catch {
    // O simulador continua utilizável quando o armazenamento está indisponível.
  }
  return createScenarios();
}

export function saveScenarios(scenarios: Scenarios) {
  window.localStorage.setItem(storedKey, serializeScenarios(scenarios));
}

export function parseDecimal(input: string): number | null {
  const value = input.trim();
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(value)) return null;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function required(value: string, label: string): number {
  const parsed = parseDecimal(value);
  if (parsed === null) throw new Error(`Informe um número em ${label}.`);
  return parsed;
}

function projectedFlow(model: ValuationModel, row: ValuationYear, index: number) {
  const year = `ano ${index + 1}`;
  if (model === 'ddm') {
    const income = required(row.netIncome, `lucro líquido do ${year}`);
    const payout = required(row.payout, `payout do ${year}`);
    if (payout < 0 || payout > 100 || (income < 0 && payout > 0)) {
      throw new Error(`Payout do ${year} deve ficar entre 0% e 100% e ser zero com prejuízo.`);
    }
    return (income * payout) / 100;
  }
  const revenue = required(row.revenue, `receita do ${year}`);
  const margin = required(row.ebitMargin, `margem EBIT do ${year}`);
  const tax = required(row.taxRate, `alíquota do ${year}`);
  const depreciation = required(row.depreciation, `depreciação e amortização do ${year}`);
  const capex = required(row.capex, `CAPEX do ${year}`);
  const workingCapitalChange = required(
    row.workingCapitalChange,
    `variação do capital de giro do ${year}`,
  );
  if (revenue < 0 || tax < 0 || tax > 100 || depreciation < 0 || capex < 0) {
    throw new Error(
      `No ${year}, receita, depreciação e CAPEX devem ser não negativos e a alíquota deve ficar entre 0% e 100%.`,
    );
  }
  return projectFcff(revenue, margin / 100, tax / 100, depreciation, capex, workingCapitalChange);
}

export function scenarioInput(
  model: ValuationModel,
  draft: ValuationDraft,
): {
  input: ValuationInput;
  referencePrice: number | null;
} {
  const discount = required(draft.discountRate, 'taxa de desconto') / 100;
  const growth = required(draft.terminalGrowth, 'crescimento na perpetuidade') / 100;
  const shares = required(draft.shares, 'ações em circulação');
  if (growth <= -1 || discount <= growth) {
    throw new Error(
      'A taxa de desconto deve superar o crescimento na perpetuidade, que deve ser maior que −100%.',
    );
  }
  if (shares <= 0) throw new Error('A quantidade de ações em circulação deve ser positiva.');
  const referencePrice = draft.referencePrice.trim()
    ? required(draft.referencePrice, 'preço de referência')
    : null;
  if (referencePrice !== null && referencePrice <= 0) {
    throw new Error('O preço de referência deve ser positivo.');
  }
  const flows = draft.years.map((row, index) => projectedFlow(model, row, index));
  if ((flows.at(-1) ?? 0) < 0) {
    throw new Error('A perpetuidade exige fluxo não negativo no último ano.');
  }
  const common = { flows, discount, growth, shares };
  const input: ValuationInput =
    model === 'ddm'
      ? { ...common, model }
      : {
          ...common,
          model,
          netDebt: required(draft.netDebt, 'dívida líquida'),
          equityAdjustments: required(draft.equityAdjustments, 'ajustes ao patrimônio'),
        };
  return { input, referencePrice };
}

export function evaluateValuation(model: ValuationModel, draft: ValuationDraft) {
  const { input, referencePrice } = scenarioInput(model, draft);
  const result = valueScenario(input);
  if (!result) throw new Error('O cálculo exige valores finitos e premissas válidas.');
  return { input, result, referencePrice };
}

const sensitivitySteps = [-0.01, 0, 0.01] as const;

export function valuationSensitivity(input: ValuationInput) {
  const growths = sensitivitySteps.map((step) => input.growth + step);
  return {
    growths,
    rows: sensitivitySteps.map((step) => {
      const discount = input.discount + step;
      return {
        discount,
        results: growths.map(
          (growth) => valueScenario({ ...input, growth, discount })?.perShare ?? null,
        ),
      };
    }),
  };
}

export function valuationPriceMetrics(perShare: number, referencePrice: number | null) {
  const potential = referencePrice === null ? null : perShare / referencePrice - 1;
  const safety = referencePrice === null || perShare <= 0 ? null : 1 - referencePrice / perShare;
  return {
    potential: Number.isFinite(potential) ? potential : null,
    safety: Number.isFinite(safety) ? safety : null,
  };
}
