import { useId } from 'react';
import { valueScenario, type ValuationInput } from '../../shared/analytics/valuation';
import { Panel, Table } from '../../shared/ui';
import { valuationPriceMetrics, valuationSensitivity } from './scenario';

const cash = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentage = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
type Result = NonNullable<ReturnType<typeof valueScenario>>;

function Sensitivity({ input }: { input: ValuationInput }) {
  const { growths, rows } = valuationSensitivity(input);
  return (
    <div
      className="valuation-table-scroll"
      role="region"
      tabIndex={0}
      aria-label="Variação das taxas do cenário"
    >
      <Table aria-label="Sensibilidade do valor por ação">
        <thead>
          <tr>
            <th scope="col">Desconto / crescimento</th>
            {growths.map((growth) => (
              <th key={growth} scope="col">
                {percentage.format(growth)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ discount, results }) => (
            <tr key={discount}>
              <th scope="row">{percentage.format(discount)}</th>
              {growths.map((growth, index) => {
                const perShare = results[index] ?? null;
                return (
                  <td key={growth}>{perShare === null ? 'Indisponível' : cash.format(perShare)}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function ValuationResults({
  input,
  result,
  referencePrice,
}: {
  input: ValuationInput;
  result: Result;
  referencePrice: number | null;
}) {
  const heading = useId();
  const { potential, safety } = valuationPriceMetrics(result.perShare, referencePrice);
  return (
    <Panel className="valuation-panel" aria-labelledby={heading}>
      <h2 id={heading}>Resultado do cenário</h2>
      <dl className="valuation-measures">
        <div>
          <dt>Valor intrínseco estimado por ação</dt>
          <dd>
            <strong>{cash.format(result.perShare)}</strong>
          </dd>
        </div>
        {referencePrice !== null && (
          <div>
            <dt>Preço informado</dt>
            <dd>{cash.format(referencePrice)}</dd>
          </div>
        )}
        {potential !== null && (
          <div>
            <dt>Potencial sobre o preço</dt>
            <dd>{percentage.format(potential)}</dd>
          </div>
        )}
        {referencePrice !== null && (
          <div>
            <dt>Margem de segurança</dt>
            <dd>{safety === null ? 'Indisponível' : percentage.format(safety)}</dd>
          </div>
        )}
        {result.enterpriseValue !== null && (
          <div>
            <dt>Valor da firma (R$ mi)</dt>
            <dd>{cash.format(result.enterpriseValue)}</dd>
          </div>
        )}
        <div>
          <dt>Valor do patrimônio (R$ mi)</dt>
          <dd>{cash.format(result.equityValue)}</dd>
        </div>
        <div>
          <dt>Valor presente dos fluxos (R$ mi)</dt>
          <dd>{cash.format(result.presentYears)}</dd>
        </div>
        <div>
          <dt>Valor presente da perpetuidade (R$ mi)</dt>
          <dd>{cash.format(result.presentTerminal)}</dd>
        </div>
      </dl>
      <h3>Sensibilidade do valor por ação</h3>
      <p>Variação de 1 p.p. acima e abaixo das taxas de desconto e crescimento do cenário.</p>
      <Sensitivity input={input} />
      <details className="company-observation">
        <summary>Fluxos considerados no cenário</summary>
        <div className="company-observation-body">
          <Table aria-label="Fluxos e valores presentes por ano">
            <thead>
              <tr>
                <th scope="col">Ano</th>
                <th scope="col">Fluxo (R$ mi)</th>
                <th scope="col">Valor presente (R$ mi)</th>
              </tr>
            </thead>
            <tbody>
              {result.years.map(({ flow, presentValue }, index) => (
                <tr key={index}>
                  <th scope="row">{index + 1}</th>
                  <td>{cash.format(flow)}</td>
                  <td>{cash.format(presentValue)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </details>
    </Panel>
  );
}
