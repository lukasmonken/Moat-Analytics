import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../apps/web/src/app/App';
import { readCvmSample } from './cvm-snapshot';

function setPreferredTheme(theme: 'light' | 'dark') {
  const query = '(prefers-color-scheme: dark)';
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: media === query && theme === 'dark',
    media,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  localStorage.clear();
  setPreferredTheme('light');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404, ok: false }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe('Moat Analytics', () => {
  it('abre o screener a partir da visão geral', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Qualidade, preço e valor.' }),
    ).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Explorar screener' }));

    expect(window.location.hash).toBe('#/screener');
    expect(screen.getByRole('heading', { level: 1, name: 'Screener e Rankings' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Universo B3 indisponível' })).toBeTruthy();
  });

  it('navega entre as páginas e indica a página atual', async () => {
    const user = userEvent.setup();
    render(<App />);
    const pages = [
      ['Screener e Rankings', '#/screener'],
      ['Empresas', '#/empresas'],
      ['Valuation e Premissas', '#/valuation'],
      ['Carteiras', '#/carteiras'],
      ['Simulador e Backtest', '#/simulador'],
      ['Metodologia', '#/metodologia'],
    ] as const;

    for (const [name, hash] of pages) {
      const navigation = screen.getByRole('navigation', { name: 'Navegação principal' });
      const link = within(navigation).getByRole('link', { name });
      await user.click(link);
      expect(window.location.hash).toBe(hash);
      expect(screen.getByRole('heading', { level: 1, name })).toBeTruthy();
      expect(link.getAttribute('aria-current')).toBe('page');
    }
  });

  it('abre o screener por URL direta e mantém o estado vazio ao ajustar os filtros', async () => {
    window.history.replaceState(null, '', '/#/screener');
    const user = userEvent.setup();
    render(<App />);

    const search = screen.getByRole('searchbox', { name: 'Empresa ou ticker' });
    const index = screen.getByRole('combobox', { name: 'Índice' });
    const rows = screen.getByRole('combobox', { name: 'Linhas por página' });
    expect(index).toHaveProperty('value', '');
    expect(rows).toHaveProperty('value', '10');
    expect(
      within(rows)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['5', '10', '20', '30', '40', '50']);
    for (const code of ['IBOV', 'SMLL', 'IDIV']) {
      expect(within(index).getByRole('option', { name: code })).toBeTruthy();
    }

    await user.type(search, 'teste');
    await user.selectOptions(index, 'SMLL');
    await user.selectOptions(rows, '30');
    expect(search).toHaveProperty('value', 'teste');
    expect(index).toHaveProperty('value', 'SMLL');
    expect(rows).toHaveProperty('value', '30');
    expect(screen.getByRole('heading', { name: 'Universo B3 indisponível' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(search).toHaveProperty('value', '');
    expect(index).toHaveProperty('value', '');
    expect(rows).toHaveProperty('value', '10');
  });

  it('mostra indisponibilidade quando o snapshot não existe', async () => {
    window.history.replaceState(null, '', '/#/empresas');
    render(<App />);

    expect(screen.getByRole('status').textContent).toMatch(/Carregando a amostra/);
    expect(await screen.findByRole('heading', { name: 'Amostra indisponível' })).toBeTruthy();
  });

  it('recupera de erro de validação e troca a companhia da amostra', async () => {
    window.history.replaceState(null, '', '/#/empresas');
    const data = readCvmSample();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => data });
    vi.stubGlobal('fetch', fetch);

    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Erro ao carregar a amostra' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    const company = await screen.findByRole('combobox', { name: 'Companhia' });
    expect(within(company).getAllByRole('option')).toHaveLength(3);
    await user.selectOptions(company, 'cvm:19348');
    expect(company).toHaveProperty('value', 'cvm:19348');
    const history = screen.getByRole('table', { name: 'Contas por exercício' });
    expect(within(history).getByRole('columnheader', { name: '2025' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Conciliação e proveniência' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Baixar amostra em JSON' })).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('segue o tema do sistema até a escolha manual e mantém a escolha após remontar', async () => {
    setPreferredTheme('dark');
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Ativar tema claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('moat-theme')).toBe('light');

    unmount();
    render(<App />);

    expect(document.documentElement.dataset.theme).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Ativar tema escuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('moat-theme')).toBe('dark');
  });
});
