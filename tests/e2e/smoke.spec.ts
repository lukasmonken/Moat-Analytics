import { expect, test } from '@playwright/test';
import { cdiRateUrl } from '../../apps/web/src/shared/data-client/riskFreeRate';

const cdiFixture = [{ data: '15/12/2025', valor: '13.65' }];

test.beforeEach(async ({ page }) => {
  await page.route(cdiRateUrl, (route) => route.fulfill({ json: cdiFixture }));
});

test('navega, atualiza a rota e mantém o tema sem erros no navegador', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Qualidade, preço e valor.' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Explorar screener' }).click();
  await expect(page).toHaveURL(/#\/screener$/);
  await expect(page.getByRole('heading', { name: 'Diretório de companhias' })).toBeVisible();
  const directory = page.getByRole('table', { name: 'Companhias selecionadas' });
  await expect(directory.getByRole('columnheader')).toHaveText(['Companhia']);
  await expect(page.getByRole('combobox', { name: 'Índice' })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Companhia' }).fill('WEG S.A.');
  await expect(directory.getByText('WEG S.A.', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Linhas por página' })).toHaveValue('10');

  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const response = await page.reload();
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/#\/screener$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Screener e Rankings' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('consulta a amostra oficial no build hospedado em subdiretório', async ({ page }) => {
  await page.goto('./#/empresas');
  await expect(page.getByRole('heading', { name: 'Amostra da CVM' })).toBeVisible();
  const company = page.getByRole('combobox', { name: 'Companhia' });
  await expect(company.getByRole('option')).toHaveCount(3);
  await company.selectOption('cvm:8133');
  await expect(company).toHaveValue('cvm:8133');
  const history = page.getByRole('table', { name: 'Contas por exercício' });
  await expect(history.getByRole('columnheader', { name: '2021' })).toBeVisible();
  await expect(history.getByRole('columnheader', { name: '2025' })).toBeVisible();
  await page.getByText('Códigos informados à CVM', { exact: true }).click();
  await expect(page.getByText('LREN3', { exact: true })).toBeVisible();

  const link = page.getByRole('link', { name: 'Baixar amostra em JSON' });
  const href = await link.evaluate((node: HTMLAnchorElement) => node.href);
  const response = await page.request.get(href);
  expect(response.ok()).toBe(true);
  expect((await response.json()).manifest.coverage).toEqual({
    eligibleCompanies: null,
    includedCompanies: 3,
  });
});

test('consulta o resultado de 12 meses e as contas do ITR', async ({ page }) => {
  await page.goto('./#/empresas');
  const company = page.getByRole('combobox', { name: 'Companhia' });
  const pricing = page.getByRole('region', { name: 'Preço e rendimento implícito' });
  await company.selectOption('cvm:5410');
  await expect(pricing.getByText('NOPAT estimado em 12 meses')).toBeVisible();
  await expect(pricing.getByText(/R\$\s*5\.203\.761\.420/)).toBeVisible();
  await expect(pricing.getByText('Fechamento indisponível nesta versão.')).toBeVisible();
  await pricing.getByText('Capitalização e dívida líquida', { exact: true }).click();
  const shares = pricing.getByRole('table', { name: 'Ações por classe' });
  await expect(shares.getByRole('row', { name: /WEGE3/ })).toContainText('4.195.829.691');
  await expect(pricing.getByText(/937\.479\.000/)).toBeVisible();
  await pricing.getByText('Contas usadas nos últimos 12 meses').click();
  const source = pricing.getByRole('table', { name: 'Insumos dos últimos 12 meses' });
  await expect(source.getByRole('row')).toHaveCount(4);
  await expect(source.getByRole('link', { name: /Acumulado comparativo · ITR/ })).toBeVisible();
  await company.selectOption('cvm:19348');
  await expect(pricing.getByText('Lucro da controladora em 12 meses')).toBeVisible();
  await expect(pricing.getByText(/R\$\s*47\.749\.000\.000/)).toBeVisible();
  const historical = pricing.getByRole('region', { name: 'Rendimento implícito histórico' });
  await expect(historical.getByText(/9,33\s*%/)).toBeVisible();
  await expect(historical.getByText(/511\.593\.650\.014,19/)).toBeVisible();
  await expect(historical.getByRole('link', { name: /Nota 19/ })).toBeVisible();
  await company.selectOption('cvm:8133');
  await expect(pricing.getByText(/A posição exata na mesma data-base/)).toBeVisible();
  await expect(pricing.getByText(/2\.074\.041\.000/)).toBeVisible();
  await expect(historical).toHaveCount(0);
});

test('consulta ROIC estimado, ROE e as contas de origem', async ({ page }) => {
  await page.goto('./#/empresas');
  const company = page.getByRole('combobox', { name: 'Companhia' });
  await company.selectOption('cvm:5410');
  await page.getByText('Histórico de qualidade', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ROIC estimado' })).toBeVisible();
  const series = page.getByRole('table', { name: 'Série de qualidade por exercício' });
  await expect(series.getByText(/27,87\s*%/)).toBeVisible();
  await expect(
    page.getByText(/Diferença para o CDI atual.*ROIC estimado de 2025.*\+14,22 p.p./),
  ).toBeVisible();
  await page.getByText('Contas e cálculo de 2025', { exact: true }).click();
  await expect(page.getByText(/SHA-256/).filter({ visible: true })).toHaveCount(1);

  await company.selectOption('cvm:19348');
  await expect(page.getByRole('heading', { name: 'ROE atribuível à controladora' })).toBeVisible();
  await expect(series.getByText(/21,59\s*%/)).toBeVisible();
  await expect(
    page.getByText(/Diferença para o CDI atual.*ROE de 2025.*\+7,94 p.p./),
  ).toBeVisible();
  await expect(page.getByText(/^Ranking indisponível/)).toBeVisible();
});

test('compara ROE de cinco bancos e consulta a conciliação do Santander', async ({ page }) => {
  await page.goto('./#/empresas');
  const table = page.getByRole('table', { name: 'ROE por banco e exercício' });
  await expect(table.getByRole('row')).toHaveCount(6);
  await expect(table.getByRole('columnheader', { name: '2021' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: '2025' })).toBeVisible();
  await expect(table.getByRole('row', { name: /SANTANDER/i }).getByText(/10,44\s*%/)).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: 'Diferença para o CDI atual' }),
  ).toBeVisible();
  await expect(
    table.getByRole('row', { name: /SANTANDER/i }).getByText('-3,21 p.p.'),
  ).toBeVisible();

  await page.getByRole('combobox', { name: 'Banco', exact: true }).selectOption('cvm:20532');
  await page.getByRole('combobox', { name: 'Exercício da DFP' }).selectOption('2022');
  await page.getByText('Contas e cálculo de 2022', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'Demonstrações IFRS auditadas' })).toBeVisible();
  await expect(page.getByText(/DMPL · 5\.05\.01\.02/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Baixar comparação em JSON' })).toBeVisible();
});

