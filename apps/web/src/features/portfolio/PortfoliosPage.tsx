import { EmptyState, PageHeader } from '../../shared/ui';

export function PortfoliosPage() {
  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Carteiras"
        description="Planeje seleções de ativos e avalie exposição por empresa e setor."
      />
      <EmptyState
        icon="portfolio"
        title="Módulo em desenvolvimento"
        description="A montagem de carteiras terá seleção manual ou por ranking, pesos iguais ou personalizados e limites por ativo ou setor."
      />
    </div>
  );
}
