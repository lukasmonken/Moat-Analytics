import { parseSectorReinvestment } from '@moat/data-contracts';
import sectorReinvestmentUrl from '../../../../../data/public/cvm-sector-reinvestment.json?url&no-inline';

export async function loadSectorReinvestment(signal: AbortSignal) {
  const response = await fetch(sectorReinvestmentUrl, { signal });
  if (!response.ok) throw new Error('Falha ao carregar o comparativo de reinvestimento da CVM.');
  return parseSectorReinvestment(await response.json());
}
