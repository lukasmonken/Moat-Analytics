import {
  BacktestPage,
  CompaniesPage,
  MethodologyPage,
  OverviewPage,
  PortfoliosPage,
  ScreenerPage,
  ValuationPage,
} from '../features';

export const appRoutes = [
  { path: '/', title: 'Visão geral', icon: 'overview', Component: OverviewPage },
  { path: '/screener', title: 'Screener e Rankings', icon: 'screener', Component: ScreenerPage },
  { path: '/empresas', title: 'Empresas', icon: 'company', Component: CompaniesPage },
  {
    path: '/valuation',
    title: 'Valuation e Premissas',
    icon: 'valuation',
    Component: ValuationPage,
  },
  { path: '/carteiras', title: 'Carteiras', icon: 'portfolio', Component: PortfoliosPage },
  { path: '/simulador', title: 'Simulador e Backtest', icon: 'backtest', Component: BacktestPage },
  { path: '/metodologia', title: 'Metodologia', icon: 'methodology', Component: MethodologyPage },
] as const;
