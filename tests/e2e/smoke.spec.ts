import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
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
  await expect(page.getByRole('heading', { name: 'Rankings de fundamentos' })).toBeVisible();
  await page.getByRole('link', { name: 'Diretório de empresas' }).click();
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
  await expect(page).toHaveURL(/#\/screener\?visao=companhias$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Screener e Rankings' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('consulta a amostra oficial no build hospedado em subdiretório', async ({ page }) => {
  await page.goto('./#/empresas');
  await page.getByText('Dados complementares', { exact: true }).click();
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
  await page.getByText('Dados complementares', { exact: true }).click();
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
  await page.getByText('Dados complementares', { exact: true }).click();
  const company = page.getByRole('combobox', { name: 'Companhia' });
  await company.selectOption('cvm:5410');
  await page.getByText('Histórico de qualidade', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ROIC estimado' })).toBeVisible();
  const series = page.getByRole('table', { name: 'Série de qualidade por exercício' });
  await expect(series.getByText(/29,15\s*%/)).toBeVisible();
  await expect(
    page.getByText(/Diferença para o CDI atual.*ROIC estimado de 2025.*\+15,50 p.p./),
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
  await page.getByText('Dados complementares', { exact: true }).click();
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

test('calcula DDM, mostra sensibilidade e salva premissas por modelo e cenário', async ({
  page,
}) => {
  await page.goto('./#/valuation');
  await page.getByText('Premissas manuais', { exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar CDI como desconto' }).click();
  const discount = page.getByLabel('Taxa de desconto (% a.a.)');
  await expect(discount).toHaveValue('13,65');
  await page.getByRole('combobox', { name: 'Modelo' }).selectOption('ddm');
  await expect(discount).toHaveValue('');
  await discount.fill('10');
  await page.getByLabel('Crescimento na perpetuidade (% a.a.)').fill('10');
  await page.getByLabel('Ações em circulação (milhões)').fill('100');
  await page.getByRole('button', { name: 'Calcular valuation' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /deve superar/ })).toBeVisible();
  await page.getByLabel('Crescimento na perpetuidade (% a.a.)').fill('0');
  await page.getByLabel('Preço de referência (R$/ação, opcional)').fill('8');
  for (let year = 1; year <= 10; year++) {
    await page.getByLabel(`Lucro líquido do ano ${year} (R$ mi)`, { exact: true }).fill('200');
    await page.getByLabel(`Payout do ano ${year} (%)`, { exact: true }).fill('50');
  }
  await page.getByRole('button', { name: 'Calcular valuation' }).click();
  const result = page.getByRole('region', { name: 'Resultado do cenário' });
  await expect(result.getByText(/20,00\s*%/)).toBeVisible();
  await expect(result.getByText(/25,00\s*%/)).toBeVisible();
  await expect(
    result.getByRole('table', { name: 'Sensibilidade do valor por ação' }).getByRole('row'),
  ).toHaveCount(4);
  await page.getByRole('button', { name: 'Salvar no navegador' }).click();
  await page.reload();
  await page.getByText('Premissas manuais', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Modelo' }).selectOption('ddm');
  await expect(discount).toHaveValue('10');
  await page.getByRole('combobox', { name: 'Cenário' }).selectOption('otimista');
  await expect(discount).toHaveValue('');
});

test('aplica as referências contábeis da WEG às premissas sem preencher as projeções', async ({
  page,
}) => {
  await page.goto('./#/valuation');
  await page.getByText('Premissas manuais', { exact: true }).click();
  const reference = page.getByRole('region', { name: 'Referências contábeis' });
  await reference
    .getByRole('combobox', { name: 'Companhia de referência' })
    .selectOption('cvm:5410');
  await reference.getByRole('button', { name: 'Aplicar referências ao cenário' }).click();
  await expect(page.getByLabel('Dívida líquida (R$ mi)')).toHaveValue('-937,479');
  await expect(page.getByLabel('Outros ajustes ao patrimônio (R$ mi)')).toHaveValue('-1410,309');
  await expect(page.getByLabel('Ações em circulação (milhões)')).toHaveValue('4195,829691');
  await expect(page.getByLabel('Receita do ano 1 (R$ mi)', { exact: true })).toHaveValue('');
});

test('calcula DCF após importar premissas e exporta o cenário', async ({ page }) => {
  await page.goto('./#/valuation');
  await page.getByText('Premissas manuais', { exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar premissas' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('moat-cenarios-valuation.json');
  const file = await download.path();
  if (file === null) throw new Error('Arquivo exportado indisponível.');
  const payload = JSON.parse(await readFile(file, 'utf8'));
  const dcf = payload.scenarios.dcf.base;
  Object.assign(dcf, {
    discountRate: '10',
    terminalGrowth: '0',
    shares: '100',
    netDebt: '200',
    equityAdjustments: '-25',
  });
  for (const year of dcf.years) {
    Object.assign(year, {
      revenue: '500',
      ebitMargin: '30',
      taxRate: '20',
      depreciation: '30',
      capex: '40',
      workingCapitalChange: '10',
    });
  }
  await page.getByLabel('Arquivo de premissas').setInputFiles({
    name: 'cenarios-teste.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await expect(page.getByText('Cenários importados.')).toBeVisible();
  await page.getByRole('button', { name: 'Calcular valuation' }).click();
  const result = page.getByRole('region', { name: 'Resultado do cenário' });
  await expect(result.getByRole('strong')).toHaveText(/R\$\s*7,75/);
  await expect(result.getByText('Valor da firma (R$ mi)')).toBeVisible();
});

test('salva uma carteira e exige meses completos para calcular a retrospectiva', async ({
  page,
}) => {
  await page.goto('./#/carteiras');
  await expect(page.getByRole('combobox', { name: 'Quantidade de companhias' })).toHaveValue('10');
  await page.getByRole('combobox', { name: 'Quantidade de companhias' }).selectOption('custom');
  await page.getByLabel('Quantidade personalizada (1 a 50)').fill('1');
  await page.getByRole('searchbox', { name: 'Buscar companhia' }).fill('WEG S.A.');
  await page.getByRole('combobox', { name: 'Companhia para adicionar' }).selectOption('WEG S.A.');
  await page.getByRole('button', { name: 'Adicionar companhia' }).click();
  await page.getByRole('combobox', { name: 'Distribuição de pesos' }).selectOption('custom');
  await page.getByLabel('Peso de WEG S.A. (%)').fill('90');
  await page.getByLabel('Capital inicial (R$)').fill('1000');
  await page.getByRole('button', { name: 'Salvar carteira' }).click();
  await expect(page.getByRole('alert')).toContainText('exatamente 100%');
  await page.getByLabel('Peso de WEG S.A. (%)').fill('100');
  await page.getByRole('button', { name: 'Salvar carteira' }).click();
  await expect(page.getByText('Carteira salva neste navegador.')).toBeVisible();
  await page.getByRole('link', { name: 'Abrir simulador' }).click();

  const button = page.getByRole('button', { name: 'Calcular retrospectiva' });
  await expect(button).toBeDisabled();
  const rows = [
    { date: '2023-12-28', level: 100 },
    { date: '2024-01-31', level: 110 },
    { date: '2024-02-29', level: 120 },
  ];
  for (const complete of [false, true]) {
    const history = {
      schemaVersion: '1.0.0',
      basis: 'total-return-brl',
      source: {
        name: 'Séries de teste',
        retrievedAt: '2024-03-01T12:00:00-03:00',
        methodology: 'Dados fictícios da suíte de testes.',
      },
      assets: [
        {
          company: 'WEG S.A.',
          instrument: 'WEGE3',
          observations: complete ? rows : [rows[0], rows[2]],
        },
      ],
      benchmarks: [{ symbol: 'IBOV', observations: rows }],
    };
    await page.getByLabel('Arquivo de séries diárias ou mensais (JSON)').setInputFiles({
      name: 'fixture.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(history)),
    });
    await button.click();
    if (!complete)
      await expect(page.getByRole('alert')).toContainText('Falta observação em 2024-01');
  }
  const result = page.getByRole('region', { name: 'Resultado da retrospectiva' });
  await expect(result.getByText('Patrimônio final após tributo')).toBeVisible();
  await expect(
    result.getByRole('table', { name: 'Evolução mensal da carteira' }).getByRole('row'),
  ).toHaveCount(4);
  await expect(page.getByRole('row', { name: /^IBOV/ })).toContainText('20,00%');
  await expect(page.getByRole('row', { name: /^SMAL11/ })).toContainText('Indisponível');
  await page.getByText('Correlação dos retornos mensais', { exact: true }).click();
  await expect(page.getByText('Indisponível para as séries nesta janela.')).toBeVisible();
  await result.getByText('Retorno por ano', { exact: true }).click();
  await expect(result.getByRole('row', { name: /^2024/ })).toContainText('2 de 12');
  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(result).toBeVisible();
});

test('exporta e restaura uma carteira em JSON sem substituir a carteira salva até confirmar', async ({
  page,
}) => {
  await page.goto('./#/carteiras');
  const quantity = page.getByLabel('Quantidade personalizada (1 a 50)');
  const distribution = page.getByRole('combobox', { name: 'Distribuição de pesos' });
  const company = page.getByRole('combobox', { name: 'Companhia para adicionar' });
  const add = page.getByRole('button', { name: 'Adicionar companhia' });
  const save = page.getByRole('button', { name: 'Salvar carteira' });
  const capital = page.getByLabel('Capital inicial (R$)', { exact: true });
  const amountFields = [
    ['Aporte mensal (R$)', '100,21'],
    ['Custo por operação (%)', '0,15'],
    ['Tributo sobre ganho ao final (%), hipótese', '17,5'],
    ['Limite por companhia (%, opcional)', '60'],
  ] as const;
  const wegWeight = page.getByLabel('Peso de WEG S.A. (%)');
  const rennerWeight = page.getByLabel('Peso de LOJAS RENNER S.A. (%)');
  const rebalance = page.getByRole('combobox', { name: 'Rebalanceamento' });
  const attachment = page.getByLabel('Arquivo de carteira (JSON)');
  const importFile = (content: string | Buffer) => ({
    name: 'carteira-teste.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });

  await page.getByRole('combobox', { name: 'Quantidade de companhias' }).selectOption('custom');
  await quantity.fill('1');
  await company.selectOption('WEG S.A.');
  await add.click();
  await capital.fill('1000');
  await save.click();
  await expect(page.getByText('Carteira salva neste navegador.')).toBeVisible();

  await quantity.fill('2');
  await company.selectOption('LOJAS RENNER S.A.');
  await add.click();
  await distribution.selectOption('custom');
  await wegWeight.fill('57,1250');
  await rennerWeight.fill('42,8750');
  await capital.fill('2500,50');
  for (const [label, value] of amountFields) await page.getByLabel(label).fill(value);
  await rebalance.selectOption('monthly');
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar carteira em JSON' }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const path = await download.path();
  if (path === null) throw new Error('O navegador não salvou o arquivo de carteira.');
  const backup = await readFile(path);
  const payload = {
    schemaVersion: '1.0.0',
    draft: {
      target: 'custom',
      customTarget: '2',
      method: 'custom',
      positions: [
        { name: 'WEG S.A.', weight: '57,1250' },
        { name: 'LOJAS RENNER S.A.', weight: '42,8750' },
      ],
      capital: '2500,50',
      contribution: '100,21',
      cost: '0,15',
      gainTax: '17,5',
      maxWeight: '60',
      rebalance: 'monthly',
    },
  };
  expect(JSON.parse(backup.toString('utf8'))).toEqual(payload);

  await capital.fill('3333');
  await attachment.setInputFiles(importFile('{'));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(capital).toHaveValue('3333');
  payload.draft.positions[1] = {
    name: 'COMPANHIA FICTÍCIA DE TESTE',
    weight: '42,8750',
  };
  await attachment.setInputFiles(importFile(JSON.stringify(payload)));
  await expect(page.getByRole('alert')).toContainText('COMPANHIA FICTÍCIA DE TESTE');
  await expect(capital).toHaveValue('3333');
  await expect(rennerWeight).toHaveValue('42,8750');

  await page.getByRole('link', { name: 'Abrir simulador' }).click();
  await expect(page.getByText('1 companhia na carteira salva')).toBeVisible();
  await page.getByRole('link', { name: 'Editar carteira' }).click();
  await expect(capital).toHaveValue('1000');

  const pendingFile = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar carteira em JSON' }).click();
  await (await pendingFile).setFiles(importFile(backup));
  await expect(
    page.getByText('Carteira importada. Confira os parâmetros e salve para usar no simulador.'),
  ).toBeVisible();
  await expect(quantity).toHaveValue('2');
  await expect(distribution).toHaveValue('custom');
  await expect(wegWeight).toHaveValue('57,1250');
  await expect(rennerWeight).toHaveValue('42,8750');
  await expect(capital).toHaveValue('2500,50');
  for (const [label, value] of amountFields)
    await expect(page.getByLabel(label)).toHaveValue(value);
  await expect(rebalance).toHaveValue('monthly');

  await page.getByRole('link', { name: 'Abrir simulador' }).click();
  await expect(page.getByText('1 companhia na carteira salva')).toBeVisible();
  await page.getByRole('link', { name: 'Editar carteira' }).click();
  await expect(page.getByRole('button', { name: 'Importar carteira em JSON' })).toBeEnabled();
  await attachment.setInputFiles(importFile(backup));
  await expect(capital).toHaveValue('2500,50');
  await save.click();
  await page.getByRole('link', { name: 'Abrir simulador' }).click();
  await expect(page.getByText('2 companhias na carteira salva')).toBeVisible();
});

test.describe('janela móvel', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('mantém Carteiras e Simulador dentro da largura da página', async ({ page }) => {
    await page.goto('./#/carteiras');
    await expect(page.getByRole('heading', { name: 'Composição da carteira' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
    await page.getByRole('link', { name: 'Abrir simulador' }).click();
    await expect(page.getByRole('heading', { name: 'Carteira salva indisponível' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  });

  test('mantém o editor de valuation dentro da largura da página', async ({ page }) => {
    await page.goto('./#/valuation');
    await page.getByText('Premissas manuais', { exact: true }).click();
    const projections = page.getByRole('region', { name: 'Editor de projeções anuais' });
    await expect(projections).toBeVisible();
    expect(await projections.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  });

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
    await page.getByText('Dados complementares', { exact: true }).click();
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
