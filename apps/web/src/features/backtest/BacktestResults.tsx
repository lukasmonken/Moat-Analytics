import type { ReactNode } from 'react';
import { Panel, Table } from '../../shared/ui';
import { backtestMeasures } from './backtestReport';
import type { prepareBacktest } from './history';
import './backtest.css';

type Evaluation = ReturnType<typeof prepareBacktest>;

const cash = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percentage = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const correlationFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatRate(value: number | null) {
  return value === null ? 'Indisponível' : percentage.format(value === 0 ? 0 : value);
}

function DateStamp({ date }: { date: string }) {
  return <time dateTime={date}>{dateFormat.format(new Date(date))}</time>;
}

function MonthlyResults({ points }: { points: Evaluation['result']['points'] }) {
  return (
    <div
      className="backtest-table-scroll backtest-table-scroll--monthly"
      role="region"
      tabIndex={0}
      aria-label="Histórico mensal da simulação"
    >
      <Table aria-label="Evolução mensal da carteira">
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Patrimônio antes do tributo final</th>
            <th scope="col">Aportes acumulados</th>
            <th scope="col">Retorno do mês</th>
            <th scope="col">Retorno acumulado</th>
            <th scope="col">Queda desde o pico</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">
                <DateStamp date={point.date} />
              </th>
              <td>{cash.format(point.value)}</td>
              <td>{cash.format(point.contributions)}</td>
              <td>
                {point.periodReturn === null ? 'Data inicial' : formatRate(point.periodReturn)}
              </td>
              <td>{formatRate(point.totalReturn)}</td>
              <td>{formatRate(point.drawdown)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function BenchmarkResults({ comparisons }: Pick<Evaluation, 'comparisons'>) {
  return (
    <Panel className="backtest-panel" aria-labelledby="backtest-benchmarks">
      <h2 id="backtest-benchmarks">Referências de mercado</h2>
      <p>Retornos de referência no mesmo período, sem custos de negociação e tributo final.</p>
      <div className="backtest-table-scroll" role="region" tabIndex={0} aria-label="Benchmarks">
        <Table aria-label="Comparação de retorno no período">
          <thead>
            <tr>
              <th scope="col">Referência</th>
              <th scope="col">Retorno acumulado</th>
              <th scope="col">Retorno anualizado</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map(({ symbol, totalReturn, cagr }) => (
              <tr key={symbol}>
                <th scope="row">{symbol}</th>
                <td>{formatRate(totalReturn)}</td>
                <td>{formatRate(cagr)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Panel>
  );
}

function PositionResults({
  positions,
  correlations,
}: Pick<Evaluation, 'positions' | 'correlations'>) {
  const hasPair = correlations.some((row, index) =>
    row.some((value, column) => column > index && value !== null),
  );
  return (
    <Panel className="backtest-panel" aria-labelledby="backtest-positions">
      <h2 id="backtest-positions">Contribuição e concentração</h2>
      <p>
        A contribuição de cada ativo desconta os custos atribuídos a ele. O tributo é calculado
        sobre o ganho da carteira. O peso final usa o patrimônio antes do tributo.
      </p>
      <div
        className="backtest-table-scroll"
        role="region"
        tabIndex={0}
        aria-label="Posições da carteira"
      >
        <Table aria-label="Contribuição e pesos por ativo">
          <thead>
            <tr>
              <th scope="col">Companhia</th>
              <th scope="col">Ativo</th>
              <th scope="col">Peso-alvo</th>
              <th scope="col">Peso final</th>
              <th scope="col">Ganho de mercado</th>
              <th scope="col">Custos</th>
              <th scope="col">Contribuição antes do tributo</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr key={position.company}>
                <th scope="row">{position.company}</th>
                <td>{position.instrument}</td>
                <td>{formatRate(position.targetWeight)}</td>
                <td>{formatRate(position.finalWeight)}</td>
                <td>{cash.format(position.marketGain)}</td>
                <td>{cash.format(position.costs)}</td>
                <td>{cash.format(position.contribution)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <details className="backtest-instruments">
        <summary>Correlação dos retornos mensais</summary>
        <div className="backtest-correlations">
          <p>
            A correlação de Pearson vai de −1 a +1 e requer pelo menos três retornos mensais
            alinhados e variação nos retornos dos dois ativos.
          </p>
          {hasPair ? (
            <div
              className="backtest-table-scroll"
              role="region"
              tabIndex={0}
              aria-label="Correlações da carteira"
            >
              <Table aria-label="Matriz de correlação">
                <thead>
                  <tr>
                    <th scope="col">Ativo</th>
                    {positions.map(({ instrument }) => (
                      <th scope="col" key={instrument}>
                        {instrument}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map(({ instrument }, index) => (
                    <tr key={instrument}>
                      <th scope="row">{instrument}</th>
                      {positions.map(({ instrument: column }, columnIndex) => {
                        const value = correlations[index]?.[columnIndex] ?? null;
                        return (
                          <td key={column}>
                            {value === null ? 'Indisponível' : correlationFormat.format(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <p>Indisponível para as séries nesta janela.</p>
          )}
        </div>
      </details>
    </Panel>
  );
}

export function BacktestResults({
  result,
  comparisons,
  positions,
  correlations,
  actions,
}: Evaluation & { actions?: ReactNode }) {
  const first = result.points[0];
  const last = result.points.at(-1);
  const stats = backtestMeasures(result);
  const measures = [
    ...stats.currency.map(([label, value]) => [label, cash.format(value)]),
    ...stats.rates.map(([label, value]) => [label, formatRate(value)]),
  ] as const;

  return (
    <>
      <Panel className="backtest-panel" aria-labelledby="backtest-results">
        <div>
          <h2 id="backtest-results">Resultado da retrospectiva</h2>
          {first && last && (
            <p>
              <DateStamp date={first.date} /> a <DateStamp date={last.date} />
            </p>
          )}
        </div>
        {actions && <div className="backtest-actions">{actions}</div>}
        <dl className="backtest-measures">
          {measures.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p>
          O retorno acumulado desconta o efeito dos aportes. As métricas de retorno e risco incluem
          custos de negociação e são calculadas antes do tributo final.
        </p>
        <h3>Evolução mensal</h3>
        <MonthlyResults points={result.points} />
        <details className="backtest-instruments">
          <summary>Retorno por ano</summary>
          <div
            className="backtest-table-scroll"
            role="region"
            tabIndex={0}
            aria-label="Retornos por ano"
          >
            <Table aria-label="Retornos por ano">
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col">Meses na janela</th>
                  <th scope="col">Retorno no recorte</th>
                </tr>
              </thead>
              <tbody>
                {result.calendarReturns.map(({ year, months, totalReturn }) => (
                  <tr key={year}>
                    <th scope="row">{year}</th>
                    <td>{months} de 12</td>
                    <td>{formatRate(totalReturn)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </details>
      </Panel>
      <PositionResults positions={positions} correlations={correlations} />
      <BenchmarkResults comparisons={comparisons} />
    </>
  );
}
