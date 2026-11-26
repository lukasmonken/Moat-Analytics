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
