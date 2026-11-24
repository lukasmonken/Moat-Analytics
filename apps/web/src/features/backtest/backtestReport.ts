import type { BacktestHistory } from '@moat/data-contracts';
import type { WorkbookReport } from '../../shared/export/report';
import { totalWeightUnits, type SavedPortfolio } from '../portfolio/portfolio';
import { portfolioParameterSheet } from '../portfolio/portfolioReport';
import type { prepareBacktest } from './history';

export function backtestMeasures(result: ReturnType<typeof prepareBacktest>['result']) {
  return {
    currency: [
      ['Patrimônio final após tributo', result.finalValue],
      ['Ganho ou perda líquida', result.profit],
      ['Capital inicial', result.capital],
      ['Aportes totais', result.contributions],
      ['Patrimônio antes do tributo final', result.terminalValue],
      ['Custos de negociação', result.costs],
      ['Tributo final simulado', result.tax],
    ],
    rates: [
      ['Retorno acumulado (TWR)', result.totalReturn],
      ['Retorno anualizado (CAGR)', result.cagr],
      ['Volatilidade anualizada', result.annualizedVolatility],
      ['Queda máxima desde o pico', result.maxDrawdown],
      ['Índice de Sharpe', null],
    ],
  } as const;
}

export function buildBacktestReport(
  evaluation: ReturnType<typeof prepareBacktest>,
  portfolio: SavedPortfolio,
  source: BacktestHistory['source'],
): WorkbookReport {
  const { result, comparisons, instruments } = evaluation;
  const stats = backtestMeasures(result);
  const first = result.points[0];
  const last = result.points.at(-1);
  const weights = new Map(portfolio.positions.map(({ name, weightUnits }) => [name, weightUnits]));
  return {
    sheets: [
      {
        name: 'Resumo',
        columns: [
          { label: 'Indicador', width: 43 },
          { label: 'Valor em BRL', format: 'currency', width: 23 },
          { label: 'Taxa', format: 'percent', width: 16 },
        ],
        rows: [
          ...stats.currency.map(([name, value]) => [name, value, null]),
          ...stats.rates.map(([name, value]) => [name, null, value]),
        ],
      },
      {
        name: 'Histórico mensal',
        columns: [
          { label: 'Pregão de referência', format: 'date', width: 23 },
          { label: 'Patrimônio pré-tributo', format: 'currency', width: 25 },
          { label: 'Aportes acumulados', format: 'currency', width: 22 },
          { label: 'Retorno do mês', format: 'percent', width: 17 },
          { label: 'Retorno acumulado', format: 'percent', width: 21 },
          { label: 'Queda desde o pico', format: 'percent', width: 21 },
        ],
        rows: result.points.map((point) => [
          new Date(point.date),
          point.value,
          point.contributions,
          point.periodReturn,
          point.totalReturn,
          point.drawdown,
        ]),
      },
      {
        name: 'Retorno por ano',
        columns: [
          { label: 'Ano', format: 'integer', width: 12 },
          { label: 'Meses na janela', format: 'integer', width: 19 },
          { label: 'Retorno no recorte', format: 'percent', width: 22 },
        ],
        rows: result.calendarReturns.map(({ year, months, totalReturn }) => [
          year,
          months,
          totalReturn,
        ]),
      },
      {
        name: 'Benchmarks',
        columns: [
          { label: 'Referência', width: 16 },
          { label: 'Retorno acumulado', format: 'percent', width: 21 },
          { label: 'Retorno anualizado', format: 'percent', width: 21 },
        ],
        rows: comparisons.map(({ symbol, totalReturn, cagr }) => [symbol, totalReturn, cagr]),
      },
      {
        name: 'Composição',
        columns: [
          { label: 'Companhia', width: 52 },
          { label: 'Instrumento', width: 18 },
          { label: 'Peso-alvo', format: 'percent', width: 16 },
        ],
        rows: instruments.map(({ company, instrument }) => {
          const units = weights.get(company);
          return [company, instrument, units === undefined ? null : units / totalWeightUnits];
        }),
      },
      portfolioParameterSheet(portfolio),
    ],
    notes: [
      ['Modelo', 'Carteira de hoje no passado. A seleção das companhias é retrospectiva.'],
      ['Início da janela', first ? new Date(first.date) : null],
      ['Fim da janela', last ? new Date(last.date) : null],
      ['Fonte declarada pelo usuário', source.name],
      ['Endereço da fonte', source.url ?? null],
      ['Coleta declarada (UTC)', new Date(source.retrievedAt)],
      ['Metodologia informada da série', source.methodology],
      ['Base', 'Níveis mensais de retorno total em reais, alinhados na data de cada pregão.'],
      ['Aportes', 'Aplicados ao fim de cada mês. O TWR e o CAGR isolam o efeito dos aportes.'],
      [
        'Custos e tributo',
        'Os custos afetam retorno e risco. O tributo é deduzido do ganho positivo no fim da janela.',
      ],
      [
        'Referências de mercado',
        'Mesma janela e sem custos/tributo. Valores faltantes indicam cobertura indisponível.',
      ],
      ['Índice de Sharpe', 'Indisponível sem uma série histórica alinhada de taxa livre de risco.'],
    ],
  };
}
