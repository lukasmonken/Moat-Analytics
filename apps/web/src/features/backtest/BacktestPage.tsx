import {
  parseBacktestHistory,
  parseDailyBacktestHistory,
  type BacktestHistory,
  type DailyBacktestHistory,
} from '@moat/data-contracts';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { loadLocalMarketHistory } from '../../shared/data-client/marketHistory';
import { ExportWorkbookButton } from '../../shared/export/ExportWorkbookButton';
import { Button, ButtonLink, EmptyState, Input, PageHeader, Panel, Select } from '../../shared/ui';
import { readSavedPortfolio } from '../portfolio/portfolio';
import { formatDate } from '../screener/presentation';
import { BacktestResults } from './BacktestResults';
import { buildBacktestReport } from './backtestReport';
import { DailyReturns } from './DailyReturns';
import { monthlyHistoryFromDaily } from './dailyHistory';
import { horizons, prepareBacktest, type Horizon } from './history';
import './backtest.css';

const collectedAt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});
const maxMonthlyHistorySize = 2 * 1024 * 1024;
const maxDailyHistorySize = 16 * 1024 * 1024;

function FileRequirements() {
  return (
    <details className="company-observation">
      <summary>Formato do arquivo de séries</summary>
      <div className="company-observation-body">
        <p>
          Use JSON com <code>schemaVersion</code> igual a <code>1.0.0</code>, <code>basis</code>{' '}
          igual a <code>total-return-brl</code> e <code>source</code> com <code>name</code>,{' '}
          <code>retrievedAt</code> em ISO com fuso, <code>methodology</code> e <code>url</code>{' '}
          HTTPS opcional.
        </p>
        <p>
          Cada entrada em <code>assets</code> requer <code>company</code> com o nome exibido na
          carteira, <code>instrument</code> com o código negociado e <code>observations</code> com
          os campos <code>date</code> (AAAA-MM-DD) e <code>level</code> (número positivo). Em séries
          mensais, use um nível por mês, no mesmo pregão para todas as posições. Em séries diárias,
          inclua <code>frequency</code> igual a <code>daily</code>, <code>asOf</code> com a data do
          último pregão e observações em ordem de data, uma por pregão.
        </p>
        <p>
          Em <code>benchmarks</code>, informe opcionalmente <code>symbol</code> igual a IBOV, IDIV
          ou SMAL11 e <code>observations</code> no mesmo formato. O arquivo fica neste navegador
          durante a sessão. Confira a fonte e os ajustes de proventos antes de usar os resultados.
        </p>
      </div>
    </details>
  );
}

