import type { IndexUniverseCompany, IndexUniverseSnapshot } from '@moat/data-contracts';
import { Badge, Button, EmptyState, Panel, Table } from '../../shared/ui';

const columns = [
  { key: 'name', label: 'Companhia' },
  { key: 'tickers', label: 'Tickers na composição' },
  { key: 'indices', label: 'Índices' },
] as const;

type SortColumn = (typeof columns)[number]['key'];
export type Sort = { column: SortColumn; direction: 'ascending' | 'descending' };

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});
const numberFormatter = new Intl.NumberFormat('pt-BR');
const compare = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true }).compare;

function sortValue(company: IndexUniverseCompany, key: SortColumn) {
  switch (key) {
    case 'name':
      return company.name;
    case 'tickers':
      return company.securities
        .map(({ ticker }) => ticker)
        .sort()
        .join(' ');
    case 'indices':
      return company.indexMemberships.slice().sort().join(' ');
  }
}

export function orderCompanies(companies: IndexUniverseCompany[], sort: Sort) {
  const direction = sort.direction === 'ascending' ? 1 : -1;

  return companies
    .slice()
    .sort(
      (a, b) =>
        compare(sortValue(a, sort.column), sortValue(b, sort.column)) * direction ||
        compare(a.name, b.name) ||
        a.cvmCode - b.cvmCode,
    );
}

export function IndexUniverseSource({ snapshot }: { snapshot: IndexUniverseSnapshot }) {
  return (
    <Panel className="screener-source" aria-labelledby="screener-source-title">
      <div>
        <h2 id="screener-source-title">Composição anual</h2>
        {snapshot.source.redistributionBasis === null && <Badge>Consulta local</Badge>}
        <p>O ranking de qualidade ficará disponível quando os indicadores forem integrados.</p>
      </div>

      <dl>
        <div>
          <dt>Data-base</dt>
          <dd>
            <time dateTime={snapshot.asOf}>
              {dateFormatter.format(new Date(`${snapshot.asOf}T00:00:00Z`))}
            </time>
          </dd>
        </div>
        <div>
          <dt>Fonte</dt>
          <dd>
            {snapshot.source.url ? (
              <a href={snapshot.source.url}>{snapshot.source.name}</a>
            ) : (
              snapshot.source.name
            )}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

interface IndexUniverseResultsProps {
  companies: IndexUniverseCompany[];
  total: number;
  pageSize: number;
  page: number;
  onPageChange: (page: number) => void;
  sort: Sort;
  onSort: (column: SortColumn) => void;
}

export function IndexUniverseResults({
  companies,
  total,
  pageSize,
  page,
  onPageChange,
  sort,
  onSort,
}: IndexUniverseResultsProps) {
  const totalPages = Math.ceil(companies.length / pageSize);
  const currentPage = Math.min(page, totalPages);
  const first = (currentPage - 1) * pageSize;
  const count = `${numberFormatter.format(companies.length)} de ${numberFormatter.format(total)} companhias`;

  if (companies.length === 0) {
    return (
      <EmptyState
        icon="search"
        title="Nenhuma companhia encontrada"
        description={`${count}. Ajuste a pesquisa ou o filtro de índice.`}
      />
    );
  }

  return (
    <Panel className="screener-results">
      <div className="screener-results__toolbar">
        <p role="status">{count}</p>
        <nav className="screener-pagination" aria-label="Paginação da composição">
          <Button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
            Página anterior
          </Button>
          <p aria-live="polite">
            Página {numberFormatter.format(currentPage)} de {numberFormatter.format(totalPages)}
          </p>
          <Button
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Próxima página
          </Button>
        </nav>
      </div>

      <div
        className="screener-results__scroll"
        role="region"
        aria-label="Tabela da composição anual"
        tabIndex={0}
      >
        <Table aria-label="Companhias da composição anual">
          <thead>
            <tr>
              {columns.map(({ key, label }) => (
                <th
                  key={key}
                  scope="col"
                  aria-sort={sort.column === key ? sort.direction : undefined}
                >
                  <button type="button" className="screener-sort" onClick={() => onSort(key)}>
                    {label}
                    {sort.column === key && (
                      <span aria-hidden="true">{sort.direction === 'ascending' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.slice(first, first + pageSize).map((company) => (
              <tr key={company.companyId}>
                <th scope="row">{company.name}</th>
                <td>
                  <ul className="screener-tickers" aria-label="Códigos por classe">
                    {company.securities.map((security) => (
                      <li key={security.ticker}>
                        <strong>{security.ticker}</strong>
                        <span>
                          {security.kind} · {security.indexMemberships.join(', ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td>
                  <ul className="screener-indices">
                    {company.indexMemberships.map((index) => (
                      <li key={index}>
                        <Badge>{index}</Badge>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Panel>
  );
}
