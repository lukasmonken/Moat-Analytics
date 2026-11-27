import { expect, test } from '@playwright/test';
import { ipcaRateUrl } from '../../apps/web/src/shared/data-client/inflationRate';
import { cdiRateUrl } from '../../apps/web/src/shared/data-client/riskFreeRate';
import { serveCvm2025 } from './annual-fixtures';

const ipca = [{ data: '01/10/2025', valor: '4.63' }];
const cdi = [{ data: '26/11/2025', valor: '14.15' }];

test.beforeEach(async ({ page }) => {
  await serveCvm2025(page);
});

test('projeta DCF e DDM da DFP com taxas datadas e sem preencher premissas', async ({ page }) => {
  await page.route(ipcaRateUrl, (route) => route.fulfill({ json: ipca }));
  await page.route(cdiRateUrl, (route) => route.fulfill({ json: cdi }));
  await page.goto('./#/valuation');

  const panel = page.getByRole('region', { name: 'Valuation automático' });
  const select = panel.getByRole('combobox', { name: 'Companhia', exact: true });
  await expect(select).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Calcular valuation' })).toBeHidden();
  await expect(page.locator('time[datetime="2025-10"]')).toHaveText('outubro de 2025');
  await expect(page.locator('time[datetime="2025-11-26"]')).toBeVisible();
  await panel.getByRole('searchbox', { name: 'Buscar companhia' }).fill('petroleo brasileiro');
  await select.selectOption('PETROLEO BRASILEIRO S.A. PETROBRAS');
  await expect(panel.getByRole('heading', { name: /PETROBRAS · DCF/ })).toBeVisible();
  await expect(panel.getByText(/R\$\s*68\.073\.480\.000/)).toBeVisible();
  await expect(panel.getByRole('link', { name: 'DFP na CVM' })).toBeVisible();
  await expect(panel.locator('time')).toHaveAttribute('datetime', '2025-12-31');
  await panel.getByText('Ver projeções anuais').click();
  const flows = panel.getByRole('table', { name: 'Fluxos da projeção automática' });
  await expect(flows.getByRole('row')).toHaveCount(11);
  await expect(flows.getByRole('row', { name: /^1 / })).toContainText(/71\.225\.282\.124/);

  await panel.getByRole('searchbox', { name: 'Buscar companhia' }).clear();
  await select.selectOption('ITAU UNIBANCO HOLDING S.A.');
  await expect(
    panel.getByRole('heading', { name: /ITAU UNIBANCO HOLDING S.A. · DDM/ }),
  ).toBeVisible();
  await expect(panel.getByText(/R\$\s*48\.299\.000\.000/)).toBeVisible();
  await expect(panel.getByText('Dívida líquida na DFP')).toHaveCount(0);
  await select.selectOption('BRADSAÚDE S.A.');
  await expect(panel.getByText(/Estimativa indisponível para o perímetro atual/)).toBeVisible();
  await expect(panel.getByText('Valor estimado do patrimônio')).toHaveCount(0);
});

test('recupera o IPCA e mantém a projeção sem perpetuidade quando CDI não supera IPCA', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(ipcaRateUrl, (route) => route.fulfill({ json: ipca }));
  await page.route(ipcaRateUrl, (route) => route.fulfill({ status: 503 }), { times: 1 });
  await page.route(cdiRateUrl, (route) =>
    route.fulfill({ json: [{ data: '26/11/2025', valor: '4.63' }] }),
  );
  await page.goto('./#/valuation');
  const panel = page.getByRole('region', { name: 'Valuation automático' });
  await panel
    .getByRole('combobox', { name: 'Companhia', exact: true })
    .selectOption('ITAU UNIBANCO HOLDING S.A.');
  await expect(panel.getByText('Valor estimado do patrimônio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Atualizar IPCA' }).click();
  await expect(panel.getByText('A perpetuidade exige CDI superior ao IPCA.')).toBeVisible();
  await expect(panel.getByText('Valor presente dos dez anos')).toBeVisible();
  await expect(panel.getByText('Indisponível', { exact: true })).toHaveCount(2);
  await panel.getByText('Ver projeções anuais').click();
  await expect(panel.getByRole('table')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
