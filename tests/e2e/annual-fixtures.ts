import type { Page } from '@playwright/test';
import { readCvm2025 } from '../fixtures/annual-cvm-2025';

const assets = [
  'cvm-company-selection',
  'cvm-sector-comparison',
  'cvm-sector-roic',
  'cvm-sector-leverage',
  'cvm-sector-reinvestment',
  'cvm-sector-margins',
];

export async function serveCvm2025(page: Page) {
  for (const name of assets) {
    await page.route(`**/${name}-*.json`, (route) => route.fulfill({ json: readCvm2025(name) }));
  }
}
