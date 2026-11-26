import { expect, test } from '@playwright/test';

const bbSeguridade = 'BB SEGURIDADE PARTICIPAÇÕES S.A.';
const csnMineracao = 'CSN MINERAÇÃO S.A.';
const cury = 'CURY CONSTRUTORA E INCORPORADORA S.A.';
const plano = 'PLANO & PLANO DESENVOLVIMENTO IMOBILIÁRIO S.A.';

test('aplica os quatro modelos de carteira sem sobrescrever a carteira salva', async ({ page }) => {
  await page.goto('./#/carteiras');
  const model = page.getByLabel('Modelo de carteira');
  const apply = page.getByRole('button', { name: 'Aplicar ao rascunho' });
  const selected = page.getByRole('table', { name: 'Composição e pesos' }).locator('tbody');
  const names = selected.getByRole('rowheader');

  await expect(apply).toBeDisabled();
  await page.getByLabel('Capital inicial (R$)', { exact: true }).fill('1000');
  await page.getByLabel('Aporte mensal (R$)', { exact: true }).fill('55');
  await page.getByLabel('Distribuição de pesos').selectOption('custom');
  await model.selectOption({ label: 'Maiores ROEs' });
  await expect(page.getByText('Demonstrações da CVM · exercício 2025')).toBeVisible();
  await expect(names).toHaveCount(0);
  await apply.click();
  await expect(names).toHaveCount(10);
  await expect(names.first()).toHaveText(bbSeguridade);
  await expect(selected.getByRole('cell', { name: '10%' })).toHaveCount(10);
  await expect(page.getByLabel('Distribuição de pesos')).toHaveValue('equal');
  await expect(page.getByLabel('Aporte mensal (R$)', { exact: true })).toHaveValue('55');
  await page.getByRole('button', { name: 'Salvar carteira' }).click();
  await expect(page.getByText('Carteira salva neste navegador.')).toBeVisible();

  await model.selectOption({ label: 'Maiores ROICs' });
  await apply.click();
  await expect(names).toHaveCount(10);
  await expect(names.first()).toHaveText(csnMineracao);
  await expect(selected.getByRole('rowheader', { name: plano, exact: true })).toBeVisible();

  await model.selectOption({ label: 'ROE e ROIC (até 5 de cada)' });
  await apply.click();
  await expect(names).toHaveCount(10);
  await expect(names.nth(0)).toHaveText(bbSeguridade);
  await expect(names.nth(5)).toHaveText(csnMineracao);

  await model.selectOption({ label: 'Melhor ROIC por setor' });
  await apply.click();
  await expect(names).toHaveCount(10);
  await expect(names.first()).toHaveText(csnMineracao);
  await expect(selected.getByRole('rowheader', { name: cury, exact: true })).toBeVisible();
  await expect(selected.getByRole('rowheader', { name: plano, exact: true })).toHaveCount(0);

  await page.reload();
  await expect(names).toHaveCount(10);
  await expect(names.first()).toHaveText(bbSeguridade);
});

test('mantém a seleção manual quando falta a fonte de um modelo e permite reconsulta', async ({
  page,
}) => {
  const roicUrl = '**/cvm-sector-roic-*.json';
  await page.route(roicUrl, (route) => route.fulfill({ status: 503 }));
  await page.goto('./#/carteiras');
  await page.getByLabel('Modelo de carteira').selectOption({ label: 'Maiores ROICs' });
  await expect(page.getByText('Falha ao carregar os indicadores da CVM.')).toBeVisible();
  const apply = page.getByRole('button', { name: 'Aplicar ao rascunho' });
  await expect(apply).toBeDisabled();

  await page.getByLabel('Companhia para adicionar').selectOption('WEG S.A.');
  await page.getByRole('button', { name: 'Adicionar companhia' }).click();
  await expect(page.getByRole('rowheader', { name: 'WEG S.A.' })).toBeVisible();

  await page.unroute(roicUrl);
  await page.getByRole('button', { name: 'Recarregar modelos' }).click();
  await expect(apply).toBeEnabled();
  await expect(page.getByRole('rowheader', { name: 'WEG S.A.' })).toBeVisible();
});
