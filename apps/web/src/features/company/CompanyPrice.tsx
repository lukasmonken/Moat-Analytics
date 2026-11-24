import type {
  CvmIdentitySnapshot,
  MarketCloseSnapshot,
  PriceFundamental,
  PriceFundamentalsSnapshot,
} from '@moat/data-contracts';
import { useEffect, useState } from 'react';
import { loadCvmIdentity } from '../../shared/data-client/cvmSnapshot';
import {
  fundamentalsUrl,
  loadMarketCloses,
  loadPriceFundamentals,
} from '../../shared/data-client/priceSnapshot';
import { ExportWorkbookButton } from '../../shared/export/ExportWorkbookButton';
import { Button, Icon, Panel, Table } from '../../shared/ui';
import {
  companyFundamentalsReport,
  companyWorkbookFilename,
  fundamentalRoles,
} from './companyReports';
import { formatAmount, formatCurrency, formatDate, formatInstant } from './financialPresentation';
import { formatRate } from './QualityHistory';

type PriceData = { closes: MarketCloseSnapshot; identity: CvmIdentitySnapshot | null };
type Loaded<T> = { status: 'loading' | 'error' } | { status: 'ready'; data: T | null };

function DatedValue({ date }: { date: string }) {
  return <time dateTime={date}>{formatDate(date)}</time>;
}

