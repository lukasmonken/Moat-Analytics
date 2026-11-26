import { useEffect, useRef, useState } from 'react';
import { matchesRatioRange, type RatioRange } from '../../shared/analytics/ratios';
import { loadLocalMarketYields } from '../../shared/data-client/marketYields';
import { loadSectorComparison } from '../../shared/data-client/sectorComparison';
import { loadSectorLeverage } from '../../shared/data-client/sectorLeverage';
import { loadSectorReinvestment } from '../../shared/data-client/sectorReinvestment';
import { loadSectorRoicComparison } from '../../shared/data-client/sectorRoicComparison';
import { Button, EmptyState, Input, Panel, RatioRangeSelect, Select, Table } from '../../shared/ui';
import { combineSnapshots } from '../company/companyQualityData';
import { formatCurrency } from '../company/financialPresentation';
import { ScreenerToolbar } from '../screener/ScreenerToolbar';
import {
  compareNames,
  defaultPageSize,
  formatCompanyCount,
  normalizeSearch,
} from '../screener/presentation';
import { FundamentalComparison } from './FundamentalComparison';
import { GrowthDetail } from './GrowthDetail';
import { RankingDataFilters } from './RankingDataFilters';
import {
  availableFactorCount,
  buildFundamentalRanks,
  orderFundamentalRanks,
  signedDirection,
  type FundamentalFactor,
  type FundamentalRow,
} from './fundamentalRanks';
import {
  formatRankingScore,
  formatRankingValue,
  rankingFactorLabels as labels,
} from './rankingPresentation';
import './ranking.css';

const factors = Object.keys(labels) as FundamentalFactor[];

const growthDetailId = 'ranking-growth-detail';

type RankingData = ReturnType<typeof buildFundamentalRanks>;
type LoadState = { status: 'loading' | 'error' } | { status: 'ready'; data: RankingData };

function RankingShortcuts({
  rows,
  current,
  onSelect,
  hasPrice,
}: {
  rows: FundamentalRow[];
  current: FundamentalFactor;
  onSelect: (factor: FundamentalFactor) => void;
  hasPrice: boolean;
}) {
  const isRoic = rows[0]?.metric === 'ROIC';
  const views: FundamentalFactor[] = isRoic
    ? [rows.some(({ score }) => score !== null) ? 'score' : 'accountingScore', 'growth', 'risk']
    : ['profitability', 'growth', ...(hasPrice ? (['price'] as const) : [])];
  return (
    <div className="ranking-shortcuts" role="group" aria-label="Destaques dos rankings">
      {views.map((factor) => {
        const available = rows.filter((row) => row[factor] !== null);
        const leader = orderFundamentalRanks(available, factor).at(0);
        return (
          <button
            key={factor}
            type="button"
            className="ranking-shortcut"
            aria-pressed={current === factor}
            onClick={() => onSelect(factor)}
          >
            <span className="ranking-shortcut__label">
              {factor === 'risk' ? 'Menor drawdown do ROIC' : labels[factor]}
            </span>
            {leader && (
              <>
                <strong>{formatRankingValue(leader, factor)}</strong>
                <span className="ranking-shortcut__leader">{leader.name}</span>
              </>
            )}
            <small>{formatCompanyCount(available.length, rows.length)} com dados</small>
          </button>
        );
      })}
    </div>
  );
}

