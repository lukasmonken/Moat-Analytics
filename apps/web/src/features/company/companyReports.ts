import type {
  BankRoeSnapshot,
  CvmCompany,
  CvmSnapshot,
  CvmSource,
  PriceFundamental,
  PriceFundamentalsSnapshot,
  QualityCompany,
  QualitySnapshot,
  RiskFreeRate,
} from '@moat/data-contracts';
import { spreadToRiskFreeRate } from '../../shared/analytics/riskFreeRate';
import { cdiRateUrl } from '../../shared/data-client/riskFreeRate';
import type { ReportSheet, WorkbookReport } from '../../shared/export/report';
import { categories, checkLabels } from './financialPresentation';

type Column = ReportSheet['columns'][number];
type Note = WorkbookReport['notes'][number];

const exercise = { label: 'Exercício', format: 'integer', width: 13 } as const;
const companyName = { label: 'Companhia', width: 36 };
const version = { label: 'Versão do envio', format: 'integer', width: 20 } as const;
const amount = { label: 'Valor (BRL)', format: 'currency', width: 23 } as const;
const reference = { label: 'Data-base', format: 'date', width: 16 } as const;
const collectedAt = { label: 'Coleta (UTC)', format: 'datetime', width: 23 } as const;
const fileHash = { label: 'SHA-256 do ZIP', width: 34 };
const archive = { label: 'ZIP da CVM', width: 52 };
const document = { label: 'Documento do envio', width: 54 };
const receipt = { label: 'Recebimento na CVM', format: 'date', width: 24 } as const;
const account = { label: 'Conta', width: 19 };
const accountDescription = { label: 'Descrição da conta', width: 44 };
const qualityState = {
  validated: 'Validado',
  estimated: 'Estimado',
  unavailable: 'Indisponível',
};

export function companyWorkbookFilename(kind: string, companyId: string) {
  return `moat-${kind}-${companyId.replace(':', '-')}.xlsx`;
}

function sources(source: CvmSource): Note[] {
  return [
    [source.name, source.datasetUrl],
    ['Licença dos dados da CVM', source.license],
    ['Termos da licença ODbL', source.licenseUrl],
  ];
}

export function cdiNotes(rate: RiskFreeRate | null): Note[] {
  return rate
    ? [
        ['Fonte do CDI atual', rate.provenance.source],
        ['Série SGS 4389', cdiRateUrl],
        ['Data-base do CDI atual', new Date(rate.provenance.referenceDate)],
        ['Coleta do CDI (UTC)', new Date(rate.provenance.retrievedAt)],
      ]
    : [['CDI atual', 'Indisponível no momento da exportação.']];
}

