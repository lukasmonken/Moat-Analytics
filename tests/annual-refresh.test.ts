import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseCompanyDirectory,
  parseSectorComparison,
  parseSectorLeverage,
  parseSectorMargins,
  parseSectorReinvestment,
  parseSectorRoicComparison,
} from '@moat/data-contracts';
import { expect, it } from 'vitest';

function readAsset(name: string, directory: string): unknown {
  return JSON.parse(readFileSync(join(directory, `${name}.json`), 'utf8'));
}

it('valida a janela corrente e a origem comum dos comparativos e indicadores anuais', () => {
  const publicDirectory = 'data/public';
  const annualDirectory = process.env.MOAT_ANNUAL_PUBLIC_DIR ?? publicDirectory;
  const directory = parseCompanyDirectory(readAsset('cvm-company-selection', publicDirectory));
  const roe = parseSectorComparison(readAsset('cvm-sector-comparison', annualDirectory));
  const roic = parseSectorRoicComparison(readAsset('cvm-sector-roic', annualDirectory));
  const leverage = parseSectorLeverage(readAsset('cvm-sector-leverage', annualDirectory));
  const reinvestment = parseSectorReinvestment(
    readAsset('cvm-sector-reinvestment', annualDirectory),
  );
  const margins = parseSectorMargins(readAsset('cvm-sector-margins', annualDirectory));

  const years = roic.manifest.years;
  const year = years.at(-1);
  const dfp = roic.manifest.archives.find((entry) => entry.kind === 'dfp' && entry.year === year);
  expect(years).toHaveLength(5);
  expect(dfp).toBeDefined();
  expect(roe.manifest.years).toEqual(years);
  expect(roe.manifest.archives).toEqual(roic.manifest.archives);
  expect(roe.manifest.asOf).toBe(directory.asOf);
  expect(roic.manifest.asOf).toBe(directory.asOf);
  expect([...roe.companies, ...roic.companies].map(({ name }) => name).sort()).toEqual(
    [...directory.companies].sort(),
  );
  expect(roe.manifest.verifiedOn).toBe(roic.manifest.verifiedOn);
  expect(
    roe.companies.some(({ observations }) => observations.some(({ roe }) => roe !== null)),
  ).toBe(true);
  expect(
    roic.companies.some(({ observations }) => observations.some(({ roic }) => roic !== null)),
  ).toBe(true);
  expect(
    roe.companies.some(({ observations }) => observations.at(-1)?.roe != null) ||
      roic.companies.some(({ observations }) => observations.at(-1)?.roic != null),
  ).toBe(true);

  const roicCompanies = roic.companies.map(({ name }) => name).sort();
  for (const { manifest, companies } of [leverage, reinvestment, margins]) {
    expect(manifest.asOf).toBe(directory.asOf);
    expect(manifest.year).toBe(year);
    expect(manifest.archive).toEqual(dfp);
    expect(companies.map(({ name }) => name).sort()).toEqual(roicCompanies);
  }
});
