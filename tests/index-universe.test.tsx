import { parseIndexUniverse, type IndexUniverseSnapshot } from '@moat/data-contracts';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ScreenerPage } from '../apps/web/src/features/screener/ScreenerPage';
import { loadIndexUniverse } from '../apps/web/src/shared/data-client/indexUniverse';

vi.mock('../apps/web/src/shared/data-client/indexUniverse', () => ({
  hasIndexUniverse: true,
  loadIndexUniverse: vi.fn(),
}));

function sample(): IndexUniverseSnapshot {
  const companies: IndexUniverseSnapshot['companies'] = [
    {
      cvmCode: 1,
      companyId: 'cvm:1',
      name: 'Árvore de teste',
      indexMemberships: ['IBOV', 'IDIV'],
      representativeTicker: null,
      securities: [
        { ticker: 'TEST3', kind: 'ON', indexMemberships: ['IBOV'] },
        { ticker: 'TEST4', kind: 'PN', indexMemberships: ['IDIV'] },
      ],
    },
  ];
  for (let id = 2; id <= 12; id += 1) {
    companies.push({
      cvmCode: id,
      companyId: `cvm:${id}`,
      name: `Teste ${id}`,
      indexMemberships: ['SMLL'],
      representativeTicker: null,
      securities: [
        { ticker: `T${String(id).padStart(3, '0')}3`, kind: 'ON', indexMemberships: ['SMLL'] },
      ],
    });
  }
  return {
    schemaVersion: '1.0.0',
    asOf: '2026-11-18',
    importedAt: '2026-11-18T12:00:00Z',
    source: { name: 'Arquivo de teste', url: null, redistributionBasis: null },
    coverage: { includedCompanies: 12, byIndex: { IBOV: 1, IDIV: 1, SMLL: 11 } },
    companies,
  };
}

function renderScreener() {
  return render(
    <MemoryRouter>
      <ScreenerPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Composição anual dos índices', () => {
  it('rejeita divergência dos totais e a mesma classe em emissores diferentes', () => {
    const snapshot = sample();
    expect(parseIndexUniverse(snapshot).coverage.includedCompanies).toBe(12);
    const wrongCount = { ...snapshot, coverage: { ...snapshot.coverage, includedCompanies: 13 } };
    expect(() => parseIndexUniverse(wrongCount)).toThrow();

    const companies = snapshot.companies.map((company) =>
      company.cvmCode === 2
        ? { ...company, securities: [{ ticker: 'TEST3', kind: 'ON', indexMemberships: ['SMLL'] }] }
        : company,
    );
    expect(() => parseIndexUniverse({ ...snapshot, companies })).toThrow();
  });

  it('exibe data-base, pagina e mantém uma linha por companhia ao filtrar', async () => {
    vi.mocked(loadIndexUniverse).mockResolvedValueOnce(sample());
    const user = userEvent.setup();
    renderScreener();
    const table = await screen.findByRole('table', { name: 'Companhias da composição anual' });
    expect(screen.getByText('18/11/2026')).toBeTruthy();
    expect(screen.getByText('Consulta local')).toBeTruthy();
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(within(table).getAllByRole('row')).toHaveLength(3);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Índice' }), 'IDIV');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('TEST3')).toBeTruthy();
    expect(within(table).getByText('TEST4')).toBeTruthy();

    const search = screen.getByRole('searchbox', { name: 'Empresa ou ticker' });
    await user.type(search, 'arvore');
    expect(within(table).getByRole('rowheader', { name: 'Árvore de teste' })).toBeTruthy();
    await user.clear(search);
    await user.type(search, 'faltante');
    expect(screen.getByRole('heading', { name: 'Nenhuma companhia encontrada' })).toBeTruthy();
  });

  it('permite refazer a leitura após falha', async () => {
    const load = vi.mocked(loadIndexUniverse);
    load.mockRejectedValueOnce(new Error('JSON inválido')).mockResolvedValueOnce(sample());
    const user = userEvent.setup();
    renderScreener();

    expect(
      await screen.findByRole('heading', { name: 'Falha ao carregar a composição' }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Composição anual' })).toBeTruthy();
  });
});
