import { expect, test, type Page } from '@playwright/test';
import { fromArrayBuffer, loadWorkbook } from '@office-kit/xlsx/io';
import { getSheet, sheetNames } from '@office-kit/xlsx/workbook';
import { getAutoFilter, getCell } from '@office-kit/xlsx/worksheet';
import { readFile } from 'node:fs/promises';
import { cdiRateUrl } from '../../apps/web/src/shared/data-client/riskFreeRate';

async function workbookDownload(page: Page, label: string, filename: string) {
  const result = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
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
