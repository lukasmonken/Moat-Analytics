import { parseSectorComparison } from '@moat/data-contracts';
import sectorComparisonUrl from '../../../../../data/public/cvm-sector-comparison.json?url&no-inline';

export { sectorComparisonUrl };

export async function loadSectorComparison(signal: AbortSignal) {
  const response = await fetch(sectorComparisonUrl, { signal });
  if (!response.ok) throw new Error('Falha ao carregar o comparativo de ROE da CVM.');
  return parseSectorComparison(await response.json());
}
