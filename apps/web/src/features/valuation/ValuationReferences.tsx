import type { PriceFundamentalsSnapshot } from '@moat/data-contracts';
import { useEffect, useId, useState } from 'react';
import { loadPriceFundamentals } from '../../shared/data-client/priceSnapshot';
import { Button, Panel, Select } from '../../shared/ui';
import type { ValuationDraft, ValuationModel, ValuationSources } from './scenario';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

function millions(value: number) {
  return String(value / 1_000_000).replace('.', ',');
}

export function ValuationReferences({
  model,
  onApply,
}: {
  model: ValuationModel;
  onApply: (
    fields: Partial<Pick<ValuationDraft, 'shares' | 'netDebt' | 'equityAdjustments'>>,
    sources: ValuationSources,
  ) => void;
}) {
  const heading = useId();
  const [companyId, setCompanyId] = useState('');
  const [snapshot, setSnapshot] = useState<PriceFundamentalsSnapshot | null | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    void loadPriceFundamentals(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSnapshot(data);
      },
      () => {
        if (!controller.signal.aborted) setSnapshot(null);
      },
    );
    return () => controller.abort();
  }, []);

  const companies =
    snapshot?.companies.filter(({ category }) => (category === 'bank') === (model === 'ddm')) ?? [];
  const company = companies.find((entry) => entry.companyId === companyId) ?? companies[0];
  const { balance, shares } = company ?? {};
  const shareCount = shares?.classes.reduce((total, entry) => total + entry.outstanding, 0);
  const balanceDate = balance?.provenance.referenceDate;
  const sourceDate = balanceDate ?? shares?.referenceDate;

  function apply() {
    const counts = { shares: shareCount === undefined ? '' : millions(shareCount) };
    const sources: ValuationSources = {};
    if (shares) {
      sources.shares = {
        source: 'Posição de ações fora da tesouraria',
        url: shares.evidenceUrl,
        referenceDate: shares.referenceDate,
        retrievedAt: shares.retrievedAt,
      };
    }
    if (model === 'dcf' && balance) {
      const balanceSource = {
        source: balance.provenance.source,
        url: balance.documentUrl,
        referenceDate: balance.provenance.referenceDate,
        retrievedAt: balance.provenance.retrievedAt,
      };
      sources.netDebt = balanceSource;
      sources.equityAdjustments = balanceSource;
    }
    onApply(
      model === 'ddm'
        ? counts
        : {
            ...counts,
            netDebt: balance ? millions(balance.netDebtBrl) : '',
            equityAdjustments: balance ? millions(-balance.nonControllingInterestsBrl) : '',
          },
      sources,
    );
  }

  return (
    <Panel className="valuation-panel" aria-labelledby={heading}>
      <h2 id={heading}>Referências contábeis</h2>
      {snapshot === undefined && <p role="status">Consultando os demonstrativos da CVM…</p>}
      {snapshot !== undefined && !company && (
        <p>Referências da CVM indisponíveis para este modelo.</p>
      )}
      {company && (
        <>
          <Select
            id="valuation-company"
            label="Companhia de referência"
            value={company.companyId}
            onChange={(event) => setCompanyId(event.currentTarget.value)}
          >
            {companies.map((entry) => (
              <option key={entry.companyId} value={entry.companyId}>
                {entry.name}
              </option>
            ))}
          </Select>
          {sourceDate && (
            <p>
              Dados em <time dateTime={sourceDate}>{date.format(new Date(sourceDate))}</time>. Ao
              aplicar, esta posição preenche os campos de capital do cenário. Campos sem dados ficam
              em branco.
            </p>
          )}
          <dl className="valuation-measures">
            <div>
              <dt>
                {company.metric === 'nopat'
                  ? 'NOPAT histórico estimado (12 meses)'
                  : 'Lucro histórico da controladora (12 meses)'}
              </dt>
              <dd>{currency.format(company.amountBrl)}</dd>
            </div>
            {balance && (
              <>
                <div>
                  <dt>Dívida líquida simplificada</dt>
                  <dd>{currency.format(balance.netDebtBrl)}</dd>
                </div>
                <div>
                  <dt>Ajuste contábil de não controladores</dt>
                  <dd>{currency.format(-balance.nonControllingInterestsBrl || 0)}</dd>
                </div>
              </>
            )}
            <div>
              <dt>Ações fora da tesouraria</dt>
              <dd>
                {shareCount === undefined ? 'Indisponível' : shareCount.toLocaleString('pt-BR')}
              </dd>
            </div>
          </dl>
          {company.denominatorIssues?.shares && <p>{company.denominatorIssues.shares}</p>}
          {balance?.limitations.map((note) => (
            <p key={note}>{note}</p>
          ))}
          {(balance || shares) && (
            <div className="valuation-actions">
              <Button variant="quiet" onClick={apply}>
                Aplicar referências ao cenário
              </Button>
              {balance && (
                <a href={balance.documentUrl} target="_blank" rel="noreferrer">
                  Balanço no ITR da CVM
                </a>
              )}
              {shares && (
                <a href={shares.evidenceUrl} target="_blank" rel="noreferrer">
                  Fonte da posição de ações
                </a>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
