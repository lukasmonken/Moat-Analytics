import { parseQualitySnapshot } from '@moat/data-contracts';
import qualitySnapshotUrl from '../../../../../data/public/cvm-quality.json?url&no-inline';

export { qualitySnapshotUrl };

export async function loadQualitySnapshot(signal: AbortSignal) {
  const response = await fetch(qualitySnapshotUrl, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Falha ao carregar as séries de qualidade.');

  return parseQualitySnapshot(await response.json());
}
