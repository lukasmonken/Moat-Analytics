import type {
  MarketYieldsSnapshot,
  SectorLeverageSnapshot,
  SectorMarginsSnapshot,
  SectorReinvestmentSnapshot,
} from '@moat/data-contracts';
import { useEffect, useMemo, useState } from 'react';
import { formatRatio, parseRatioLimit } from '../../shared/analytics/ratios';
import { spreadToRiskFreeRate } from '../../shared/analytics/riskFreeRate';
import { loadLocalMarketYields } from '../../shared/data-client/marketYields';
import { cdiRateUrl } from '../../shared/data-client/riskFreeRate';
import { loadSectorComparison } from '../../shared/data-client/sectorComparison';
import { loadSectorLeverage } from '../../shared/data-client/sectorLeverage';
import { loadSectorMargins } from '../../shared/data-client/sectorMargins';
import { loadSectorReinvestment } from '../../shared/data-client/sectorReinvestment';
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
  comparisonSector,
  orderByAnnualReturn,
  type Company,
  type ComparisonData,
} from './companyQualityData';
import { comparisonReport } from './companyQualityReport';
import { formatPoints, formatRate } from './QualityHistory';
import { formatCurrency, formatDate } from './financialPresentation';
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

function RatioLimitField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const invalid = value.trim() !== '' && parseRatioLimit(value) === null;
  return (
    <div>
      <Input
        id={id}
        label={label}
        value={value}
        placeholder="Sem limite"
        inputMode="decimal"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {invalid && <small id={`${id}-error`}>Informe um número, como 2,5.</small>}
    </div>
  );
}

