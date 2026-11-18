import { parseCdiRate } from '@moat/data-contracts';

export type { RiskFreeRate } from '@moat/data-contracts';

export const cdiRateUrl =
  'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json';

export async function loadRiskFreeRate(signal: AbortSignal) {
  const response = await fetch(cdiRateUrl, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    credentials: 'omit',
  });
  if (!response.ok) throw new Error('Falha ao consultar o CDI no Banco Central.');

  return parseCdiRate(await response.json(), new Date());
}
