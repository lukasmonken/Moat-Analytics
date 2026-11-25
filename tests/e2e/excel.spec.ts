import { expect, test, type Locator, type Page } from '@playwright/test';
import { fromArrayBuffer, loadWorkbook } from '@office-kit/xlsx/io';
import { getSheet, sheetNames } from '@office-kit/xlsx/workbook';
import { getAutoFilter, getCell } from '@office-kit/xlsx/worksheet';
import { readFile } from 'node:fs/promises';
import { cdiRateUrl } from '../../apps/web/src/shared/data-client/riskFreeRate';

async function workbookDownload(
  page: Page,
  label: string,
  filename: string,
  scope: Page | Locator = page,
) {
  const result = page.waitForEvent('download');
  await scope.getByRole('button', { name: label, exact: true }).click();
  const download = await result;
  expect(download.suggestedFilename()).toBe(filename);
  const path = await download.path();
  if (path === null) throw new Error('O navegador não salvou o download.');
  const workbook = await loadWorkbook(fromArrayBuffer(await readFile(path)));
  expect(sheetNames(workbook)).toContain('Metodologia e fontes');
  return workbook;
}

test('exporta o screener filtrado e completo sem afiliações de índices', async ({ page }) => {
  await page.goto('./#/screener');
  await page.getByRole('searchbox', { name: 'Companhia' }).fill('WEG S.A.');
  const filtered = await workbookDownload(page, 'Exportar Excel', 'moat-companhias.xlsx');
  expect(sheetNames(filtered)).toEqual(['Companhias', 'Metodologia e fontes']);
  const rows = getSheet(filtered, 'Companhias');
  if (!rows) throw new Error('Aba ausente.');
  expect(getAutoFilter(rows)?.ref).toBe('A1:A2');
  expect(getCell(rows, 2, 1)?.value).toBe('WEG S.A.');
  await page.getByRole('combobox', { name: 'Linhas para exportar' }).selectOption('all');
  const all = await workbookDownload(page, 'Exportar Excel', 'moat-companhias.xlsx');
  const allRows = getSheet(all, 'Companhias');
  if (!allRows) throw new Error('Aba ausente.');
  expect(getAutoFilter(allRows)?.ref).toBe('A1:A145');
});

