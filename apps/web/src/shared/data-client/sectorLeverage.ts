import { parseSectorLeverage } from '@moat/data-contracts';
import sectorLeverageUrl from '../../../../../data/public/cvm-sector-leverage.json?url&no-inline';

export async function loadSectorLeverage(signal: AbortSignal) {
  const response = await fetch(sectorLeverageUrl, { signal });
  if (!response.ok) throw new Error('Falha ao carregar a dívida líquida/EBITDA da CVM.');
  return parseSectorLeverage(await response.json());
}
