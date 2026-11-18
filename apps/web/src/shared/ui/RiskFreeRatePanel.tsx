import { useId } from 'react';
import { cdiRateUrl } from '../data-client/riskFreeRate';
import type { RiskFreeRateState } from '../data-client/useRiskFreeRate';
import { Button, Icon, Panel } from './index';

const formatRate = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const formatDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

export function RiskFreeRatePanel({
  state,
  reload,
}: {
  state: RiskFreeRateState;
  reload: () => void;
}) {
  const heading = useId();

  return (
    <Panel className="company-panel" aria-labelledby={heading}>
      <div>
        <h2 id={heading}>CDI atual</h2>
        <p>Taxa livre de risco provisória, anualizada na base de 252 dias úteis.</p>
      </div>
      {state.status === 'ready' && (
        <p>
          <strong>{formatRate.format(state.rate.value)} a.a.</strong> ·{' '}
          <time dateTime={state.rate.provenance.referenceDate}>
            {formatDate.format(new Date(state.rate.provenance.referenceDate))}
          </time>
        </p>
      )}
      {state.status === 'loading' && <p role="status">Consultando o CDI no Banco Central…</p>}
      {(state.status === 'error' || state.status === 'unavailable') && (
        <div>
          <p role="status">CDI indisponível no Banco Central.</p>
          <Button className="company-inline-action" onClick={reload}>
            Atualizar CDI
          </Button>
        </div>
      )}
      <p className="company-source-links">
        <a href={cdiRateUrl} target="_blank" rel="noreferrer">
          Banco Central do Brasil · SGS 4389 <Icon name="arrow-up-right" size={14} />
        </a>
      </p>
    </Panel>
  );
}
