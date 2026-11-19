import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { parseIndexUniverse } from './packages/data-contracts/src/index-universe.ts';
import { parseMarketCloseSnapshot } from './packages/data-contracts/src/market-close.ts';

const privateUniverse = new URL(
  './data/processed/index-universe/index-universe.json',
  import.meta.url,
);
const publicUniverse = new URL('./data/public/index-universe.json', import.meta.url);
const privateCloses = new URL('./data/processed/market-closes/market-closes.json', import.meta.url);
const publicCloses = new URL('./data/public/market-closes.json', import.meta.url);
const loopbackAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

async function readOptionalFile(url: URL) {
  try {
    return await readFile(url, 'utf8');
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function serveLocalSnapshot(name: string, file: URL): Plugin {
  return {
    name: 'moat-local-' + name,
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__moat/' + name + '.json', (request, response) => {
        if (
          request.method !== 'GET' ||
          !loopbackAddresses.has(request.socket.remoteAddress ?? '')
        ) {
          response.statusCode = 404;
          response.end();
          return;
        }
        void readOptionalFile(file).then(
          (payload) => {
            if (payload === null) {
              response.statusCode = 404;
              response.end();
              return;
            }
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.setHeader('Cache-Control', 'no-store');
            response.end(payload);
          },
          () => {
            response.statusCode = 500;
            response.end();
          },
        );
      });
    },
  };
}

export default defineConfig(async ({ command }) => {
  if (command === 'build') {
    const [payload, closes] = await Promise.all([
      readOptionalFile(publicUniverse),
      readOptionalFile(publicCloses),
    ]);
    if (
      payload !== null &&
      parseIndexUniverse(JSON.parse(payload)).source.redistributionBasis === null
    ) {
      throw new Error(
        'A composição em data/public requer autorização de redistribuição registrada.',
      );
    }
    if (
      closes !== null &&
      parseMarketCloseSnapshot(JSON.parse(closes)).source.redistributionBasis === null
    ) {
      throw new Error(
        'Os fechamentos em data/public requerem autorização de redistribuição registrada.',
      );
    }
  }

  return {
    root: fileURLToPath(new URL('./apps/web', import.meta.url)),
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      serveLocalSnapshot('index-universe', privateUniverse),
      serveLocalSnapshot('market-closes', privateCloses),
    ],
    server: {
      fs: {
        deny: [
          '.env',
          '.env.*',
          '*.{crt,pem,key,p12,pfx,cer,der}',
          '.npmrc',
          '.yarnrc.yml',
          '**/.git/**',
          '**/data/{raw,processed}/**',
        ],
      },
    },
  };
});
