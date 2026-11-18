import { parseIndexUniverse } from '@moat/data-contracts';

const assets = import.meta.glob<string>('../../../../../data/public/index-universe.json', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
});
const snapshotUrl = Object.values(assets)[0];
const developmentUrl =
  import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? '/__moat/index-universe.json'
    : undefined;
const url = snapshotUrl ?? developmentUrl;

export const hasIndexUniverse = url !== undefined;

export async function loadIndexUniverse(signal: AbortSignal) {
  if (!url) return null;

  const response = await fetch(url, { signal });
  if (!snapshotUrl && response.status === 404) return null;
  if (!response.ok) {
    throw new Error('Falha ao carregar a composição anual.');
  }

  const snapshot = parseIndexUniverse(await response.json());
  if (snapshotUrl && snapshot.source.redistributionBasis === null) {
    throw new Error('A composição anual não tem autorização de redistribuição registrada.');
  }

  return snapshot;
}