test('consulta o CDI em Premissas e permite atualizar após falha', async ({ page }) => {
  await page.route(cdiRateUrl, (route) => route.fulfill({ status: 503 }), { times: 1 });
  await page.goto('./#/valuation');
  const cdi = page.getByRole('region', { name: 'CDI atual' });
  await expect(cdi.getByText('CDI indisponível no Banco Central.')).toBeVisible();
  await cdi.getByRole('button', { name: 'Atualizar CDI' }).click();
  await expect(cdi.getByText(/13,65\s*% a.a./)).toBeVisible();
  await expect(cdi.locator('time')).toHaveAttribute('datetime', '2025-12-15');
  await expect(cdi.getByRole('link', { name: /Banco Central do Brasil/ })).toHaveAttribute(
    'href',
    cdiRateUrl,
  );
});

test.describe('janela móvel', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('abre o menu e navega sem rolagem horizontal', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Metodologia' })
      .click();

    await expect(page).toHaveURL(/#\/metodologia$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Metodologia' })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() => {
      const { scrollWidth, clientWidth } = document.documentElement;
      return scrollWidth > clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('mantém a rolagem da tabela dentro da página de empresas', async ({ page }) => {
    await page.goto('./#/empresas');
    const bankTable = page.getByRole('region', { name: 'Resultados anuais por banco' });
    await expect(bankTable).toBeVisible();
    expect(await bankTable.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    await expect(page.getByRole('table', { name: 'Contas por exercício' })).toBeVisible();
    const scroll = page
      .getByRole('region', { name: 'Contas por exercício' })
      .and(page.locator('.company-table-scroll'));
    expect(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
    await page.locator('summary').filter({ hasText: '2025' }).click();
    await expect(page.getByRole('link', { name: 'ZIP original' })).toBeVisible();
    await page.getByText('Histórico de qualidade', { exact: true }).click();
    await expect(
      page.getByRole('table', { name: 'Série de qualidade por exercício' }),
    ).toBeVisible();
    const price = page.getByRole('region', { name: 'Preço e rendimento implícito' });
    await price.getByText('Contas usadas nos últimos 12 meses').click();
    await expect(price.getByRole('table', { name: 'Insumos dos últimos 12 meses' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  });
});