export function companyAccountsReport(company: CvmCompany, snapshot: CvmSnapshot): WorkbookReport {
  const { manifest, issues } = snapshot;
  const observations = [...company.observations].sort((a, b) => b.fiscalYear - a.fiscalYear);
  const sheets: ReportSheet[] = [
    {
      name: 'Contas anuais',
      columns: [
        exercise,
        reference,
        { label: 'Demonstrativo', width: 18 },
        account,
        accountDescription,
        amount,
      ],
      rows: observations.flatMap((observation) =>
        observation.accounts.map((item) => [
          observation.fiscalYear,
          new Date(observation.referenceDate),
          item.statement,
          item.code,
          item.label,
          item.amountBrl,
        ]),
      ),
    },
    {
      name: 'Conciliações',
      columns: [
        exercise,
        { label: 'Verificação', width: 49 },
        { label: 'Status', width: 18 },
        { ...amount, label: 'Diferença (BRL)' },
      ],
      rows: observations.flatMap((observation) =>
        observation.reconciliations.map((item) => [
          observation.fiscalYear,
          item.label,
          checkLabels[item.status],
          item.differenceBrl,
        ]),
      ),
    },
    {
      name: 'Envios e coleta',
      columns: [
        exercise,
        { ...reference, label: 'Início do período' },
        reference,
        version,
        receipt,
        { ...collectedAt, label: 'Publicação (UTC)' },
        collectedAt,
        { label: 'Metodologia', width: 27 },
        { label: 'Qualidade', width: 18 },
        { label: 'Fonte', width: 34 },
        document,
        archive,
        fileHash,
      ],
      rows: observations.map((item) => [
        item.fiscalYear,
        new Date(item.periodStart),
        new Date(item.referenceDate),
        item.filingVersion,
        new Date(item.receiptDate),
        item.provenance.publishedAt ? new Date(item.provenance.publishedAt) : null,
        new Date(item.provenance.retrievedAt),
        item.provenance.methodologyVersion,
        qualityState[item.provenance.qualityStatus],
        item.provenance.source,
        item.documentUrl,
        item.archiveUrl,
        item.archiveSha256,
      ]),
    },
  ];
  const missing = issues.filter(({ companyId }) => companyId === company.companyId);
  if (missing.length) {
    sheets.push({
      name: 'Lacunas',
      columns: [exercise, { label: 'Motivo', width: 60 }],
      rows: missing.map(({ fiscalYear, message }) => [fiscalYear, message]),
    });
  }
  return {
    sheets,
    notes: [
      ['Companhia', company.name],
      ['Código CVM', company.cvmCode],
      ['Categoria', categories[company.category]],
      ['Data-base do lote', new Date(manifest.asOf)],
      ['Geração do lote (UTC)', new Date(manifest.generatedAt)],
      ['Escopo', 'Demonstrações Financeiras Padronizadas consolidadas. Valores em reais.'],
      ['Células vazias', 'Dado indisponível na origem.'],
      ...sources(manifest.source),
    ],
  };
}

function qualitySheets(companies: readonly QualityCompany[]): ReportSheet[] {
  const sorted = companies.flatMap((company) =>
    [...company.observations]
      .sort((a, b) => b.fiscalYear - a.fiscalYear)
      .map((observation) => ({ company, observation })),
  );
  return [
    {
      name: 'Série anual',
      columns: [
        companyName,
        exercise,
        reference,
        { label: 'Indicador', width: 29 },
        { label: 'Retorno', format: 'percent', width: 15 },
        { label: 'Variação (p.p.)', format: 'number', width: 20 },
        { label: 'Spread histórico (p.p.)', format: 'number', width: 25 },
        { ...amount, label: 'Numerador (BRL)' },
        { ...amount, label: 'Capital inicial (BRL)' },
        { ...amount, label: 'Capital final (BRL)' },
        { ...amount, label: 'Capital médio (BRL)' },
        { label: 'Qualidade', width: 17 },
        version,
        collectedAt,
        archive,
        fileHash,
        { label: 'Documento complementar', width: 36 },
        { label: 'Notas da apuração', width: 58 },
      ],
      rows: sorted.map(({ company, observation }) => [
        company.name,
        observation.fiscalYear,
        new Date(observation.provenance.referenceDate),
        company.metric === 'roic' ? 'ROIC estimado' : 'ROE da controladora',
        observation.value,
        observation.changePp,
        observation.spreadPp,
        observation.numeratorBrl,
        observation.openingCapitalBrl,
        observation.closingCapitalBrl,
        observation.averageCapitalBrl,
        qualityState[observation.provenance.qualityStatus],
        observation.filingVersion,
        new Date(observation.provenance.retrievedAt),
        observation.archiveUrl,
        observation.archiveSha256,
        observation.supportingDocumentUrl ?? null,
        observation.reasons.join('\n') || null,
      ]),
    },
    {
      name: 'Estatísticas',
      columns: [
        companyName,
        { label: 'Exercícios válidos', format: 'integer', width: 21 },
        { label: 'Média', format: 'percent', width: 14 },
        { label: 'Mediana', format: 'percent', width: 14 },
        { label: 'Desvio-padrão (p.p.)', format: 'number', width: 24 },
        { label: 'Amplitude (p.p.)', format: 'number', width: 22 },
        { label: 'Tendência anual (p.p.)', format: 'number', width: 25 },
      ],
      rows: companies.map(({ name, summary }) => [
        name,
        summary.validYears,
        summary.mean,
        summary.median,
        summary.populationStddev === null ? null : summary.populationStddev * 100,
        summary.amplitude === null ? null : summary.amplitude * 100,
        summary.trendPpPerYear,
      ]),
    },
    {
      name: 'Contas usadas no cálculo',
      columns: [
        companyName,
        exercise,
        { label: 'Demonstrativo', width: 19 },
        account,
        accountDescription,
        { ...reference, label: 'Referência da conta' },
        amount,
      ],
      rows: sorted.flatMap(({ company, observation }) =>
        observation.inputs.map((input) => [
          company.name,
          observation.fiscalYear,
          input.statement,
          input.code,
          input.label,
          new Date(input.referenceDate),
          input.amountBrl,
        ]),
      ),
    },
  ];
}

