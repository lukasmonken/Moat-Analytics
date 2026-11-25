import type { RiskFreeRate, SectorComparisonSnapshot } from '@moat/data-contracts';
import { spreadToRiskFreeRate } from '../../shared/analytics/riskFreeRate';
import { cdiRateUrl } from '../../shared/data-client/riskFreeRate';
import type { ReportSheet, WorkbookReport } from '../../shared/export/report';
import type { ScreenerExportScope } from '../screener/ScreenerExport';
import { cdiNotes } from './companyReports';
import {
  minimumSectorPeers,
  type SectorComparisonRow,
  type SideBySideRoe,
} from './sectorComparisonRows';

function optionalDate(value: string | undefined) {
  return value ? new Date(value) : null;
}

export function sectorComparisonReport(
  snapshot: SectorComparisonSnapshot,
  rows: SectorComparisonRow[],
  year: number,
  scope: ScreenerExportScope,
  search: string,
  sector: string,
  order: string,
  riskFreeRate: RiskFreeRate | null = null,
): WorkbookReport {
  const { manifest } = snapshot;
  const showCdi = year === manifest.years.at(-1);
  const cdiSheet: ReportSheet = {
    name: 'CDI atual',
    columns: [
      { label: 'Companhia', width: 52 },
      { label: 'Exercício', format: 'integer', width: 13 },
      { label: 'ROE', format: 'percent', width: 18 },
      { label: 'Data-base do CDI', format: 'date', width: 19 },
      { label: 'CDI atual (a.a.)', format: 'percent', width: 20 },
      { label: 'Diferença (p.p.)', format: 'number', width: 21 },
    ],
    rows: showCdi
      ? rows.map(({ company, current }) => [
          company.name,
          year,
          current?.roe ?? null,
          optionalDate(riskFreeRate?.provenance.referenceDate),
          riskFreeRate?.value ?? null,
          spreadToRiskFreeRate(current?.roe ?? null, riskFreeRate),
        ])
      : [],
  };
  return {
    sheets: [
      {
        name: 'Comparativo setorial',
        columns: [
          { label: 'Companhia', width: 52 },
          { label: 'Setor declarado no FCA', width: 52 },
          { label: `ROE de ${year}`, format: 'percent', width: 18 },
          { label: 'Média de ROE em cinco exercícios', format: 'percent', width: 28 },
          { label: 'Percentil no setor (0–100)', format: 'number', width: 22 },
          { label: 'Exercícios válidos na janela', format: 'integer', width: 25 },
          { label: 'Pares com cinco exercícios válidos', format: 'integer', width: 28 },
          { label: 'Lacuna no exercício selecionado', width: 58 },
        ],
        rows: rows.map(({ company, current, mean, percentile, validYears, peers }) => [
          company.name,
          company.sector,
          current?.roe ?? null,
          mean,
          percentile,
          validYears,
          peers,
          current?.reason ?? null,
        ]),
      },
      {
        name: 'Contas e formulários',
        columns: [
          { label: 'Companhia', width: 52 },
          { label: 'Exercício', format: 'integer', width: 12 },
          { label: 'ROE da controladora', format: 'percent', width: 20 },
          { label: 'Lucro atribuível (R$)', format: 'currency', width: 23 },
          { label: 'PL de abertura (R$)', format: 'currency', width: 23 },
          { label: 'PL de fechamento (R$)', format: 'currency', width: 23 },
          { label: 'Conta do lucro', width: 18 },
          { label: 'Contas do balanço', width: 24 },
          { label: 'Data-base da DFP', format: 'date', width: 18 },
          { label: 'Recebimento da DFP', format: 'date', width: 20 },
          { label: 'Versão da DFP', format: 'integer', width: 17 },
          { label: 'Formulário na CVM', width: 55 },
          { label: 'Documento de apoio', width: 55 },
          { label: 'Motivo da lacuna', width: 58 },
        ],
        rows: rows.flatMap(({ company }) =>
          company.observations.map(({ year, roe, reason, filing, inputs }) => [
            company.name,
            year,
            roe,
            inputs?.netIncomeBrl ?? null,
            inputs?.openingEquityBrl ?? null,
            inputs?.closingEquityBrl ?? null,
            inputs ? `${inputs.incomeStatement} ${inputs.incomeCode}` : null,
            inputs?.equityCodes.join(', ') ?? null,
            optionalDate(filing?.referenceDate),
            optionalDate(filing?.receivedAt),
            filing?.version ?? null,
            filing?.filingUrl ?? null,
            filing?.supportingDocumentUrl ?? null,
            reason,
          ]),
        ),
      },
      {
        name: 'Cadastro por setor',
        columns: [
          { label: 'Companhia', width: 52 },
          { label: 'Setor declarado no FCA', width: 52 },
          { label: 'Data-base do FCA', format: 'date', width: 22 },
          { label: 'Recebimento do FCA', format: 'date', width: 22 },
          { label: 'Versão do FCA', format: 'integer', width: 17 },
          { label: 'Ano do arquivo FCA', format: 'integer', width: 20 },
          { label: 'Formulário na CVM', width: 55 },
        ],
        rows: rows.map(({ company }) => [
          company.name,
          company.sector,
          new Date(company.classification.referenceDate),
          new Date(company.classification.receivedAt),
          company.classification.version,
          company.classification.archiveYear,
          company.classification.filingUrl,
        ]),
      },
      {
        name: 'Arquivos de origem',
        columns: [
          { label: 'Formulário', width: 14 },
          { label: 'Ano do arquivo', format: 'integer', width: 17 },
          { label: 'Coleta (UTC)', format: 'datetime', width: 24 },
          { label: 'Arquivo original', width: 77 },
          { label: 'Hash SHA-256', width: 68 },
        ],
        rows: manifest.archives.map(({ kind, year, retrievedAt, url, sha256 }) => [
          kind.toUpperCase(),
          year,
          new Date(retrievedAt),
          url,
          sha256,
        ]),
      },
      ...(showCdi ? [cdiSheet] : []),
    ],
    notes: [
      ['Método', manifest.methodologyVersion],
      [
        'ROE',
        'Lucro líquido da controladora dividido pelo patrimônio médio da controladora na DFP consolidada.',
      ],
      ['Exercício do comparativo', year],
      ['Exercícios da média', manifest.years.join(', ')],
      ['Critério da média', 'Cinco exercícios consecutivos com ROE disponível.'],
      ...(showCdi
        ? [
            [
              'Diferença para o CDI atual',
              `ROE do exercício de ${year} menos o CDI atual anualizado, em pontos percentuais. A data-base do CDI é indicada separadamente.`,
            ] as const,
            ...cdiNotes(riskFreeRate),
            ...(!riskFreeRate ? [['Série SGS 4389', cdiRateUrl] as const] : []),
          ]
        : []),
      [
        'Percentil no setor',
        `Posição pela média de ROE com pelo menos ${minimumSectorPeers} companhias completas no setor exato do FCA. Empates usam a posição média.`,
      ],
      ['Publicação das DFP', 'O catálogo informa a data de recebimento dos formulários.'],
      ['Data-base da seleção', new Date(manifest.asOf)],
      ['Lote gerado em (UTC)', new Date(manifest.generatedAt)],
      ['Fonte DFP', manifest.source.datasetUrl],
      ['Fonte FCA', manifest.sectorSource.datasetUrl],
      ['Licença', manifest.source.license],
      ['Termos da licença', manifest.source.licenseUrl],
      ['Escopo', scope === 'filtered' ? 'Companhias filtradas' : 'Todas as companhias'],
      ['Busca aplicada', scope === 'filtered' ? search.trim() || null : null],
      ['Setor filtrado', scope === 'filtered' ? sector || null : null],
      ['Ordenação', order],
      ['Companhias exportadas', rows.length],
      ['Companhias na seleção', snapshot.companies.length],
    ],
  };
}

