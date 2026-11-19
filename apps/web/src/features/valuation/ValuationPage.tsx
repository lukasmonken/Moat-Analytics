import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { valueScenario } from '../../shared/analytics/valuation';
import { useRiskFreeRate } from '../../shared/data-client/useRiskFreeRate';
import { Button, PageHeader, Panel, Select } from '../../shared/ui';
import { RiskFreeRatePanel } from '../../shared/ui/RiskFreeRatePanel';
import {
  caseLabels,
  cases,
  createDraft,
  parseScenarios,
  readStoredScenarios,
  saveScenarios,
  scenarioInput,
  serializeScenarios,
  type ValuationCase,
  type ValuationDraft,
  type ValuationModel,
} from './scenario';
import { ValuationInputs } from './ValuationInputs';
import { ValuationReferences } from './ValuationReferences';
import { ValuationResults } from './ValuationResults';

export function ValuationPage() {
  const { state, reload } = useRiskFreeRate();
  const [model, setModel] = useState<ValuationModel>('dcf');
  const [activeCase, setActiveCase] = useState<ValuationCase>('base');
  const [scenarios, setScenarios] = useState(readStoredScenarios);
  const [showResult, setShowResult] = useState(false);
  const [status, setStatus] = useState('');
  const importField = useRef<HTMLInputElement>(null);
  const activeDraft = scenarios[model][activeCase];
  const cdi = state.status === 'ready' ? state.rate : null;
  const cdiPercentage =
    cdi === null ? '' : String(Number((cdi.value * 100).toFixed(8))).replace('.', ',');

  function changeDraft(draft: ValuationDraft) {
    setScenarios((previous) => ({
      ...previous,
      [model]: { ...previous[model], [activeCase]: draft },
    }));
    setShowResult(false);
    setStatus('');
  }

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');
    setShowResult(true);
  }

  let evaluation;
  let error = '';
  if (showResult) {
    try {
      const { input, referencePrice } = scenarioInput(model, activeDraft);
      const result = valueScenario(input);
      if (!result) throw new Error('O cálculo exige valores finitos e premissas válidas.');
      evaluation = { input, result, referencePrice };
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'Não foi possível calcular o cenário.';
    }
  }

  function save() {
    try {
      saveScenarios(scenarios);
      setStatus('Cenários salvos neste navegador.');
    } catch {
      setStatus('O armazenamento deste navegador está indisponível.');
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      if (file.size > 128_000) throw new Error('Arquivo grande demais.');
      setScenarios(parseScenarios(await file.text()));
      setShowResult(false);
      setStatus('Cenários importados.');
    } catch {
      setStatus('O arquivo de cenários é inválido.');
    }
  }

  function exportFile() {
    const url = URL.createObjectURL(
      new Blob([serializeScenarios(scenarios)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'moat-cenarios-valuation.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Valuation e Premissas"
        description="Projete dez anos e compare premissas de valor por ação."
      />
      <RiskFreeRatePanel state={state} reload={reload} />
      <Panel className="valuation-panel" aria-labelledby="valuation-scenario">
        <h2 id="valuation-scenario">Premissas do cenário</h2>
        <div className="valuation-premises-grid">
          <Select
            id="valuation-model"
            label="Modelo"
            value={model}
            onChange={(event) => {
              setModel(event.currentTarget.value as ValuationModel);
              setShowResult(false);
              setStatus('');
            }}
          >
            <option value="dcf">DCF · empresas não financeiras</option>
            <option value="ddm">DDM · bancos</option>
          </Select>
          <Select
            id="valuation-case"
            label="Cenário"
            value={activeCase}
            onChange={(event) => {
              setActiveCase(event.currentTarget.value as ValuationCase);
              setShowResult(false);
              setStatus('');
            }}
          >
            {cases.map((choice) => (
              <option key={choice} value={choice}>
                {caseLabels[choice]}
              </option>
            ))}
          </Select>
        </div>
        <p>
          {model === 'dcf'
            ? 'Informe o custo médio ponderado de capital (WACC) como taxa de desconto.'
            : 'Informe o custo de capital próprio como taxa de desconto. O valor por ação é uma média quando há classes com direitos distintos. Projete um payout compatível com as restrições de capital do banco.'}
        </p>
        <div className="valuation-actions">
          <Button
            disabled={!cdi}
            variant="quiet"
            onClick={() => changeDraft({ ...activeDraft, discountRate: cdiPercentage })}
          >
            Aplicar CDI como desconto
          </Button>
          <p>Usar apenas a taxa livre de risco no desconto pode superestimar o valor.</p>
        </div>
        <form className="valuation-inputs" onSubmit={calculate} noValidate>
          <ValuationInputs model={model} draft={activeDraft} onChange={changeDraft} />
          <div className="valuation-actions">
            <Button variant="primary" type="submit">
              Calcular valuation
            </Button>
            <Button variant="quiet" onClick={() => changeDraft(createDraft())}>
              Limpar cenário
            </Button>
            <Button variant="quiet" onClick={save}>
              Salvar no navegador
            </Button>
            <Button variant="quiet" onClick={exportFile}>
              Exportar premissas
            </Button>
            <Button variant="quiet" onClick={() => importField.current?.click()}>
              Importar premissas
            </Button>
            <input
              ref={importField}
              type="file"
              aria-label="Arquivo de premissas"
              accept=".json,application/json"
              hidden
              onChange={(event) => void importFile(event)}
            />
          </div>
          {status && <p role="status">{status}</p>}
          {error && <p role="alert">{error}</p>}
        </form>
      </Panel>
      {evaluation && <ValuationResults {...evaluation} />}
      <ValuationReferences
        model={model}
        onApply={(fields) => changeDraft({ ...activeDraft, ...fields })}
      />
    </div>
  );
}
