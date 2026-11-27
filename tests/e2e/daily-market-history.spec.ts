import { expect, test } from '@playwright/test';

test('consulta ativos e carteira por período e simula com os fechamentos mensais do arquivo', async ({
  page,
}) => {
  const companies = ['WEG S.A.', 'VALE S.A.'];
  await page.addInitScript(
    (names) =>
      window.localStorage.setItem(
        'moat-portfolio-v1',
        JSON.stringify({
          schemaVersion: '1.0.0',
          draft: {
            target: 'custom',
            customTarget: '2',
            method: 'equal',
            positions: names.map((name) => ({ name, weight: '' })),
            capital: '1000',
            contribution: '0',
            rebalance: 'hold',
            cost: '0',
            gainTax: '0',
            maxWeight: '',
          },
        }),
      ),
    companies,
  );
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./#/simulador');
  const dates = [
    '2025-12-30',
    '2026-01-30',
    '2026-02-27',
    '2026-10-30',
    '2026-11-19',
    '2026-11-24',
    '2026-11-26',
  ];
  const series = [
    { instrument: 'WEGE3', levels: [100, 110, 120, 125, 130, 133, 143] },
    { instrument: 'VALE3', levels: [200, 200, 210, 220, 240, 242, 216] },
  ];
  await page.getByLabel('Arquivo de séries diárias ou mensais (JSON)').setInputFiles({
    name: 'historico-diario-teste.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: '1.0.0',
        frequency: 'daily',
        basis: 'total-return-brl',
        asOf: '2026-11-26',
        source: {
          name: 'Séries de teste',
          retrievedAt: '2026-11-26T22:00:00-03:00',
          methodology: 'Dados fictícios da suíte de testes.',
        },
        assets: series.map(({ instrument, levels }, index) => ({
          company: companies[index],
          instrument,
          observations: dates.map((date, position) => ({ date, level: levels[position] })),
        })),
      }),
    ),
  });

  const panel = page.getByRole('region', { name: 'Rentabilidade dos ativos' });
  const period = panel.getByLabel('Período da rentabilidade');
  await period.selectOption('week');
  await expect(panel.getByRole('row', { name: /^WEG/ })).toContainText('10,00%');
  await expect(panel.getByRole('row', { name: /^VALE/ })).toContainText('-10,00%');
  await expect(panel.getByRole('definition')).toHaveText('0,00%');
  await period.selectOption('5y');
  await expect(panel.getByText('Histórico insuficiente para o período selecionado.')).toBeVisible();
  await expect(panel.getByRole('row', { name: /^WEG/ })).toContainText('Indisponível');
  await panel.getByLabel('Buscar companhia ou ticker').fill('VALE3');
  await expect(panel.getByRole('rowheader')).toHaveText(['VALE S.A.']);

  await page.getByLabel('Período da retrospectiva').selectOption('custom');
  await page.getByLabel('Mês inicial').fill('2025-12');
  await page.getByLabel('Mês final').fill('2026-02');
  await page.getByRole('button', { name: 'Calcular retrospectiva' }).click();
  const result = page.getByRole('region', { name: 'Resultado da retrospectiva' });
  await expect(result.getByRole('table', { name: 'Evolução mensal da carteira' })).toContainText(
    '12,50%',
  );

  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
