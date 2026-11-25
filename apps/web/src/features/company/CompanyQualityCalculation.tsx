import type { SectorComparisonObservation, SectorRoicObservation } from '@moat/data-contracts';
import { useEffect, useRef } from 'react';
import { Table } from '../../shared/ui';
import {
  annualComparisonContext,
  annualObservation,
  comparisonSector,
  type Company,
} from './companyQualityData';
import { formatCurrency, formatDate } from './financialPresentation';
import { formatRate } from './QualityHistory';

function RoeCalculation({
  inputs,
}: {
  inputs: NonNullable<SectorComparisonObservation['inputs']>;
}) {
  const incomeSource = inputs.auditedStatementPage
    ? `${inputs.incomeStatement}, p. ${inputs.auditedStatementPage}`
    : `${inputs.incomeStatement} ${inputs.incomeCode}`;
  return (
    <dl className="company-metadata">
      <div>
        <dt>Lucro líquido da controladora</dt>
        <dd>
          {formatCurrency(inputs.netIncomeBrl)} · {incomeSource}
        </dd>
      </div>
      <div>
        <dt>Patrimônio médio da controladora</dt>
        <dd>{formatCurrency((inputs.openingEquityBrl + inputs.closingEquityBrl) / 2)}</dd>
      </div>
      <div>
        <dt>Patrimônio na abertura</dt>
        <dd>
          {formatCurrency(inputs.openingEquityBrl)}
          {inputs.openingEquityDate && (
            <>
              {' · '}
              <time dateTime={inputs.openingEquityDate}>
                {formatDate(inputs.openingEquityDate)}
              </time>
            </>
          )}
        </dd>
      </div>
      <div>
        <dt>Patrimônio no fechamento</dt>
        <dd>{formatCurrency(inputs.closingEquityBrl)}</dd>
      </div>
    </dl>
  );
}

const embeddedLeasesLabel = 'Arrendamentos incluídos nos financiamentos';
const separateLeasesLabel = 'Arrendamentos fora dos financiamentos';
const balanceLabels = [
  ['Patrimônio líquido consolidado', /Equity$/],
  ['Empréstimos e financiamentos', /Borrowings$/],
  [embeddedLeasesLabel, /LeaseIncluded$/],
  [separateLeasesLabel, /SeparateLease$/],
  ['Outros passivos financeiros', /SeparateDebt\d+$/],
  ['Caixa e equivalentes', /Cash$/],
] as const;

function RoicCalculation({
  inputs,
  taxRate,
}: {
  inputs: NonNullable<SectorRoicObservation['inputs']>;
  taxRate: number;
}) {
  const noteBalances: Record<string, typeof inputs.embeddedLeases> = {
    [embeddedLeasesLabel]: inputs.embeddedLeases,
    [separateLeasesLabel]: inputs.separateLeases,
  };
  const presentation = (period: string, pattern: RegExp) => {
    const accounts = inputs.accounts.filter(
      ({ key }) => key.startsWith(period) && pattern.test(key),
    );
    const total = accounts.reduce((sum, account) => sum + account.amountBrl, 0);
    return accounts.length > 0 ? formatCurrency(total) : '—';
  };
  return (
    <>
      <dl className="company-metadata">
        <div>
          <dt>EBIT</dt>
          <dd>{formatCurrency(inputs.ebitBrl)}</dd>
        </div>
        <div>
          <dt>Alíquota padronizada</dt>
          <dd>{formatRate(taxRate)}</dd>
        </div>
        <div>
          <dt>NOPAT estimado</dt>
          <dd>{formatCurrency(inputs.nopatBrl)}</dd>
        </div>
        <div>
          <dt>Capital investido médio</dt>
          <dd>{formatCurrency((inputs.openingCapitalBrl + inputs.closingCapitalBrl) / 2)}</dd>
        </div>
      </dl>
      <div className="company-table-scroll" role="region" aria-label="Saldos do ROIC" tabIndex={0}>
        <Table className="company-history-table" aria-label="Contas do capital investido">
          <thead>
            <tr>
              <th scope="col">Conta</th>
              <th scope="col">Abertura</th>
              <th scope="col">Fechamento</th>
            </tr>
          </thead>
          <tbody>
            {balanceLabels.map(([label, pattern]) => {
              const leases = noteBalances[label];
              const opening = leases
                ? formatCurrency(leases.openingBrl)
                : presentation('opening', pattern);
              const closing = leases
                ? formatCurrency(leases.closingBrl)
                : presentation('closing', pattern);
              return opening === '—' && closing === '—' ? null : (
                <tr key={label}>
                  <th scope="row">
                    {label}
                    {leases && <small>Nota {leases.note}</small>}
                  </th>
                  <td>{opening}</td>
                  <td>{closing}</td>
                </tr>
              );
            })}
            <tr>
              <th scope="row">Capital investido</th>
              <td>{formatCurrency(inputs.openingCapitalBrl)}</td>
              <td>{formatCurrency(inputs.closingCapitalBrl)}</td>
            </tr>
          </tbody>
        </Table>
      </div>
    </>
  );
}

export const calculationId = 'company-quality-calculation';
const calculationHeadingId = 'company-quality-calculation-heading';

export function CompanyCalculation({
  company,
  year,
  taxRate,
}: {
  company: Company;
  year: number;
  taxRate: number;
}) {
  const focus = useRef<HTMLElement>(null);
  const observation = annualObservation(company, year);
  const filing = observation?.filing;
  const context = annualComparisonContext(company, year);
  useEffect(() => {
    focus.current?.focus();
  }, [company.name]);

  return (
    <section
      className="sector-comparison-audit"
      id={calculationId}
      aria-labelledby={calculationHeadingId}
      tabIndex={-1}
      ref={focus}
    >
      <h3 id={calculationHeadingId}>
        {company.name} · {year}
      </h3>
      {comparisonSector(company) !== company.sector && (
        <p>Setor cadastral na CVM · {company.sector}</p>
      )}
      {context && (
        <p className="company-source-links">
          <span>{context.note}</span>
          <a href={context.sourceUrl} target="_blank" rel="noreferrer">
            Fato relevante na CVM
          </a>
        </p>
      )}
      {observation?.reason && <p>{observation.reason}</p>}
      {!observation && <p>Demonstrativo indisponível para este exercício.</p>}
      {observation?.inputs &&
        ('roe' in observation ? (
          <RoeCalculation inputs={observation.inputs} />
        ) : (
          <RoicCalculation inputs={observation.inputs} taxRate={taxRate} />
        ))}
      {filing && (
        <p className="company-source-links">
          <a href={filing.filingUrl} target="_blank" rel="noreferrer">
            Formulário DFP na CVM
          </a>
          <span>
            Data-base{' '}
            <time dateTime={filing.referenceDate}>{formatDate(filing.referenceDate)}</time>
            {' · '}Recebimento{' '}
            <time dateTime={filing.receivedAt}>{formatDate(filing.receivedAt)}</time>
            {' · '}Versão {filing.version}
            {filing.basis === 'individual' && ' · Demonstração individual'}
          </span>
          {filing.supportingDocumentUrl && (
            <a href={filing.supportingDocumentUrl} target="_blank" rel="noreferrer">
              Demonstrações de apoio
            </a>
          )}
        </p>
      )}
    </section>
  );
}
