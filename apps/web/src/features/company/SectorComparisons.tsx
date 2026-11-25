import type { RiskFreeRate, SectorComparisonSnapshot } from '@moat/data-contracts';
import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { spreadToRiskFreeRate } from '../../shared/analytics/riskFreeRate';
import { cdiRateUrl } from '../../shared/data-client/riskFreeRate';
import {
  loadSectorComparison,
  sectorComparisonUrl,
} from '../../shared/data-client/sectorComparison';
import { Button, EmptyState, Input, Panel, Select, Table } from '../../shared/ui';
import { ScreenerExport } from '../screener/ScreenerExport';
import { ScreenerToolbar } from '../screener/ScreenerToolbar';
import {
  compareNames,
  defaultPageSize,
  formatCompanyCount,
  normalizeSearch,
  pageSizes,
} from '../screener/presentation';
import { formatPoints, formatRate } from './QualityHistory';
import { formatCurrency, formatDate, formatInstant } from './financialPresentation';
import { sectorComparisonReport } from './sectorComparisonReport';
import {
  buildSectorRows,
  minimumSectorPeers,
  type SectorComparisonRow,
} from './sectorComparisonRows';
import './sector-comparison.css';

const percentileFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const sortLabels = {
  name: 'Nome (A–Z)',
  year: 'ROE do exercício, maior primeiro',
  mean: 'Média de ROE, maior primeiro',
} as const;
type SortOrder = keyof typeof sortLabels;

function compareRates(left: number | null, right: number | null) {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return right - left;
}

function AccountDetails({
  row: { company, current },
  year,
  focusRef,
}: {
  row: SectorComparisonRow;
  year: number;
  focusRef: Ref<HTMLElement>;
}) {
  const { classification } = company;
  const { filing, inputs } = current ?? {};
  return (
    <section
      className="sector-comparison-audit"
      ref={focusRef}
      tabIndex={-1}
      id="sector-comparison-accounts"
      aria-labelledby="sector-comparison-company"
    >
      <h3 id="sector-comparison-company">
        {company.name} · {year}
      </h3>
      {current?.reason && <p>{current.reason}</p>}
      {filing && (
        <p className="company-source-links">
          <a href={filing.filingUrl} target="_blank" rel="noreferrer">
            {inputs ? 'DFP consolidada na CVM' : 'Formulário DFP na CVM'}
          </a>
          <span>
            Data-base em{' '}
            <time dateTime={filing.referenceDate}>{formatDate(filing.referenceDate)}</time> ·
            recebida em <time dateTime={filing.receivedAt}>{formatDate(filing.receivedAt)}</time> ·
            versão {filing.version}
          </span>
          {filing.supportingDocumentUrl && (
            <a href={filing.supportingDocumentUrl} target="_blank" rel="noreferrer">
              Demonstrações IFRS auditadas
            </a>
          )}
        </p>
      )}
      {inputs && (
        <dl className="company-metadata">
          <div>
            <dt>Lucro líquido da controladora</dt>
            <dd>
              {formatCurrency(inputs.netIncomeBrl)} · conta {inputs.incomeStatement}{' '}
              {inputs.incomeCode}
            </dd>
          </div>
          <div>
            <dt>Patrimônio da controladora na abertura</dt>
            <dd>{formatCurrency(inputs.openingEquityBrl)}</dd>
          </div>
          <div>
            <dt>Patrimônio da controladora no fechamento</dt>
            <dd>{formatCurrency(inputs.closingEquityBrl)}</dd>
          </div>
          <div>
            <dt>Contas do patrimônio</dt>
            <dd>{inputs.equityCodes.join(', ')}</dd>
          </div>
        </dl>
      )}
      <p className="company-source-links">
        <a href={classification.filingUrl} target="_blank" rel="noreferrer">
          Formulário Cadastral na CVM
        </a>
        <span>
          {company.sector} · data-base em{' '}
          <time dateTime={classification.referenceDate}>
            {formatDate(classification.referenceDate)}
          </time>{' '}
          · recebido em{' '}
          <time dateTime={classification.receivedAt}>{formatDate(classification.receivedAt)}</time>{' '}
          · versão {classification.version}
        </span>
      </p>
    </section>
  );
}

