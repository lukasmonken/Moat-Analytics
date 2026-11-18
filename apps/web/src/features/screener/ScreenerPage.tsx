import { INDEX_CODES, type IndexCode } from '@moat/data-contracts';
import { useState } from 'react';
import { Button, ButtonLink, EmptyState, Input, PageHeader, Panel, Select } from '../../shared/ui';
import {
  IndexUniverseResults,
  IndexUniverseSource,
  orderCompanies,
  type Sort,
} from './IndexUniverseResults';
import './screener.css';
import { useIndexUniverse } from './useIndexUniverse';

const pageSizes = ['5', '10', '20', '30', '40', '50'] as const;
const defaultPageSize = '10';

function normalizeSearch(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function ScreenerPage() {
  const { state, reload } = useIndexUniverse();
  const [search, setSearch] = useState('');
  const [index, setIndex] = useState<IndexCode | ''>('');
  const [pageSize, setPageSize] = useState<string>(defaultPageSize);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>({ column: 'name', direction: 'ascending' });
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
    <div className="feature-page module-page">
      <PageHeader
        title="Screener e Rankings"
        description="Consulte as companhias da composição anual do IBOV, SMLL e IDIV."
      />

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
      </Panel>

      {state.status === 'loading' && (
        <Panel className="screener-loading">
          <p role="status">Carregando composição anual…</p>
        </Panel>
      )}
      {state.status === 'error' && (
        <EmptyState
          icon="database"
          title="Falha ao carregar a composição"
          description="Houve um problema ao acessar ou validar o arquivo da composição anual."
        >
          <Button onClick={reload}>Tentar novamente</Button>
        </EmptyState>
      )}
      {state.status === 'unavailable' && (
        <EmptyState
          icon="database"
          title="Universo B3 indisponível"
          description="A composição anual de IBOV, SMLL e IDIV aguarda uma fonte autorizada. O histórico contábil da amostra já pode ser consultado em Empresas."
        >
          <ButtonLink to="/empresas">Consultar a amostra da CVM</ButtonLink>
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
    </div>
  );
}
