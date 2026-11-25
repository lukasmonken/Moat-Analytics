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

test('compara e exporta a seleção setorial com contas e cobertura', async ({ page }) => {
  await page.route(cdiRateUrl, (route) =>
    route.fulfill({ json: [{ data: '15/12/2025', valor: '13.65' }] }),
  );
  await page.goto('./#/empresas');
  const region = page.getByRole('region', { name: 'Comparativos por setor' });
  const comparison = region.getByRole('table', { name: 'Comparativo de ROE por setor' });
  const search = region.getByLabel('Buscar companhia no comparativo');
  await region.getByLabel('Setor de atividade').selectOption({ label: 'Bancos' });
  await search.fill('ITAU UNIBANCO');
  const bank = comparison.getByRole('row', { name: /ITAU UNIBANCO HOLDING/ });
  await expect(bank).toContainText(/21,59\s*%/);
  await expect(bank).toContainText(/\+7,94\s*p\.p\./);
  await bank.getByRole('button', { name: 'Conferir contas de ITAU UNIBANCO HOLDING S.A.' }).click();
  const details = region.getByRole('region', { name: 'ITAU UNIBANCO HOLDING S.A. · 2025' });
  await expect(details.getByRole('link', { name: 'DFP consolidada na CVM' })).toBeVisible();
  const exportComparison = () =>
    workbookDownload(page, 'Exportar Excel', 'moat-comparativo-setorial.xlsx', region);
  const workbook = await exportComparison();
  const rows = getSheet(workbook, 'Comparativo setorial');
  const sources = getSheet(workbook, 'Contas e formulários');
  const cdi = getSheet(workbook, 'CDI atual');
  if (!rows || !sources || !cdi) throw new Error('Aba ausente.');
  expect(getAutoFilter(rows)?.ref).toBe('A1:H2');
  expect(getAutoFilter(sources)?.ref).toBe('A1:N6');
  expect(getCell(rows, 2, 1)?.value).toBe('ITAU UNIBANCO HOLDING S.A.');
  expect(getCell(rows, 2, 3)?.value).toBeCloseTo(0.215870892296, 9);
  expect(getCell(cdi, 2, 5)?.value).toBe(0.1365);
  expect(getCell(cdi, 2, 6)?.value).toBeCloseTo(7.9370892296, 9);
  await region.getByLabel('Exercício comparado').selectOption('2024');
  await expect(
    comparison.getByRole('columnheader', { name: 'Diferença para o CDI atual' }),
  ).toHaveCount(0);
  expect(sheetNames(await exportComparison())).not.toContain('CDI atual');
  await region.getByLabel('Exercício comparado').selectOption('2025');
  await region.getByLabel('Linhas para exportar').selectOption('all');
  const all = getSheet(await exportComparison(), 'Comparativo setorial');
  if (!all) throw new Error('Aba ausente.');
  expect(getAutoFilter(all)?.ref).toBe('A1:H145');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('compara o histórico de ROE de companhias selecionadas em buscas diferentes', async ({
  page,
}) => {
  await page.route(cdiRateUrl, (route) => route.fulfill({ json: [] }));
  await page.goto('./#/empresas');
  const region = page.getByRole('region', { name: 'Comparativos por setor' });
  const search = region.getByLabel('Buscar companhia no comparativo');
  const comparison = region.getByRole('region', { name: 'ROE lado a lado' });
  const itau = 'ITAU UNIBANCO HOLDING S.A.';
  const bradespar = 'BRADESPAR S.A.';
  const compare = (company: string) =>
    region.getByRole('button', { name: `Comparar ${company}`, exact: true });

  await search.fill(itau);
  await compare(itau).click();
  await expect(comparison).toBeVisible();
  await search.fill(bradespar);
  await compare(bradespar).click();

  const history = comparison.getByRole('table');
  await expect(history.getByRole('columnheader', { name: /ITAU UNIBANCO/ })).toBeVisible();
  await expect(history.getByRole('columnheader', { name: /BRADESPAR/ })).toBeVisible();
  for (const year of ['2021', '2022', '2023', '2024', '2025']) {
    await expect(history.getByRole('rowheader', { name: year, exact: true })).toBeVisible();
  }
  const latest = history.getByRole('row').filter({
    has: page.getByRole('rowheader', { name: '2025', exact: true }),
  });
  await expect(latest).toContainText(/21,59\s*%/);
  await expect(latest).toContainText(/\+1,11\s*p\.p\./);
  await expect(latest).toContainText(/14,66\s*%/);
  await expect(latest).toContainText('8 companhias');
  await expect(latest.getByRole('cell').filter({ hasText: /indisponível/i })).toHaveCount(1);
  await expect(
    latest.getByRole('link', { name: `DFP 2025 de ${itau}`, exact: true }),
  ).toBeVisible();

  const workbook = await workbookDownload(
    page,
    'Exportar comparação em Excel',
    'moat-roe-lado-a-lado.xlsx',
    comparison,
  );
  const annual = getSheet(workbook, 'ROE lado a lado');
  if (!annual) throw new Error('Aba ausente.');
  expect(getCell(annual, 6, 1)?.value).toBe(itau);
  expect(getCell(annual, 6, 3)?.value).toBe(2025);
  expect(getCell(annual, 6, 4)?.value).toBeCloseTo(0.2158708923, 9);
  expect(getCell(annual, 6, 5)?.value).toBeCloseTo(1.109452145, 8);
  expect(getCell(annual, 6, 7)?.value).toBe(8);
  expect(getCell(annual, 11, 1)?.value).toBe(bradespar);
  expect(getCell(annual, 11, 4)?.value).toBeUndefined();
  expect(getCell(annual, 11, 6)?.value).toBeUndefined();

  for (const company of ['WEG S.A.', 'LOJAS RENNER S.A.']) {
    await search.fill(company);
    await compare(company).click();
  }
  await search.fill('VALE S.A.');
  await expect(compare('VALE S.A.')).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await comparison.getByRole('button', { name: `Remover ${bradespar}` }).click();
  await expect(compare('VALE S.A.')).toBeEnabled();

  await comparison.getByRole('button', { name: 'Limpar seleção' }).click();
  await expect(comparison).toHaveCount(0);
  await search.fill(itau);
  await expect(compare(itau)).toHaveAttribute('aria-pressed', 'false');
});

test('consulta o ROIC estimado da Vale e exporta os insumos da DFP', async ({ page }) => {
  await page.route(cdiRateUrl, (route) => route.fulfill({ json: [] }));
  await page.goto('./#/empresas');
  const region = page.getByRole('region', { name: 'Comparativo de ROIC estimado' });
  await region.getByLabel('Setor do ROIC').selectOption({ label: 'Extração Mineral' });
  await region.getByLabel('Buscar companhia no ROIC').fill('VALE');
  const row = region
    .getByRole('table', { name: 'ROIC estimado por setor' })
    .getByRole('row', { name: /VALE S\.A\./ });
  await expect(row).toContainText(/7,58\s*%/);
  await row.getByRole('button', { name: 'Conferir contas de VALE S.A.' }).click();
  const details = region.getByRole('region', { name: 'VALE S.A. · 2025' });
  await expect(details.getByText('31.969.000.000', { exact: false }).first()).toBeVisible();
  await expect(details.getByRole('link', { name: 'Demonstrações de apoio' })).toBeVisible();
  const workbook = await workbookDownload(
    page,
    'Exportar Excel',
    'moat-roic-setorial.xlsx',
    region,
  );
  expect(sheetNames(workbook)).toContain('Contas e saldos');
  const rows = getSheet(workbook, 'Comparativo de ROIC');
  if (!rows) throw new Error('Aba ausente.');
  expect(getCell(rows, 2, 1)?.value).toBe('VALE S.A.');
  expect(getCell(rows, 2, 3)?.value).toBeCloseTo(0.07575986829703543, 9);
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
