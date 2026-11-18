import type { QualityCompany, QualityObservation, QualitySnapshot } from '@moat/data-contracts';
import { useEffect, useState } from 'react';
import { loadQualitySnapshot, qualitySnapshotUrl } from '../../shared/data-client/qualitySnapshot';
import { Button, Icon, Panel, Table } from '../../shared/ui';
import { formatCurrency, formatDate, formatInstant } from './financialPresentation';
import './quality-history.css';

const percent = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const taxPercent = new Intl.NumberFormat('pt-BR', { style: 'percent' });
const points = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const signedPoints = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

function formatRate(value: number | null) {
  return value === null ? 'Indisponível' : percent.format(value);
}

function formatPoints(value: number | null, signed = false) {
  if (value === null) return 'Indisponível';
  return (signed ? signedPoints : points).format(value) + ' p.p.';
}

function formatRateDistance(value: number | null) {
  return formatPoints(value === null ? null : value * 100);
}

function formatCapital(value: number | null) {
  return value === null ? 'Indisponível' : formatCurrency(value);
}

function QualitySummary({ summary }: { summary: QualityCompany['summary'] }) {
  const measures = [
    ['Exercícios com cálculo', summary.validYears],
    ['Média', formatRate(summary.mean)],
    ['Mediana', formatRate(summary.median)],
    ['Desvio-padrão', formatRateDistance(summary.populationStddev)],
    ['Amplitude', formatRateDistance(summary.amplitude)],
    ['Tendência anual', formatPoints(summary.trendPpPerYear, true)],
  ] as const;

  return (
    <dl className="quality-summary">
      {measures.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function QualityAudit({
  observation,
  metric,
}: {
  observation: QualityObservation;
  metric: QualityCompany['metric'];
}) {
  const { fiscalYear, provenance } = observation;
  const base = metric === 'roic' ? 'Capital investido' : 'Patrimônio da controladora';
  const calculations = [
    [
      metric === 'roic' ? 'NOPAT estimado' : 'Lucro atribuível à controladora',
      observation.numeratorBrl,
    ],
    [`${base} na abertura`, observation.openingCapitalBrl],
    [`${base} no fechamento`, observation.closingCapitalBrl],
    [`${base} médio`, observation.averageCapitalBrl],
  ] as const;

  return (
    <details className="company-observation quality-audit">
      <summary>
        <span>Contas e cálculo de {fiscalYear}</span>
        <Icon className="company-observation-icon" name="chevron-down" size={18} />
      </summary>
      <div className="company-observation-body">
        <dl className="company-metadata">
          {calculations.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{formatCapital(value)}</dd>
            </div>
          ))}
          <div>
            <dt>Data-base da DFP</dt>
            <dd>
              <time dateTime={provenance.referenceDate}>
                {formatDate(provenance.referenceDate)}
              </time>
            </dd>
          </div>
          <div>
            <dt>Versão da DFP na CVM</dt>
            <dd>{observation.filingVersion}</dd>
          </div>
          <div>
            <dt>Data de coleta</dt>
            <dd>
              <time dateTime={provenance.retrievedAt}>{formatInstant(provenance.retrievedAt)}</time>
            </dd>
          </div>
        </dl>
        {observation.reasons.length > 0 && (
          <ul className="quality-notes" aria-label={`Notas de ${fiscalYear}`}>
            {observation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        {observation.inputs.length > 0 && (
          <div
            className="company-table-scroll"
            role="region"
            tabIndex={0}
            aria-label={`Contas CVM de ${fiscalYear}`}
          >
            <Table
              className="quality-table"
              aria-label={`Contas usadas no cálculo de ${fiscalYear}`}
            >
              <thead>
                <tr>
                  <th scope="col">Conta CVM</th>
                  <th scope="col">Referência</th>
                  <th scope="col">Valor</th>
                </tr>
              </thead>
              <tbody>
                {observation.inputs.map((input) => (
                  <tr key={`${input.key}:${input.referenceDate}`}>
                    <th scope="row">
                      {input.label}
                      <small>
                        {input.statement} · {input.code}
                      </small>
                    </th>
                    <td>
                      <time dateTime={input.referenceDate}>{formatDate(input.referenceDate)}</time>
                    </td>
                    <td>{formatCurrency(input.amountBrl)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
        <p className="company-source-links">
          <a href={observation.archiveUrl} target="_blank" rel="noreferrer">
            ZIP da DFP na CVM <Icon name="arrow-up-right" size={14} />
          </a>
        </p>
        <p className="company-filing-hash">
          SHA-256 do ZIP <code>{observation.archiveSha256}</code>
        </p>
      </div>
    </details>
  );
}

function QualitySeries({
  snapshot,
  company,
}: {
  snapshot: QualitySnapshot;
  company: QualityCompany;
}) {
  const isRoic = company.metric === 'roic';
  const metric = isRoic ? 'ROIC estimado' : 'ROE atribuível à controladora';
  const observations = [...company.observations].sort((a, b) => b.fiscalYear - a.fiscalYear);

  return (
    <>
      <div>
        <h3>{metric}</h3>
        <p>
          {isRoic
            ? `A estimativa aplica a alíquota de cenário de ${taxPercent.format(snapshot.roicTaxRate)} ao resultado divulgado antes do financeiro e dos tributos para calcular o NOPAT. O capital investido soma patrimônio líquido consolidado, empréstimos e arrendamentos contabilizados em separado. O cálculo deduz caixa e equivalentes como aproximação do caixa excedente e usa a média dos saldos de abertura e fechamento.`
            : 'O lucro líquido atribuível à controladora é dividido pela média do patrimônio líquido da controladora nos saldos de abertura e fechamento da mesma DFP.'}
        </p>
      </div>
      <QualitySummary summary={company.summary} />
      <div
        className="company-table-scroll"
        role="region"
        tabIndex={0}
        aria-label="Resultados anuais de qualidade"
      >
        <Table className="quality-table" aria-label="Série de qualidade por exercício">
          <thead>
            <tr>
              <th scope="col">Exercício</th>
              <th scope="col">{isRoic ? 'ROIC estimado' : 'ROE'}</th>
              <th scope="col">Variação anual</th>
              <th scope="col">Spread de 10 anos</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((observation) => (
              <tr key={observation.fiscalYear}>
                <th scope="row">{observation.fiscalYear}</th>
                <td>{formatRate(observation.value)}</td>
                <td>{formatPoints(observation.changePp, true)}</td>
                <td>{formatPoints(observation.spreadPp, true)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <p>Spread indisponível. {snapshot.benchmark.reason}</p>
      <p>Ranking indisponível. {snapshot.ranking.reason}</p>
      <div className="quality-audits">
        {observations.map((observation) => (
          <QualityAudit
            key={observation.fiscalYear}
            observation={observation}
            metric={company.metric}
          />
        ))}
      </div>
      <p className="quality-provenance">
        Metodologia <code>{snapshot.methodologyVersion}</code> · lote de{' '}
        <time dateTime={snapshot.manifest.asOf}>{formatDate(snapshot.manifest.asOf)}</time>
      </p>
      <p className="company-source-links">
        <a href={snapshot.manifest.source.datasetUrl} target="_blank" rel="noreferrer">
          Catálogo da CVM <Icon name="arrow-up-right" size={14} />
        </a>
        <a href={snapshot.manifest.source.licenseUrl} target="_blank" rel="noreferrer">
          {snapshot.manifest.source.license} <Icon name="arrow-up-right" size={14} />
        </a>
        <a href={qualitySnapshotUrl} download="cvm-quality.json">
          Baixar séries em JSON
        </a>
      </p>
    </>
  );
}

type QualityState =
  { status: 'loading' | 'error' | 'unavailable' } | { status: 'ready'; snapshot: QualitySnapshot };

function QualityContent({ companyId }: { companyId: string }) {
  const [state, setState] = useState<QualityState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadQualitySnapshot(signal).then(
      (snapshot) => {
        if (!signal.aborted)
          setState(snapshot ? { status: 'ready', snapshot } : { status: 'unavailable' });
      },
      () => {
        if (!signal.aborted) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  if (state.status === 'loading') return <p role="status">Carregando séries de qualidade…</p>;

  if (state.status === 'error') {
    return (
      <>
        <p role="status">Falha ao carregar a série de qualidade.</p>
        <Button
          className="company-inline-action"
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((last) => last + 1);
          }}
        >
          Tentar novamente
        </Button>
      </>
    );
  }

  if (state.status === 'ready') {
    const { snapshot } = state;
    const company = snapshot.companies.find((entry) => entry.companyId === companyId);
    if (company?.observations.length) {
      return <QualitySeries key={company.companyId} snapshot={snapshot} company={company} />;
    }
  }

  return <p role="status">Série de qualidade indisponível para esta companhia.</p>;
}

export function QualityHistory({ companyId }: { companyId: string }) {
  const [requested, setRequested] = useState(false);

  return (
    <Panel className="company-panel" aria-labelledby="company-quality">
      <div>
        <h2 id="company-quality">Qualidade contábil</h2>
        <p>Indicadores anuais da amostra, com as contas e premissas de cada cálculo.</p>
      </div>
      <details
        className="company-observation"
        onToggle={(event) => {
          if (event.currentTarget.open) setRequested(true);
        }}
      >
        <summary>
          <span>Histórico de qualidade</span>
          <Icon className="company-observation-icon" name="chevron-down" size={18} />
        </summary>
        <div className="company-observation-body quality-body">
          {requested && <QualityContent companyId={companyId} />}
        </div>
      </details>
    </Panel>
  );
}
