import type { CompanyDirectorySnapshot } from '@moat/data-contracts';
import type { ReportSheet, WorkbookReport } from '../../shared/export/report';
import { totalWeightUnits, type PortfolioDraft, type SavedPortfolio } from './portfolio';

export function portfolioParameterSheet(portfolio: SavedPortfolio): ReportSheet {
  return {
    name: 'Parâmetros',
    columns: [
      { label: 'Capital inicial', format: 'currency', width: 20 },
      { label: 'Aporte mensal', format: 'currency', width: 20 },
      { label: 'Rebalanceamento', width: 23 },
      { label: 'Custo por operação', format: 'percent', width: 21 },
      { label: 'Tributo hipotético ao final', format: 'percent', width: 27 },
    ],
    rows: [
      [
        portfolio.capital,
        portfolio.contribution,
        portfolio.rebalance === 'monthly' ? 'Mensal' : 'Sem rebalanceamento',
        portfolio.costRate,
        portfolio.gainTaxRate,
      ],
    ],
  };
}

export function buildPortfolioReport(
  portfolio: SavedPortfolio,
  draft: PortfolioDraft,
  directory: CompanyDirectorySnapshot | null,
): WorkbookReport {
  return {
    sheets: [
      {
        name: 'Composição',
        columns: [
          { label: 'Companhia', width: 52 },
          { label: 'Peso-alvo', format: 'percent', width: 16 },
        ],
        rows: portfolio.positions.map(({ name, weightUnits }) => [
          name,
          weightUnits / totalWeightUnits,
        ]),
      },
      portfolioParameterSheet(portfolio),
      {
        name: 'Limites',
        columns: [
          { label: 'Distribuição dos pesos', width: 23 },
          { label: 'Limite por companhia', format: 'percent', width: 22 },
        ],
        rows: [
          [
            draft.method === 'equal' ? 'Iguais' : 'Personalizados',
            draft.maxWeight.trim() ? Number(draft.maxWeight.replace(',', '.')) / 100 : null,
          ],
        ],
      },
    ],
    notes: [
      ['Modelo', 'Seleção manual por companhia e pesos-alvo.'],
      [
        'Fonte dos nomes',
        directory?.source.datasetUrl ?? 'Diretório de companhias da CVM no aplicativo.',
      ],
      ['Data-base do diretório consultado', directory ? new Date(directory.asOf) : null],
      ['Licença dos nomes', directory?.source.license ?? null],
      ['Fonte das premissas', 'Parâmetros da composição atual no navegador.'],
      [
        'Taxas',
        'Custo sobre compra e rebalanceamento. O tributo é uma hipótese sobre ganho positivo ao final da simulação.',
      ],
      ['Cobertura', 'A exposição por setor está indisponível no diretório atual.'],
    ],
  };
}
