import { parseBankRoeSnapshot } from '@moat/data-contracts';
import bankRoeSnapshotUrl from '../../../../../data/public/cvm-bank-roe.json?url&no-inline';

export { bankRoeSnapshotUrl };

export async function loadBankRoeSnapshot(signal: AbortSignal) {
  const response = await fetch(bankRoeSnapshotUrl, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Falha ao carregar a comparação de ROE.');

  return parseBankRoeSnapshot(await response.json());
}
