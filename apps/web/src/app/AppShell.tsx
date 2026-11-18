import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from '../shared/ui';
import { appRoutes } from './routes';
import { useTheme } from './useTheme';

function Brand({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Link
      to="/"
      className="app-brand"
      aria-label="Moat Analytics, visão geral"
      onClick={onNavigate}
    >
      <img src={import.meta.env.BASE_URL + 'moat.svg'} width="32" height="32" alt="" />
      <span>Moat Analytics</span>
    </Link>
  );
}

export function AppShell() {
  const { pathname, key } = useLocation();
  const [openAtLocation, setOpenAtLocation] = useState<string | null>(null);
  const menuOpen = openAtLocation === key;
  const menuButton = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const { theme, toggleTheme } = useTheme();
  const activeRoute = appRoutes.find((route) => route.path === pathname);
  const pageTitle = activeRoute?.title ?? 'Página indisponível';

  useEffect(() => {
    document.title = pathname === '/' ? 'Moat Analytics' : pageTitle + ' | Moat Analytics';

    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      main.current?.focus({ preventScroll: true });
      document.scrollingElement?.scrollTo({ top: 0 });
    }
  }, [pageTitle, pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpenAtLocation(null);
      menuButton.current?.focus();
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  function focusContent() {
    main.current?.focus();
  }

  function closeMenu() {
    if (menuOpen) {
      setOpenAtLocation(null);
      menuButton.current?.focus();
    }
  }

  return (
    <div className="app-shell">
      <button type="button" className="app-skip" onClick={focusContent}>
        Ir para o conteúdo
      </button>

      <header className="app-topbar">
        <button
          ref={menuButton}
          type="button"
          className="app-icon-button app-menu-toggle"
          aria-label={menuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
          aria-controls="app-navigation"
          aria-expanded={menuOpen}
          onClick={() => setOpenAtLocation(menuOpen ? null : key)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={19} />
        </button>
        <div className="app-mobile-brand">
          <Brand onNavigate={closeMenu} />
        </div>
        <div className="app-breadcrumb">
          {activeRoute && <Icon name={activeRoute.icon} size={15} />}
          <span>{pageTitle}</span>
        </div>
        <button
          type="button"
          className="app-icon-button app-theme-toggle"
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          onClick={toggleTheme}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
        </button>
      </header>

      <aside className="app-sidebar" data-open={menuOpen}>
        <div className="app-sidebar-brand">
          <Brand onNavigate={closeMenu} />
        </div>
        <nav id="app-navigation" className="app-navigation" aria-label="Navegação principal">
          {appRoutes.map(({ path, title, icon }) => (
            <NavLink key={path} to={path} end onClick={closeMenu}>
              <Icon name={icon} size={17} />
              <span>{title}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {menuOpen && <div aria-hidden="true" className="app-menu-backdrop" onClick={closeMenu} />}

      <main ref={main} id="conteudo" tabIndex={-1} className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
