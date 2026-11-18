import { expect, test } from '@playwright/test';

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
  await expect(page.getByRole('heading', { name: 'Dados ainda não integrados' })).toBeVisible();
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
});