export function companyQualityReport(
  company: QualityCompany,
  snapshot: QualitySnapshot,
  rate: RiskFreeRate | null,
): WorkbookReport {
  const { manifest } = snapshot;
  const last = [...company.observations].sort((a, b) => b.fiscalYear - a.fiscalYear)[0];
  const methodology = last?.provenance.methodologyVersion ?? snapshot.methodologyVersion;
  const capitalDescription =
    methodology === 'quality-dfp-m2.v1'
      ? 'O capital inclui empréstimos e arrendamentos separados e deduz caixa e equivalentes.'
      : 'O capital corresponde ao patrimônio líquido mais empréstimos e financiamentos, menos caixa e equivalentes.';
  const sheets = qualitySheets([company]);
  if (last) {
    sheets.push({
      name: 'Comparação com CDI',
      columns: [
        companyName,
        exercise,
        { label: 'ROIC ou ROE do exercício', format: 'percent', width: 29 },
        { ...reference, label: 'Data-base do CDI' },
        { label: 'CDI atual (a.a.)', format: 'percent', width: 19 },
        { label: 'Diferença (p.p.)', format: 'number', width: 21 },
      ],
      rows: [
        [
          company.name,
          last.fiscalYear,
          last.value,
          rate ? new Date(rate.provenance.referenceDate) : null,
          rate?.value ?? null,
          spreadToRiskFreeRate(last.value, rate),
        ],
      ],
    });
  }
  return {
    sheets,
    notes: [
      ['Companhia', company.name],
      ['Data-base do lote', new Date(manifest.asOf)],
      ['Geração do lote (UTC)', new Date(manifest.generatedAt)],
      ['Versão do cálculo', methodology],
      [
        'Método',
        company.metric === 'roic'
          ? `NOPAT estimado dividido pelo capital investido médio. ${capitalDescription}`
          : 'Lucro atribuível à controladora dividido pelo patrimônio médio da controladora.',
      ],
      ...(company.metric === 'roic'
        ? [['Alíquota assumida para o NOPAT', `${snapshot.roicTaxRate * 100}%`] as const]
        : []),
      [
        'Comparação com CDI',
        'A diferença usa o exercício mais recente e o CDI anualizado atual. As referências podem ter datas diferentes.',
      ],
      ['Spread histórico', snapshot.benchmark.reason],
      ['Ranking composto', snapshot.ranking.reason],
      ...cdiNotes(rate),
      ...sources(manifest.source),
    ],
  };
}