test('exporta as quatro consultas contábeis de Empresas', async ({ page }) => {
  await page.route(cdiRateUrl, (route) =>
    route.fulfill({ json: [{ data: '15/12/2025', valor: '13.65' }] }),
  );
  await page.goto('./#/empresas');
  await page.getByText('Dados complementares', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Companhia' }).selectOption('cvm:5410');
  await page.getByText('Histórico de qualidade', { exact: true }).click();
  const reports = [
    ['Exportar contas em Excel', 'moat-contas-cvm-5410.xlsx', 'Contas anuais'],
    ['Exportar série em Excel', 'moat-qualidade-cvm-5410.xlsx', 'Série anual'],
    ['Exportar comparação em Excel', 'moat-roe-bancos.xlsx', 'Comparação entre bancos'],
    ['Exportar fundamentos em Excel', 'moat-fundamentos-cvm-5410.xlsx', 'Resultado de 12 meses'],
  ] as const;
  for (const [label, name, sheet] of reports) {
    expect(sheetNames(await workbookDownload(page, label, name))).toContain(sheet);
  }
});

test('compara ROE e ROIC na mesma lista e exporta toda a seleção', async ({ page }) => {
  await page.route(cdiRateUrl, (route) =>
    route.fulfill({ json: [{ data: '15/12/2025', valor: '13.65' }] }),
  );
  await page.goto('./#/empresas');
  const region = page.getByRole('region', { name: 'Comparar empresas' });
  const table = region.getByRole('table', { name: 'Indicadores das empresas' });
  const search = region.getByLabel('Buscar empresa');
  await expect(region.getByText('144 de 144 companhias')).toBeVisible();
  await search.fill('ITAU UNIBANCO');
  const bank = table.getByRole('row', { name: /ITAU UNIBANCO HOLDING/ });
  await expect(bank.getByRole('cell', { name: 'ROE', exact: true })).toBeVisible();
  await expect(bank).toContainText(/21,59\s*%/);
  await expect(bank).toContainText(/\+7,94\s*p\.p\./);
  await bank.getByRole('button', { name: 'Ver cálculo de ITAU UNIBANCO HOLDING S.A.' }).click();
  const details = region.getByRole('region', { name: 'ITAU UNIBANCO HOLDING S.A. · 2025' });
  await expect(
    details.getByText('Patrimônio médio da controladora', { exact: true }),
  ).toBeVisible();
  await expect(details.getByRole('link', { name: 'Formulário DFP na CVM' })).toBeVisible();

  const exportComparison = () =>
    workbookDownload(page, 'Exportar Excel', 'moat-comparativo-empresas.xlsx', region);
  const workbook = await exportComparison();
  const rows = getSheet(workbook, 'Comparativo');
  const accounts = getSheet(workbook, 'Contas e saldos');
  if (!rows || !accounts) throw new Error('Aba ausente.');
  expect(getCell(rows, 2, 1)?.value).toBe('ITAU UNIBANCO HOLDING S.A.');
  expect(getCell(rows, 2, 3)?.value).toBe('ROE');
  expect(getCell(rows, 2, 5)?.value).toBeCloseTo(0.215870892296, 9);
  expect(getCell(rows, 2, 6)?.value).toBeCloseTo(7.9370892296, 9);
  expect(getCell(accounts, 2, 6)?.value).toBe(44_857_000_000);

  await search.fill('VALE S.A.');
  const miner = table.getByRole('row', { name: /^VALE S\.A\./ });
  await expect(miner.getByRole('cell', { name: /ROIC/ })).toBeVisible();
  await expect(miner).toContainText(/7,58\s*%/);
  await miner.getByRole('button', { name: 'Ver cálculo de VALE S.A.' }).click();
  const roic = region.getByRole('region', { name: 'VALE S.A. · 2025' });
  await expect(roic.getByText(/31\.969\.000\.000/)).toBeVisible();
  await expect(roic.getByRole('row', { name: /Caixa e equivalentes/ })).toBeVisible();
  await expect(roic.getByRole('link', { name: 'Demonstrações de apoio' })).toBeVisible();
  const roicReport = getSheet(await exportComparison(), 'Comparativo');
  if (!roicReport) throw new Error('Aba ausente.');
  expect(getCell(roicReport, 2, 5)?.value).toBeCloseTo(0.075759868297, 9);

  await region.getByLabel('Exercício').selectOption('2024');
  await expect(table.getByRole('columnheader', { name: 'Diferença para o CDI atual' })).toHaveCount(
    0,
  );
  await region.getByLabel('Linhas para exportar').selectOption('all');
  const all = getSheet(await exportComparison(), 'Comparativo');
  if (!all) throw new Error('Aba ausente.');
  expect(getAutoFilter(all)?.ref?.split(':')[1]).toMatch(/^[A-Z]+145$/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('mantém empresas sem ROIC na lista e pagina o setor inteiro', async ({ page }) => {
  await page.route(cdiRateUrl, (route) => route.fulfill({ json: [] }));
  await page.goto('./#/empresas');
  const region = page.getByRole('region', { name: 'Comparar empresas' });
  const rows = region.getByRole('table', { name: 'Indicadores das empresas' }).getByRole('row');
  await region
    .getByLabel('Setor', { exact: true })
    .selectOption({ label: 'Serviços Transporte e Logística' });
  await region.getByLabel('Linhas por página').selectOption('5');
  await expect(rows).toHaveCount(6);
  const pagination = region.getByRole('navigation', { name: 'Paginação das empresas' });
  await pagination.getByRole('button', { name: 'Próxima página' }).click();
  await expect(pagination).toContainText('Página 2 de 2');
  await expect(rows).toHaveCount(6);
  const workbook = await workbookDownload(
    page,
    'Exportar Excel',
    'moat-comparativo-empresas.xlsx',
    region,
  );
  const report = getSheet(workbook, 'Comparativo');
  if (!report) throw new Error('Aba ausente.');
  expect(getCell(report, 11, 2)?.value).toBe('Serviços Transporte e Logística');
  expect(getCell(report, 12, 1)?.value).toBeUndefined();

  await region.getByLabel('Setor', { exact: true }).selectOption({ label: 'Papel e Celulose' });
  await expect(rows.nth(1)).toContainText(/KLABIN S\.A\..*6,69\s*%/s);
  await expect(rows.nth(2)).toContainText(/SUZANO S\.A\..*5,35\s*%/s);
  await region.getByLabel('Exercício').selectOption('2024');
  await expect(rows.nth(1)).toContainText(/KLABIN S\.A\..*Indisponível/s);
});
test('compara cinco exercícios de duas empresas com o mesmo indicador', async ({ page }) => {
  await page.goto('./#/empresas');
  const region = page.getByRole('region', { name: 'Comparar empresas' });
  await region.getByText('Comparar histórico', { exact: true }).click();
  const first = region.getByLabel('Primeira empresa');
  const second = region.getByLabel('Segunda empresa');
  await first.selectOption('KLABIN S.A.');
  await expect(second.getByRole('option', { name: /ITAU UNIBANCO/ })).toHaveCount(0);
  await second.selectOption('SUZANO S.A.');
  const history = region.getByRole('table', { name: 'Histórico de ROIC' });
  await expect(history.getByRole('row')).toHaveCount(6);
  await expect(history.getByRole('row', { name: /2024/ })).toContainText('Indisponível');
  await expect(history.getByRole('row', { name: /2025/ })).toContainText(/6,69\s*%.*5,35\s*%/s);

  await first.selectOption('ITAU UNIBANCO HOLDING S.A.');
  await expect(second).toHaveValue('');
  await second.selectOption('BB SEGURIDADE PARTICIPAÇÕES S.A.');
  await expect(region.getByRole('table', { name: 'Histórico de ROE' })).toBeVisible();
});

test('exporta resultados de valuation e mantém a origem da taxa aplicada enquanto ela é usada', async ({
  page,
}) => {
  await page.route(cdiRateUrl, (route) =>
    route.fulfill({ json: [{ data: '15/12/2025', valor: '10' }] }),
  );
  await page.goto('./#/valuation');
  await page.getByRole('combobox', { name: 'Modelo' }).selectOption('ddm');
  await page.getByRole('button', { name: 'Aplicar CDI como desconto' }).click();
  await page.getByLabel('Crescimento na perpetuidade (% a.a.)').fill('0');
  await page.getByLabel('Ações em circulação (milhões)').fill('100');
  for (let year = 1; year <= 10; year++) {
    await page.getByLabel(`Lucro líquido do ano ${year} (R$ mi)`, { exact: true }).fill('200');
    await page.getByLabel(`Payout do ano ${year} (%)`, { exact: true }).fill('50');
  }

  const save = () =>
    workbookDownload(page, 'Exportar valuation em Excel', 'moat-valuation-ddm-base.xlsx');
  const workbook = await save();
  const result = getSheet(workbook, 'Resultado');
  const sensitivity = getSheet(workbook, 'Sensibilidade');
  if (!result || !sensitivity) throw new Error('Aba de resultado ausente.');
  expect(getCell(result, 2, 2)?.value).toBeCloseTo(10, 10);
  expect(getAutoFilter(sensitivity)?.ref).toBe('A1:C10');
  const sourceLabels = (report: typeof workbook) => {
    const notes = getSheet(report, 'Metodologia e fontes');
    if (!notes) throw new Error('Aba de fontes ausente.');
    return Array.from({ length: 25 }, (_, index) => getCell(notes, index + 2, 1)?.value);
  };
  expect(sourceLabels(workbook)).toContain('Taxa de desconto · data-base');

  await page.getByLabel('Taxa de desconto (% a.a.)').fill('12');
  const manualLabels = sourceLabels(await save());
  expect(manualLabels).not.toContain('Taxa de desconto · data-base');
  expect(manualLabels).toContain('Data-base do CDI');
});

test('exporta premissas, carteira válida e retrospectiva calculada no navegador', async ({
  page,
}) => {
  await page.route(cdiRateUrl, (route) => route.fulfill({ json: [] }));
  await page.goto('./#/valuation');
  const valuation = await workbookDownload(
    page,
    'Exportar valuation em Excel',
    'moat-valuation-dcf-base.xlsx',
  );
  expect(sheetNames(valuation)).toContain('Premissas');
  await page.goto('./#/carteiras');
  await page.getByRole('combobox', { name: 'Quantidade de companhias' }).selectOption('custom');
  await page.getByLabel('Quantidade personalizada (1 a 50)').fill('2');
  for (const company of ['WEG S.A.', 'LOJAS RENNER S.A.']) {
    await page.getByRole('combobox', { name: 'Companhia para adicionar' }).selectOption(company);
    await page.getByRole('button', { name: 'Adicionar companhia' }).click();
  }
  await page.getByLabel('Capital inicial (R$)').fill('1000');
  const portfolio = await workbookDownload(
    page,
    'Exportar carteira em Excel',
    'moat-carteira.xlsx',
  );
  expect(sheetNames(portfolio)).toContain('Composição');
  await page.getByRole('button', { name: 'Salvar carteira' }).click();
  await page.getByRole('link', { name: 'Abrir simulador' }).click();
  await page.getByLabel('Arquivo de séries mensais (JSON)').setInputFiles({
    name: 'teste.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: '1.0.0',
        basis: 'total-return-brl',
        source: {
          name: '=1+1',
          retrievedAt: '2024-04-01T12:00:00-03:00',
          methodology: 'Dados de teste.',
        },
        assets: [
          {
            company: 'WEG S.A.',
            instrument: 'WEGE3',
            observations: [
              { date: '2023-12-28', level: 100 },
              { date: '2024-01-31', level: 125 },
              { date: '2024-02-29', level: 187.5 },
              { date: '2024-03-28', level: 93.75 },
            ],
          },
          {
            company: 'LOJAS RENNER S.A.',
            instrument: 'LREN3',
            observations: [
              { date: '2023-12-28', level: 100 },
              { date: '2024-01-31', level: 75 },
              { date: '2024-02-29', level: 37.5 },
              { date: '2024-03-28', level: 56.25 },
            ],
          },
        ],
      }),
    ),
  });
  await page.getByRole('button', { name: 'Calcular retrospectiva' }).click();
  const positions = page.getByRole('table', { name: 'Contribuição e pesos por ativo' });
  await expect(positions.getByRole('row', { name: /^WEG S\.A\./ })).toContainText('62,50%');
  await page.getByText('Correlação dos retornos mensais', { exact: true }).click();
  const matrix = page.getByRole('table', { name: 'Matriz de correlação' });
  await expect(matrix.getByRole('row', { name: /^WEGE3/ })).toContainText('-1,00');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const backtest = await workbookDownload(
    page,
    'Exportar retrospectiva em Excel',
    'moat-retrospectiva.xlsx',
  );
  expect(sheetNames(backtest)).toContain('Histórico mensal');
  const notes = getSheet(backtest, 'Metodologia e fontes');
  const allocation = getSheet(backtest, 'Composição');
  const correlations = getSheet(backtest, 'Correlações');
  if (!notes || !allocation || !correlations) throw new Error('Aba ausente.');
  expect(getCell(allocation, 2, 4)?.value).toBe(0.625);
  expect(getCell(allocation, 2, 7)?.value).toBe(-31.25);
  expect(getCell(correlations, 2, 3)?.value).toBeCloseTo(-1);
  expect(Array.from({ length: 25 }, (_, index) => getCell(notes, index + 2, 2)?.value)).toContain(
    '=1+1',
  );
});
