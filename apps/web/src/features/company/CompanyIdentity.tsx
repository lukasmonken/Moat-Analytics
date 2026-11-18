import type { CvmIdentitySnapshot } from '@moat/data-contracts';
import { useEffect, useState } from 'react';
import { cvmIdentityUrl, loadCvmIdentity } from '../../shared/data-client/cvmSnapshot';
import { Badge, Button, Icon } from '../../shared/ui';
import { formatDate, formatInstant } from './financialPresentation';

type IdentityState =
  | { status: 'loading' | 'unavailable' | 'error' }
  | { status: 'ready'; snapshot: CvmIdentitySnapshot };

function CompanyIdentityContent({ companyId }: { companyId: string }) {
  const [state, setState] = useState<IdentityState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadCvmIdentity(signal).then(
      (snapshot) => {
        if (signal.aborted) return;
        setState(snapshot ? { status: 'ready', snapshot } : { status: 'unavailable' });
      },
      () => {
        if (!signal.aborted) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  if (state.status === 'loading') {
    return <p role="status">Carregando os códigos da CVM…</p>;
  }
  if (state.status === 'error') {
    return (
      <>
        <p role="status">Houve um problema ao carregar ou validar o cadastro da CVM.</p>
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
  if (state.status !== 'ready') {
    return <p>O cadastro da CVM está indisponível.</p>;
  }

  const { snapshot } = state;
  const company = snapshot.companies.find((entry) => entry.companyId === companyId);
  if (!company?.tickers.length) {
    return <p>Os códigos desta companhia estão indisponíveis na amostra do cadastro.</p>;
  }

  return (
    <>
      <p>
        Códigos e classes do Formulário Cadastral (FCA). O ticker representativo e a composição dos
        índices aguardam validação.
      </p>
      <ul className="company-tickers" aria-label="Códigos de negociação" role="list">
        {company.tickers.map(({ ticker, kind }) => (
          <li key={ticker}>
            <strong>{ticker}</strong>
            <Badge>{kind}</Badge>
          </li>
        ))}
      </ul>
      <dl className="company-metadata">
        <div>
          <dt>Referência do cadastro</dt>
          <dd>
            <time dateTime={company.referenceDate}>{formatDate(company.referenceDate)}</time>
          </dd>
        </div>
        <div>
          <dt>Recebimento na CVM</dt>
          <dd>
            <time dateTime={company.receiptDate}>{formatDate(company.receiptDate)}</time>
          </dd>
        </div>
        <div>
          <dt>Versão do envio</dt>
          <dd>{company.filingVersion}</dd>
        </div>
        <div>
          <dt>Coleta (Brasília)</dt>
          <dd>
            <time dateTime={snapshot.retrievedAt}>{formatInstant(snapshot.retrievedAt)}</time>
          </dd>
        </div>
      </dl>
      <p className="company-source-links">
        <a href={snapshot.source.datasetUrl} target="_blank" rel="noreferrer">
          Catálogo do FCA <Icon name="arrow-up-right" size={14} />
        </a>
        <a href={snapshot.source.licenseUrl} target="_blank" rel="noreferrer">
          {snapshot.source.license} <Icon name="arrow-up-right" size={14} />
        </a>
        <a href={snapshot.archiveUrl} target="_blank" rel="noreferrer">
          ZIP original do FCA <Icon name="arrow-up-right" size={14} />
        </a>
        <a href={cvmIdentityUrl} download="cvm-identity.json">
          Baixar códigos em JSON
        </a>
      </p>
    </>
  );
}

export function CompanyIdentity({ companyId }: { companyId: string }) {
  const [requested, setRequested] = useState(false);

  return (
    <details
      className="company-observation"
      onToggle={(event) => {
        if (event.currentTarget.open) setRequested(true);
      }}
    >
      <summary>
        <span>Códigos informados à CVM</span>
        <Icon className="company-observation-icon" name="chevron-down" size={18} />
      </summary>
      <div className="company-observation-body">
        {requested && <CompanyIdentityContent companyId={companyId} />}
      </div>
    </details>
  );
}