function ComparisonResults({
  snapshot,
  riskFreeRate,
}: {
  snapshot: SectorComparisonSnapshot;
  riskFreeRate: RiskFreeRate | null;
}) {
  const { manifest } = snapshot;
  const latestYear = manifest.years[manifest.years.length - 1] ?? 0;
  const [year, setYear] = useState(latestYear);
  const [sector, setSector] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<string>(defaultPageSize);
  const [sort, setSort] = useState<SortOrder>('name');
  const [selection, setSelection] = useState('');
  const focusRef = useRef<HTMLElement>(null);
  const rows = useMemo(() => {
    const results = buildSectorRows(snapshot, year);
    if (sort === 'name') return results;
    return results.sort(
      (left, right) =>
        compareRates(
          sort === 'year' ? (left.current?.roe ?? null) : left.mean,
          sort === 'year' ? (right.current?.roe ?? null) : right.mean,
        ) || compareNames(left.company.name, right.company.name),
    );
  }, [snapshot, year, sort]);
  const sectors = [...new Set(snapshot.companies.map((company) => company.sector))].sort(
    compareNames,
  );
  const searchKey = normalizeSearch(search);
  const matches = rows.filter(
    ({ company }) =>
      (!sector || company.sector === sector) && normalizeSearch(company.name).includes(searchKey),
  );
  const rowsPerPage = Number(pageSize);
  const totalPages = Math.ceil(matches.length / rowsPerPage);
  const firstRow = (page - 1) * rowsPerPage;
  const visibleRows = matches.slice(firstRow, firstRow + rowsPerPage);
  const audited = visibleRows.find(({ company }) => company.name === selection);
  const covered = rows.filter(({ current }) => current !== null && current.roe !== null).length;
  const years = `${manifest.years[0]}–${latestYear}`;
  const showCdi = year === latestYear;

  useEffect(() => {
    if (selection) focusRef.current?.focus();
  }, [selection]);

  function showPage(nextPage: number) {
    setPage(nextPage);
    setSelection('');
  }

  return (
    <>
      <p>
        {formatCompanyCount(covered, rows.length)} com ROE em {year}. A média exige cinco exercícios
        completos ({years}). O percentil exige ao menos {minimumSectorPeers} companhias com média
        disponível no mesmo setor cadastral.
      </p>
      {showCdi && (
        <p>
          A diferença usa o ROE de {year} e o CDI atual anualizado do{' '}
          <a href={cdiRateUrl} target="_blank" rel="noreferrer">
            Banco Central do Brasil (SGS 4389)
          </a>
          {riskFreeRate ? (
            <>
              {' · '}
              {formatRate(riskFreeRate.value)} a.a. em{' '}
              <time dateTime={riskFreeRate.provenance.referenceDate}>
                {formatDate(riskFreeRate.provenance.referenceDate)}
              </time>
              .
            </>
          ) : (
            ' · taxa indisponível.'
          )}
        </p>
      )}
      <div className="sector-comparison-filters">
        <Input
          id="sector-comparison-search"
          label="Buscar companhia no comparativo"
          placeholder="Buscar pelo nome"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            showPage(1);
          }}
        />
        <Select
          id="sector-comparison-sector"
          label="Setor de atividade"
          value={sector}
          onChange={(event) => {
            setSector(event.currentTarget.value);
            showPage(1);
          }}
        >
          <option value="">Todos os setores</option>
          {sectors.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <Select
          id="sector-comparison-year"
          label="Exercício comparado"
          value={year}
          onChange={(event) => {
            setYear(Number(event.currentTarget.value));
            if (sort === 'year') showPage(1);
          }}
        >
          {[...manifest.years].reverse().map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <Select
          id="sector-comparison-sort"
          label="Ordenação do comparativo"
          value={sort}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setSort(value === 'year' || value === 'mean' ? value : 'name');
            showPage(1);
          }}
        >
          {Object.entries(sortLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          id="sector-comparison-page-size"
          label="Linhas por página"
          value={pageSize}
          onChange={(event) => {
            setPageSize(event.currentTarget.value);
            showPage(1);
          }}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
        <ScreenerExport
          filename="moat-comparativo-setorial.xlsx"
          filteredCount={matches.length}
          build={(scope) =>
            sectorComparisonReport(
              snapshot,
              scope === 'filtered' ? matches : rows,
              year,
              scope,
              search,
              sector,
              sortLabels[sort],
              riskFreeRate,
            )
          }
        />
      </div>
      {matches.length > 0 ? (
        <>
          <ScreenerToolbar
            count={formatCompanyCount(matches.length, rows.length)}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={showPage}
            paginationLabel="Paginação do comparativo"
          />
          <div
            className="company-table-scroll"
            role="region"
            aria-label="Resultados do comparativo setorial"
            tabIndex={0}
          >
            <Table
              className="sector-comparison-table company-history-table"
              aria-label="Comparativo de ROE por setor"
            >
              <thead>
                <tr>
                  <th scope="col">Companhia</th>
                  <th scope="col">ROE de {year}</th>
                  {showCdi && <th scope="col">Diferença para o CDI atual</th>}
                  <th scope="col">Média de ROE em {years}</th>
                  <th scope="col">Percentil no setor</th>
                  <th scope="col">Contas</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const { company, current, mean, percentile, peers, validYears } = row;
                  const expanded = selection === company.name;
                  return (
                    <tr key={company.name}>
                      <th scope="row">
                        {company.name}
                        <small>{company.sector}</small>
                      </th>
                      <td>{formatRate(current?.roe ?? null)}</td>
                      {showCdi && (
                        <td>
                          {formatPoints(
                            spreadToRiskFreeRate(current?.roe ?? null, riskFreeRate),
                            true,
                          )}
                        </td>
                      )}
                      <td>
                        {formatRate(mean)}
                        <small>
                          {validYears} de {manifest.years.length} exercícios
                        </small>
                      </td>
                      <td>
                        {percentile === null ? 'Indisponível' : percentileFormat.format(percentile)}
                        <small>{peers} no setor com cinco exercícios</small>
                      </td>
                      <td>
                        <Button
                          variant="quiet"
                          aria-label={`Conferir contas de ${company.name}`}
                          aria-expanded={expanded}
                          aria-controls={expanded ? 'sector-comparison-accounts' : undefined}
                          onClick={() => setSelection(expanded ? '' : company.name)}
                        >
                          {expanded ? 'Ocultar' : 'Conferir'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </>
      ) : (
        <EmptyState
          icon="search"
          title="Nenhuma companhia encontrada"
          description="Ajuste a busca ou o setor."
        />
      )}
      {audited && <AccountDetails row={audited} year={year} focusRef={focusRef} />}
      <p>
        Seleção de <time dateTime={manifest.asOf}>{formatDate(manifest.asOf)}</time> · lote gerado
        em <time dateTime={manifest.generatedAt}>{formatInstant(manifest.generatedAt)}</time>.
      </p>
      <p className="company-source-links">
        <a href={manifest.source.datasetUrl} target="_blank" rel="noreferrer">
          Catálogo de DFP da CVM
        </a>
        <a href={manifest.sectorSource.datasetUrl} target="_blank" rel="noreferrer">
          Catálogo de FCA da CVM
        </a>
        <a href={manifest.source.licenseUrl} target="_blank" rel="noreferrer">
          {manifest.source.license}
        </a>
        <a href={sectorComparisonUrl} download="cvm-sector-comparison.json">
          Baixar comparativo setorial em JSON
        </a>
      </p>
    </>
  );
}

type ComparisonState =
  { status: 'loading' | 'error' } | { status: 'ready'; snapshot: SectorComparisonSnapshot };

export function SectorComparisons({ riskFreeRate }: { riskFreeRate: RiskFreeRate | null }) {
  const [state, setState] = useState<ComparisonState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadSectorComparison(signal).then(
      (snapshot) => {
        if (!signal.aborted) setState({ status: 'ready', snapshot });
      },
      () => {
        if (!signal.aborted) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  return (
    <Panel
      className="company-panel sector-comparison-panel"
      aria-labelledby="sector-comparison-heading"
    >
      <div>
        <h2 id="sector-comparison-heading">Comparativos por setor</h2>
        <p>
          O ROE mede o lucro líquido atribuível à controladora sobre seu patrimônio médio na DFP
          consolidada. Os setores vêm do Formulário Cadastral da CVM.
        </p>
      </div>
      {state.status === 'loading' && <p role="status">Carregando o comparativo setorial…</p>}
      {state.status === 'error' && (
        <>
          <p role="status">Falha ao carregar o comparativo setorial da CVM.</p>
          <Button
            className="company-inline-action"
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((previous) => previous + 1);
            }}
          >
            Recarregar comparativo
          </Button>
        </>
      )}
      {state.status === 'ready' && (
        <ComparisonResults snapshot={state.snapshot} riskFreeRate={riskFreeRate} />
      )}
    </Panel>
  );
}