function ComparisonResults({
  data,
  rateState,
  reloadRate,
  marketYields,
  leverage,
  reinvestment,
  margins,
}: {
  data: ComparisonData;
  marketYields: MarketYieldsSnapshot | null;
  leverage: SectorLeverageSnapshot | null;
  reinvestment: SectorReinvestmentSnapshot | null;
  margins: SectorMarginsSnapshot | null;
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
  const [maxLeverage, setMaxLeverage] = useState('');
  const [minReinvestment, setMinReinvestment] = useState('');
  const sectors = useMemo(
    () => [...new Set(companies.map(comparisonSector))].sort(compareNames),
    [companies],
  );
  const rate = rateState.status === 'ready' ? rateState.rate : null;
  const showCdi = year === latestYear;
  const yieldSnapshot = showCdi && marketYields?.selectionAsOf === roe.asOf ? marketYields : null;
  const yieldsByName = useMemo(
    () => new Map(yieldSnapshot?.companies.map(({ name, valuation }) => [name, valuation])),
    [yieldSnapshot],
  );
  const leverageSnapshot =
    showCdi && leverage?.manifest.asOf === roic.asOf && leverage.manifest.year === year
      ? leverage
      : null;
  const leverageByName = useMemo(
    () => new Map(leverageSnapshot?.companies.map((company) => [company.name, company])),
    [leverageSnapshot],
  );
  const reinvestmentSnapshot =
    showCdi && reinvestment?.manifest.asOf === roic.asOf && reinvestment.manifest.year === year
      ? reinvestment
      : null;
  const reinvestmentByName = useMemo(
    () => new Map(reinvestmentSnapshot?.companies.map((company) => [company.name, company])),
    [reinvestmentSnapshot],
  );
  const showLeverageFilter = leverageSnapshot !== null && metric !== 'ROE';
  const showReinvestmentFilter = reinvestmentSnapshot !== null && metric !== 'ROE';
  const leverageLimit = showLeverageFilter ? parseRatioLimit(maxLeverage) : null;
  const reinvestmentLimit = showReinvestmentFilter ? parseRatioLimit(minReinvestment) : null;
  const orderByReturn = metric !== '' && order === 'return';
  const searchKey = normalizeSearch(search);
  const filtered = companies.filter((company) => {
    if (
      (sector && comparisonSector(company) !== sector) ||
      (metric && company.metric !== metric) ||
      !normalizeSearch(company.name).includes(searchKey)
    ) {
      return false;
    }
    if (leverageLimit === null && reinvestmentLimit === null) return true;
    if (company.metric !== 'ROIC') return false;
    const leverageValue = leverageByName.get(company.name)?.value;
    const reinvestmentValue = reinvestmentByName.get(company.name)?.value;
    return (
      (leverageLimit === null || (leverageValue != null && leverageValue <= leverageLimit)) &&
      (reinvestmentLimit === null ||
        (reinvestmentValue != null && reinvestmentValue >= reinvestmentLimit))
    );
  });
  const hasRoic = filtered.some((company) => company.metric === 'ROIC');
  const showLeverage = showLeverageFilter && hasRoic;
  const showReinvestment = showReinvestmentFilter && hasRoic;
  const firstMetric = filtered[0]?.metric;
  const metricLabel =
    firstMetric && filtered.every((company) => company.metric === firstMetric)
      ? firstMetric
      : 'ROIC ou ROE';
  const matches = orderByReturn ? orderByAnnualReturn(filtered, year) : filtered;
  const rowsPerPage = Number(pageSize);
  const offset = (page - 1) * rowsPerPage;
  const visible = matches.slice(offset, offset + rowsPerPage);
  const audited = visible.find(({ name }) => name === selectedName);
  const companyMargins =
    audited?.metric === 'ROIC' &&
    margins?.manifest.year === year &&
    margins.manifest.asOf === roe.asOf
      ? margins.companies.find(({ name }) => name === audited.name)
      : undefined;

  function showPage(nextPage: number) {
    setPage(nextPage);
    setSelectedName('');
  }

  return (
    <>
      {showCdi && <CdiReference state={rateState} reload={reloadRate} />}
      {yieldSnapshot && (
        <p className="company-source-links">
          <span>
            Valor de mercado no pregão de{' '}
            <time dateTime={yieldSnapshot.tradeDate}>{formatDate(yieldSnapshot.tradeDate)}</time>
          </span>
        </p>
      )}
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
            showPage(1);
          }}
        >
          {[...roe.years].reverse().map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>
        {showLeverageFilter && (
          <RatioLimitField
            id="company-quality-max-leverage"
            label="Dívida líquida/EBITDA máxima"
            value={maxLeverage}
            onChange={(next) => {
              setMaxLeverage(next);
              showPage(1);
            }}
          />
        )}
        {showReinvestmentFilter && (
          <RatioLimitField
            id="company-quality-min-reinvestment"
            label="NOPAT/reinvestimento mínimo"
            value={minReinvestment}
            onChange={(next) => {
              setMinReinvestment(next);
              showPage(1);
            }}
          />
        )}
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
                    {metricLabel} em {year}
                  </th>
                  {showCdi && <th scope="col">Diferença para o CDI atual</th>}
                  {showLeverage && <th scope="col">Dívida líquida/EBITDA</th>}
                  {showReinvestment && <th scope="col">NOPAT/reinvestimento</th>}
                  {yieldSnapshot && <th scope="col">Rendimento implícito</th>}
                  <th scope="col">Cálculo</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((company) => {
                  const value = annualRate(annualObservation(company, year));
                  const expanded = selectedName === company.name;
                  const marketYield = yieldsByName.get(company.name);
                  const leverageRow =
                    company.metric === 'ROIC' ? leverageByName.get(company.name) : undefined;
                  const reinvestmentRow =
                    company.metric === 'ROIC' ? reinvestmentByName.get(company.name) : undefined;
                  return (
                    <tr key={company.name}>
                      <th scope="row">
                        {company.name}
                        <small>{comparisonSector(company)}</small>
                      </th>
                      <td>{company.metric}</td>
                      <td>{formatRate(value)}</td>
                      {showCdi && <td>{formatPoints(spreadToRiskFreeRate(value, rate), true)}</td>}
                      {showLeverage && (
                        <td title={leverageRow?.reason ?? undefined}>
                          {company.metric === 'ROIC'
                            ? formatRatio(leverageRow?.value ?? null)
                            : '—'}
                        </td>
                      )}
                      {showReinvestment && (
                        <td title={reinvestmentRow?.reason ?? undefined}>
                          {company.metric === 'ROIC'
                            ? formatRatio(reinvestmentRow?.value ?? null)
                            : '—'}
                          {reinvestmentRow?.inputs && (
                            <>
                              <small>
                                Reinvestimento{' '}
                                {formatCurrency(reinvestmentRow.inputs.reinvestmentBrl)}
                              </small>
                              {reinvestmentRow.value === null && (
                                <small>{reinvestmentRow.reason}</small>
                              )}
                            </>
                          )}
                        </td>
                      )}
                      {yieldSnapshot && (
                        <td title={marketYield?.reason ?? undefined}>
                          {marketYield?.value != null && marketYield.accounting ? (
                            <>
                              {formatRate(marketYield.value)}
                              <small>
                                {marketYield.metric === 'operatingYield'
                                  ? 'NOPAT/EV'
                                  : 'Earnings yield'}
                                {' · '}
                                {marketYield.accounting.referenceDate.slice(0, 4)}
                              </small>
                            </>
                          ) : (
                            'Indisponível'
                          )}
                        </td>
                      )}
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
      {audited && (
        <CompanyCalculation
          company={audited}
          year={year}
          taxRate={roic.taxRate}
          margins={companyMargins}
        />
      )}
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
  const [marketYields, setMarketYields] = useState<MarketYieldsSnapshot | null>(null);
  const [leverage, setLeverage] = useState<SectorLeverageSnapshot | null>(null);
  const [reinvestment, setReinvestment] = useState<SectorReinvestmentSnapshot | null>(null);
  const [margins, setMargins] = useState<SectorMarginsSnapshot | null>(null);
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
    void loadSectorLeverage(signal)
      .then((snapshot) => {
        if (!signal.aborted) setLeverage(snapshot);
      })
      .catch(() => {
        if (!signal.aborted) setLeverage(null);
      });
    void loadSectorReinvestment(signal)
      .then((snapshot) => {
        if (!signal.aborted) setReinvestment(snapshot);
      })
      .catch(() => {
        if (!signal.aborted) setReinvestment(null);
      });
    void loadSectorMargins(signal).then(
      (snapshot) => {
        if (!signal.aborted) setMargins(snapshot);
      },
      () => {
        if (!signal.aborted) setMargins(null);
      },
    );
    if (import.meta.env.DEV) {
      void loadLocalMarketYields(signal)
        .then((snapshot) => {
          if (!signal.aborted) setMarketYields(snapshot);
        })
        .catch(() => {
          if (!signal.aborted) setMarketYields(null);
        });
    }
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
        <ComparisonResults
          data={state.data}
          rateState={rateState}
          reloadRate={reloadRate}
          marketYields={marketYields}
          leverage={leverage}
          reinvestment={reinvestment}
          margins={margins}
        />
      )}
    </Panel>
  );
}
