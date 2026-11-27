import type { DailyBacktestHistory } from '@moat/data-contracts';
import { useMemo, useState } from 'react';
import { Input, Panel, Select, Table } from '../../shared/ui';
import { formatRate } from '../company/QualityHistory';
import { totalWeightUnits, type SavedPortfolio } from '../portfolio/portfolio';
import { compareNames, formatDate, normalizeSearch } from '../screener/presentation';
import { dailyAssetReturn, dailyReturnPeriods } from './dailyHistory';

export function DailyReturns({
  history,
  portfolio,
}: {
  history: DailyBacktestHistory;
  portfolio: SavedPortfolio | null;
}) {
  const periods = useMemo(() => dailyReturnPeriods(history), [history]);
  const [periodId, setPeriodId] = useState('month');
  const [search, setSearch] = useState('');
  const period = periods.find(({ id }) => id === periodId);
  const rows = useMemo(
    () =>
      history.assets
        .map(({ company, instrument, observations }) => ({
          company,
          instrument,
          rate: period ? dailyAssetReturn(observations, period) : null,
        }))
        .sort((left, right) => compareNames(left.company, right.company)),
    [history, period],
  );
  const byCompany = new Map(rows.map(({ company, rate }) => [company, rate]));
  const positionReturns = (portfolio?.positions ?? []).map(({ name, weightUnits }) => {
    const rate = byCompany.get(name);
    return rate == null ? null : (rate * weightUnits) / totalWeightUnits;
  });
  const portfolioReturn = positionReturns.every((rate) => rate !== null)
    ? positionReturns.reduce((sum, rate) => sum + rate, 0)
    : null;
  const searchTerm = normalizeSearch(search);
  const matches = rows.filter(
    ({ company, instrument }) =>
      normalizeSearch(company).includes(searchTerm) ||
      normalizeSearch(instrument).includes(searchTerm),
  );
  const dateRange =
    period?.start && period.end && period.start < period.end
      ? { start: period.start, end: period.end }
      : null;

  return (
    <Panel className="backtest-panel" aria-labelledby="daily-returns-heading">
      <h2 id="daily-returns-heading">Rentabilidade dos ativos</h2>
      <div className="backtest-fields">
        <Select
          id="daily-return-period"
          label="Período da rentabilidade"
          value={periodId}
          onChange={(event) => setPeriodId(event.currentTarget.value)}
        >
          {periods.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          id="daily-return-search"
          type="search"
          label="Buscar companhia ou ticker"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </div>
      {dateRange ? (
        <p>
          Pregões de <time dateTime={dateRange.start}>{formatDate(dateRange.start)}</time> a{' '}
          <time dateTime={dateRange.end}>{formatDate(dateRange.end)}</time>.
        </p>
      ) : (
        <p role="status">Histórico insuficiente para o período selecionado.</p>
      )}
      {portfolio && (
        <div className="daily-portfolio-return">
          <dl className="backtest-measures">
            <div>
              <dt>Carteira salva · pesos iniciais</dt>
              <dd>{portfolioReturn === null ? 'Indisponível' : formatRate(portfolioReturn)}</dd>
            </div>
          </dl>
          <p>
            {portfolioReturn === null && dateRange
              ? 'Há posições sem dados para o período.'
              : 'Retorno bruto. A retrospectiva mensal aplica os parâmetros da carteira.'}
          </p>
        </div>
      )}
      {matches.length === 0 ? (
        <p role="status">Nenhuma companhia encontrada para essa busca.</p>
      ) : (
        <div
          className="backtest-table-scroll backtest-table-scroll--monthly"
          role="region"
          aria-label="Rentabilidade por companhia"
          tabIndex={0}
        >
          <Table aria-label="Retorno total por companhia">
            <thead>
              <tr>
                <th scope="col">Companhia</th>
                <th scope="col">Ticker</th>
                <th scope="col">Retorno total</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(({ company, instrument, rate }) => (
                <tr key={company}>
                  <th scope="row">{company}</th>
                  <td>{instrument}</td>
                  <td>{rate === null ? 'Indisponível' : formatRate(rate)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
