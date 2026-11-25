import type { RiskFreeRate, SectorRoicSnapshot } from '@moat/data-contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { spreadToRiskFreeRate } from '../../shared/analytics/riskFreeRate';
import { cdiRateUrl } from '../../shared/data-client/riskFreeRate';
import {
  loadSectorRoicComparison,
  sectorRoicComparisonUrl,
} from '../../shared/data-client/sectorRoicComparison';
import { Button, EmptyState, Input, Panel, Select, Table } from '../../shared/ui';
import { ScreenerExport } from '../screener/ScreenerExport';
import { compareNames, formatCompanyCount, normalizeSearch } from '../screener/presentation';
import { formatPoints, formatRate } from './QualityHistory';
import { formatCurrency, formatDate, formatInstant } from './financialPresentation';
import {
  buildSectorRoicRows,
  minimumSectorPeers,
  type SectorRoicRow,
} from './sectorComparisonRows';
import { sectorRoicReport } from './sectorRoicReport';
import './sector-comparison.css';

const percentileFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const auditId = 'sector-roic-audit';

function RoicAudit({ row, year }: { row: SectorRoicRow; year: number }) {
  const focus = useRef<HTMLElement>(null);
  const { company, current } = row;
  const { filing, inputs } = current ?? {};
  useEffect(() => {
    focus.current?.focus();
  }, [company.name]);

  return (
    <section
      className="sector-comparison-audit"
      id={auditId}
      ref={focus}
      tabIndex={-1}
      aria-labelledby="sector-roic-company"
    >
      <h3 id="sector-roic-company">
        {company.name} · {year}
      </h3>
      {current?.reason && <p>{current.reason}</p>}
      {filing && (
        <p className="company-source-links">
          <a href={filing.filingUrl} target="_blank" rel="noreferrer">
            {inputs ? 'DFP consolidada na CVM' : 'Formulário DFP na CVM'}
          </a>
          <span>
            Data-base em{' '}
            <time dateTime={filing.referenceDate}>{formatDate(filing.referenceDate)}</time> ·
            recebida em <time dateTime={filing.receivedAt}>{formatDate(filing.receivedAt)}</time> ·
            versão {filing.version}
          </span>
          {filing.supportingDocumentUrl && (
            <a href={filing.supportingDocumentUrl} target="_blank" rel="noreferrer">
              Demonstrações de apoio
            </a>
          )}
        </p>
      )}
      {inputs && (
        <>
          <dl className="company-metadata">
            <div>
              <dt>EBIT conciliado</dt>
              <dd>{formatCurrency(inputs.ebitBrl)}</dd>
            </div>
            <div>
              <dt>NOPAT estimado</dt>
              <dd>{formatCurrency(inputs.nopatBrl)}</dd>
            </div>
            <div>
              <dt>Capital investido na abertura</dt>
              <dd>{formatCurrency(inputs.openingCapitalBrl)}</dd>
            </div>
            <div>
              <dt>Capital investido no fechamento</dt>
              <dd>{formatCurrency(inputs.closingCapitalBrl)}</dd>
            </div>
          </dl>
          <div
            className="company-table-scroll"
            role="region"
            tabIndex={0}
            aria-label="Contas da DFP no ROIC"
          >
            <Table
              className="company-history-table sector-comparison-table"
              aria-label="Contas do ROIC estimado"
            >
              <thead>
                <tr>
                  <th scope="col">Conta</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Data-base</th>
                  <th scope="col">Valor em reais</th>
                </tr>
              </thead>
              <tbody>
                {inputs.accounts.map(
                  ({ key, statement, code, label, referenceDate, amountBrl }) => (
                    <tr key={`${key}/${referenceDate}`}>
                      <th scope="row">
                        {statement} {code}
                      </th>
                      <td>{label}</td>
                      <td>
                        <time dateTime={referenceDate}>{formatDate(referenceDate)}</time>
                      </td>
                      <td>{formatCurrency(amountBrl)}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}

function RoicResults({
  snapshot,
  riskFreeRate,
}: {
  snapshot: SectorRoicSnapshot;
  riskFreeRate: RiskFreeRate | null;
}) {
  const { manifest } = snapshot;
  const latestYear = manifest.years.at(-1) ?? 0;
  const [year, setYear] = useState(latestYear);
  const [sector, setSector] = useState('');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState('');
  const rows = useMemo(() => buildSectorRoicRows(snapshot, year), [snapshot, year]);
  const sectors = Array.from(new Set(rows.map(({ company }) => company.sector))).sort(compareNames);
  const searchKey = normalizeSearch(search);
  const matches = rows.filter(
    ({ company }) =>
      (!sector || company.sector === sector) && normalizeSearch(company.name).includes(searchKey),
  );
  const auditRow = matches.find(({ company }) => company.name === selection);
  const coverage = rows.filter(({ current }) => current !== null && current.roic !== null).length;
  const showCdi = year === latestYear;

  return (
    <>
      <p>
        {formatCompanyCount(coverage, rows.length)} com ROIC em {year}. A média exige cinco
        exercícios completos ({manifest.years[0]}–{latestYear}). O percentil exige ao menos{' '}
        {minimumSectorPeers} companhias com série completa no mesmo setor declarado à CVM.
      </p>
      {showCdi && (
        <p>
          A diferença compara o ROIC de {year} ao CDI anualizado do{' '}
          <a href={cdiRateUrl} target="_blank" rel="noreferrer">
            Banco Central (SGS 4389)
          </a>
          {riskFreeRate ? (
            <>
              {' · '}
              {formatRate(riskFreeRate.value)} a.a. em{' '}
              <time dateTime={riskFreeRate.provenance.referenceDate}>
                {formatDate(riskFreeRate.provenance.referenceDate)}
              </time>
              .
            </>
          ) : (
            ' · taxa indisponível.'
          )}
        </p>
      )}
      <div className="sector-comparison-filters">
        <Input
          id="sector-roic-search"
          label="Buscar companhia no ROIC"
          placeholder="Buscar pelo nome"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setSelection('');
          }}
        />
        <Select
          id="sector-roic-sector"
          label="Setor do ROIC"
          value={sector}
          onChange={(event) => {
            setSector(event.currentTarget.value);
            setSelection('');
          }}
        >
          <option value="">Todos os setores</option>
          {sectors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select
          id="sector-roic-year"
          label="Exercício do ROIC"
          value={year}
          onChange={(event) => setYear(Number(event.currentTarget.value))}
        >
          {[...manifest.years].reverse().map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>
        <ScreenerExport
          filename="moat-roic-setorial.xlsx"
          filteredCount={matches.length}
          build={(scope) =>
            sectorRoicReport(snapshot, scope === 'filtered' ? matches : rows, year, riskFreeRate, {
              scope,
              search,
              sector,
            })
          }
        />
      </div>
      {matches.length > 0 ? (
        <div
          className="company-table-scroll"
          role="region"
          aria-label="Resultados do ROIC setorial"
          tabIndex={0}
        >
          <Table
            className="sector-comparison-table company-history-table"
            aria-label="ROIC estimado por setor"
          >
            <thead>
              <tr>
                <th scope="col">Companhia</th>
                <th scope="col">ROIC estimado de {year}</th>
                {showCdi && <th scope="col">Diferença para o CDI atual</th>}
                <th scope="col">Média de ROIC</th>
                <th scope="col">Percentil no setor</th>
                <th scope="col">Contas</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(({ company, current, mean, validYears, percentile, peers }) => {
                const expanded = company.name === selection;
                return (
                  <tr key={company.name}>
                    <th scope="row">
                      {company.name}
                      <small>{company.sector}</small>
                    </th>
                    <td>{formatRate(current?.roic ?? null)}</td>
                    {showCdi && (
                      <td>
                        {formatPoints(
                          spreadToRiskFreeRate(current?.roic ?? null, riskFreeRate),
                          true,
                        )}
                      </td>
                    )}
                    <td>
                      {formatRate(mean)}
                      <small>
                        {validYears} de {manifest.years.length} exercícios
                      </small>
                    </td>
                    <td>
                      {percentile === null ? 'Indisponível' : percentileFormat.format(percentile)}
                      <small>{peers} no setor com cinco exercícios</small>
                    </td>
                    <td>
                      <Button
                        variant="quiet"
                        aria-label={`Conferir contas de ${company.name}`}
                        aria-expanded={expanded}
                        aria-controls={expanded ? auditId : undefined}
                        onClick={() => setSelection(expanded ? '' : company.name)}
                      >
                        {expanded ? 'Ocultar' : 'Conferir'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon="search"
          title="Nenhuma companhia encontrada"
          description="Ajuste a busca ou o setor."
        />
      )}
      {auditRow && <RoicAudit row={auditRow} year={year} />}
      <p>
        Seleção de <time dateTime={manifest.asOf}>{formatDate(manifest.asOf)}</time> · lote gerado
        em <time dateTime={manifest.generatedAt}>{formatInstant(manifest.generatedAt)}</time>.
      </p>
      <p className="company-source-links">
        <a href={manifest.source.datasetUrl} target="_blank" rel="noreferrer">
          Catálogo de DFP da CVM
        </a>
        <a href={manifest.sectorSource.datasetUrl} target="_blank" rel="noreferrer">
          Catálogo de FCA da CVM
        </a>
        <a href={manifest.source.licenseUrl} target="_blank" rel="noreferrer">
          {manifest.source.license}
        </a>
        <a href={sectorRoicComparisonUrl} download="cvm-sector-roic.json">
          Baixar ROIC setorial em JSON
        </a>
      </p>
    </>
  );
}

type LoadState =
  { status: 'loading' | 'error' } | { status: 'ready'; snapshot: SectorRoicSnapshot };

export function SectorRoicComparisons({ riskFreeRate }: { riskFreeRate: RiskFreeRate | null }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadSectorRoicComparison(signal).then(
      (snapshot) => {
        if (!signal.aborted) setState({ status: 'ready', snapshot });
      },
      () => {
        if (!signal.aborted) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  return (
    <Panel className="company-panel sector-comparison-panel" aria-labelledby="sector-roic-heading">
      <h2 id="sector-roic-heading">Comparativo de ROIC estimado</h2>
      <p>
        Siderurgia, metalurgia e extração mineral. O ROIC divide o NOPAT estimado com alíquota
        padronizada de 34% pelo capital investido médio. O saldo soma patrimônio consolidado,
        financiamentos, arrendamentos e outros passivos financeiros revisados. Caixa e equivalentes
        são deduzidos.
      </p>
      {state.status === 'loading' && <p role="status">Carregando o comparativo de ROIC…</p>}
      {state.status === 'error' && (
        <EmptyState
          icon="company"
          title="ROIC setorial indisponível"
          description="Houve um problema ao carregar ou validar o lote de ROIC."
        >
          <Button
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt(attempt + 1);
            }}
          >
            Recarregar ROIC setorial
          </Button>
        </EmptyState>
      )}
      {state.status === 'ready' && (
        <RoicResults snapshot={state.snapshot} riskFreeRate={riskFreeRate} />
      )}
    </Panel>
  );
}
