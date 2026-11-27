import type { CompanyDirectorySnapshot } from '@moat/data-contracts';

export const rankingPortfolioLimit = 10;

export interface RankingPortfolioTransfer {
  rankingPortfolio: {
    names: string[];
    label: string;
    selectionAsOf: string;
  };
}

type RankingPortfolioResolution =
  | { status: 'ready'; selection: RankingPortfolioTransfer['rankingPortfolio'] }
  | { status: 'invalid'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonemptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function resolveRankingPortfolioTransfer(
  state: unknown,
  directory: CompanyDirectorySnapshot,
): RankingPortfolioResolution | null {
  if (!isRecord(state) || !Object.hasOwn(state, 'rankingPortfolio')) return null;

  const selection = state.rankingPortfolio;
  const invalid = {
    status: 'invalid',
    message: 'A seleção enviada pelo ranking é inválida.',
  } as const;
  if (
    !isRecord(selection) ||
    !isNonemptyText(selection.label) ||
    !isNonemptyText(selection.selectionAsOf) ||
    !Array.isArray(selection.names) ||
    selection.names.length === 0 ||
    selection.names.length > rankingPortfolioLimit
  ) {
    return invalid;
  }

  const names: unknown[] = [...selection.names];
  if (!names.every(isNonemptyText) || new Set(names).size !== names.length) return invalid;

  if (selection.selectionAsOf !== directory.asOf) {
    return {
      status: 'invalid',
      message: 'A data da seleção do ranking é incompatível com o diretório atual da CVM.',
    };
  }
  if (!names.every((name) => directory.companies.includes(name))) {
    return {
      status: 'invalid',
      message: 'A seleção do ranking inclui companhias fora do diretório atual da CVM.',
    };
  }

  return {
    status: 'ready',
    selection: { names, label: selection.label, selectionAsOf: selection.selectionAsOf },
  };
}
