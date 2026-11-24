import { cdiRateUrl, type RiskFreeRate } from '../../shared/data-client/riskFreeRate';
import type { ReportSheet, ReportValue, WorkbookReport } from '../../shared/export/report';
import {
  caseLabels,
  evaluateValuation,
  parseDecimal,
  valuationPriceMetrics,
  valuationSensitivity,
  type ValuationCase,
  type ValuationDraft,
  type ValuationModel,
} from './scenario';

function premise(input: string, percent = false): ReportValue {
  const value = parseDecimal(input);
  return value === null ? input.trim() || null : percent ? value / 100 : value;
}

function assumptions(model: ValuationModel, draft: ValuationDraft): ReportSheet {
  const columns: ReportSheet['columns'] = [
    { label: 'Taxa de desconto', format: 'percent', width: 20 },
    { label: 'Crescimento na perpetuidade', format: 'percent', width: 28 },
    { label: 'Ações em circulação (mi)', format: 'number', width: 24 },
    { label: 'Preço de referência (R$/ação)', format: 'currency', width: 30 },
    ...(model === 'dcf'
      ? [
          { label: 'Dívida líquida (R$ mi)', format: 'currency' as const, width: 23 },
          { label: 'Ajustes ao patrimônio (R$ mi)', format: 'currency' as const, width: 30 },
        ]
      : []),
  ];
  const row = [
    premise(draft.discountRate, true),
    premise(draft.terminalGrowth, true),
    premise(draft.shares),
    premise(draft.referencePrice),
    ...(model === 'dcf' ? [premise(draft.netDebt), premise(draft.equityAdjustments)] : []),
  ];
  return { name: 'Premissas', columns, rows: [row] };
}

function projection(
  model: ValuationModel,
  draft: ValuationDraft,
  evaluation: ReturnType<typeof evaluateValuation> | null,
): ReportSheet {
  const columns: ReportSheet['columns'] = [
    { label: 'Ano', format: 'integer', width: 8 },
    ...(model === 'dcf'
      ? [
          { label: 'Receita (R$ mi)', format: 'currency' as const, width: 18 },
          { label: 'Margem EBIT', format: 'percent' as const, width: 16 },
          { label: 'Alíquota', format: 'percent' as const, width: 12 },
          { label: 'Depreciação e amortização (R$ mi)', format: 'currency' as const, width: 34 },
          { label: 'CAPEX (R$ mi)', format: 'currency' as const, width: 17 },
          { label: 'Variação do capital de giro (R$ mi)', format: 'currency' as const, width: 35 },
        ]
      : [
          { label: 'Lucro líquido (R$ mi)', format: 'currency' as const, width: 23 },
          { label: 'Payout', format: 'percent' as const, width: 12 },
        ]),
    {
      label: model === 'dcf' ? 'FCFF (R$ mi)' : 'Dividendos (R$ mi)',
      format: 'currency',
      width: 21,
    },
    { label: 'Valor presente (R$ mi)', format: 'currency', width: 24 },
  ];
  const rows = draft.years.map((year, index) => {
    const calculated = evaluation?.result.years[index];
    return [
      index + 1,
      ...(model === 'dcf'
        ? [
            premise(year.revenue),
            premise(year.ebitMargin, true),
            premise(year.taxRate, true),
            premise(year.depreciation),
            premise(year.capex),
            premise(year.workingCapitalChange),
          ]
        : [premise(year.netIncome), premise(year.payout, true)]),
      calculated?.flow ?? null,
      calculated?.presentValue ?? null,
    ];
  });
  return { name: 'Projeções anuais', columns, rows };
}

