import { parseMarketCloseSnapshot, parsePriceFundamentalsSnapshot } from '@moat/data-contracts';
import fundamentalsUrl from '../../../../../data/public/cvm-price-fundamentals.json?url&no-inline';

export { fundamentalsUrl };

const assets = import.meta.glob<string>('../../../../../data/public/market-closes.json', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
});
const publicClosesUrl = Object.values(assets)[0];
const localClosesUrl =
  import.meta.env.DEV && import.meta.env.MODE !== 'test' ? '/__moat/market-closes.json' : undefined;

export async function loadPriceFundamentals(signal: AbortSignal) {
  const response = await fetch(fundamentalsUrl, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Falha ao carregar os resultados de 12 meses.');
  return parsePriceFundamentalsSnapshot(await response.json());
}

export async function loadMarketCloses(signal: AbortSignal) {
  const url = publicClosesUrl ?? localClosesUrl;
  if (!url) return null;
  const response = await fetch(url, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Falha ao carregar os fechamentos.');
  const snapshot = parseMarketCloseSnapshot(await response.json());
  if (publicClosesUrl && snapshot.source.redistributionBasis === null) {
    throw new Error('O lote de fechamentos não tem autorização de redistribuição registrada.');
  }
  return snapshot;
}
