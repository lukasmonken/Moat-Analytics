import type { RiskFreeRate, SectorRoicSnapshot } from '@moat/data-contracts';
import { spreadToRiskFreeRate } from '../../shared/analytics/riskFreeRate';
import { cdiRateUrl } from '../../shared/data-client/riskFreeRate';
import type { WorkbookReport } from '../../shared/export/report';
import type { ScreenerExportScope } from '../screener/ScreenerExport';
import { cdiNotes } from './companyReports';
import { minimumSectorPeers, type SectorRoicRow } from './sectorComparisonRows';

const companyName = { label: 'Companhia', width: 46 };
const exercise = { label: 'Exercício', format: 'integer', width: 13 } as const;
const estimate = { label: 'ROIC estimado', format: 'percent', width: 19 } as const;

function optionalDate(value: string | undefined) {
  return value ? new Date(value) : null;
}

export function sectorRoicReport(
  snapshot: SectorRoicSnapshot,
  rows: SectorRoicRow[],
  year: number,
  riskFreeRate: RiskFreeRate | null,
  { scope, search, sector }: { scope: ScreenerExportScope; search: string; sector: string },
): WorkbookReport {
  const { manifest } = snapshot;
  const showCdi = year === manifest.years.at(-1);
  const sheets: WorkbookReport['sheets'] = [
    {
      name: 'Comparativo de ROIC',
      columns: [
        companyName,
        { label: 'Setor declarado no FCA', width: 35 },
        { ...estimate, label: `ROIC estimado em ${year}` },
        { ...estimate, label: 'Média dos cinco exercícios' },
        { label: 'Percentil no setor (0–100)', format: 'number', width: 24 },
        { label: 'Exercícios válidos', format: 'integer', width: 19 },
        { label: 'Companhias com a janela completa no setor', format: 'integer', width: 33 },
        { label: 'Motivo da lacuna no exercício selecionado', width: 66 },
      ],
      rows: rows.map(({ company, current, mean, percentile, validYears, peers }) => [
        company.name,
        company.sector,
        current?.roic ?? null,
        mean,
        percentile,
        validYears,
        peers,
        current?.reason ?? null,
      ]),
    },
    {
      name: 'Exercícios e formulários',
      columns: [
        companyName,
        exercise,
        estimate,
        { label: 'EBIT conciliado (R$)', format: 'currency', width: 22 },
        { label: 'NOPAT estimado (R$)', format: 'currency', width: 22 },
        { label: 'Capital investido na abertura (R$)', format: 'currency', width: 29 },
        { label: 'Capital investido no fechamento (R$)', format: 'currency', width: 29 },
        { label: 'Data-base da DFP', format: 'date', width: 19 },
        { label: 'Recebimento da DFP', format: 'date', width: 23 },
        { label: 'Versão da DFP', format: 'integer', width: 16 },
        { label: 'Formulário DFP na CVM', width: 76 },
        { label: 'Documento de apoio', width: 76 },
        { label: 'Motivo da lacuna', width: 66 },
      ],
      rows: rows.flatMap(({ company }) =>
        company.observations.map(({ year, roic, reason, filing, inputs }) => [
          company.name,
          year,
          roic,
          inputs?.ebitBrl ?? null,
          inputs?.nopatBrl ?? null,
          inputs?.openingCapitalBrl ?? null,
          inputs?.closingCapitalBrl ?? null,
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
      name: 'Contas e saldos',
      columns: [
        companyName,
        exercise,
        { label: 'Demonstrativo', width: 16 },
        { label: 'Conta', width: 21 },
        { label: 'Descrição', width: 57 },
        { label: 'Data-base da conta', format: 'date', width: 20 },
        { label: 'Valor (R$)', format: 'currency', width: 24 },
      ],
      rows: rows.flatMap(({ company }) =>
        company.observations.flatMap(({ year, inputs }) =>
          (inputs?.accounts ?? []).map((account) => [
            company.name,
            year,
            account.statement,
            account.code,
            account.label,
            new Date(account.referenceDate),
            account.amountBrl,
          ]),
        ),
      ),
    },
    {
      name: 'Arquivos de origem',
      columns: [
        { label: 'Formulário', width: 16 },
        { label: 'Ano do arquivo', format: 'integer', width: 16 },
        { label: 'Coleta (UTC)', format: 'datetime', width: 23 },
        { label: 'Arquivo original', width: 77 },
        { label: 'SHA-256 do ZIP', width: 70 },
      ],
      rows: manifest.archives.map(({ kind, year, retrievedAt, url, sha256 }) => [
        kind.toUpperCase(),
        year,
        new Date(retrievedAt),
        url,
        sha256,
      ]),
    },
  ];
  if (showCdi) {
    sheets.push({
      name: 'CDI atual',
      columns: [
        companyName,
        exercise,
        estimate,
        { label: 'Data-base do CDI', format: 'date', width: 20 },
        { label: 'CDI atual (a.a.)', format: 'percent', width: 21 },
        { label: 'Diferença (p.p.)', format: 'number', width: 22 },
      ],
      rows: rows.map(({ company, current }) => [
        company.name,
        year,
        current?.roic ?? null,
        optionalDate(riskFreeRate?.provenance.referenceDate),
        riskFreeRate?.value ?? null,
        spreadToRiskFreeRate(current?.roic ?? null, riskFreeRate),
      ]),
    });
  }
  return {
    sheets,
    notes: [
      ['Método', manifest.methodologyVersion],
      [
        'ROIC estimado',
        'NOPAT estimado dividido pelo capital investido médio, com saldos de abertura e fechamento.',
      ],
      [
        'NOPAT estimado',
        'EBIT anual conciliado da DFP consolidada após aplicar a alíquota padronizada.',
      ],
      ['Alíquota padronizada', `${manifest.taxRate * 100}%`],
      [
        'Capital investido',
        'Patrimônio consolidado mais financiamentos, arrendamentos e outros passivos financeiros revisados, menos caixa e equivalentes.',
      ],
      ['Exercício do comparativo', year],
      ['Exercícios da média', manifest.years.join(', ')],
      [
        'Percentil no setor',
        `Posição da média com pelo menos ${minimumSectorPeers} companhias com os cinco exercícios válidos no mesmo setor do FCA. Empates usam a posição média.`,
      ],
      ...(showCdi
        ? [
            [
              'Diferença para o CDI atual',
              `ROIC estimado de ${year} menos o CDI atual anualizado, em pontos percentuais.`,
            ] as const,
            ...cdiNotes(riskFreeRate),
            ...(!riskFreeRate ? [['Série SGS 4389', cdiRateUrl] as const] : []),
          ]
        : []),
      ['Data-base da seleção', new Date(manifest.asOf)],
      ['Lote gerado (UTC)', new Date(manifest.generatedAt)],
      ['Fonte DFP', manifest.source.datasetUrl],
      ['Fonte FCA', manifest.sectorSource.datasetUrl],
      ['Licença', manifest.source.license],
      ['Termos da licença', manifest.source.licenseUrl],
      ['Escopo', scope === 'filtered' ? 'Companhias filtradas' : 'Todas as companhias'],
      ['Busca aplicada', scope === 'filtered' ? search.trim() || null : null],
      ['Setor filtrado', scope === 'filtered' ? sector || null : null],
      ['Companhias exportadas', rows.length],
      ['Companhias no piloto', snapshot.companies.length],
    ],
  };
}
