import type { simulatePortfolio } from '../../shared/analytics/backtest';
import { Panel, Table } from '../../shared/ui';
import './backtest.css';

type Result = NonNullable<ReturnType<typeof simulatePortfolio>>;

interface BenchmarkComparison {
  symbol: string;
  totalReturn: number | null;
  cagr: number | null;
}

interface Instrument {
  company: string;
  instrument: string;
}

const cash = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percentage = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

function formatRate(value: number | null) {
  return value === null ? 'Indisponível' : percentage.format(value === 0 ? 0 : value);
}

function DateStamp({ date }: { date: string }) {
  return <time dateTime={date}>{dateFormat.format(new Date(date))}</time>;
}

function MonthlyResults({ points }: { points: Result['points'] }) {
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

function BenchmarkResults({ comparisons }: { comparisons: BenchmarkComparison[] }) {
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

export function BacktestResults({
  result,
  comparisons,
  instruments,
}: {
  result: Result;
  comparisons: BenchmarkComparison[];
  instruments: Instrument[];
}) {
  const first = result.points[0];
  const last = result.points.at(-1);
  const measures = [
    ['Patrimônio final após tributo', cash.format(result.finalValue)],
    ['Ganho ou perda líquida', cash.format(result.profit)],
    ['Capital inicial', cash.format(result.capital)],
    ['Aportes totais', cash.format(result.contributions)],
    ['Patrimônio antes do tributo final', cash.format(result.terminalValue)],
    ['Custos de negociação', cash.format(result.costs)],
    ['Tributo final simulado', cash.format(result.tax)],
    ['Retorno acumulado (TWR)', formatRate(result.totalReturn)],
    ['Retorno anualizado (CAGR)', formatRate(result.cagr)],
    ['Volatilidade anualizada', formatRate(result.annualizedVolatility)],
    ['Queda máxima desde o pico', formatRate(result.maxDrawdown)],
    ['Índice de Sharpe', 'Indisponível'],
  ];

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
        <details className="backtest-instruments">
          <summary>Instrumentos usados na simulação</summary>
          <dl>
            {instruments.map(({ company, instrument }) => (
              <div key={company}>
                <dt>{company}</dt>
                <dd>{instrument}</dd>
              </div>
            ))}
          </dl>
        </details>
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
      <BenchmarkResults comparisons={comparisons} />
    </>
  );
}