export function sideBySideRoeReport(
  snapshot: SectorComparisonSnapshot,
  comparison: SideBySideRoe,
): WorkbookReport {
  const { manifest } = snapshot;
  return {
    sheets: [
      {
        name: 'ROE lado a lado',
        columns: [
          { label: 'Companhia', width: 52 },
          { label: 'Setor declarado no FCA', width: 52 },
          { label: 'Exercício', format: 'integer', width: 12 },
          { label: 'ROE', format: 'percent', width: 16 },
          { label: 'Variação anual (p.p.)', format: 'number', width: 24 },
          { label: 'Mediana do setor', format: 'percent', width: 22 },
          { label: 'Companhias com ROE no setor', format: 'integer', width: 31 },
          { label: 'Data-base da DFP', format: 'date', width: 20 },
          { label: 'Recebimento da DFP', format: 'date', width: 23 },
          { label: 'Versão da DFP', format: 'integer', width: 17 },
          { label: 'Formulário DFP na CVM', width: 55 },
          { label: 'Documento de apoio', width: 55 },
          { label: 'Motivo da lacuna', width: 58 },
        ],
        rows: comparison.companies.flatMap(({ company, observations }) =>
          observations.map(({ year, observation, deltaPp, sectorMedian, sectorPeers }) => [
            company.name,
            company.sector,
            year,
            observation?.roe ?? null,
            deltaPp,
            sectorMedian,
            sectorPeers,
            optionalDate(observation?.filing?.referenceDate),
            optionalDate(observation?.filing?.receivedAt),
            observation?.filing?.version ?? null,
            observation?.filing?.filingUrl ?? null,
            observation?.filing?.supportingDocumentUrl ?? null,
            observation?.reason ?? null,
          ]),
        ),
      },
      {
        name: 'Média no período',
        columns: [
          { label: 'Companhia', width: 52 },
          { label: 'Setor declarado no FCA', width: 52 },
          { label: 'Média de ROE', format: 'percent', width: 19 },
          { label: 'Exercícios com ROE', format: 'integer', width: 24 },
          { label: 'Data-base do FCA', format: 'date', width: 20 },
          { label: 'Formulário FCA na CVM', width: 55 },
        ],
        rows: comparison.companies.map(({ company, mean, validYears }) => [
          company.name,
          company.sector,
          mean,
          validYears,
          new Date(company.classification.referenceDate),
          company.classification.filingUrl,
        ]),
      },
    ],
    notes: [
      ['Método', manifest.methodologyVersion],
      [
        'ROE',
        'Lucro líquido da controladora dividido pelo patrimônio médio da controladora na DFP consolidada.',
      ],
      ['Exercícios comparados', comparison.years.join(', ')],
      [
        'Média no período',
        'Média aritmética dos cinco exercícios quando todos têm ROE disponível.',
      ],
      [
        'Variação anual',
        'Diferença em pontos percentuais entre dois exercícios consecutivos com ROE disponível.',
      ],
      [
        'Mediana do setor',
        `Considera todas as companhias com ROE no mesmo exercício e no mesmo setor do FCA na seleção anual. A mediana exige ao menos ${minimumSectorPeers} companhias com ROE disponível.`,
      ],
      ['Data-base da seleção', new Date(manifest.asOf)],
      ['Lote gerado em (UTC)', new Date(manifest.generatedAt)],
      ['Fonte DFP', manifest.source.datasetUrl],
      ['Fonte FCA', manifest.sectorSource.datasetUrl],
      ['Licença', manifest.source.license],
      ['Termos da licença', manifest.source.licenseUrl],
    ],
  };
}
