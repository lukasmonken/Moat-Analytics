import { defineConfig } from '@playwright/test';

const origin = 'http://127.0.0.1:4173';
const baseURL = origin + '/moat-analytics/';
const channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL,
    ...(channel ? { channel } : {}),
  },
  webServer: {
    command: 'vite preview --host 127.0.0.1 --port 4173 --strictPort --base /moat-analytics/',
    url: baseURL,
    timeout: 15_000,
  },
});
