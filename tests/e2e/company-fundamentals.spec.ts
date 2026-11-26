import { expect, test } from '@playwright/test';

test('filtra endividamento e reinvestimento e exibe margens só para empresas de ROIC', async ({
  page,
}) => {
  await page.goto('./#/empresas');
  const region = page.getByRole('region', { name: 'Comparar empresas' });
  const search = region.getByLabel('Buscar empresa', { exact: true });
  const leverage = region.getByLabel('Dívida líquida/EBITDA máxima');
  const moat = region.getByLabel('NOPAT/reinvestimento mínimo');
  await search.fill('WEG');
  const weg = region.getByRole('row', { name: /WEG S.A./ });
  await expect(weg).toContainText('-0,19×');
  await expect(weg).toContainText('1,28×');
  await leverage.fill('-0,2');
  await expect(weg).toHaveCount(0);
  await leverage.fill('0');
  await expect(weg).toBeVisible();
  await moat.fill('1,3');
  await expect(weg).toHaveCount(0);
  await moat.fill('1,25');
  await expect(weg).toBeVisible();

  await weg.getByRole('button', { name: /Ver cálculo/ }).click();
  const margins = region.getByRole('region', { name: 'Margens de 2025' });
  await expect(margins).toContainText('Margem bruta33,53%');
  await expect(margins).toContainText('Margem operacional19,60%');
  await expect(margins).toContainText('Margem líquida16,61%');

  await leverage.fill('');
  await moat.fill('');
  await region.getByLabel('Indicador', { exact: true }).selectOption('ROE');
  await search.fill('Itaú Unibanco');
  await region.getByRole('button', { name: /Ver cálculo de ITAU UNIBANCO/ }).click();
  await expect(margins).toHaveCount(0);
});