export function bankRoeReport(
  banks: readonly QualityCompany[],
  years: readonly number[],
  snapshot: BankRoeSnapshot,
  rate: RiskFreeRate | null,
): WorkbookReport {
  const { comparison, excluded, manifest, minimumPeers } = snapshot;
  const { startYear, endYear } = comparison.period;
  const annualColumns: Column[] = years.map((year) => ({
    label: `ROE ${year}`,
    format: 'percent',
    width: 15,
  }));
  const sheets: ReportSheet[] = [
    {
      name: 'Comparação entre bancos',
      columns: [
        companyName,
        ...annualColumns,
        { label: 'Média de ROE', format: 'percent', width: 18 },
        { label: 'Percentil (0 a 100)', format: 'number', width: 22 },
        { label: 'CDI atual (a.a.)', format: 'percent', width: 20 },
        { ...reference, label: 'Data-base do CDI' },
        { label: 'Diferença para CDI (p.p.)', format: 'number', width: 29 },
      ],
      rows: banks.map((bank) => {
        const byYear = new Map(
          bank.observations.map(({ fiscalYear, value }) => [fiscalYear, value]),
        );
        return [
          bank.name,
          ...years.map((year) => byYear.get(year) ?? null),
          bank.summary.mean,
          comparison.percentiles?.[bank.companyId] ?? null,
          rate?.value ?? null,
          rate ? new Date(rate.provenance.referenceDate) : null,
          spreadToRiskFreeRate(byYear.get(endYear) ?? null, rate),
        ];
      }),
    },
    ...qualitySheets(banks),
  ];
  if (excluded.length) {
    sheets.push({
      name: 'Bancos excluídos',
      columns: [companyName, { label: 'Motivo', width: 60 }],
      rows: excluded.map(({ name, reason }) => [name, reason]),
    });
  }
  return {
    sheets,
    notes: [
      ['Data-base do lote', new Date(manifest.asOf)],
      ['Geração do lote (UTC)', new Date(manifest.generatedAt)],
      ['Versão do cálculo', snapshot.methodologyVersion],
      ['Período comum', `${startYear} a ${endYear}`],
      ['Método', 'ROE da controladora em DFP consolidada, com os saldos de abertura e fechamento.'],
      [
        'Percentil',
        `Posição pela média do ROE. A janela comum requer pelo menos ${minimumPeers} bancos completos.`,
      ],
      [
        'Comparação com CDI',
        `Diferença entre o ROE de ${endYear} e o CDI atual, de datas distintas.`,
      ],
      ...cdiNotes(rate),
      ...sources(manifest.source),
    ],
  };
}

export const fundamentalRoles = {
  annual: 'Exercício anterior',
  currentYtd: 'Acumulado atual',
  priorYtd: 'Acumulado comparativo',
} as const;

