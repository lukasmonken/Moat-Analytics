import { parseSectorMargins } from '@moat/data-contracts';
import sectorMarginsUrl from '../../../../../data/public/cvm-sector-margins.json?url&no-inline';

export async function loadSectorMargins(signal: AbortSignal) {
  const response = await fetch(sectorMarginsUrl, { signal });
  if (!response.ok) throw new Error('Falha ao carregar as margens da CVM.');
  return parseSectorMargins(await response.json());
}