function CapitalEvidence({ fundamental }: { fundamental: PriceFundamental }) {
  const { balance, shares, denominatorIssues, category } = fundamental;
  return (
    <details className="company-observation">
      <summary>
        <span>Capitalização e dívida líquida</span>
        <Icon className="company-observation-icon" name="chevron-down" size={18} />
      </summary>
      <div className="company-observation-body quality-body">
        {shares ? (
          <>
            <h3>Ações por classe</h3>
            <p>
              Posição em <DatedValue date={shares.referenceDate} />. A capitalização exige confirmar
              as quantidades no pregão da cotação.
            </p>
            <div
              className="company-table-scroll"
              role="region"
              tabIndex={0}
              aria-label="Composição do capital"
            >
              <Table className="quality-table" aria-label="Ações por classe">
                <thead>
                  <tr>
                    <th scope="col">Classe</th>
                    <th scope="col">Emitidas</th>
                    <th scope="col">Tesouraria</th>
                    <th scope="col">Fora da tesouraria</th>
                  </tr>
                </thead>
                <tbody>
                  {shares.classes.map((row) => (
                    <tr key={row.ticker}>
                      <th scope="row">
                        {row.ticker} · {row.kind}
                      </th>
                      <td>{formatAmount(row.issued)}</td>
                      <td>{formatAmount(row.treasury)}</td>
                      <td>{formatAmount(row.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <p className="company-source-links">
              <a href={shares.documentUrl} target="_blank" rel="noreferrer">
                ITR na CVM · versão {shares.filingVersion} <Icon name="arrow-up-right" size={14} />
              </a>
              <a href={shares.evidenceUrl} target="_blank" rel="noreferrer">
                Documento com as quantidades exatas <Icon name="arrow-up-right" size={14} />
              </a>
            </p>
          </>
        ) : (
          <p>{denominatorIssues?.shares ?? 'Ações por classe indisponíveis.'}</p>
        )}
        {balance && (
          <>
            <h3>Dívida líquida simplificada</h3>
            <dl className="company-metadata">
              {(
                [
                  ['Empréstimos e financiamentos', balance.borrowingsBrl],
                  ['Arrendamentos', balance.leaseLiabilitiesBrl],
                  ['Dívida bruta', balance.grossDebtBrl],
                  ['Caixa e equivalentes', balance.cashBrl],
                  ['Dívida líquida', balance.netDebtBrl],
                  ['Aplicações financeiras circulantes', balance.financialInvestmentsBrl],
                  ['Patrimônio dos não controladores', balance.nonControllingInterestsBrl],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{formatCurrency(value)}</dd>
                </div>
              ))}
            </dl>
            <p>
              Balanço de <DatedValue date={balance.provenance.referenceDate} /> ·{' '}
              <a href={balance.documentUrl} target="_blank" rel="noreferrer">
                ITR na CVM · versão {balance.filingVersion}
              </a>
            </p>
            <ul className="quality-notes">
              {balance.limitations.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        )}
        {!balance && category !== 'bank' && (
          <p>
            {denominatorIssues?.balance ??
              'Dívida líquida e ajustes do valor da firma indisponíveis.'}
          </p>
        )}
      </div>
    </details>
  );
}

function TrailingResults({
  snapshot,
  companyId,
}: {
  snapshot: PriceFundamentalsSnapshot;
  companyId: string;
}) {
  const fundamental = snapshot.companies.find((row) => row.companyId === companyId);
  if (!fundamental) {
    const issue = snapshot.issues.find((row) => row.companyId === companyId);
    return <p>{issue?.message ?? 'Resultado de 12 meses indisponível para esta companhia.'}</p>;
  }
  const licenseUrl = snapshot.manifest.sources[0]?.licenseUrl;
  return (
    <>
      <dl className="company-metadata">
        <div>
          <dt>
            {fundamental.metric === 'nopat'
              ? 'NOPAT estimado em 12 meses'
              : 'Lucro da controladora em 12 meses'}
          </dt>
          <dd>{formatCurrency(fundamental.amountBrl)}</dd>
        </div>
        <div>
          <dt>Período contábil</dt>
          <dd>
            <DatedValue date={fundamental.periodStart} /> a{' '}
            <DatedValue date={fundamental.periodEnd} />
          </dd>
        </div>
      </dl>
      <details className="company-observation">
        <summary>
          <span>Contas usadas nos últimos 12 meses</span>
          <Icon className="company-observation-icon" name="chevron-down" size={18} />
        </summary>
        <div className="company-observation-body quality-body">
          <p>
            Resultado anual mais o acumulado atual, menos o comparativo do mesmo ITR.
            {fundamental.taxRate !== null && ' O NOPAT estimado aplica alíquota de 34% ao EBIT.'}
          </p>
          <div
            className="company-table-scroll"
            role="region"
            tabIndex={0}
            aria-label="Insumos da CVM"
          >
            <Table className="quality-table" aria-label="Insumos dos últimos 12 meses">
              <thead>
                <tr>
                  <th scope="col">Conta e documento</th>
                  <th scope="col">Período</th>
                  <th scope="col">Valor</th>
                </tr>
              </thead>
              <tbody>
                {fundamental.inputs.map((input) => (
                  <tr key={input.role}>
                    <th scope="row">
                      <a href={input.documentUrl} target="_blank" rel="noreferrer">
                        {fundamentalRoles[input.role]} · {input.role === 'annual' ? 'DFP' : 'ITR'} v
                        {input.filingVersion}
                      </a>
                      <small>
                        {input.accountCode} · {input.accountLabel}
                      </small>
                    </th>
                    <td>
                      <DatedValue date={input.periodStart} /> a{' '}
                      <DatedValue date={input.periodEnd} />
                    </td>
                    <td>{formatCurrency(input.amountBrl)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="company-source-links">
            {snapshot.manifest.sources.map((source) => (
              <a key={source.datasetUrl} href={source.datasetUrl} target="_blank" rel="noreferrer">
                Catálogo {source.datasetUrl.endsWith('-dfp') ? 'DFP' : 'ITR'} da CVM{' '}
                <Icon name="arrow-up-right" size={14} />
              </a>
            ))}
            {licenseUrl && (
              <a href={licenseUrl} target="_blank" rel="noreferrer">
                Licença dos dados CVM · ODbL 1.0 <Icon name="arrow-up-right" size={14} />
              </a>
            )}
            <a href={fundamentalsUrl} download="cvm-price-fundamentals.json">
              Baixar dados e fontes em JSON
            </a>
          </p>
        </div>
      </details>
      <CapitalEvidence fundamental={fundamental} />
      {fundamental.historicalMarketPoint && (
        <HistoricalYield point={fundamental.historicalMarketPoint} />
      )}
      <div className="company-inline-action">
        <ExportWorkbookButton
          filename={companyWorkbookFilename('fundamentos', companyId)}
          build={() => companyFundamentalsReport(fundamental, snapshot)}
          label="Exportar fundamentos em Excel"
        />
      </div>
    </>
  );
}

function HistoricalYield({
  point,
}: {
  point: NonNullable<PriceFundamental['historicalMarketPoint']>;
}) {
  return (
    <section aria-labelledby="historical-market-yield">
      <h3 id="historical-market-yield">Rendimento implícito histórico</h3>
      <p>
        Referência de <DatedValue date={point.referenceDate} />. Cálculo retrospectivo com o lucro
        de 12 meses e os valores por ação informados no demonstrativo divulgado após a data-base.
      </p>
      <dl className="company-metadata">
        <div>
          <dt>Lucro sobre capitalização</dt>
          <dd>{formatRate(point.earningsYield)}</dd>
        </div>
        <div>
          <dt>Capitalização de mercado na data-base</dt>
          <dd>{formatCurrency(point.marketCapBrl)}</dd>
        </div>
        {point.classes.map(({ ticker, priceBrl }) => (
          <div key={ticker}>
            <dt>{ticker}</dt>
            <dd>{formatCurrency(priceBrl)}</dd>
          </div>
        ))}
      </dl>
      <p className="company-source-links">
        <a href={point.documentUrl} target="_blank" rel="noreferrer">
          {point.sourceName} <Icon name="arrow-up-right" size={14} />
        </a>
        <a href={point.reusePolicyUrl} target="_blank" rel="noreferrer">
          Política de reuso da SEC <Icon name="arrow-up-right" size={14} />
        </a>
      </p>
    </section>
  );
}

function ClosingPrices({ data, companyId }: { data: PriceData; companyId: string }) {
  const { closes, identity } = data;
  const tickers = identity?.companies.find((entry) => entry.companyId === companyId)?.tickers ?? [];
  if (tickers.length === 0) {
    return <p>Códigos de negociação indisponíveis para vincular os fechamentos.</p>;
  }
  const quotes = new Map(closes.quotes.map((quote) => [quote.ticker, quote]));

  return (
    <>
      <p>
        Pregão de referência do lote <DatedValue date={closes.expectedTradeDate} /> ·{' '}
        <a href={closes.source.url} target="_blank" rel="noreferrer">
          {closes.source.name}
        </a>
      </p>
      <div
        className="company-table-scroll"
        role="region"
        tabIndex={0}
        aria-label="Cotações por classe"
      >
        <Table className="quality-table" aria-label="Fechamentos por classe">
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Pregão</th>
              <th scope="col">Coleta</th>
              <th scope="col">Fechamento por ação</th>
            </tr>
          </thead>
          <tbody>
            {tickers.map(({ ticker, kind }) => {
              const quote = quotes.get(ticker);
              return (
                <tr key={ticker}>
                  <th scope="row">
                    {ticker} · {kind}
                  </th>
                  {quote ? (
                    <>
                      <td>
                        <DatedValue date={quote.tradeDate} />
                        {quote.tradeDate < closes.expectedTradeDate && (
                          <small>Anterior ao pregão de referência</small>
                        )}
                      </td>
                      <td>
                        <time dateTime={quote.provenance.retrievedAt}>
                          {formatInstant(quote.provenance.retrievedAt)}
                        </time>
                      </td>
                      <td>{formatCurrency(quote.close)}</td>
                    </>
                  ) : (
                    <td colSpan={3}>Indisponível</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </>
  );
}

export function CompanyPrice({ companyId }: { companyId: string }) {
  const [fundamentals, setFundamentals] = useState<Loaded<PriceFundamentalsSnapshot>>({
    status: 'loading',
  });
  const [prices, setPrices] = useState<Loaded<PriceData>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadPriceFundamentals(signal).then(
      (data) => {
        if (!signal.aborted) setFundamentals({ status: 'ready', data });
      },
      () => {
        if (!signal.aborted) setFundamentals({ status: 'error' });
      },
    );
    void loadMarketCloses(signal)
      .then(async (closes) => closes && { closes, identity: await loadCvmIdentity(signal) })
      .then(
        (data) => {
          if (!signal.aborted) setPrices({ status: 'ready', data });
        },
        () => {
          if (!signal.aborted) setPrices({ status: 'error' });
        },
      );
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setFundamentals({ status: 'loading' });
    setPrices({ status: 'loading' });
    setAttempt((current) => current + 1);
  }

  return (
    <Panel className="company-panel" aria-labelledby="company-price">
      <h2 id="company-price">Preço e rendimento implícito</h2>
      {fundamentals.status === 'loading' && <p role="status">Carregando dados de 12 meses…</p>}
      {fundamentals.status === 'error' && (
        <p role="status">Falha ao carregar os dados de 12 meses.</p>
      )}
      {fundamentals.status === 'ready' &&
        (fundamentals.data ? (
          <TrailingResults snapshot={fundamentals.data} companyId={companyId} />
        ) : (
          <p>Resultado de 12 meses indisponível.</p>
        ))}
      {prices.status === 'loading' && <p role="status">Carregando fechamentos…</p>}
      {prices.status === 'error' && <p role="status">Falha ao carregar os fechamentos.</p>}
      {prices.status === 'ready' &&
        (prices.data ? (
          <ClosingPrices companyId={companyId} data={prices.data} />
        ) : (
          <p>Fechamento indisponível nesta versão.</p>
        ))}
      {(fundamentals.status === 'error' || prices.status === 'error') && (
        <Button className="company-inline-action" onClick={retry}>
          Recarregar dados de preço
        </Button>
      )}
      <p>
        Rendimento implícito atual indisponível. O cálculo depende de fechamentos e da confirmação
        das ações em circulação por classe no mesmo pregão.
      </p>
    </Panel>
  );
}
