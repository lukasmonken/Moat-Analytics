import { useState } from 'react';
import type { RiskFreeRate } from '../../shared/data-client/riskFreeRate';
import { useRiskFreeRate } from '../../shared/data-client/useRiskFreeRate';
import { Button, ButtonLink, EmptyState, PageHeader, Panel } from '../../shared/ui';
import { BankRoeComparison } from './BankRoeComparison';
import { CompanyQualityComparison } from './CompanyQualityComparison';
import { CompanySample } from './CompanySample';
import { useCvmSample } from './useCvmSample';

function ComplementaryData({ riskFreeRate }: { riskFreeRate: RiskFreeRate | null }) {
  const { state, reload } = useCvmSample();

  return (
    <div className="company-observation-body">
      <BankRoeComparison riskFreeRate={riskFreeRate} />

      {state.status === 'loading' && (
        <Panel className="company-panel">
          <p role="status">Carregando a amostra da CVM…</p>
        </Panel>
      )}

      {(state.status === 'unavailable' ||
        (state.status === 'ready' && state.snapshot.companies.length === 0)) && (
        <EmptyState
          icon="company"
          title="Amostra indisponível"
          description="Os demonstrativos estão indisponíveis nesta versão."
        >
          <ButtonLink to="/metodologia">Ver fontes e cobertura</ButtonLink>
        </EmptyState>
      )}

      {state.status === 'error' && (
        <EmptyState
          icon="company"
          title="Erro ao carregar a amostra"
          description="Houve um problema ao carregar ou validar o arquivo da amostra."
        >
          <Button onClick={reload}>Tentar novamente</Button>
        </EmptyState>
      )}

      {state.status === 'ready' && state.snapshot.companies.length > 0 && (
        <CompanySample snapshot={state.snapshot} riskFreeRate={riskFreeRate} />
      )}
    </div>
  );
}

export function CompaniesPage() {
  const [complementaryOpened, setComplementaryOpened] = useState(false);
  const { state: rateState, reload: reloadRate } = useRiskFreeRate();
  const riskFreeRate = rateState.status === 'ready' ? rateState.rate : null;

  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Empresas"
        description="Compare o retorno das empresas da seleção e confira as contas da CVM usadas em cada cálculo."
      />

      <CompanyQualityComparison rateState={rateState} reloadRate={reloadRate} />

      <details
        className="company-observation quality-audit"
        onToggle={(event) => {
          if (event.currentTarget.open) setComplementaryOpened(true);
        }}
      >
        <summary>Dados complementares</summary>
        {complementaryOpened && <ComplementaryData riskFreeRate={riskFreeRate} />}
      </details>
    </div>
  );
}
