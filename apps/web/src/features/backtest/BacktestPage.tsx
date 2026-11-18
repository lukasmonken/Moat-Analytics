import { EmptyState, PageHeader } from '../../shared/ui';

export function BacktestPage() {
  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Simulador e Backtest"
        description="Avalie hipóteses de alocação e compare desempenho histórico com referências de mercado."
      />
      <EmptyState
        icon="backtest"
        title="Módulo em desenvolvimento"
        description="O backtest depende de históricos validados de cotações, proventos e composições de índices com as datas em que se tornaram públicos."
      />
    </div>
  );
}