function RankingResults({ data }: { data: RankingData }) {
  const [group, setGroup] = useState<FundamentalRow['metric']>('ROIC');
  const [selectedFactor, setSelectedFactor] = useState<FundamentalFactor>(
    data.rows.some(({ metric, score }) => metric === 'ROIC' && score !== null)
      ? 'score'
      : 'accountingScore',
  );
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [leverageRange, setLeverageRange] = useState<RatioRange>('all');
  const [reinvestmentRange, setReinvestmentRange] = useState<RatioRange>('all');
  const [requireHistory, setRequireHistory] = useState(false);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const growthTrigger = useRef<HTMLButtonElement>(null);
  const isRoic = group === 'ROIC';
  const validFactors = isRoic ? factors : (['profitability', 'growth', 'price', 'score'] as const);
  const factor = validFactors.some((candidate) => candidate === selectedFactor)
    ? selectedFactor
    : 'profitability';
  const criterion = labels[factor];
  const { rows, years, marketTradeDate } = data;
  const aggregate = factor === 'score' || factor === 'accountingScore';
  const includePrice =
    factor === 'score' ||
    factor === 'price' ||
    (factor !== 'accountingScore' && marketTradeDate !== null);
  const groupRows = rows.filter((row) => row.metric === group);
  const sectorOptions = [...new Set(groupRows.map((row) => row.sector))].sort(compareNames);
  const requiredFactors = (isRoic ? 5 : 2) + (includePrice ? 1 : 0);
  const scoreSampleSize = groupRows.filter((row) => row[factor] !== null).length;
  const query = normalizeSearch(search);
  const hasFilters = Boolean(
    query ||
    sector ||
    requireHistory ||
    hideUnavailable ||
    (isRoic && (leverageRange !== 'all' || reinvestmentRange !== 'all')),
  );

  const matches = orderFundamentalRanks(
    groupRows.filter(
      (row) =>
        (!sector || row.sector === sector) &&
        normalizeSearch(row.name).includes(query) &&
        (!isRoic ||
          (matchesRatioRange(row.leverage, leverageRange) &&
            matchesRatioRange(row.moat, reinvestmentRange))) &&
        (!requireHistory || row.validYears === 5) &&
        (!hideUnavailable ||
          (row[factor] !== null && availableFactorCount(row, includePrice) === requiredFactors)),
    ),
    factor,
  );
  const pageSize = Number(defaultPageSize);
  const offset = (page - 1) * pageSize;
  const tableLabel = `Ranking de ${criterion.toLowerCase()}`;
  const numeratorLabel = isRoic ? 'NOPAT' : 'Lucro atribuível';
  const priceLabel = isRoic ? 'NOPAT/EV' : 'Earnings yield';
  const showGrowth = factor === 'growth';
  const rankByValue = new Map<number, number>();
  for (const [index, row] of matches.entries()) {
    const value = row[factor];
    if (value !== null && !rankByValue.has(value)) rankByValue.set(value, index + 1);
  }
  const visible = matches.slice(offset, offset + pageSize);
  const expanded = showGrowth ? visible.find(({ name }) => name === expandedName) : undefined;

  function showPage(pageNumber: number) {
    setPage(pageNumber);
    setExpandedName(null);
  }

  function selectFactor(value: FundamentalFactor) {
    setSelectedFactor(value);
    showPage(1);
  }

  function clearFilters() {
    setSearch('');
    setSector('');
    setLeverageRange('all');
    setReinvestmentRange('all');
    setRequireHistory(false);
    setHideUnavailable(false);
    showPage(1);
  }

  function closeGrowth() {
    setExpandedName(null);
    growthTrigger.current?.focus();
  }

  return (
    <>
      <RankingShortcuts
        rows={groupRows}
        current={factor}
        onSelect={selectFactor}
        hasPrice={marketTradeDate !== null}
      />
      <div className="roic-ranking-filters">
        <Select
          id="fundamental-ranking-group"
          label="Grupo do indicador"
          value={group}
          onChange={(event) => {
            setGroup(event.currentTarget.value as FundamentalRow['metric']);
            setSector('');
            showPage(1);
          }}
        >
          <option value="ROIC">Empresas de ROIC</option>
          <option value="ROE">Empresas de ROE</option>
        </Select>
        <Select
          id="fundamental-ranking-factor"
          label="Ranking"
          value={factor}
          onChange={(event) => selectFactor(event.currentTarget.value as FundamentalFactor)}
        >
          {validFactors.map((key) => (
            <option key={key} value={key}>
              {labels[key]}
            </option>
          ))}
        </Select>
        <Input
          id="fundamental-ranking-search"
          label="Buscar companhia"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            showPage(1);
          }}
        />
        <Select
          id="fundamental-ranking-sector"
          label="Setor"
          value={sector}
          onChange={(event) => {
            setSector(event.currentTarget.value);
            showPage(1);
          }}
        >
          <option value="">Todos os setores</option>
          {sectorOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        {isRoic && (
          <>
            <RatioRangeSelect
              id="fundamental-ranking-leverage"
              label="Faixa de dívida líquida/EBITDA"
              value={leverageRange}
              onChange={(value) => {
                setLeverageRange(value);
                showPage(1);
              }}
            />
            <RatioRangeSelect
              id="fundamental-ranking-reinvestment"
              label="Faixa de NOPAT/reinvestimento"
              value={reinvestmentRange}
              onChange={(value) => {
                setReinvestmentRange(value);
                showPage(1);
              }}
            />
          </>
        )}
      </div>
      <div className="ranking-filter-actions">
        <RankingDataFilters
          requireHistory={requireHistory}
          hideUnavailable={hideUnavailable}
          onHistoryChange={(checked) => {
            setRequireHistory(checked);
            showPage(1);
          }}
          onUnavailableChange={(checked) => {
            setHideUnavailable(checked);
            showPage(1);
          }}
        />
        {hasFilters && (
          <Button variant="quiet" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>
      <FundamentalComparison
        key={group}
        rows={groupRows}
        years={years}
        marketTradeDate={marketTradeDate}
      />
      {aggregate && (
        <p>
          Pontuação com pesos iguais em {requiredFactors} fatores, calculada para {scoreSampleSize}{' '}
          empresas com dados completos.
        </p>
      )}
      {(factor === 'price' || factor === 'score') && (
        <p>
          {marketTradeDate ? (
            <>
              Preço medido por {priceLabel} no pregão de{' '}
              <time dateTime={marketTradeDate}>
                {marketTradeDate.split('-').reverse().join('/')}
              </time>
              .
            </>
          ) : (
            'Aguardando valor de mercado no lote privado para o fator preço.'
          )}
        </p>
      )}
      {factor === 'growth' && (
        <p>
          Crescimento anualizado de {years[0]} a {years.at(-1)}, com cinco exercícios e valores de
          início e fim positivos. Selecione uma companhia para ver a série anual.
        </p>
      )}
      {matches.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nenhuma companhia encontrada"
          description="Ajuste os filtros do ranking."
        />
      ) : (
        <div className="screener-results roic-ranking-results">
          <ScreenerToolbar
            count={formatCompanyCount(matches.length, groupRows.length)}
            currentPage={page}
            totalPages={Math.ceil(matches.length / pageSize)}
            onPageChange={showPage}
            paginationLabel="Paginação do ranking de fundamentos"
          />
          <div
            className="screener-results__scroll"
            role="region"
            aria-label="Resultados de fundamentos"
            tabIndex={0}
          >
            <Table aria-label={tableLabel}>
              <thead>
                <tr>
                  <th scope="col" className="ranking-position">
                    Posição
                  </th>
                  <th scope="col">Companhia</th>
                  <th
                    scope="col"
                    aria-sort={signedDirection(factor) === 1 ? 'descending' : 'ascending'}
                  >
                    {factor === 'profitability'
                      ? `${group} em ${years.at(-1)}`
                      : factor === 'price'
                        ? priceLabel
                        : criterion}
                  </th>
                  {factor === 'growth' && (
                    <>
                      <th scope="col">
                        {numeratorLabel} em {years[0]}
                      </th>
                      <th scope="col">
                        {numeratorLabel} em {years.at(-1)}
                      </th>
                    </>
                  )}
                  <th scope="col">{aggregate ? 'Fatores disponíveis' : 'Z-score do fator'}</th>
                  <th scope="col">Histórico</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.name}>
                    <td className="ranking-position">
                      {row[factor] === null ? '—' : rankByValue.get(row[factor])}
                    </td>
                    <th scope="row">
                      {showGrowth ? (
                        <button
                          type="button"
                          className="ranking-company-link"
                          aria-label={`Ver crescimento de ${row.name}`}
                          aria-expanded={expandedName === row.name}
                          aria-controls={expandedName === row.name ? growthDetailId : undefined}
                          onClick={(event) => {
                            growthTrigger.current = event.currentTarget;
                            setExpandedName(expandedName === row.name ? null : row.name);
                          }}
                        >
                          {row.name}
                        </button>
                      ) : (
                        row.name
                      )}
                      <small>{row.sector}</small>
                    </th>
                    <td>
                      {formatRankingValue(row, factor)}
                      {factor === 'growth' && row.growthReason && <small>{row.growthReason}</small>}
                    </td>
                    {factor === 'growth' && (
                      <>
                        <td>
                          {row.growthBaseBrl === null ? '—' : formatCurrency(row.growthBaseBrl)}
                        </td>
                        <td>
                          {row.growthFinalBrl === null ? '—' : formatCurrency(row.growthFinalBrl)}
                        </td>
                      </>
                    )}
                    <td>
                      {aggregate
                        ? `${availableFactorCount(row, includePrice)}/${requiredFactors}`
                        : row.zScores[factor] === undefined
                          ? '—'
                          : formatRankingScore(row.zScores[factor])}
                    </td>
                    <td>{row.validYears}/5</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}
      {expanded && <GrowthDetail id={growthDetailId} row={expanded} onClose={closeGrowth} />}
    </>
  );
}

