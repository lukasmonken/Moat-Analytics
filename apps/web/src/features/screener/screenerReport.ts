import type {
  CompanyDirectorySnapshot,
  IndexCode,
  IndexUniverseCompany,
  IndexUniverseSnapshot,
} from '@moat/data-contracts';
import type { WorkbookReport } from '../../shared/export/report';
import type { ScreenerExportScope } from './ScreenerExport';

function scopeLabel(scope: ScreenerExportScope) {
  return scope === 'filtered' ? 'Companhias filtradas' : 'Todas as companhias';
}

export function directoryReport(
  snapshot: CompanyDirectorySnapshot,
  companies: readonly string[],
  scope: ScreenerExportScope,
  search: string,
): WorkbookReport {
  return {
    sheets: [
      {
        name: 'Companhias',
        columns: [{ label: 'Companhia', width: 52 }],
        rows: companies.map((name) => [name]),
      },
    ],
    notes: [
      ['Fonte', snapshot.source.name],
      ['Catálogo', snapshot.source.datasetUrl],
      ['Licença', snapshot.source.license],
      ['Termos da licença', snapshot.source.licenseUrl],
      ['Data-base da seleção', new Date(snapshot.asOf)],
      ['Atualização do cadastro no lote', 'Horário não informado'],
      ['Escopo', scopeLabel(scope)],
      ['Busca aplicada', scope === 'filtered' ? search.trim() || null : null],
      ['Companhias exportadas', companies.length],
      ['Companhias na seleção', snapshot.companies.length],
      ['Metodologia', 'Nomes oficiais das companhias selecionadas no cadastro da CVM (FCA).'],
    ],
  };
}

export function compositionReport(
  snapshot: IndexUniverseSnapshot,
  companies: readonly IndexUniverseCompany[],
  scope: ScreenerExportScope,
  search: string,
  index: IndexCode | '',
  order: string,
): WorkbookReport {
  return {
    sheets: [
      {
        name: 'Companhias',
        columns: [
          { label: 'Companhia', width: 52 },
          { label: 'Tickers na composição', width: 29 },
          { label: 'Índices', width: 23 },
        ],
        rows: companies.map((company) => [
          company.name,
          company.securities.map(({ ticker }) => ticker).join(', '),
          company.indexMemberships.join(', '),
        ]),
      },
      {
        name: 'Classes',
        columns: [
          { label: 'Companhia', width: 52 },
          { label: 'Ticker na composição', width: 24 },
          { label: 'Classe', width: 14 },
          { label: 'Índices da classe', width: 23 },
        ],
        rows: companies.flatMap((company) =>
          company.securities.map((security) => [
            company.name,
            security.ticker,
            security.kind,
            security.indexMemberships.join(', '),
          ]),
        ),
      },
    ],
    notes: [
      ['Fonte', snapshot.source.name],
      ['Endereço da fonte', snapshot.source.url],
      ['Data-base', new Date(snapshot.asOf)],
      ['Importado em (UTC)', new Date(snapshot.importedAt)],
      ['Escopo', scopeLabel(scope)],
      ['Busca aplicada', scope === 'filtered' ? search.trim() || null : null],
      ['Índice filtrado', scope === 'filtered' ? index || null : null],
      ['Ordenação da tela', order],
      ['Companhias exportadas', companies.length],
      ['Companhias na composição', snapshot.coverage.includedCompanies],
      ['Metodologia', 'União das composições por companhia com as afiliações por classe.'],
      [
        'Condições de uso',
        snapshot.source.redistributionBasis ??
          'Dados de consulta local. Respeite as condições da fonte ao compartilhar.',
      ],
    ],
  };
}
