import { useEffect, useMemo, useState } from 'react';
import { spreadToRiskFreeRate } from '../../shared/analytics/riskFreeRate';
import { cdiRateUrl } from '../../shared/data-client/riskFreeRate';
import { loadSectorComparison } from '../../shared/data-client/sectorComparison';
import { loadSectorRoicComparison } from '../../shared/data-client/sectorRoicComparison';
import type { RiskFreeRateState } from '../../shared/data-client/useRiskFreeRate';
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
import { CompanyCalculation, calculationId } from './CompanyQualityCalculation';
import {
  annualObservation,
  annualRate,
  combineSnapshots,
  orderByAnnualReturn,
  type Company,
  type ComparisonData,
} from './companyQualityData';
import { comparisonReport } from './companyQualityReport';
import { formatPoints, formatRate } from './QualityHistory';
import { formatDate } from './financialPresentation';
import './sector-comparison.css';

type LoadState = { status: 'loading' | 'error' } | { status: 'ready'; data: ComparisonData };

function CdiReference({ state, reload }: { state: RiskFreeRateState; reload: () => void }) {
  return (
    <p className="company-source-links">
      <span role="status">
        {state.status === 'ready' ? (
          <>
            CDI atual <strong>{formatRate(state.rate.value)} a.a.</strong> ·{' '}
            <time dateTime={state.rate.provenance.referenceDate}>
              {formatDate(state.rate.provenance.referenceDate)}
            </time>
          </>
        ) : state.status === 'loading' ? (
          'Consultando o CDI atual…'
        ) : (
          'CDI atual indisponível.'
        )}
      </span>
      <a href={cdiRateUrl} target="_blank" rel="noreferrer">
        Banco Central do Brasil · SGS 4389
      </a>
      {(state.status === 'error' || state.status === 'unavailable') && (
        <Button variant="quiet" onClick={reload}>
          Atualizar CDI
        </Button>
      )}
    </p>
  );
}

