import { parseIpcaRate } from '@moat/data-contracts';

export type { InflationRate } from '@moat/data-contracts';

export const ipcaRateUrl =
  'https://api.bcb.gov.br/dados/serie/bcdata.sgs.13522/dados/ultimos/1?formato=json';

export async function loadInflationRate(signal: AbortSignal) {
  const response = await fetch(ipcaRateUrl, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    credentials: 'omit',
  });
  if (!response.ok) throw new Error('Falha ao consultar o IPCA no Banco Central.');

  return parseIpcaRate(await response.json(), new Date());
}