function calculatedSheets({ input, result, referencePrice }: ReturnType<typeof evaluateValuation>) {
  const { potential, safety } = valuationPriceMetrics(result.perShare, referencePrice);
  const sensitivity = valuationSensitivity(input);
  const sheets: ReportSheet[] = [
    {
      name: 'Resultado',
      columns: [
        { label: 'Indicador', width: 42 },
        { label: 'Valor', format: 'currency', width: 22 },
        { label: 'Percentual', format: 'percent', width: 18 },
      ],
      rows: [
        ['Valor intrínseco estimado (R$/ação)', result.perShare, null],
        ['Preço informado (R$/ação)', referencePrice, null],
        ['Potencial sobre o preço', null, potential],
        ['Margem de segurança', null, safety],
        ...(result.enterpriseValue === null
          ? []
          : [['Valor da firma (R$ mi)', result.enterpriseValue, null]]),
        ['Valor do patrimônio (R$ mi)', result.equityValue, null],
        ['Valor presente dos fluxos (R$ mi)', result.presentYears, null],
        ['Valor presente da perpetuidade (R$ mi)', result.presentTerminal, null],
      ],
    },
    {
      name: 'Sensibilidade',
      columns: [
        { label: 'Taxa de desconto', format: 'percent', width: 19 },
        { label: 'Crescimento na perpetuidade', format: 'percent', width: 30 },
        { label: 'Valor estimado (R$/ação)', format: 'currency', width: 26 },
      ],
      rows: sensitivity.rows.flatMap(({ discount, results }) =>
        sensitivity.growths.map((growth, index) => [discount, growth, results[index] ?? null]),
      ),
    },
  ];
  return sheets;
}

export function buildValuationReport(
  model: ValuationModel,
  activeCase: ValuationCase,
  draft: ValuationDraft,
  cdi: RiskFreeRate | null,
): WorkbookReport {
  let evaluation = null;
  let coverage = 'Cenário calculado com as premissas exportadas.';
  try {
    evaluation = evaluateValuation(model, draft);
  } catch (error) {
    coverage = error instanceof Error ? error.message : 'Cálculo indisponível.';
  }
  const notes: Array<readonly [string, ReportValue]> = [
    [
      'Modelo',
      model === 'dcf' ? 'Fluxo de caixa descontado (DCF)' : 'Desconto de dividendos (DDM)',
    ],
    ['Cenário', caseLabels[activeCase]],
    ['Fonte das premissas', 'Premissas do cenário ativo, preenchidas ou aplicadas pelo usuário.'],
    ['Cobertura', coverage],
    [
      'Horizonte e fluxo',
      'Dez anos em BRL nominal. Fluxos de fim de ano e perpetuidade de Gordon.',
    ],
    [
      'Sensibilidade',
      'Taxa de desconto e crescimento variam 1 p.p. acima e abaixo da base. Combinações inválidas aparecem em branco.',
    ],
    ['Preço de referência', 'Valor opcional informado no editor.'],
  ];
  const premiseLabels = {
    discountRate: 'Taxa de desconto',
    shares: 'Ações em circulação',
    netDebt: 'Dívida líquida',
    equityAdjustments: 'Ajustes ao patrimônio',
  } as const;
  const fields: (keyof typeof premiseLabels)[] =
    model === 'dcf'
      ? ['discountRate', 'shares', 'netDebt', 'equityAdjustments']
      : ['discountRate', 'shares'];
  for (const field of fields) {
    const provenance = draft.sources?.[field];
    if (!provenance || !draft[field].trim()) continue;
    const label = premiseLabels[field];
    notes.push(
      [`${label} · origem aplicada`, provenance.source],
      [`${label} · documento`, provenance.url],
      [`${label} · data-base`, new Date(provenance.referenceDate)],
      [`${label} · coleta (UTC)`, new Date(provenance.retrievedAt)],
    );
  }
  if (model === 'ddm') {
    notes.push([
      'Valor por ação',
      'Média se houver classes com direitos distintos. Payout e restrições de capital são premissas do cenário.',
    ]);
  }
  if (cdi !== null) {
    notes.push(
      [
        'CDI observado na exportação',
        `${(cdi.value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 8 })}% a.a.`,
      ],
      ['Data-base do CDI', new Date(cdi.provenance.referenceDate)],
      ['Coleta do CDI', new Date(cdi.provenance.retrievedAt)],
      ['Fonte do CDI de referência', cdiRateUrl],
      [
        'Desconto no cálculo',
        'A taxa aplicada está na aba Premissas. O CDI é uma referência disponível no editor.',
      ],
    );
  }
  return {
    sheets: [
      ...(evaluation ? calculatedSheets(evaluation) : []),
      assumptions(model, draft),
      projection(model, draft, evaluation),
    ],
    notes,
  };
}
