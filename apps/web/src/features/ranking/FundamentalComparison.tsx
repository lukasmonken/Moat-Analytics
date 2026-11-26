import { useId, useState } from 'react';
import { Select, Table } from '../../shared/ui';
import { compareNames, formatDate } from '../screener/presentation';
import type { FundamentalFactor, FundamentalRow } from './fundamentalRanks';
import { formatRankingScore, formatRankingValue, rankingFactorLabels } from './rankingPresentation';
import './fundamental-comparison.css';

type ComparisonFactor = { factor: FundamentalFactor; label: string; period?: string | undefined };

export function FundamentalComparison({
  rows,
  years,
  marketTradeDate,
}: {
  rows: FundamentalRow[];
  years: number[];
  marketTradeDate: string | null;
}) {
  const id = useId();
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const names = rows.map(({ name }) => name).sort(compareNames);
  const first = rows.find(({ name }) => name === firstName);
  const second = first && rows.find(({ name }) => name === secondName && name !== first.name);
  const selected = first && second ? ([first, second] as const) : null;
  const annualSources = selected?.map((company) => company.growthHistory.points.at(-1)?.filingUrl);
  const isRoic = first?.metric === 'ROIC';
  const latest = years.at(-1)?.toString();
  const period = years.length > 1 ? `${years[0]} a ${latest}` : latest;
  const factors: ComparisonFactor[] = [
    { factor: 'profitability', label: isRoic ? 'ROIC' : 'ROE', period: latest },
    {
      factor: 'growth',
      label: `Crescimento anualizado ${isRoic ? 'do NOPAT' : 'do lucro atribuível'}`,
      period,
    },
  ];
  if (isRoic) {
    factors.push(
      { factor: 'moat', label: rankingFactorLabels.moat, period: latest },
      { factor: 'leverage', label: rankingFactorLabels.leverage, period: latest },
      { factor: 'risk', label: rankingFactorLabels.risk, period },
    );
  }
  factors.push({
    factor: 'price',
    label: isRoic ? 'NOPAT/EV' : 'Earnings yield',
    period: marketTradeDate ? `Pregão de ${formatDate(marketTradeDate)}` : undefined,
  });
  if (isRoic)
    factors.push({ factor: 'accountingScore', label: rankingFactorLabels.accountingScore });
  factors.push({ factor: 'score', label: rankingFactorLabels.score });

  if (names.length < 2) return null;

  return (
    <details className="fundamental-comparison">
      <summary>Comparar fundamentos</summary>
      <div className="fundamental-comparison__body">
        <div className="fundamental-comparison__selectors">
          <Select
            id={`${id}-first`}
            label="Primeira companhia"
            value={first?.name ?? ''}
            onChange={(event) => {
              const name = event.currentTarget.value;
              setFirstName(name);
              if (!name || name === secondName) setSecondName('');
            }}
          >
            <option value="">Selecione uma companhia</option>
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            id={`${id}-second`}
            label="Segunda companhia"
            value={second?.name ?? ''}
            disabled={!first}
            onChange={(event) => setSecondName(event.currentTarget.value)}
          >
            <option value="">Selecione uma companhia</option>
            {names
              .filter((name) => name !== first?.name)
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </Select>
        </div>
        {selected && (
          <>
            <p>
              Z-scores calculados no grupo completo de {selected[0].metric}. No Z-score, valores
              maiores são melhores.
            </p>
            <div
              className="fundamental-comparison__scroll"
              role="region"
              aria-label="Comparação lado a lado"
              tabIndex={0}
            >
              <Table aria-label="Comparação de fundamentos">
                <thead>
                  <tr>
                    <th scope="col">Indicador</th>
                    {selected.map(({ name }) => (
                      <th key={name} scope="col">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {factors.map(({ factor, label, period }) => (
                    <tr key={factor}>
                      <th scope="row">
                        {label}
                        {period && <small>{period}</small>}
                      </th>
                      {selected.map((company) => {
                        const showScore =
                          factor !== 'score' &&
                          factor !== 'accountingScore' &&
                          company[factor] !== null;
                        const score = showScore ? company.zScores[factor] : undefined;
                        return (
                          <td key={company.name}>
                            {formatRankingValue(company, factor)}
                            {factor === 'growth' && company.growthReason && (
                              <small>{company.growthReason}</small>
                            )}
                            {showScore && (
                              <small>
                                {score === undefined
                                  ? 'Z-score indisponível'
                                  : `Z-score ${formatRankingScore(score)}`}
                              </small>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {annualSources?.some(Boolean) && (
                    <tr>
                      <th scope="row">Balanço anual da CVM</th>
                      {selected.map(({ name }, index) => {
                        const url = annualSources[index];
                        return (
                          <td key={name}>
                            {url ? (
                              <a href={url} target="_blank" rel="noreferrer">
                                DFP de {latest}
                              </a>
                            ) : (
                              'Indisponível'
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
