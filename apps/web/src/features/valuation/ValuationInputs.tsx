import { useId } from 'react';
import { Input, Table } from '../../shared/ui';
import type { ValuationDraft, ValuationModel } from './scenario';
import './valuation.css';

const scenarioFields = [
  ['discountRate', 'Taxa de desconto (% a.a.)', 'text'],
  ['terminalGrowth', 'Crescimento na perpetuidade (% a.a.)', 'text'],
  ['shares', 'Ações em circulação (milhões)', 'decimal'],
  ['referencePrice', 'Preço de referência (R$/ação, opcional)', 'decimal'],
] as const;

const dcfFields = [
  ['netDebt', 'Dívida líquida (R$ mi)', 'text'],
  ['equityAdjustments', 'Outros ajustes ao patrimônio (R$ mi)', 'text'],
] as const;

const projectionFields = {
  dcf: [
    ['revenue', 'Receita', 'R$ mi', 'decimal'],
    ['ebitMargin', 'Margem EBIT', '%', 'text'],
    ['taxRate', 'Alíquota', '%', 'decimal'],
    ['depreciation', 'Depreciação e amortização', 'R$ mi', 'decimal'],
    ['capex', 'CAPEX', 'R$ mi', 'decimal'],
    ['workingCapitalChange', 'Variação do capital de giro', 'R$ mi', 'text'],
  ],
  ddm: [
    ['netIncome', 'Lucro líquido', 'R$ mi', 'text'],
    ['payout', 'Payout', '%', 'decimal'],
  ],
} as const;

interface ValuationInputsProps {
  model: ValuationModel;
  draft: ValuationDraft;
  onChange: (draft: ValuationDraft) => void;
}

export function ValuationInputs({ model, draft, onChange }: ValuationInputsProps) {
  const id = useId();
  const projection = projectionFields[model];
  const fields = model === 'dcf' ? [...scenarioFields, ...dcfFields] : scenarioFields;

  return (
    <div className="valuation-inputs">
      <div className="valuation-premises-grid">
        {fields.map(([key, label, inputMode]) => (
          <Input
            autoComplete="off"
            id={id + '-' + key}
            inputMode={inputMode}
            key={key}
            label={label}
            maxLength={48}
            value={draft[key]}
            aria-describedby={
              key === 'netDebt' || key === 'equityAdjustments' ? id + '-debt' : undefined
            }
            onChange={(event) => onChange({ ...draft, [key]: event.currentTarget.value })}
          />
        ))}
      </div>
      {model === 'dcf' && (
        <p id={id + '-debt'}>
          A dívida líquida é deduzida do valor da firma. Ajustes positivos aumentam o valor do
          patrimônio. Informe zero para um saldo ou ajuste igual a zero.
        </p>
      )}
      <div className="valuation-projection-head">
        <h3>Projeções anuais</h3>
        <p id={id + '-basis'}>
          Use valores e taxas nominais, com vírgula para decimais e sem separador de milhar.{' '}
          {model === 'dcf'
            ? 'Informe um aumento no capital de giro como valor positivo.'
            : 'O payout é a parcela do lucro líquido atribuível aos acionistas distribuída em cada ano.'}
        </p>
      </div>
      <div
        className="valuation-projections-scroll"
        role="region"
        tabIndex={0}
        aria-label="Editor de projeções anuais"
        aria-describedby={id + '-basis'}
      >
        <Table className="valuation-projections" aria-label="Projeções anuais (R$ mi)">
          <thead>
            <tr>
              <th scope="col">Ano</th>
              {projection.map(([key, label, unit]) => (
                <th key={key} scope="col">
                  {label}
                  <small>{unit}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.years.map((year, index) => (
              <tr key={index}>
                <th scope="row">Ano {index + 1}</th>
                {projection.map(([key, label, unit, inputMode]) => (
                  <td key={key}>
                    <Input
                      autoComplete="off"
                      id={id + '-' + index + '-' + key}
                      inputMode={inputMode}
                      label={`${label} do ano ${index + 1} (${unit})`}
                      maxLength={48}
                      value={year[key]}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        const years = draft.years.map((entry, at) =>
                          at === index ? { ...entry, [key]: value } : entry,
                        );
                        onChange({ ...draft, years });
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
