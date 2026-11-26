import { formatRatio } from '../../shared/analytics/ratios';
import { formatPoints, formatRate } from '../company/QualityHistory';
import type { FundamentalFactor, FundamentalRow } from './fundamentalRanks';

export const rankingFactorLabels: Record<FundamentalFactor, string> = {
  profitability: 'Rentabilidade',
  moat: 'NOPAT/reinvestimento',
  leverage: 'Dívida líquida/EBITDA',
  risk: 'Drawdown do ROIC',
  growth: 'Crescimento',
  price: 'Preço',
  accountingScore: 'Pontuação contábil',
  score: 'Pontuação final',
};

const scoreFormat = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatRankingScore(value: number) {
  return scoreFormat.format(value);
}

export function formatRankingValue(row: FundamentalRow, factor: FundamentalFactor) {
  const value = row[factor];
  if (value === null) return factor === 'risk' ? 'Empresa muito nova' : 'Indisponível';
  if (factor === 'risk') return formatPoints(value);
  if (factor === 'score' || factor === 'accountingScore') return formatRankingScore(value);
  if (factor === 'profitability' || factor === 'growth' || factor === 'price')
    return formatRate(value);
  return formatRatio(value);
}
