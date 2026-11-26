import { readFileSync } from 'node:fs';
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
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('cvm-company-selection')) {
        return {
          status: 200,
          ok: true,
          json: async () =>
            JSON.parse(readFileSync('data/public/cvm-company-selection.json', 'utf8')),
        };
      }
      return { status: 404, ok: false };
    }),
  );
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
    expect(screen.getByRole('heading', { name: 'Rankings de fundamentos' })).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Diretório de empresas' }));
    expect(await screen.findByRole('heading', { name: 'Diretório de companhias' })).toBeTruthy();
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

  it('filtra a lista pública pelo nome da companhia', async () => {
    window.history.replaceState(null, '', '/#/screener?visao=companhias');
    const user = userEvent.setup();
    render(<App />);

    const search = await screen.findByRole('searchbox', { name: 'Companhia' });
    const rows = screen.getByRole('combobox', { name: 'Linhas por página' });
    expect(rows).toHaveProperty('value', '10');
    expect(
      within(rows)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['5', '10', '20', '30', '40', '50']);
    expect(screen.queryByRole('combobox', { name: 'Índice' })).toBeNull();

    await user.type(search, 'weg s.a.');
    const table = screen.getByRole('table', { name: 'Companhias selecionadas' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((column) => column.textContent),
    ).toEqual(['Companhia']);
    expect(within(table).getByText('WEG S.A.', { exact: true })).toBeTruthy();
  });

  it('mostra indisponibilidade quando o snapshot não existe', async () => {
    window.history.replaceState(null, '', '/#/empresas');
    render(<App />);

    expect(screen.getByText(/Carregando indicadores/).getAttribute('role')).toBe('status');
    expect(await screen.findByRole('heading', { name: 'Indicadores indisponíveis' })).toBeTruthy();
    await userEvent.setup().click(screen.getByText('Dados complementares', { exact: true }));
    expect(await screen.findByRole('heading', { name: 'Amostra indisponível' })).toBeTruthy();
    expect(await screen.findByText('Comparação de ROE indisponível.')).toBeTruthy();
  });

  it('recupera de erro de validação e troca a companhia da amostra', async () => {
    window.history.replaceState(null, '', '/#/empresas');
    const data = readCvmSample();
    const fetchSample = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => data });
    vi.stubGlobal('fetch', (url: string) =>
      url.includes('cvm-sample') ? fetchSample(url) : Promise.resolve({ status: 404, ok: false }),
    );

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Dados complementares', { exact: true }));
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
    expect(fetchSample).toHaveBeenCalledTimes(2);
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