export function BacktestPage() {
  const [portfolio] = useState(readSavedPortfolio);
  const [localHistory, setLocalHistory] = useState<DailyBacktestHistory | null>(null);
  const [localError, setLocalError] = useState(false);
  const [importedHistory, setImportedHistory] = useState<
    BacktestHistory | DailyBacktestHistory | null
  >(null);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [calculationError, setCalculationError] = useState('');
  const [horizon, setHorizon] = useState<Horizon>('ytd');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [evaluation, setEvaluation] = useState<ReturnType<typeof prepareBacktest>>();
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);

  const inputHistory = importedHistory ?? localHistory;
  const daily = inputHistory?.frequency === 'daily' ? inputHistory : null;
  const history = useMemo(
    () =>
      inputHistory?.frequency === 'daily' ? monthlyHistoryFromDaily(inputHistory) : inputHistory,
    [inputHistory],
  );
  const hasMonthlyHistory =
    history !== null &&
    (!daily || history.assets.some(({ observations }) => observations.length > 1));

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const controller = new AbortController();
    const { signal } = controller;
    void loadLocalMarketHistory(signal).then(
      (file) => {
        if (!signal.aborted) setLocalHistory(file);
      },
      () => {
        if (!signal.aborted) setLocalError(true);
      },
    );
    return () => controller.abort();
  }, []);

  function invalidate() {
    setEvaluation(undefined);
    setCalculationError('');
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const attempt = ++revision.current;
    invalidate();
    setFileError('');
    setLoading(true);
    try {
      if (file.size > maxDailyHistorySize) throw new Error('O arquivo deve ter até 16 MiB.');
      const content: unknown = JSON.parse(await file.text());
      const isDaily =
        typeof content === 'object' &&
        content !== null &&
        'frequency' in content &&
        content.frequency === 'daily';
      if (!isDaily && file.size > maxMonthlyHistorySize)
        throw new Error('O arquivo de séries mensais deve ter até 2 MiB.');
      const imported = isDaily ? parseDailyBacktestHistory(content) : parseBacktestHistory(content);
      if (attempt !== revision.current) return;
      setImportedHistory(imported);
      setFileName(file.name);
    } catch (error) {
      if (attempt !== revision.current) return;
      setFileError(
        error instanceof SyntaxError
          ? 'O arquivo não é um JSON válido.'
          : error instanceof Error
            ? error.message
            : 'Falha ao ler as séries.',
      );
    } finally {
      if (attempt === revision.current) setLoading(false);
    }
  }

  function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invalidate();
    if (!portfolio || !history) return;
    try {
      setEvaluation(prepareBacktest(portfolio, history, horizon, start, end));
    } catch (error) {
      setCalculationError(
        error instanceof Error ? error.message : 'Falha ao calcular a retrospectiva.',
      );
    }
  }

  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Simulador e Backtest"
        description="Avalie hipóteses de alocação e compare desempenho histórico com referências de mercado."
      />
      <Panel className="backtest-panel" aria-labelledby="backtest-data-heading">
        <h2 id="backtest-data-heading">Histórico de mercado</h2>
        <Input
          id="backtest-file"
          label="Arquivo de séries diárias ou mensais (JSON)"
          type="file"
          accept=".json,application/json"
          onChange={(event) => void loadFile(event)}
        />
        {loading && <p role="status">Validando séries do arquivo…</p>}
        {fileError && <p role="alert">{fileError}</p>}
        {localError && !importedHistory && (
          <p role="alert">Falha ao carregar a base diária privada.</p>
        )}
        {!inputHistory && !fileError && !loading && (
          <p>Importe séries de retorno total em reais para consultar e simular.</p>
        )}
        {inputHistory && (
          <div>
            <p>
              <strong>{fileName || 'Base diária privada'}</strong> ·{' '}
              {inputHistory.source.url ? (
                <a href={inputHistory.source.url} target="_blank" rel="noreferrer">
                  {inputHistory.source.name}
                </a>
              ) : (
                inputHistory.source.name
              )}{' '}
              · coleta de{' '}
              <time dateTime={inputHistory.source.retrievedAt}>
                {collectedAt.format(new Date(inputHistory.source.retrievedAt))}
              </time>
              {daily && (
                <>
                  {' '}
                  · até o pregão de <time dateTime={daily.asOf}>
                    {formatDate(daily.asOf)}
                  </time> · {daily.assets.length} {daily.assets.length === 1 ? 'ativo' : 'ativos'}{' '}
                  com histórico
                </>
              )}
            </p>
            <p>{inputHistory.source.methodology}</p>
          </div>
        )}
        <FileRequirements />
      </Panel>
      {daily && <DailyReturns history={daily} portfolio={portfolio} />}
      {!portfolio ? (
        <EmptyState
          icon="portfolio"
          title="Carteira salva indisponível"
          description="Salve uma composição e seus parâmetros em Carteiras para iniciar a retrospectiva."
        >
          <ButtonLink to="/carteiras">Montar carteira</ButtonLink>
        </EmptyState>
      ) : (
        <Panel className="backtest-panel" aria-labelledby="backtest-retro">
          <h2 id="backtest-retro">Carteira de hoje no passado</h2>
          <p>
            A retrospectiva aplica a seleção atual ao período histórico e está sujeita a viés de
            seleção.
          </p>
          <p>
            {portfolio.positions.length}{' '}
            {portfolio.positions.length === 1
              ? 'companhia na carteira salva'
              : 'companhias na carteira salva'}
            .{' '}
            <ButtonLink to="/carteiras" variant="quiet">
              Editar carteira
            </ButtonLink>
          </p>
          {daily && (
            <p>
              A retrospectiva usa o último pregão registrado em cada mês encerrado, com tolerância
              de sete dias corridos até o fim do mês. Todas as posições precisam ter dados nessas
              datas.
            </p>
          )}
          {daily && !hasMonthlyHistory && <p role="status">Faltam dois meses fechados na base.</p>}
          <form className="backtest-form" onSubmit={run}>
            <div className="backtest-fields">
              <Select
                id="backtest-horizon"
                label="Período da retrospectiva"
                value={horizon}
                onChange={(event) => {
                  setHorizon(event.currentTarget.value as Horizon);
                  invalidate();
                }}
              >
                {horizons.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ytd'
                      ? 'Ano corrente das séries (YTD)'
                      : option === 'custom'
                        ? 'Personalizado'
                        : option === '1'
                          ? '1 ano (12 meses)'
                          : `${option} anos`}
                  </option>
                ))}
              </Select>
              {horizon === 'custom' && (
                <>
                  <Input
                    id="backtest-start"
                    type="month"
                    label="Mês inicial"
                    value={start}
                    onChange={(event) => {
                      setStart(event.currentTarget.value);
                      invalidate();
                    }}
                  />
                  <Input
                    id="backtest-end"
                    type="month"
                    label="Mês final"
                    value={end}
                    onChange={(event) => {
                      setEnd(event.currentTarget.value);
                      invalidate();
                    }}
                  />
                </>
              )}
            </div>
            <div className="backtest-actions">
              <Button variant="primary" type="submit" disabled={!hasMonthlyHistory || loading}>
                Calcular retrospectiva
              </Button>
            </div>
            {calculationError && <p role="alert">{calculationError}</p>}
          </form>
        </Panel>
      )}
      {evaluation && portfolio && history && (
        <BacktestResults
          {...evaluation}
          actions={
            <ExportWorkbookButton
              label="Exportar retrospectiva em Excel"
              filename="moat-retrospectiva.xlsx"
              build={() => buildBacktestReport(evaluation, portfolio, history.source)}
            />
          }
        />
      )}
      <Panel className="backtest-panel" aria-labelledby="backtest-point-in-time">
        <h2 id="backtest-point-in-time">Estratégia historicamente investível</h2>
        <p>
          Indisponível. A simulação requer a composição do universo e os dados que estavam
          publicados em cada data de decisão.
        </p>
      </Panel>
    </div>
  );
}
