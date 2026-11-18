import { Button, ButtonLink, EmptyState, PageHeader, Panel } from '../../shared/ui';
import { CompanySample } from './CompanySample';
import { useCvmSample } from './useCvmSample';

export function CompaniesPage() {
  const { state, reload } = useCvmSample();

  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Empresas"
        description="Consulte demonstrações financeiras publicadas na CVM e confira a conciliação das contas por exercício."
      />

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
        <CompanySample snapshot={state.snapshot} />
      )}
    </div>
  );
}
