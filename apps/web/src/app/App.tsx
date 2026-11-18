import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { appRoutes } from './routes';

function UnknownPage() {
  return (
    <section className="app-unknown-page">
      <h1>Página indisponível</h1>
      <p>Confira o endereço ou volte para a visão geral.</p>
      <Link to="/">Voltar à visão geral</Link>
    </section>
  );
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          {appRoutes.map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
          <Route path="*" element={<UnknownPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
