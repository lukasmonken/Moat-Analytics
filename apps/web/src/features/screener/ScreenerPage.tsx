import { INDEX_CODES, type IndexCode } from '@moat/data-contracts';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, Input, PageHeader, Panel, Select } from '../../shared/ui';
import { FundamentalRanking } from '../ranking/FundamentalRanking';
import { RoicDrawdownRanking } from '../ranking/RoicDrawdownRanking';
import { CompanyDirectory } from './CompanyDirectory';
import {
  IndexUniverseResults,
  IndexUniverseSource,
  orderCompanies,
  sortDescription,
  type Sort,
} from './IndexUniverseResults';
import { defaultPageSize, normalizeSearch, pageSizes } from './presentation';
import './screener.css';
import { ScreenerExport } from './ScreenerExport';
import { compositionReport } from './screenerReport';
import { useIndexUniverse } from './useIndexUniverse';

function CompanyScreener() {
  const { state, reload } = useIndexUniverse();
  const [search, setSearch] = useState('');
  const [index, setIndex] = useState<IndexCode | ''>('');
  const [pageSize, setPageSize] = useState<string>(defaultPageSize);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>({ column: 'name', direction: 'ascending' });

  if (state.status === 'unavailable') {
    return <CompanyDirectory />;
  }

  if (state.status === 'loading') {
    return (
      <Panel className="screener-loading">
        <p role="status">Carregando companhias…</p>
      </Panel>
    );
  }

  const hasFilters = search !== '' || index !== '' || pageSize !== defaultPageSize;
  const snapshot = state.status === 'ready' ? state.snapshot : undefined;
  const searchKey = normalizeSearch(search);
  const matches = (snapshot?.companies ?? []).filter(
    (company) =>
      (!index || company.indexMemberships.includes(index)) &&
      (!searchKey ||
        normalizeSearch(company.name).includes(searchKey) ||
        company.securities.some(({ ticker }) => ticker.toLowerCase().includes(searchKey))),
  );
  const sorted = orderCompanies(matches, sort);

  function clearFilters() {
    setSearch('');
    setIndex('');
    setPageSize(defaultPageSize);
    setPage(1);
  }

  function sortBy(column: Sort['column']) {
    setSort((current) => ({
      column,
      direction:
        current.column === column && current.direction === 'ascending' ? 'descending' : 'ascending',
    }));
    setPage(1);
  }

  return (
    <>
      {snapshot && <IndexUniverseSource snapshot={snapshot} />}

      <Panel aria-label="Filtros do screener" className="screener-filters">
        <Input
          id="screener-search"
          label="Empresa ou ticker"
          placeholder="Buscar empresa ou ticker"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
        />
        <Select
          id="screener-index"
          label="Índice"
          value={index}
          onChange={(event) => {
            setIndex(event.currentTarget.value as IndexCode | '');
            setPage(1);
          }}
        >
          <option value="">Todos os índices</option>
          {INDEX_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
        <Select
          id="screener-page-size"
          label="Linhas por página"
          value={pageSize}
          onChange={(event) => {
            setPageSize(event.currentTarget.value);
            setPage(1);
          }}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
        <Button disabled={!hasFilters} onClick={clearFilters} variant="quiet">
          Limpar filtros
        </Button>
        {snapshot && (
          <ScreenerExport
            filename="moat-composicao-anual.xlsx"
            filteredCount={sorted.length}
            build={(scope) =>
              compositionReport(
                snapshot,
                scope === 'filtered' ? sorted : orderCompanies(snapshot.companies, sort),
                scope,
                search,
                index,
                sortDescription(sort),
              )
            }
          />
        )}
      </Panel>

      {state.status === 'error' && (
        <EmptyState
          icon="database"
          title="Falha ao carregar a composição"
          description="Houve um problema ao acessar ou validar o arquivo da composição anual."
        >
          <Button onClick={reload}>Tentar novamente</Button>
        </EmptyState>
      )}
      {snapshot && (
        <IndexUniverseResults
          companies={sorted}
          total={snapshot.coverage.includedCompanies}
          pageSize={Number(pageSize)}
          page={page}
          onPageChange={setPage}
          sort={sort}
          onSort={sortBy}
        />
      )}
    </>
  );
}

export function ScreenerPage() {
  const [searchParams] = useSearchParams();
  const showCompanies = searchParams.get('visao') === 'companhias';
  const showDrawdown = !showCompanies && searchParams.get('ranking') === 'drawdown-roic';
  const showFundamentals = !showCompanies && !showDrawdown;

  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Screener e Rankings"
        description="Filtre por fundamentos, compare os resultados e abra o histórico de cada empresa."
      />
      <nav className="screener-views" aria-label="Consultas do screener">
        <ButtonLink
          to="/screener"
          variant={showFundamentals ? 'primary' : 'secondary'}
          aria-current={showFundamentals ? 'page' : undefined}
        >
          Rankings
        </ButtonLink>
        <ButtonLink
          to="/screener?ranking=drawdown-roic"
          variant={showDrawdown ? 'primary' : 'secondary'}
          aria-current={showDrawdown ? 'page' : undefined}
        >
          Drawdown do ROIC
        </ButtonLink>
        <ButtonLink
          to="/screener?visao=companhias"
          variant={showCompanies ? 'primary' : 'secondary'}
          aria-current={showCompanies ? 'page' : undefined}
        >
          Diretório de empresas
        </ButtonLink>
      </nav>
      {showFundamentals && <FundamentalRanking />}
      {showDrawdown && <RoicDrawdownRanking />}
      {showCompanies && <CompanyScreener />}
    </div>
  );
}
