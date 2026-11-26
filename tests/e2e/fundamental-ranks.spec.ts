import { expect, test } from '@playwright/test';
import { serveCvm2025 } from './annual-fixtures';

test('compara crescimento por grupo e permite ligar e desligar os dois filtros de dados', async ({
  page,
}) => {
  await serveCvm2025(page);
  await page.goto('./#/screener?ranking=fundamentos');
  const region = page.getByRole('region', { name: 'Rankings de fundamentos' });
  const ranking = region.getByLabel('Ranking', { exact: true });
  const company = region.getByLabel('Buscar companhia', { exact: true });
  const history = region.getByRole('checkbox', { name: /5 anos de histórico/ });
  const availability = region.getByRole('checkbox', { name: /indicadores indisponíveis/ });

  await expect(region.getByText(/calculada para [1-9]\d* empresas/)).toBeVisible();
  await expect(history).not.toBeChecked();
  await expect(availability).not.toBeChecked();
  await ranking.selectOption('leverage');
  await company.fill('Unipar');
  const unipar = region.getByRole('row', { name: /UNIPAR/ });
  await expect(unipar).toContainText('Indisponível');
  await history.check();
  await expect(unipar).toBeVisible();
  await availability.check();
  await expect(unipar).toHaveCount(0);
  await availability.uncheck();
  await expect(unipar).toBeVisible();
  await history.uncheck();
  await company.fill('Camil');
  const camil = region.getByRole('row', { name: /CAMIL/ });
  await expect(camil).toContainText('0/5');
  await history.check();
  await expect(camil).toHaveCount(0);
  await history.uncheck();

  await ranking.selectOption('growth');
  await company.fill('WEG');
  await expect(region.getByRole('columnheader', { name: 'NOPAT em 2021' })).toBeVisible();
  await expect(region.getByRole('columnheader', { name: 'NOPAT em 2025' })).toBeVisible();
  await expect(region.getByRole('row', { name: /WEG/ })).toContainText(/17,7\d%/);
  await company.fill('Itaú Unibanco');
  await region.getByLabel('Grupo do indicador').selectOption('ROE');
  await expect(
    region.getByRole('columnheader', { name: 'Lucro atribuível em 2025' }),
  ).toBeVisible();
  await expect(ranking.locator('option[value="accountingScore"]')).toHaveCount(0);
  await expect(region.getByRole('columnheader', { name: 'Z-score do fator' })).toBeVisible();
  await expect(region.getByRole('row', { name: /ITAU UNIBANCO/ })).toContainText('5/5');
  await ranking.selectOption('price');
  await expect(region.getByRole('columnheader', { name: 'Earnings yield' })).toBeVisible();
  await expect(region.getByText(/Aguardando valor de mercado/)).toBeVisible();
});

