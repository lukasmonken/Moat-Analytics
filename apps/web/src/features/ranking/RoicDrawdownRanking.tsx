import type { SectorLeverageSnapshot } from '@moat/data-contracts';
import { useEffect, useState } from 'react';
import { formatRatio, matchesRatioRange, type RatioRange } from '../../shared/analytics/ratios';
import { loadSectorLeverage } from '../../shared/data-client/sectorLeverage';
import { loadSectorRoicComparison } from '../../shared/data-client/sectorRoicComparison';
import { Button, EmptyState, Input, Panel, RatioRangeSelect, Select, Table } from '../../shared/ui';
import { formatPoints } from '../company/QualityHistory';
import {
  compareNames,
  defaultPageSize,
  formatCompanyCount,
  normalizeSearch,
} from '../screener/presentation';
import { ScreenerToolbar } from '../screener/ScreenerToolbar';
import { RankingDataFilters } from './RankingDataFilters';
import { rankRoicDrawdown } from './roicDrawdown';
import './ranking.css';

type LoadState =
  | { status: 'loading' | 'error' }
  | {
      status: 'ready';
      ranking: ReturnType<typeof rankRoicDrawdown>;
      sourceUrl: string;
      asOf: string;
    };

type LeverageState =
  { status: 'loading' | 'error' } | { status: 'ready'; snapshot: SectorLeverageSnapshot };

function RankingResults({
  ranking: { rows, years },
  sourceUrl,
  asOf,
  leverageState,
}: Extract<LoadState, { status: 'ready' }> & { leverageState: LeverageState }) {
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [leverageRange, setLeverageRange] = useState<RatioRange>('all');
  const [requireHistory, setRequireHistory] = useState(false);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [page, setPage] = useState(1);
  const query = normalizeSearch(search);
  const lastYear = years.at(-1);
  const leverage =
    leverageState.status === 'ready' &&
    leverageState.snapshot.manifest.asOf === asOf &&
    leverageState.snapshot.manifest.year === lastYear
      ? leverageState.snapshot
      : null;
  const leverageByName = new Map(leverage?.companies.map(({ name, value }) => [name, value]));
  const hasLeverage = rows.some(({ name }) => leverageByName.get(name) != null);
  const activeLeverageRange = leverage ? leverageRange : 'all';
  const sectors = [...new Set(rows.map((row) => row.sector))].sort(compareNames);
  const matches = rows.filter((row) => {
    const ratio = leverageByName.get(row.name);
    return (
      (!sector || row.sector === sector) &&
      normalizeSearch(row.name).includes(query) &&
      (!requireHistory || row.validYears === years.length) &&
      (!hideUnavailable || (row.drawdownPp !== null && ratio != null)) &&
      matchesRatioRange(ratio, activeLeverageRange)
    );
  });
  const pageSize = Number(defaultPageSize);
  const first = (page - 1) * pageSize;
  const complete = rows.filter((row) => row.drawdownPp !== null).length;

  return (
    <>
      <p>
        {formatCompanyCount(complete, rows.length)} com cinco exercícios disponíveis, de {years[0]}{' '}
        a {lastYear}. <a href={sourceUrl}>Demonstrações da CVM</a>.
      </p>
      <div className="roic-ranking-filters">
        <Input
          id="roic-ranking-search"
          label="Buscar companhia no ranking"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
        />
        <Select
          id="roic-ranking-sector"
          label="Setor do ranking"
          value={sector}
          onChange={(event) => {
            setSector(event.currentTarget.value);
            setPage(1);
          }}
        >
          <option value="">Todos os setores</option>
          {sectors.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate}
            </option>
          ))}
        </Select>
        <RatioRangeSelect
          id="roic-ranking-leverage-range"
          label="Faixa de dívida líquida/EBITDA"
          disabled={!leverage}
          value={leverageRange}
          onChange={(next) => {
            setLeverageRange(next);
            setPage(1);
          }}
        />
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
      {!hasLeverage && (
        <p role="status">
          {leverageState.status === 'loading'
            ? 'Carregando alavancagem…'
            : 'Alavancagem indisponível para esta seleção.'}
        </p>
      )}
      {matches.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nenhuma companhia encontrada no ranking"
          description="Ajuste os filtros para consultar outras companhias."
        />
      ) : (
        <div className="screener-results roic-ranking-results">
          <ScreenerToolbar
            count={formatCompanyCount(matches.length, rows.length)}
            currentPage={page}
            totalPages={Math.ceil(matches.length / pageSize)}
            onPageChange={setPage}
            paginationLabel="Paginação do ranking de ROIC"
          />
          <div
            className="screener-results__scroll"
            role="region"
            aria-label="Resultados do ranking"
            tabIndex={0}
          >
            <Table aria-label="Drawdown do ROIC em cinco exercícios">
              <thead>
                <tr>
                  <th scope="col">Companhia</th>
                  <th scope="col" aria-sort="descending">
                    Maior queda
                  </th>
                  <th scope="col">Pico → vale</th>
                  <th scope="col">
                    Dívida líquida/EBITDA{hasLeverage && <small>{lastYear}</small>}
                  </th>
                  <th scope="col">Exercícios disponíveis</th>
                </tr>
              </thead>
              <tbody>
                {matches.slice(first, first + pageSize).map((row) => (
                  <tr key={row.name}>
                    <th scope="row">
                      {row.name}
                      <small>{row.sector}</small>
                    </th>
                    <td>
                      {row.drawdownPp === null
                        ? 'Empresa muito nova'
                        : formatPoints(row.drawdownPp)}
                    </td>
                    <td>{row.peakYear === null ? '—' : `${row.peakYear} → ${row.troughYear}`}</td>
                    <td>{formatRatio(leverageByName.get(row.name) ?? null)}</td>
                    <td>
                      {row.validYears}/{years.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}
      <p>“Empresa muito nova” indica menos de cinco exercícios com ROIC disponível na base.</p>
    </>
  );
}

export function RoicDrawdownRanking() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [leverageState, setLeverageState] = useState<LeverageState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadSectorRoicComparison(signal)
      .then((snapshot) => {
        if (signal.aborted) return;
        setState({
          status: 'ready',
          ranking: rankRoicDrawdown(snapshot),
          sourceUrl: snapshot.manifest.source.datasetUrl,
          asOf: snapshot.manifest.asOf,
        });
      })
      .catch(() => {
        if (!signal.aborted) setState({ status: 'error' });
      });
    void loadSectorLeverage(signal).then(
      (snapshot) => {
        if (!signal.aborted) setLeverageState({ status: 'ready', snapshot });
      },
      () => {
        if (!signal.aborted) setLeverageState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  return (
    <Panel className="roic-ranking" aria-labelledby="roic-ranking-title">
      <h2 id="roic-ranking-title">Ranking de drawdown do ROIC</h2>
      <p>Maior queda de um ROIC anual para um exercício posterior, em pontos percentuais.</p>
      {state.status === 'loading' && <p role="status">Carregando ranking de ROIC…</p>}
      {state.status === 'error' && (
        <EmptyState
          icon="database"
          title="Ranking de ROIC indisponível"
          description="Houve um problema ao carregar os demonstrativos da CVM."
        >
          <Button
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((current) => current + 1);
            }}
          >
            Recarregar ranking
          </Button>
        </EmptyState>
      )}
      {state.status === 'ready' && <RankingResults {...state} leverageState={leverageState} />}
    </Panel>
  );
}
