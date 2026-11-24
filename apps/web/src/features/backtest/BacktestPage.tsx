import { parseBacktestHistory, type BacktestHistory } from '@moat/data-contracts';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ExportWorkbookButton } from '../../shared/export/ExportWorkbookButton';
import { Button, ButtonLink, EmptyState, Input, PageHeader, Panel, Select } from '../../shared/ui';
import { readSavedPortfolio } from '../portfolio/portfolio';
import { BacktestResults } from './BacktestResults';
import { buildBacktestReport } from './backtestReport';
import { horizons, prepareBacktest, type Horizon } from './history';
import './backtest.css';

const collectedAt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});
const maxHistorySize = 2 * 1024 * 1024;

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
          os campos <code>date</code> (AAAA-MM-DD) e <code>level</code> (número positivo). Use um
          nível de retorno total por mês, no mesmo pregão para todas as posições.
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
  const [history, setHistory] = useState<BacktestHistory | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [calculationError, setCalculationError] = useState('');
  const [horizon, setHorizon] = useState<Horizon>('ytd');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [evaluation, setEvaluation] = useState<ReturnType<typeof prepareBacktest>>();
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);

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
    setHistory(null);
    setFileName('');
    setFileError('');
    setLoading(true);
    try {
      if (file.size > maxHistorySize) throw new Error('O arquivo deve ter até 2 MiB.');
      const content: unknown = JSON.parse(await file.text());
      const imported = parseBacktestHistory(content);
      if (attempt !== revision.current) return;
      setHistory(imported);
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
          <form className="backtest-form" onSubmit={run}>
            <Input
              id="backtest-file"
              label="Arquivo de séries mensais (JSON)"
              type="file"
              accept=".json,application/json"
              onChange={(event) => void loadFile(event)}
            />
            {loading && <p role="status">Validando séries do arquivo…</p>}
            {fileError && <p role="alert">{fileError}</p>}
            {!history && !fileError && !loading && (
              <p>Importe séries de retorno total em reais para simular.</p>
            )}
            {history && (
              <div>
                <p>
                  <strong>{fileName}</strong> ·{' '}
                  {history.source.url ? (
                    <a href={history.source.url} target="_blank" rel="noreferrer">
                      {history.source.name}
                    </a>
                  ) : (
                    history.source.name
                  )}{' '}
                  ·{' '}
                  <time dateTime={history.source.retrievedAt}>
                    {collectedAt.format(new Date(history.source.retrievedAt))}
                  </time>
                </p>
                <p>{history.source.methodology}</p>
              </div>
            )}
            <FileRequirements />
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
              <Button variant="primary" type="submit" disabled={!history || loading}>
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