export function companyFundamentalsReport(
  fundamental: PriceFundamental,
  snapshot: PriceFundamentalsSnapshot,
): WorkbookReport {
  const { balance, shares, historicalMarketPoint: history, provenance } = fundamental;
  const sheets: ReportSheet[] = [
    {
      name: 'Resultado de 12 meses',
      columns: [
        { ...reference, label: 'Início do período' },
        { ...reference, label: 'Fim do período' },
        { label: 'Indicador', width: 32 },
        { ...amount, label: 'Resultado (BRL)' },
        { ...amount, label: 'Base contábil (BRL)' },
        { label: 'Alíquota estimada', format: 'percent', width: 22 },
        { label: 'Qualidade', width: 18 },
        collectedAt,
      ],
      rows: [
        [
          new Date(fundamental.periodStart),
          new Date(fundamental.periodEnd),
          fundamental.metric === 'nopat' ? 'NOPAT estimado' : 'Lucro da controladora',
          fundamental.amountBrl,
          fundamental.incomeTtmBrl,
          fundamental.taxRate,
          qualityState[provenance.qualityStatus],
          new Date(provenance.retrievedAt),
        ],
      ],
    },
    {
      name: 'Insumos dos 12 meses',
      columns: [
        { label: 'Período usado', width: 25 },
        account,
        accountDescription,
        { ...reference, label: 'Início do período' },
        { ...reference, label: 'Fim do período' },
        amount,
        version,
        receipt,
        collectedAt,
        document,
        archive,
        fileHash,
      ],
      rows: fundamental.inputs.map((input) => [
        fundamentalRoles[input.role],
        input.accountCode,
        input.accountLabel,
        new Date(input.periodStart),
        new Date(input.periodEnd),
        input.amountBrl,
        input.filingVersion,
        new Date(input.receiptDate),
        new Date(input.retrievedAt),
        input.documentUrl,
        input.archiveUrl,
        input.archiveSha256,
      ]),
    },
  ];
  const notes: Note[] = [
    ['Companhia', fundamental.name],
    ['Data-base do lote', new Date(snapshot.manifest.asOf)],
    ['Geração do lote (UTC)', new Date(snapshot.manifest.generatedAt)],
    ['Versão do cálculo', provenance.methodologyVersion],
    ['Método de 12 meses', 'DFP anual mais o ITR acumulado no ano menos o acumulado comparativo.'],
    [
      'Fechamento atual',
      'O relatório usa os fundamentos da CVM e o ponto retrospectivo documentado, quando disponível.',
    ],
    ...snapshot.manifest.sources.flatMap(sources),
  ];
  if (balance) {
    sheets.push(
      {
        name: 'Balanço e dívida líquida',
        columns: [reference, { label: 'Componente', width: 41 }, amount],
        rows: (
          [
            ['Empréstimos e financiamentos', balance.borrowingsBrl],
            ['Arrendamentos', balance.leaseLiabilitiesBrl],
            ['Dívida bruta', balance.grossDebtBrl],
            ['Caixa e equivalentes', balance.cashBrl],
            ['Dívida líquida', balance.netDebtBrl],
            ['Aplicações financeiras circulantes', balance.financialInvestmentsBrl],
            ['Patrimônio dos não controladores', balance.nonControllingInterestsBrl],
          ] as const
        ).map(([label, value]) => [new Date(balance.provenance.referenceDate), label, value]),
      },
      {
        name: 'Contas do balanço',
        columns: [
          reference,
          { label: 'Demonstrativo', width: 18 },
          account,
          accountDescription,
          amount,
        ],
        rows: balance.inputs.map((input) => [
          new Date(input.referenceDate),
          input.statement,
          input.code,
          input.label,
          input.amountBrl,
        ]),
      },
    );
    notes.push(
      ['ITR do balanço', balance.documentUrl],
      ['Versão do balanço', balance.filingVersion],
      ['Coleta do balanço (UTC)', new Date(balance.provenance.retrievedAt)],
      ['SHA-256 do ITR do balanço', balance.archiveSha256],
      ...balance.limitations.map((limitation): Note => ['Ressalva de balanço', limitation]),
    );
  }
  if (shares) {
    sheets.push({
      name: 'Ações por classe',
      columns: [
        reference,
        { label: 'Ticker', width: 14 },
        { label: 'Classe', width: 14 },
        { label: 'Emitidas', format: 'integer', width: 20 },
        { label: 'Em tesouraria', format: 'integer', width: 20 },
        { label: 'Fora da tesouraria', format: 'integer', width: 24 },
      ],
      rows: shares.classes.map((item) => [
        new Date(shares.referenceDate),
        item.ticker,
        item.kind,
        item.issued,
        item.treasury,
        item.outstanding,
      ]),
    });
    notes.push(
      ['ITR da posição de ações', shares.documentUrl],
      ['Fonte das quantidades exatas', shares.evidenceUrl],
      ['Versão da posição de ações', shares.filingVersion],
      ['Coleta da posição (UTC)', new Date(shares.retrievedAt)],
      ['SHA-256 do ITR da posição', shares.archiveSha256],
    );
  }
  if (history) {
    sheets.push({
      name: 'Rendimento retrospectivo',
      columns: [
        reference,
        { ...amount, label: 'Capitalização (BRL)', width: 26 },
        { label: 'Lucro sobre capitalização', format: 'percent', width: 30 },
        ...history.classes.map(({ ticker }): Column => ({
          label: `${ticker} (BRL por ação)`,
          format: 'currency',
          width: 25,
        })),
      ],
      rows: [
        [
          new Date(history.referenceDate),
          history.marketCapBrl,
          history.earningsYield,
          ...history.classes.map(({ priceBrl }) => priceBrl),
        ],
      ],
    });
    notes.push(
      ['Fonte do ponto retrospectivo', history.sourceName],
      ['Demonstrativo no EDGAR', history.documentUrl],
      ['Política de reuso da SEC', history.reusePolicyUrl],
      ['Referência retrospectiva', 'Valores por ação do demonstrativo divulgado após a data-base.'],
    );
  }
  if (fundamental.denominatorIssues?.balance) {
    notes.push(['Lacuna no balanço', fundamental.denominatorIssues.balance]);
  }
  if (fundamental.denominatorIssues?.shares) {
    notes.push(['Lacuna na posição de ações', fundamental.denominatorIssues.shares]);
  }
  return { sheets, notes };
}
