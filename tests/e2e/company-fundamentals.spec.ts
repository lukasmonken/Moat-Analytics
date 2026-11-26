import { expect, test } from '@playwright/test';
import { serveCvm2025 } from './annual-fixtures';

test('filtra endividamento e reinvestimento e exibe margens só para empresas de ROIC', async ({
  page,
}) => {
  await serveCvm2025(page);
  await page.goto('./#/empresas');
  const region = page.getByRole('region', { name: 'Comparar empresas' });
  const search = region.getByLabel('Buscar empresa', { exact: true });
  const leverage = region.getByLabel('Faixa de dívida líquida/EBITDA');
  const moat = region.getByLabel('Faixa de NOPAT/reinvestimento');
  await search.fill('WEG');
  const weg = region.getByRole('row', { name: /WEG S.A./ });
  await expect(weg).toContainText('-0,19×');
  await expect(weg).toContainText('1,28×');
  await expect(leverage).toHaveValue('all');
  await leverage.selectOption('0-1');
  await expect(weg).toHaveCount(0);
  await leverage.selectOption('negative');
  await expect(weg).toBeVisible();
  await moat.selectOption('2-3');
  await expect(weg).toHaveCount(0);
  await moat.selectOption('1-2');
  await expect(weg).toBeVisible();

  await weg.getByRole('button', { name: /Ver cálculo/ }).click();
  const margins = region.getByRole('region', { name: 'Margens de 2025' });
  await expect(margins).toContainText('Margem bruta33,53%');
  await expect(margins).toContainText('Margem operacional19,60%');
  await expect(margins).toContainText('Margem líquida16,61%');

  await region.getByLabel('Exercício', { exact: true }).selectOption('2024');
  await expect(leverage).toHaveCount(0);
  await expect(moat).toHaveCount(0);
  await expect(weg).toBeVisible();

  await region.getByLabel('Exercício', { exact: true }).selectOption('2025');
  await expect(leverage).toHaveValue('negative');
  await expect(moat).toHaveValue('1-2');
  await search.fill('Camil');
  const camil = region.getByRole('row', { name: /CAMIL ALIMENTOS/ });
  await expect(camil).toHaveCount(0);
  await leverage.selectOption('unavailable');
  await moat.selectOption('unavailable');
  await expect(camil).toBeVisible();

  await region.getByLabel('Indicador', { exact: true }).selectOption('ROE');
  await expect(leverage).toHaveCount(0);
  await expect(moat).toHaveCount(0);
  await search.fill('Itaú Unibanco');
  await region.getByRole('button', { name: /Ver cálculo de ITAU UNIBANCO/ }).click();
  await expect(margins).toHaveCount(0);
});
