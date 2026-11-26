import { useEffect, useState } from 'react';
import { formatRatio } from '../../shared/analytics/ratios';
import { loadLocalMarketYields } from '../../shared/data-client/marketYields';
import { loadSectorComparison } from '../../shared/data-client/sectorComparison';
import { loadSectorLeverage } from '../../shared/data-client/sectorLeverage';
import { loadSectorReinvestment } from '../../shared/data-client/sectorReinvestment';
import { loadSectorRoicComparison } from '../../shared/data-client/sectorRoicComparison';
import { Button, EmptyState, Input, Panel, Select, Table } from '../../shared/ui';
import { formatPoints, formatRate } from '../company/QualityHistory';
import { combineSnapshots } from '../company/companyQualityData';
import { formatCurrency } from '../company/financialPresentation';
import { ScreenerToolbar } from '../screener/ScreenerToolbar';
import {
  compareNames,
  defaultPageSize,
  formatCompanyCount,
  normalizeSearch,
} from '../screener/presentation';
import { RankingDataFilters } from './RankingDataFilters';
import {
  availableFactorCount,
  buildFundamentalRanks,
  orderFundamentalRanks,
  signedDirection,
  type FundamentalFactor,
  type FundamentalRow,
} from './fundamentalRanks';
import './ranking.css';

const labels: Record<FundamentalFactor, string> = {
  profitability: 'Rentabilidade',
  moat: 'NOPAT/reinvestimento',
  leverage: 'Dívida líquida/EBITDA',
  risk: 'Drawdown do ROIC',
  growth: 'Crescimento',
  price: 'Preço',
  accountingScore: 'Pontuação contábil',
  score: 'Pontuação final',
};
const factors = Object.keys(labels) as FundamentalFactor[];
const scoreFormat = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

type RankingData = ReturnType<typeof buildFundamentalRanks>;
type LoadState = { status: 'loading' | 'error' } | { status: 'ready'; data: RankingData };

function formatRankingValue(row: FundamentalRow, factor: FundamentalFactor) {
  const value = row[factor];
  if (value === null) return factor === 'risk' ? 'Empresa muito nova' : 'Indisponível';
  if (factor === 'risk') return formatPoints(value);
  if (factor === 'score' || factor === 'accountingScore') return scoreFormat.format(value);
  if (factor === 'profitability' || factor === 'growth' || factor === 'price')
    return formatRate(value);
  return formatRatio(value);
}

function RankingResults({ data }: { data: RankingData }) {
  const [group, setGroup] = useState<FundamentalRow['metric']>('ROIC');
  const [selectedFactor, setSelectedFactor] = useState<FundamentalFactor>(
    data.marketTradeDate ? 'score' : 'accountingScore',
  );
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [requireHistory, setRequireHistory] = useState(false);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [page, setPage] = useState(1);
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
  const matches = orderFundamentalRanks(
    groupRows.filter(
      (row) =>
        (!sector || row.sector === sector) &&
        normalizeSearch(row.name).includes(query) &&
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

  return (
    <>
      <div className="roic-ranking-filters">
        <Select
          id="fundamental-ranking-group"
          label="Grupo do indicador"
          value={group}
          onChange={(event) => {
            setGroup(event.currentTarget.value as FundamentalRow['metric']);
            setSector('');
            setPage(1);
          }}
        >
          <option value="ROIC">Empresas de ROIC</option>
          <option value="ROE">Empresas de ROE</option>
        </Select>
        <Select
          id="fundamental-ranking-factor"
          label="Ranking"
          value={factor}
          onChange={(event) => {
            setSelectedFactor(event.currentTarget.value as FundamentalFactor);
            setPage(1);
          }}
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
            setPage(1);
          }}
        />
        <Select
          id="fundamental-ranking-sector"
          label="Setor"
          value={sector}
          onChange={(event) => {
            setSector(event.currentTarget.value);
            setPage(1);
          }}
        >
          <option value="">Todos os setores</option>
          {sectorOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>
      <RankingDataFilters
        requireHistory={requireHistory}
        hideUnavailable={hideUnavailable}
        onHistoryChange={(checked) => {
          setRequireHistory(checked);
          setPage(1);
        }}
        onUnavailableChange={(checked) => {
          setHideUnavailable(checked);
          setPage(1);
        }}
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
          início e fim positivos.
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
            onPageChange={setPage}
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
                {matches.slice(offset, offset + pageSize).map((row) => (
                  <tr key={row.name}>
                    <th scope="row">
                      {row.name}
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
                          : scoreFormat.format(row.zScores[factor])}
                    </td>
                    <td>{row.validYears}/5</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}
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
