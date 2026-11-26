import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseSectorRoicComparison } from '@moat/data-contracts';

test('abre o exercício anual mais recente do build e permite consultar o anterior', async ({
  page,
}) => {
  const { manifest, companies } = parseSectorRoicComparison(
    JSON.parse(readFileSync('data/public/cvm-sector-roic.json', 'utf8')),
  );
  const latest = manifest.years.at(-1);
  const previous = manifest.years.at(-2);
  const company = companies.find(({ observations }) => observations.at(-1)?.roic != null);
  if (latest === undefined || previous === undefined || !company) {
    throw new Error('O build precisa ter dois exercícios e ao menos um ROIC mais recente.');
  }

  await page.goto('./#/empresas');
  const region = page.getByRole('region', { name: 'Comparar empresas' });
  const exercise = region.getByLabel('Exercício', { exact: true });
  await expect(exercise).toHaveValue(String(latest));
  await region.getByLabel('Indicador', { exact: true }).selectOption('ROIC');
  await region.getByLabel('Buscar empresa', { exact: true }).fill(company.name);
  const row = region.getByRole('row', { name: company.name });
  await expect(row).toBeVisible();
  await expect(
    region.getByRole('columnheader', { name: `ROIC em ${latest}`, exact: true }),
  ).toBeVisible();
  await expect(row.getByRole('cell').nth(1)).toContainText('%');
  await exercise.selectOption(String(previous));
  await expect(row).toBeVisible();
  await expect(
    region.getByRole('columnheader', { name: `ROIC em ${previous}`, exact: true }),
  ).toBeVisible();
});