export function FundamentalRanking() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void Promise.all([
      loadSectorComparison(signal),
      loadSectorRoicComparison(signal),
      loadSectorLeverage(signal).catch(() => null),
      loadSectorReinvestment(signal).catch(() => null),
      import.meta.env.DEV ? loadLocalMarketYields(signal).catch(() => null) : null,
    ])
      .then(([roe, roic, leverage, reinvestment, marketYields]) => {
        if (!signal.aborted) {
          const data = buildFundamentalRanks(
            combineSnapshots(roe, roic),
            leverage,
            reinvestment,
            marketYields,
          );
          setState({ status: 'ready', data });
        }
      })
      .catch(() => {
        if (!signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <Panel className="roic-ranking" aria-labelledby="fundamental-ranking-heading">
      <h2 id="fundamental-ranking-heading">Rankings de fundamentos</h2>
      {state.status === 'loading' && <p role="status">Carregando fundamentos…</p>}
      {state.status === 'error' && (
        <EmptyState
          icon="database"
          title="Fundamentos indisponíveis"
          description="Houve um problema ao carregar os demonstrativos da CVM."
        >
          <Button
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((current) => current + 1);
            }}
          >
            Recarregar fundamentos
          </Button>
        </EmptyState>
      )}
      {state.status === 'ready' && <RankingResults data={state.data} />}
    </Panel>
  );
}
