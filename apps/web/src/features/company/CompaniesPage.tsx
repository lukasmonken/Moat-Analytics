import { ButtonLink, EmptyState, PageHeader } from '../../shared/ui';

export function CompaniesPage() {
  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Empresas"
        description="Consulte demonstrativos, séries históricas e indicadores por companhia."
      />
      <EmptyState
        icon="company"
        title="Dados ainda não integrados"
        description="As fichas das companhias dependem do cadastro e dos demonstrativos oficiais da CVM."
      >
        <ButtonLink to="/metodologia">Ver fontes e métricas</ButtonLink>
      </EmptyState>
    </div>
  );
}
