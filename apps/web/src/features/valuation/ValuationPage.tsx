import { EmptyState, PageHeader } from '../../shared/ui';

export function ValuationPage() {
  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Valuation e Premissas"
        description="Estime o valor intrínseco a partir de premissas explícitas e cenários de avaliação."
      />
      <EmptyState
        icon="valuation"
        title="Módulo em desenvolvimento"
        description="O plano inclui fluxo de caixa descontado (DCF) para empresas não financeiras, desconto de dividendos (DDM) para bancos e análise de sensibilidade."
      />
    </div>
  );
}
