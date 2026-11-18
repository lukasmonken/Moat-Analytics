import type { BankRoeSnapshot } from '@moat/data-contracts';
import { useEffect, useState } from 'react';
import { bankRoeSnapshotUrl, loadBankRoeSnapshot } from '../../shared/data-client/bankRoeSnapshot';
import { Button, Icon, Panel, Select, Table } from '../../shared/ui';
import { formatDate } from './financialPresentation';
import { formatRate, QualityAudit } from './QualityHistory';

const percentileFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function BankRoeResults({ snapshot }: { snapshot: BankRoeSnapshot }) {
  const [selectedBankId, setSelectedBankId] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>();
  const { comparison, companies, excluded, manifest } = snapshot;
  const { startYear, endYear } = comparison.period;
  const banks = [...companies].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const periodYears = (banks[0]?.observations ?? [])
    .map(({ fiscalYear }) => fiscalYear)
    .sort((a, b) => a - b);
  const bank = banks.find(({ companyId }) => companyId === selectedBankId);
  const bankYears = [...(bank?.observations ?? [])].sort((a, b) => b.fiscalYear - a.fiscalYear);
  const observation =
    bankYears.find(({ fiscalYear }) => fiscalYear === selectedYear) ?? bankYears[0];

  return (
    <>
      {banks.length > 0 ? (
        <>
          <p>
            {startYear}–{endYear} · {banks.length}{' '}
            {banks.length === 1 ? 'banco de varejo selecionado' : 'bancos de varejo selecionados'}
          </p>
          <div
            className="bank-roe-table-scroll"
            role="region"
            aria-label="Resultados anuais por banco"
            tabIndex={0}
          >
            <Table className="quality-table bank-roe-table" aria-label="ROE por banco e exercício">
              <thead>
                <tr>
                  <th scope="col">Banco</th>
                  {periodYears.map((year) => (
                    <th key={year} scope="col">
                      {year}
                    </th>
                  ))}
                  <th scope="col">Média do período</th>
                  <th scope="col">Percentil da média</th>
                </tr>
              </thead>
              <tbody>
                {banks.map((company) => {
                  const annual = new Map(
                    company.observations.map((row) => [row.fiscalYear, row.value]),
                  );
                  const percentile = comparison.percentiles?.[company.companyId];
                  return (
                    <tr key={company.companyId}>
                      <th scope="row">{company.name}</th>
                      {periodYears.map((year) => (
                        <td key={year}>{formatRate(annual.get(year) ?? null)}</td>
                      ))}
                      <td>{formatRate(company.summary.mean)}</td>
                      <td>
                        {percentile === undefined
                          ? 'Indisponível'
                          : percentileFormat.format(percentile)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </>
      ) : (
        <p role="status">Nenhum banco reúne os exercícios necessários para a comparação.</p>
      )}

      {comparison.percentiles === null && (
        <p>
          Percentis indisponíveis. São necessários pelo menos {snapshot.minimumPeers} bancos com
          séries completas no mesmo período.
        </p>
      )}
      {excluded.length > 0 && (
        <div>
          <h3>Bancos excluídos</h3>
          <ul className="company-issues">
            {excluded.map(({ companyId, name, reason }) => (
              <li key={companyId}>
                <strong>{name}</strong> · {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {banks.length > 0 && (
        <>
          <h3>Contas da DFP por banco</h3>
          <div className="bank-roe-audit-fields">
            <Select
              id="bank-roe-company"
              label="Banco"
              value={selectedBankId}
              onChange={(event) => setSelectedBankId(event.currentTarget.value)}
            >
              <option value="">Selecionar banco</option>
              {banks.map(({ companyId, name }) => (
                <option key={companyId} value={companyId}>
                  {name}
                </option>
              ))}
            </Select>
            {observation && (
              <Select
                id="bank-roe-year"
                label="Exercício da DFP"
                value={observation.fiscalYear}
                onChange={(event) => setSelectedYear(Number(event.currentTarget.value))}
              >
                {bankYears.map(({ fiscalYear }) => (
                  <option key={fiscalYear} value={fiscalYear}>
                    {fiscalYear}
                  </option>
                ))}
              </Select>
            )}
          </div>
          {observation && <QualityAudit observation={observation} metric="roe" />}
        </>
      )}

      <p className="quality-provenance">
        Demonstrações Financeiras Padronizadas da CVM · lote de{' '}
        <time dateTime={manifest.asOf}>{formatDate(manifest.asOf)}</time>
      </p>
      <p className="company-source-links">
        <a href={manifest.source.datasetUrl} target="_blank" rel="noreferrer">
          Catálogo da CVM <Icon name="arrow-up-right" size={14} />
        </a>
        <a href={manifest.source.licenseUrl} target="_blank" rel="noreferrer">
          {manifest.source.license} <Icon name="arrow-up-right" size={14} />
        </a>
        <a href={bankRoeSnapshotUrl} download="cvm-bank-roe.json">
          Baixar comparação em JSON
        </a>
      </p>
    </>
  );
}

type BankRoeState =
  { status: 'loading' | 'error' | 'unavailable' } | { status: 'ready'; snapshot: BankRoeSnapshot };

export function BankRoeComparison() {
  const [state, setState] = useState<BankRoeState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadBankRoeSnapshot(signal).then(
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

  return (
    <Panel className="company-panel bank-roe-panel" aria-labelledby="bank-roe-heading">
      <div>
        <h2 id="bank-roe-heading">Comparação de ROE entre bancos</h2>
        <p>
          O ROE divide o lucro líquido atribuível à controladora pela média do seu patrimônio de
          abertura e fechamento na mesma DFP. O percentil indica a posição de cada banco, de 0 a
          100, pela média do ROE no período.
        </p>
      </div>
      {state.status === 'loading' && <p role="status">Carregando a comparação de ROE…</p>}
      {state.status === 'unavailable' && <p role="status">Comparação de ROE indisponível.</p>}
      {state.status === 'error' && (
        <>
          <p role="status">Falha ao carregar a comparação de ROE.</p>
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
      )}
      {state.status === 'ready' && <BankRoeResults snapshot={state.snapshot} />}
    </Panel>
  );
}
