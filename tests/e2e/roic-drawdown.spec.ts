import { expect, test } from '@playwright/test';
import { serveCvm2025 } from './annual-fixtures';

test('ordena a maior queda de ROIC, filtra o ranking e identifica cobertura parcial', async ({
  page,
}) => {
  await serveCvm2025(page);
  await page.goto('./#/screener');
  await page.getByRole('link', { name: 'Drawdown do ROIC', exact: true }).click();
  await expect(page).toHaveURL(/ranking=drawdown-roic/);
  const ranking = page.getByRole('region', { name: 'Ranking de drawdown do ROIC' });
  const table = ranking.getByRole('table', { name: 'Drawdown do ROIC em cinco exercícios' });
  const search = ranking.getByRole('searchbox', { name: 'Buscar companhia no ranking' });
  const sector = ranking.getByRole('combobox', { name: 'Setor do ranking' });

  await expect(ranking.getByText(/114 de 129 companhias.*2021 a 2025/)).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Maior queda' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  const biggest = table.locator('tbody tr').first();
  await expect(biggest).toContainText('UNIPAR CARBOCLORO S.A.');
  await expect(biggest).toContainText('66,78 p.p.');
  await expect(biggest).toContainText('2021 → 2024');
  await expect(biggest).toContainText('5/5');

  const leverage = ranking.getByRole('combobox', { name: 'Faixa de dívida líquida/EBITDA' });
  await expect(leverage).toBeEnabled();
  await expect(biggest.getByRole('cell', { name: 'Indisponível' })).toBeVisible();
  await leverage.selectOption('unavailable');
  await expect(biggest).toContainText('UNIPAR CARBOCLORO S.A.');
  await leverage.selectOption('0-1');
  await expect(table.getByRole('rowheader', { name: /UNIPAR/ })).toHaveCount(0);
  await search.fill('Kepler Weber');
  await expect(biggest).toContainText('KEPLER WEBER S.A.');
  await expect(biggest).toContainText('0,07×');
  await search.fill('');
  await leverage.selectOption('all');

  const hideUnavailable = ranking.getByRole('checkbox', {
    name: 'Ocultar empresas com indicadores indisponíveis',
  });
  await expect(hideUnavailable).not.toBeChecked();
  await hideUnavailable.check();
  await expect(biggest).toContainText('KEPLER WEBER S.A.');
  await hideUnavailable.uncheck();
  await expect(biggest).toContainText('UNIPAR CARBOCLORO S.A.');

  await ranking.getByRole('button', { name: 'Próxima página' }).click();
  await expect(ranking.getByText('Página 2 de 13')).toBeVisible();
  await sector.selectOption({ label: 'Extração Mineral' });
  await expect(table.getByRole('rowheader', { name: /VALE S\.A\./ })).toBeVisible();
  await expect(table.getByRole('rowheader', { name: /UNIPAR/ })).toHaveCount(0);

  await sector.selectOption('');
  await search.fill('camil');
  const camil = table.getByRole('row', { name: /CAMIL ALIMENTOS/ });
  await expect(camil.getByRole('cell', { name: 'Empresa muito nova' })).toBeVisible();
  await expect(camil.getByRole('cell', { name: '0/5' })).toBeVisible();
  const requireHistory = ranking.getByRole('checkbox', {
    name: 'Somente empresas com 5 anos de histórico',
  });
  await expect(requireHistory).not.toBeChecked();
  await requireHistory.check();
  await expect(camil).toHaveCount(0);
  await requireHistory.uncheck();
  await expect(camil).toBeVisible();
  await search.fill('itau unibanco');
  await expect(ranking.getByText('Nenhuma companhia encontrada no ranking')).toBeVisible();

  await page.getByRole('link', { name: 'Diretório de empresas', exact: true }).click();
  await expect(page).toHaveURL(/visao=companhias/);
  await expect(page.getByRole('table', { name: 'Companhias selecionadas' })).toBeVisible();
});
