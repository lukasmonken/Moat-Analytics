import { parseCvmIdentity, parseCvmSnapshot } from '@moat/data-contracts';
import cvmIdentityUrl from '../../../../../data/public/cvm-identity.json?url&no-inline';
import cvmSnapshotUrl from '../../../../../data/public/cvm-sample.json?url&no-inline';

export { cvmIdentityUrl, cvmSnapshotUrl };

async function load<T>(url: string, parse: (input: unknown) => T, signal: AbortSignal) {
  const response = await fetch(url, { signal });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Falha ao carregar os dados da CVM.');
  }

  return parse(await response.json());
}

export function loadCvmSnapshot(signal: AbortSignal) {
  return load(cvmSnapshotUrl, parseCvmSnapshot, signal);
}

export function loadCvmIdentity(signal: AbortSignal) {
  return load(cvmIdentityUrl, parseCvmIdentity, signal);
}
