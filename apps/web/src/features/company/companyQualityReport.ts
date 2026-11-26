import { spreadToRiskFreeRate } from '../../shared/analytics/riskFreeRate';
import { cdiRateUrl, type RiskFreeRate } from '../../shared/data-client/riskFreeRate';
import type { ReportSheet, WorkbookReport } from '../../shared/export/report';
import {
  annualComparisonContext,
  annualObservation,
  annualRate,
  comparisonSector,
  type Company,
  type ComparisonData,
} from './companyQualityData';
import { formatRate } from './QualityHistory';

function calculationReportRows(companies: Company[], year: number): ReportSheet['rows'] {
  return companies.flatMap((company) => {
    const observation = annualObservation(company, year);
    if (!observation?.inputs || !observation.filing) return [];
    const { filing } = observation;
    const opening = new Date(Date.UTC(year - 1, 11, 31));
    const closing = new Date(filing.referenceDate);
    const row = (label: string, code: string | null, date: Date, amount: number) => [
      company.name,
      company.metric,
      label,
      code,
      date,
      amount,
    ];
    if ('roe' in observation) {
      const { inputs } = observation;
      const auditedSource = inputs.auditedStatementPage
        ? `${inputs.incomeStatement}, p. ${inputs.auditedStatementPage}`
        : null;
      const equitySource = auditedSource ?? inputs.equityCodes.join(', ');
      return [
        row(
          'Lucro líquido da controladora',
          auditedSource ?? `${inputs.incomeStatement} ${inputs.incomeCode}`,
          closing,
          inputs.netIncomeBrl,
        ),
        row(
          'Patrimônio na abertura',
          equitySource,
          inputs.openingEquityDate ? new Date(inputs.openingEquityDate) : opening,
          inputs.openingEquityBrl,
        ),
        row('Patrimônio no fechamento', equitySource, closing, inputs.closingEquityBrl),
      ];
    }
    const { inputs } = observation;
    return [
      row('NOPAT estimado', null, closing, inputs.nopatBrl),
      row('Capital investido na abertura', null, opening, inputs.openingCapitalBrl),
      row('Capital investido no fechamento', null, closing, inputs.closingCapitalBrl),
      ...inputs.accounts.map((account) =>
        row(
          account.label,
          `${account.statement} ${account.code}`,
          new Date(account.referenceDate),
          account.amountBrl,
        ),
      ),
    ];
  });
}

export function comparisonReport(
  data: ComparisonData,
  companies: Company[],
  year: number,
  latestYear: number,
  rate: RiskFreeRate | null,
  { metric, order }: { metric: Company['metric'] | ''; order: 'name' | 'return' },
): WorkbookReport {
  const showCdi = year === latestYear;
  return {
    sheets: [
      {
        name: 'Comparativo',
        columns: [
          { label: 'Companhia', width: 52 },
          { label: 'Setor CVM', width: 43 },
          { label: 'Indicador', width: 13 },
          { label: 'Exercício', format: 'integer', width: 12 },
          { label: 'Retorno', format: 'percent', width: 16 },
          ...(showCdi
            ? [{ label: 'Diferença para o CDI atual (p.p.)', format: 'number' as const, width: 33 }]
            : []),
          { label: 'Motivo da lacuna', width: 55 },
          { label: 'Data-base da DFP', format: 'date', width: 20 },
          { label: 'Recebimento da DFP', format: 'date', width: 24 },
          { label: 'Versão da DFP', format: 'integer', width: 18 },
          { label: 'Formulário da CVM', width: 64 },
          { label: 'Demonstrações de apoio', width: 64 },
          { label: 'Base contábil', width: 19 },
          { label: 'Grupo no comparativo', width: 37 },
          { label: 'Contexto do exercício', width: 56 },
          { label: 'Fonte do contexto', width: 64 },
        ],
        rows: companies.map((company) => {
          const observation = annualObservation(company, year);
          const value = annualRate(observation);
          const filing = observation?.filing;
          const context = annualComparisonContext(company, year);
          return [
            company.name,
            company.sector,
            company.metric,
            year,
            value,
            ...(showCdi ? [spreadToRiskFreeRate(value, rate)] : []),
            observation?.reason ?? null,
            filing ? new Date(filing.referenceDate) : null,
            filing ? new Date(filing.receivedAt) : null,
            filing?.version ?? null,
            filing?.filingUrl ?? null,
            filing?.supportingDocumentUrl ?? null,
            filing ? (filing.basis === 'individual' ? 'Individual' : 'Consolidada') : null,
            comparisonSector(company),
            context?.note ?? null,
            context?.sourceUrl ?? null,
          ];
        }),
      },
      {
        name: 'Contas e saldos',
        columns: [
          { label: 'Companhia', width: 52 },
          { label: 'Indicador', width: 13 },
          { label: 'Conta ou valor calculado', width: 49 },
          { label: 'Conta ou nota de origem', width: 29 },
          { label: 'Data-base', format: 'date', width: 19 },
          { label: 'Valor em reais', format: 'currency', width: 24 },
        ],
        rows: calculationReportRows(companies, year),
      },
    ],
    notes: [
      ['Data-base da seleção', new Date(data.roe.asOf)],
      ['Exercício', year],
      ['Filtro de indicador', metric || 'ROE e ROIC'],
      ['Ordenação', order === 'return' ? 'Maior retorno do exercício' : 'Nome (A–Z)'],
      ['ROE', 'Lucro atribuível à controladora dividido pelo patrimônio médio da controladora.'],
      ['ROIC', 'NOPAT estimado dividido pelo capital investido médio.'],
      [
        'Capital investido do ROIC',
        'Patrimônio líquido mais empréstimos e financiamentos de curto e longo prazo, menos caixa e equivalentes. A média usa os saldos de abertura e fechamento.',
      ],
      ['Alíquota padronizada do ROIC', formatRate(data.roic.taxRate)],
      ['Método ROE', data.roe.methodologyVersion],
      ['Método ROIC', data.roic.methodologyVersion],
      ['Fonte DFP', data.roe.source.datasetUrl],
      ['Fonte FCA', data.roe.sectorSource.datasetUrl],
      ['Licença', data.roe.source.license],
      ['Termos da licença', data.roe.source.licenseUrl],
      ...(showCdi
        ? ([
            ['Fonte do CDI atual', cdiRateUrl],
            ['CDI atual', rate ? formatRate(rate.value) : null],
            ['Data-base do CDI', rate ? new Date(rate.provenance.referenceDate) : null],
          ] as const)
        : []),
    ],
  };
}
