import { isCvmUrl } from './cvm.ts';
import { isObject, isPositiveInteger } from './validation.ts';

export interface DfpAccountReview {
  documentUrl: string;
  page: number;
  accountCode: string;
}

export function isDfpAccountReview(value: unknown, accountCode: string): value is DfpAccountReview {
  if (
    !isObject(value) ||
    typeof value.documentUrl !== 'string' ||
    value.accountCode !== accountCode ||
    !isPositiveInteger(value.page)
  ) {
    return false;
  }
  try {
    const url = new URL(value.documentUrl);
    return (
      !url.username &&
      !url.password &&
      (url.origin === 'https://api.mziq.com' ||
        url.origin === 'https://vipfiles.valor.com.br' ||
        isCvmUrl(value.documentUrl))
    );
  } catch {
    return false;
  }
}
