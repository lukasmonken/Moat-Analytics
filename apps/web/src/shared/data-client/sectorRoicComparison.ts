import { parseSectorRoicComparison } from '@moat/data-contracts';
import sectorRoicComparisonUrl from '../../../../../data/public/cvm-sector-roic.json?url&no-inline';

export { sectorRoicComparisonUrl };

export async function loadSectorRoicComparison(signal: AbortSignal) {
  const response = await fetch(sectorRoicComparisonUrl, { signal });
  if (!response.ok) throw new Error('Falha ao carregar o comparativo de ROIC da CVM.');
  return parseSectorRoicComparison(await response.json());
}
