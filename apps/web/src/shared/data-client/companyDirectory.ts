import { parseCompanyDirectory } from '@moat/data-contracts';
import companyDirectoryUrl from '../../../../../data/public/cvm-company-selection.json?url&no-inline';

export { companyDirectoryUrl };

export async function loadCompanyDirectory(signal: AbortSignal) {
  const response = await fetch(companyDirectoryUrl, { signal });
  if (!response.ok) {
    throw new Error('Falha ao carregar o diretório de companhias.');
  }

  return parseCompanyDirectory(await response.json());
}
