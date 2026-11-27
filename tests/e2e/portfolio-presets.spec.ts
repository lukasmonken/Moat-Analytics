import { expect, test } from '@playwright/test';
import { serveCvm2025 } from './annual-fixtures';

const bbSeguridade = 'BB SEGURIDADE PARTICIPAÇÕES S.A.';
const csnMineracao = 'CSN MINERAÇÃO S.A.';
const cury = 'CURY CONSTRUTORA E INCORPORADORA S.A.';
const plano = 'PLANO & PLANO DESENVOLVIMENTO IMOBILIÁRIO S.A.';

test('aplica os quatro modelos de carteira sem sobrescrever a carteira salva', async ({ page }) => {
  await serveCvm2025(page);
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

test('leva as dez primeiras companhias do ranking filtrado para a carteira temporária', async ({
  page,
}) => {
  await serveCvm2025(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./#/carteiras');

  const target = page.getByLabel('Quantidade de companhias', { exact: true });
  const customTarget = page.getByLabel('Quantidade personalizada (1 a 50)');
  const method = page.getByLabel('Distribuição de pesos');
  const capital = page.getByLabel('Capital inicial (R$)', { exact: true });
  const contribution = page.getByLabel('Aporte mensal (R$)', { exact: true });
  const cost = page.getByLabel('Custo por operação (%)', { exact: true });
  const tax = page.getByLabel('Tributo sobre ganho ao final (%), hipótese', { exact: true });
  const maxWeight = page.getByLabel('Limite por companhia (%, opcional)', { exact: true });
  const rebalance = page.getByLabel('Rebalanceamento', { exact: true });
  const positions = page.getByRole('table', { name: 'Composição e pesos' }).locator('tbody');
  const names = positions.getByRole('rowheader');

  await target.selectOption('custom');
  await customTarget.fill('1');
  await method.selectOption('custom');
  await page.getByLabel('Companhia para adicionar').selectOption('WEG S.A.');
  await page.getByRole('button', { name: 'Adicionar companhia' }).click();
  await page.getByLabel('Peso de WEG S.A. (%)').fill('100');
  await capital.fill('1000');
  await contribution.fill('55');
  await cost.fill('0,3');
  await tax.fill('15');
  await maxWeight.fill('100');
  await rebalance.selectOption('monthly');
  await page.getByRole('button', { name: 'Salvar carteira' }).click();
  await expect(page.getByText('Carteira salva neste navegador.')).toBeVisible();

  await page.getByRole('link', { name: 'Screener e Rankings', exact: true }).click();
  const ranking = page.getByRole('region', { name: 'Rankings de fundamentos' });
  await ranking.getByLabel('Grupo do indicador').selectOption('ROE');
  await ranking.getByLabel('Ranking', { exact: true }).selectOption('profitability');
  await ranking.getByRole('checkbox', { name: /5 anos de histórico/ }).check();
  await ranking.getByRole('button', { name: 'Próxima página' }).click();
  await expect(ranking.getByText('Página 2 de 2')).toBeVisible();
  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await ranking.getByRole('button', { name: 'Criar carteira', exact: true }).click();

  await expect(page).toHaveURL(/#\/carteiras$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(target).toHaveValue('10');
  await expect(method).toHaveValue('equal');
  await expect(names).toHaveText([
    bbSeguridade,
    'BRADSAÚDE S.A.',
    'BCO PINE S.A',
    'CAIXA SEGURIDADE PARTICIPAÇÕES S.A.',
    'BCO BTG PACTUAL S.A.',
    'PORTO SEGURO S.A.',
    'BRBI BR PARTNERS S.A',
    'ITAU UNIBANCO HOLDING S.A.',
    'BANCO DO ESTADO DO RIO GRANDE DO SUL SA',
    'BCO BRADESCO S.A.',
  ]);
  await expect(page.getByText(/Rascunho iniciado com o ranking ROE · Rentabilidade/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(positions.getByRole('cell', { name: '10%', exact: true })).toHaveCount(10);
  await expect(capital).toHaveValue('1000');
  await expect(contribution).toHaveValue('55');
  await expect(cost).toHaveValue('0,3');
  await expect(tax).toHaveValue('15');
  await expect(maxWeight).toHaveValue('100');
  await expect(rebalance).toHaveValue('monthly');

  await page.reload();
  await expect(names).toHaveText(['WEG S.A.']);
  await expect(target).toHaveValue('custom');
  await expect(customTarget).toHaveValue('1');
  await expect(method).toHaveValue('custom');
  await expect(page.getByLabel('Peso de WEG S.A. (%)')).toHaveValue('100');
});

test('usa somente as companhias com o critério selecionado no resultado dos filtros', async ({
  page,
}) => {
  await serveCvm2025(page);
  await page.goto('./#/screener');
  const ranking = page.getByRole('region', { name: 'Rankings de fundamentos' });
  const create = ranking.getByRole('button', { name: 'Criar carteira', exact: true });
  const search = ranking.getByLabel('Buscar companhia', { exact: true });
  const results = ranking.getByRole('region', { name: 'Resultados de fundamentos' });

  await ranking.getByLabel('Grupo do indicador').selectOption('ROE');
  await ranking.getByLabel('Ranking', { exact: true }).selectOption('growth');
  await ranking.getByLabel('Setor', { exact: true }).selectOption('Bancos');
  await search.fill('ABC Brasil');
  await expect(results.getByRole('row', { name: /BCO ABC BRASIL/ })).toContainText('Indisponível');
  await expect(create).toBeDisabled();

  await search.fill('companhia sem correspondência');
  await expect(ranking.getByText('Nenhuma companhia encontrada', { exact: true })).toBeVisible();
  await expect(create).toBeDisabled();

  await search.fill('BCO');
  await expect(results.getByRole('rowheader')).toHaveCount(6);
  await create.click();

  await expect(page).toHaveURL(/#\/carteiras$/);
  const positions = page.getByRole('table', { name: 'Composição e pesos' }).locator('tbody');
  const names = positions.getByRole('rowheader');
  const expected = [
    'BCO PINE S.A',
    'BCO BTG PACTUAL S.A.',
    'BCO BRADESCO S.A.',
    'BCO SANTANDER (BRASIL) S.A.',
    'BCO BRASIL S.A.',
  ];
  await expect(names).toHaveText(expected);
  await expect(positions.getByRole('cell', { name: '20%', exact: true })).toHaveCount(5);
  await expect(page.getByLabel('Quantidade personalizada (1 a 50)')).toHaveValue('5');
  await page.getByLabel('Capital inicial (R$)', { exact: true }).fill('1000');
  await page.getByRole('button', { name: 'Salvar carteira' }).click();
  await expect(page.getByText('Carteira salva neste navegador.')).toBeVisible();
  await page.reload();
  await expect(names).toHaveText(expected);
});

test('preserva a seleção do ranking enquanto o diretório da CVM é reconsultado', async ({
  page,
}) => {
  await serveCvm2025(page);
  let directoryUnavailable = true;
  await page.route('**/cvm-company-selection-*.json', (route) =>
    directoryUnavailable ? route.fulfill({ status: 503 }) : route.fallback(),
  );
  await page.goto('./#/screener');

  const ranking = page.getByRole('region', { name: 'Rankings de fundamentos' });
  await ranking.getByLabel('Grupo do indicador').selectOption('ROE');
  await ranking.getByLabel('Buscar companhia').fill('BB Seguridade');
  await ranking.getByRole('button', { name: 'Criar carteira', exact: true }).click();
  await expect(page.getByText('Falha ao carregar o diretório da CVM.')).toBeVisible();
  const positions = page.getByRole('table', { name: 'Composição e pesos' });
  await expect(positions).toHaveCount(0);

  directoryUnavailable = false;
  await page.getByRole('button', { name: 'Recarregar diretório' }).click();
  await expect(positions.locator('tbody').getByRole('rowheader')).toHaveText([bbSeguridade]);
  await expect(positions.locator('tbody').getByRole('cell', { name: '100%' })).toBeVisible();
});
