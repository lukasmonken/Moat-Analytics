import { parseDailyBacktestHistory } from '@moat/data-contracts';

export async function loadLocalMarketHistory(signal: AbortSignal) {
  const response = await fetch('/__moat/market-history.json', { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Falha ao carregar a base diária privada.');
  return parseDailyBacktestHistory(await response.json());
}