test('abre pelos atalhos, combina faixas e inspeciona a evolução anual', async ({ page }) => {
  await serveCvm2025(page);
  await page.goto('./#/screener');
  const region = page.getByRole('region', { name: 'Rankings de fundamentos' });
  const shortcuts = region.getByRole('group', { name: 'Destaques dos rankings' });
  const company = region.getByLabel('Buscar companhia', { exact: true });
  const leverage = region.getByLabel('Faixa de dívida líquida/EBITDA');
  const reinvestment = region.getByLabel('Faixa de NOPAT/reinvestimento');
  await expect(shortcuts.getByRole('button', { name: /Pontuação contábil/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await shortcuts.getByRole('button', { name: /Crescimento/ }).click();
  await expect(region.getByLabel('Ranking', { exact: true })).toHaveValue('growth');
  await company.fill('WEG');
  await leverage.selectOption('negative');
  await reinvestment.selectOption('1-2');
  const weg = region.getByRole('button', { name: /Ver crescimento de WEG/ });
  await expect(weg).toBeVisible();
  await reinvestment.selectOption('2-3');
  await expect(weg).toHaveCount(0);
  await region.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(leverage).toHaveValue('all');
  await expect(reinvestment).toHaveValue('all');
  await company.fill('WEG');
  await weg.click();
  const panel = region.getByRole('region', { name: 'Crescimento de WEG S.A.' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('row', { name: /2022/ })).toContainText('589.541.040');
  await expect(panel.getByRole('row', { name: /2022/ })).toContainText('21,48%');
  await expect(panel.getByRole('row', { name: /2025/ })).toContainText('5.279.169.060');
  await panel.getByRole('button', { name: 'Fechar diagnóstico' }).click();
  await expect(panel).toHaveCount(0);
  await expect(weg).toBeFocused();

  await region.getByLabel('Grupo do indicador').selectOption('ROE');
  await company.fill('BB Seguridade');
  await region.getByRole('button', { name: /Ver crescimento de BB SEGURIDADE/ }).click();
  const financial = region.getByRole('region', { name: /Crescimento de BB SEGURIDADE/ });
  await expect(financial.getByRole('table')).toBeVisible();
  await expect(financial.getByText(/Base inicial baixa/)).toBeVisible();
  await expect(financial.getByRole('row', { name: /2025/ })).toContainText('9.017.329.000');
});

test('compara companhias do mesmo grupo mesmo quando os filtros do ranking mudam', async ({
  page,
}) => {
  await serveCvm2025(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./#/screener?ranking=fundamentos');
  const region = page.getByRole('region', { name: 'Rankings de fundamentos' });
  const openComparison = region.getByText('Comparar fundamentos', { exact: true });
  const first = region.getByLabel('Primeira companhia', { exact: true });
  const second = region.getByLabel('Segunda companhia', { exact: true });
  const comparison = region.getByRole('table', { name: 'Comparação de fundamentos' });
  const financial = 'BB SEGURIDADE PARTICIPAÇÕES S.A.';

  await expect(first).toBeHidden();
  await openComparison.click();
  await expect(first).toBeVisible();
  await expect(second).toBeDisabled();
  await expect(first.locator('option').filter({ hasText: financial })).toHaveCount(0);
  await first.selectOption({ label: 'WEG S.A.' });
  await expect(second.locator('option').filter({ hasText: 'WEG S.A.' })).toHaveCount(0);
  await second.selectOption({ label: 'VALE S.A.' });
  await expect(
    comparison.getByRole('columnheader', { name: 'WEG S.A.', exact: true }),
  ).toBeVisible();
  await expect(
    comparison.getByRole('columnheader', { name: 'VALE S.A.', exact: true }),
  ).toBeVisible();
  const roic = comparison.getByRole('row', { name: /^ROIC\b/ });
  await expect(roic.getByRole('cell').nth(0)).toContainText('29,15%');
  await expect(roic.getByRole('cell').nth(0)).toContainText('Z-score');
  await expect(roic.getByRole('cell').nth(1)).toContainText('7,95%');
  const annualSources = comparison.getByRole('row', { name: /Balanço anual da CVM/ });
  await expect(annualSources.getByRole('link', { name: 'DFP de 2025' })).toHaveCount(2);
  const corporateFactors = ['Dívida líquida/EBITDA', 'NOPAT/reinvestimento', 'Drawdown do ROIC'];
  for (const factor of corporateFactors) {
    await expect(comparison.getByRole('rowheader', { name: factor })).toBeVisible();
  }
  const enterpriseYield = comparison.getByRole('row', { name: /^NOPAT\/EV/ });
  await expect(enterpriseYield.getByText('Indisponível', { exact: true })).toHaveCount(2);
  await expect(comparison.getByRole('rowheader', { name: 'Pontuação final' })).toBeVisible();

  await region.getByLabel('Buscar companhia', { exact: true }).fill('Camil');
  await region.getByLabel('Ranking', { exact: true }).selectOption('growth');
  const results = region.getByRole('region', { name: 'Resultados de fundamentos' });
  await expect(results.getByRole('row', { name: /CAMIL/ })).toBeVisible();
  await expect(results.getByRole('row', { name: /WEG|VALE/ })).toHaveCount(0);
  await expect(
    comparison.getByRole('columnheader', { name: 'WEG S.A.', exact: true }),
  ).toBeVisible();
  await expect(
    comparison.getByRole('columnheader', { name: 'VALE S.A.', exact: true }),
  ).toBeVisible();

  await region.getByLabel('Grupo do indicador').selectOption('ROE');
  await expect(comparison).toHaveCount(0);
  await expect(first).toBeHidden();
  await openComparison.click();
  await expect(first).toHaveValue('');
  await expect(second).toHaveValue('');
  await expect(first.locator('option').filter({ hasText: 'WEG S.A.' })).toHaveCount(0);
  await first.selectOption({ label: financial });
  await second.selectOption({ label: 'ITAU UNIBANCO HOLDING S.A.' });
  await expect(
    comparison.getByRole('columnheader', { name: financial, exact: true }),
  ).toBeVisible();
  const roe = comparison.getByRole('row', { name: /^ROE\b/ });
  await expect(roe.getByRole('cell').nth(0)).toContainText('89,81%');
  await expect(roe.getByRole('cell').nth(1)).toContainText('21,59%');
  await expect(roe.getByRole('cell').nth(1)).toContainText('Z-score');
  const earningsYield = comparison.getByRole('row', { name: /^Earnings yield/ });
  await expect(earningsYield.getByText('Indisponível', { exact: true })).toHaveCount(2);
  for (const factor of corporateFactors) {
    await expect(comparison.getByRole('rowheader', { name: factor })).toHaveCount(0);
  }

  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(comparison).toBeVisible();
  const scroll = region.getByRole('region', { name: 'Comparação lado a lado' });
  expect(await scroll.evaluate(({ scrollWidth, clientWidth }) => scrollWidth > clientWidth)).toBe(
    true,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
