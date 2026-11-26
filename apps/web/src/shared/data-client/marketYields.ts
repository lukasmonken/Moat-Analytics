import { parseMarketYieldsSnapshot } from '@moat/data-contracts';

export async function loadLocalMarketYields(signal: AbortSignal) {
  const response = await fetch('/__moat/market-yields.json', { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Falha ao carregar o rendimento implícito local.');
  return parseMarketYieldsSnapshot(await response.json());
}
