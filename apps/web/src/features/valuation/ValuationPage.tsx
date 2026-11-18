import { useRiskFreeRate } from '../../shared/data-client/useRiskFreeRate';
import { EmptyState, PageHeader } from '../../shared/ui';
import { RiskFreeRatePanel } from '../../shared/ui/RiskFreeRatePanel';

export function ValuationPage() {
  const { state, reload } = useRiskFreeRate();

  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Valuation e Premissas"
        description="Estime o valor intrínseco a partir de premissas explícitas e cenários de avaliação."
      />
      <RiskFreeRatePanel state={state} reload={reload} />
      <EmptyState
        icon="valuation"
        title="Módulo em desenvolvimento"
        description="O plano inclui fluxo de caixa descontado (DCF) para empresas não financeiras, desconto de dividendos (DDM) para bancos e análise de sensibilidade."
      />
    </div>
  );
}
