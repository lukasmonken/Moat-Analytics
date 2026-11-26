import { useEffect, useRef } from 'react';
import { Button, Table } from '../../shared/ui';
import { formatRate } from '../company/QualityHistory';
import { formatCurrency } from '../company/financialPresentation';
import type { FundamentalRow } from './fundamentalRanks';
import './growth-detail.css';

function formatChange(value: number | null, format: (amount: number) => string) {
  return value === null ? '—' : `${value > 0 ? '+' : ''}${format(value)}`;
}

export function GrowthDetail({
  id,
  row,
  onClose,
}: {
  id: string;
  row: FundamentalRow;
  onClose: () => void;
}) {
  const focus = useRef<HTMLElement>(null);
  const headingId = `${id}-heading`;
  const { points, lowBase, upYears, comparableYears } = row.growthHistory;
  const metric = row.metric === 'ROIC' ? 'NOPAT' : 'Lucro líquido atribuível';
  const values = points.flatMap(({ valueBrl }) => valueBrl ?? []);
  const minimum = Math.min(0, ...values);
  const span = Math.max(0, ...values) - minimum || 1;

  useEffect(() => {
    focus.current?.focus();
  }, [row.name]);

  return (
    <section
      className="growth-detail"
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      ref={focus}
    >
      <div className="growth-detail__header">
        <h3 id={headingId}>Crescimento de {row.name}</h3>
        <Button variant="quiet" onClick={onClose}>
          Fechar diagnóstico
        </Button>
      </div>
      <dl className="growth-detail__summary">
        <div>
          <dt>Crescimento anualizado</dt>
          <dd>{formatRate(row.growth)}</dd>
          {row.growthReason && <dd className="growth-detail__note">{row.growthReason}</dd>}
        </div>
        <div>
          <dt>Altas entre anos consecutivos</dt>
          <dd>
            {comparableYears ? `${upYears} de ${comparableYears}` : 'Sem pares de anos com dados'}
          </dd>
        </div>
      </dl>
      {lowBase && (
        <p className="growth-detail__flag">
          <strong>Base inicial baixa.</strong> O primeiro valor ficou abaixo de metade da mediana
          dos exercícios seguintes.
        </p>
      )}
      <div
        className="growth-detail__scroll"
        role="region"
        aria-label="Histórico anual"
        tabIndex={0}
      >
        <Table aria-label={`Série anual de ${metric}`}>
          <thead>
            <tr>
              <th scope="col">Exercício</th>
              <th scope="col">{metric}</th>
              <th scope="col">Variação em R$</th>
              <th scope="col">Variação em %</th>
              <th scope="col">Fonte</th>
            </tr>
          </thead>
          <tbody>
            {points.map(({ year, valueBrl, changeBrl, changeRate, filingUrl, reason }) => (
              <tr key={year}>
                <th scope="row">{year}</th>
                <td>
                  {valueBrl === null ? (
                    <>
                      Indisponível
                      {reason && <small>{reason}</small>}
                    </>
                  ) : (
                    <>
                      {formatCurrency(valueBrl)}
                      <span className="growth-detail__track" aria-hidden="true">
                        <span
                          className="growth-detail__bar"
                          style={{
                            marginInlineStart: `${((Math.min(0, valueBrl) - minimum) / span) * 100}%`,
                            width: `${Math.abs(valueBrl / span) * 100}%`,
                          }}
                        />
                      </span>
                    </>
                  )}
                </td>
                <td>{formatChange(changeBrl, formatCurrency)}</td>
                <td>{formatChange(changeRate, formatRate)}</td>
                <td>
                  {filingUrl ? (
                    <a href={filingUrl} target="_blank" rel="noreferrer">
                      DFP
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {points.some(({ changeBrl, changeRate }) => changeBrl !== null && changeRate === null) && (
        <p>A variação percentual exige um valor positivo no exercício anterior.</p>
      )}
    </section>
  );
}
