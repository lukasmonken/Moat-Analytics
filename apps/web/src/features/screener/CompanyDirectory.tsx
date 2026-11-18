import type { CompanyDirectorySnapshot } from '@moat/data-contracts';
import { useEffect, useState } from 'react';
import {
  companyDirectoryUrl,
  loadCompanyDirectory,
} from '../../shared/data-client/companyDirectory';
import { Button, EmptyState, Input, Panel, Select, Table } from '../../shared/ui';
import {
  compareNames,
  defaultPageSize,
  formatCompanyCount,
  formatDate,
  normalizeSearch,
  pageSizes,
} from './presentation';
import { ScreenerToolbar } from './ScreenerToolbar';

type DirectoryState =
  { status: 'loading' | 'error' } | { status: 'ready'; snapshot: CompanyDirectorySnapshot };

function DirectorySource({ snapshot }: { snapshot: CompanyDirectorySnapshot }) {
  return (
    <Panel className="screener-source" aria-labelledby="company-directory-title">
      <h2 id="company-directory-title">Diretório de companhias</h2>
      <dl>
        <div>
          <dt>Data-base</dt>
          <dd>
            <time dateTime={snapshot.asOf}>{formatDate(snapshot.asOf)}</time>
          </dd>
        </div>
        <div>
          <dt>Fonte</dt>
          <dd>
            <a href={snapshot.source.datasetUrl}>Cadastro de companhias abertas da CVM</a>
          </dd>
        </div>
        <div>
          <dt>Licença</dt>
          <dd>
            <a href={snapshot.source.licenseUrl}>{snapshot.source.license}</a>
          </dd>
        </div>
        <div>
          <dt>Arquivo</dt>
          <dd>
            <a href={companyDirectoryUrl} download="cvm-company-selection.json">
              Baixar lista de nomes
            </a>
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

function DirectoryTable({ snapshot }: { snapshot: CompanyDirectorySnapshot }) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<string>(defaultPageSize);
  const [page, setPage] = useState(1);
  const searchKey = normalizeSearch(search);
  const matches = snapshot.companies
    .filter((name) => !searchKey || normalizeSearch(name).includes(searchKey))
    .sort(compareNames);
  const rowsPerPage = Number(pageSize);
  const totalPages = Math.ceil(matches.length / rowsPerPage);
  const first = (page - 1) * rowsPerPage;
  const count = formatCompanyCount(matches.length, snapshot.companies.length);

  return (
    <>
      <DirectorySource snapshot={snapshot} />
      <Panel
        aria-label="Filtros do diretório"
        className="screener-filters screener-directory-filters"
      >
        <Input
          id="directory-search"
          label="Companhia"
          placeholder="Buscar pelo nome"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
        />
        <Select
          id="directory-page-size"
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
        <Button
          disabled={!search && pageSize === defaultPageSize}
          onClick={() => {
            setSearch('');
            setPageSize(defaultPageSize);
            setPage(1);
          }}
          variant="quiet"
        >
          Limpar filtros
        </Button>
      </Panel>
      {matches.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nenhuma companhia encontrada"
          description={`${count}. Ajuste a pesquisa pelo nome.`}
        />
      ) : (
        <Panel className="screener-results">
          <ScreenerToolbar
            count={count}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            paginationLabel="Paginação do diretório"
          />
          <Table aria-label="Companhias selecionadas" className="screener-directory-table">
            <thead>
              <tr>
                <th scope="col">Companhia</th>
              </tr>
            </thead>
            <tbody>
              {matches.slice(first, first + rowsPerPage).map((name) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </>
  );
}

export function CompanyDirectory() {
  const [state, setState] = useState<DirectoryState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadCompanyDirectory(signal).then(
      (snapshot) => {
        if (!signal.aborted) setState({ status: 'ready', snapshot });
      },
      () => {
        if (!signal.aborted) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  if (state.status === 'ready') return <DirectoryTable snapshot={state.snapshot} />;
  if (state.status === 'error') {
    return (
      <EmptyState
        icon="database"
        title="Falha ao carregar o diretório"
        description="Houve um problema ao acessar os nomes das companhias."
      >
        <Button
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((last) => last + 1);
          }}
        >
          Tentar novamente
        </Button>
      </EmptyState>
    );
  }
  return (
    <Panel className="screener-loading">
      <p role="status">Carregando diretório…</p>
    </Panel>
  );
}