function CompareHistory({ companies, years }: { companies: Company[]; years: number[] }) {
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const first = companies.find(({ name }) => name === firstName);
  const peers = first
    ? companies.filter(({ name, metric }) => name !== first.name && metric === first.metric)
    : [];
  const second = peers.find(({ name }) => name === secondName);

  return (
    <details className="company-observation">
      <summary>Comparar histórico</summary>
      <div className="company-observation-body">
        <div className="sector-comparison-filters">
          <Select
            id="company-quality-first"
            label="Primeira empresa"
            value={firstName}
            onChange={(event) => {
              setFirstName(event.currentTarget.value);
              setSecondName('');
            }}
          >
            <option value="">Selecione uma empresa</option>
            {(['ROE', 'ROIC'] as const).map((metric) => (
              <optgroup key={metric} label={metric}>
                {companies
                  .filter((company) => company.metric === metric)
                  .map(({ name }) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
          <Select
            id="company-quality-second"
            label="Segunda empresa"
            value={secondName}
            disabled={!first}
            onChange={(event) => setSecondName(event.currentTarget.value)}
          >
            <option value="">Selecione outra empresa com o mesmo indicador</option>
            {peers.map(({ name }) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        {first && second && (
          <div
            className="company-table-scroll"
            role="region"
            aria-label="Comparação dos históricos"
            tabIndex={0}
          >
            <Table className="company-history-table" aria-label={`Histórico de ${first.metric}`}>
              <thead>
                <tr>
                  <th scope="col">Exercício</th>
                  <th scope="col">{first.name}</th>
                  <th scope="col">{second.name}</th>
                </tr>
              </thead>
              <tbody>
                {years.map((year) => (
                  <tr key={year}>
                    <th scope="row">{year}</th>
                    <td>{formatRate(annualRate(annualObservation(first, year)))}</td>
                    <td>{formatRate(annualRate(annualObservation(second, year)))}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </details>
  );
}

function ComparisonResults({
  data,
  rateState,
  reloadRate,
}: {
  data: ComparisonData;
  rateState: RiskFreeRateState;
  reloadRate: () => void;
}) {
  const { companies, roe, roic } = data;
  const latestYear = roe.years.at(-1) ?? 0;
  const [year, setYear] = useState(latestYear);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [metric, setMetric] = useState<Company['metric'] | ''>('');
  const [order, setOrder] = useState<'name' | 'return'>('name');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<string>(defaultPageSize);
  const [selectedName, setSelectedName] = useState('');
  const sectors = useMemo(
    () => [...new Set(companies.map((company) => company.sector))].sort(compareNames),
    [companies],
  );
  const rate = rateState.status === 'ready' ? rateState.rate : null;
  const showCdi = year === latestYear;
  const orderByReturn = metric !== '' && order === 'return';
  const searchKey = normalizeSearch(search);
  const filtered = companies.filter(
    (company) =>
      (!sector || company.sector === sector) &&
      (!metric || company.metric === metric) &&
      normalizeSearch(company.name).includes(searchKey),
  );
  const matches = orderByReturn ? orderByAnnualReturn(filtered, year) : filtered;
  const rowsPerPage = Number(pageSize);
  const offset = (page - 1) * rowsPerPage;
  const visible = matches.slice(offset, offset + rowsPerPage);
  const audited = visible.find(({ name }) => name === selectedName);

  function showPage(nextPage: number) {
    setPage(nextPage);
    setSelectedName('');
  }

  return (
    <>
      {showCdi && <CdiReference state={rateState} reload={reloadRate} />}
      <div className="sector-comparison-filters">
        <Input
          id="company-quality-search"
          label="Buscar empresa"
          placeholder="Nome da empresa"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            showPage(1);
          }}
        />
        <Select
          id="company-quality-sector"
          label="Setor"
          value={sector}
          onChange={(event) => {
            setSector(event.currentTarget.value);
            showPage(1);
          }}
        >
          <option value="">Todos os setores</option>
          {sectors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select
          id="company-quality-metric"
          label="Indicador"
          value={metric}
          onChange={(event) => {
            const value = event.currentTarget.value;
            const nextMetric = value === 'ROE' || value === 'ROIC' ? value : '';
            setMetric(nextMetric);
            if (!nextMetric) setOrder('name');
            showPage(1);
          }}
        >
          <option value="">ROE e ROIC</option>
          <option value="ROE">ROE</option>
          <option value="ROIC">ROIC</option>
        </Select>
        <Select
          id="company-quality-year"
          label="Exercício"
          value={year}
          onChange={(event) => {
            setYear(Number(event.currentTarget.value));
            if (orderByReturn) showPage(1);
          }}
        >
          {[...roe.years].reverse().map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>
        <Select
          id="company-quality-order"
          label="Ordenação"
          value={order}
          onChange={(event) => {
            setOrder(event.currentTarget.value === 'return' ? 'return' : 'name');
            showPage(1);
          }}
        >
          <option value="name">Nome (A–Z)</option>
          <option value="return" disabled={!metric}>
            {metric ? 'Maior retorno' : 'Maior retorno (selecione ROE ou ROIC)'}
          </option>
        </Select>
        <Select
          id="company-quality-page-size"
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
          filename="moat-comparativo-empresas.xlsx"
          filteredCount={matches.length}
          build={(scope) =>
            comparisonReport(
              data,
              scope === 'filtered' ? matches : companies,
              year,
              latestYear,
              rate,
              {
                metric: scope === 'filtered' ? metric : '',
                order: scope === 'filtered' && orderByReturn ? 'return' : 'name',
              },
            )
          }
        />
      </div>
      {matches.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nenhuma empresa encontrada"
          description="Ajuste a busca ou os filtros."
        />
      ) : (
        <>
          <ScreenerToolbar
            count={formatCompanyCount(matches.length, companies.length)}
            currentPage={page}
            totalPages={Math.ceil(matches.length / rowsPerPage)}
            onPageChange={showPage}
            paginationLabel="Paginação das empresas"
          />
          <div
            className="company-table-scroll"
            role="region"
            aria-label="Resultados das empresas"
            tabIndex={0}
          >
            <Table
              className="sector-comparison-table company-history-table"
              aria-label="Indicadores das empresas"
            >
              <thead>
                <tr>
                  <th scope="col" aria-sort={orderByReturn ? undefined : 'ascending'}>
                    Empresa
                  </th>
                  <th scope="col">Indicador</th>
                  <th scope="col" aria-sort={orderByReturn ? 'descending' : undefined}>
                    Retorno em {year}
                  </th>
                  {showCdi && <th scope="col">Diferença para o CDI atual</th>}
                  <th scope="col">Cálculo</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((company) => {
                  const value = annualRate(annualObservation(company, year));
                  const expanded = selectedName === company.name;
                  return (
                    <tr key={company.name}>
                      <th scope="row">
                        {company.name}
                        <small>{company.sector}</small>
                      </th>
                      <td>{company.metric}</td>
                      <td>{formatRate(value)}</td>
                      {showCdi && <td>{formatPoints(spreadToRiskFreeRate(value, rate), true)}</td>}
                      <td>
                        <Button
                          variant="quiet"
                          aria-label={`Ver cálculo de ${company.name}`}
                          aria-expanded={expanded}
                          aria-controls={expanded ? calculationId : undefined}
                          onClick={() => setSelectedName(expanded ? '' : company.name)}
                        >
                          {expanded ? 'Ocultar' : 'Ver cálculo'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </>
      )}
      {audited && <CompanyCalculation company={audited} year={year} taxRate={roic.taxRate} />}
      <CompareHistory companies={companies} years={roe.years} />
      <p className="company-source-links">
        <span>
          Seleção de <time dateTime={roe.asOf}>{formatDate(roe.asOf)}</time>
        </span>
        <a href={roe.source.datasetUrl} target="_blank" rel="noreferrer">
          Demonstrativos da CVM
        </a>
        <a href={roe.sectorSource.datasetUrl} target="_blank" rel="noreferrer">
          Setores da CVM
        </a>
        <a href={roe.source.licenseUrl} target="_blank" rel="noreferrer">
          {roe.source.license}
        </a>
      </p>
    </>
  );
}

export function CompanyQualityComparison({
  rateState,
  reloadRate,
}: {
  rateState: RiskFreeRateState;
  reloadRate: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void Promise.all([loadSectorComparison(signal), loadSectorRoicComparison(signal)])
      .then(([roe, roic]) => {
        if (!signal.aborted) setState({ status: 'ready', data: combineSnapshots(roe, roic) });
      })
      .catch(() => {
        if (!signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <Panel
      className="company-panel sector-comparison-panel"
      aria-labelledby="company-quality-heading"
    >
      <div>
        <h2 id="company-quality-heading">Comparar empresas</h2>
        <p>ROE para bancos e seguradoras. ROIC estimado para as demais empresas.</p>
      </div>
      {state.status === 'loading' && <p role="status">Carregando indicadores da CVM…</p>}
      {state.status === 'error' && (
        <EmptyState
          icon="company"
          title="Indicadores indisponíveis"
          description="Houve um problema ao carregar o comparativo da CVM."
        >
          <Button
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((current) => current + 1);
            }}
          >
            Recarregar indicadores
          </Button>
        </EmptyState>
      )}
      {state.status === 'ready' && (
        <ComparisonResults data={state.data} rateState={rateState} reloadRate={reloadRate} />
      )}
    </Panel>
  );
}
