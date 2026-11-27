import type { SectorLeverageSnapshot, SectorReinvestmentSnapshot } from '@moat/data-contracts';
import { useEffect, useState } from 'react';
import { ipcaRateUrl } from '../../shared/data-client/inflationRate';
import { loadSectorComparison } from '../../shared/data-client/sectorComparison';
import { loadSectorLeverage } from '../../shared/data-client/sectorLeverage';
import { loadSectorReinvestment } from '../../shared/data-client/sectorReinvestment';
import { loadSectorRoicComparison } from '../../shared/data-client/sectorRoicComparison';
import { useInflationRate } from '../../shared/data-client/useInflationRate';
import type { RiskFreeRateState } from '../../shared/data-client/useRiskFreeRate';
import { Button, Input, Panel, Select, Table } from '../../shared/ui';
import { RiskFreeRatePanel } from '../../shared/ui/RiskFreeRatePanel';
import {
  annualComparisonContext,
  combineSnapshots,
  type Company,
  type ComparisonData,
} from '../company/companyQualityData';
import { formatCurrency, formatDate } from '../company/financialPresentation';
import { normalizeSearch } from '../screener/presentation';
import {
  buildAutomaticDcfBase,
  evaluateAutomaticValuation,
  type AutomaticValuationBase,
} from './automaticValuation';

const month = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const percent = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface ValuationData {
  comparison: ComparisonData;
  leverage: SectorLeverageSnapshot | null;
  reinvestment: SectorReinvestmentSnapshot | null;
}

function useValuationData() {
  const [data, setData] = useState<ValuationData | null | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      try {
        const [roe, roic, leverage, reinvestment] = await Promise.all([
          loadSectorComparison(signal),
          loadSectorRoicComparison(signal),
          loadSectorLeverage(signal).catch(() => null),
          loadSectorReinvestment(signal).catch(() => null),
        ]);
        if (!signal.aborted)
          setData({ comparison: combineSnapshots(roe, roic), leverage, reinvestment });
      } catch {
        if (!signal.aborted) setData(null);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  return data;
}

function buildBase(company: Company, year: number, data: ValuationData) {
  if (company.metric === 'ROIC') {
    return buildAutomaticDcfBase(
      company,
      year,
      data.comparison.roic,
      data.leverage,
      data.reinvestment,
    );
  }

  const distributions = company.dividends;
  const filing = company.observations.find((observation) => observation.year === year)?.filing;
  if (distributions?.paidBrl == null || distributions.year !== year || !filing) {
    return {
      status: 'unavailable',
      reason: distributions?.reason ?? 'Dividendos e JCP pagos indisponíveis na DFP do exercício.',
    } as const;
  }
  return {
    status: 'ready',
    base: {
      model: 'ddm',
      dividendsJcpBrl: distributions.paidBrl,
      referenceDate: filing.referenceDate,
      filingUrl: filing.filingUrl,
    },
  } as const;
}

function Measures({ values }: { values: [label: string, value: number | null][] }) {
  return (
    <dl className="valuation-measures">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value === null ? 'Indisponível' : formatCurrency(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

type ValuationResult = Extract<ReturnType<typeof evaluateAutomaticValuation>, { status: 'ready' }>;

function AutomaticResults({
  base,
  result,
}: {
  base: AutomaticValuationBase;
  result: ValuationResult;
}) {
  const isDcf = base.model === 'dcf';
  const baseLabel = isDcf ? 'Fluxo de caixa livre da firma' : 'Dividendos e JCP pagos';
  const values: [string, number | null][] = [
    ['Valor estimado do patrimônio', result.equityValue],
    ['Valor presente dos dez anos', result.presentYears],
    ['Valor presente da perpetuidade', result.presentTerminal],
    [baseLabel + ' na DFP', result.baseFlow],
  ];
  if (isDcf) {
    values.push(
      ['Valor estimado da firma', result.enterpriseValue],
      ['Dívida líquida na DFP', base.netDebtBrl],
    );
  }

  return (
    <>
      <Measures values={values} />
      {result.terminalReason && <p role="status">{result.terminalReason}</p>}
      {isDcf && base.depreciationExcludesSeparateRightOfUse && (
        <p>A D&A do fluxo exclui a parcela de direito de uso apresentada em separado na DFC.</p>
      )}
      {isDcf && base.netDebtBrl === null && (
        <p role="status">Dívida líquida indisponível para estimar o patrimônio.</p>
      )}
      <p>
        <a href={base.filingUrl} target="_blank" rel="noreferrer">
          DFP na CVM
        </a>
        {' · '}
        <time dateTime={base.referenceDate}>{formatDate(base.referenceDate)}</time>
      </p>
      <details className="valuation-details">
        <summary>Ver projeções anuais</summary>
        <div className="valuation-inputs">
          {isDcf && (
            <Measures
              values={[
                ['NOPAT', base.nopatBrl],
                ['Depreciação e amortização', base.depreciationBrl],
                ['CAPEX de imobilizado e intangível', base.capexBrl],
                ['Variação do capital de giro', base.workingCapitalChangeBrl],
              ]}
            />
          )}
          <div
            className="valuation-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Projeções anuais"
          >
            <Table aria-label="Fluxos da projeção automática">
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col">{baseLabel}</th>
                  <th scope="col">Valor presente</th>
                </tr>
              </thead>
              <tbody>
                {result.years.map(({ year, flow, presentValue }) => (
                  <tr key={year}>
                    <th scope="row">{year}</th>
                    <td>{formatCurrency(flow)}</td>
                    <td>{formatCurrency(presentValue)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      </details>
    </>
  );
}

export function AutomaticValuation({
  cdi,
  reloadCdi,
}: {
  cdi: RiskFreeRateState;
  reloadCdi: () => void;
}) {
  const { state: ipca, reload: reloadIpca } = useInflationRate();
  const data = useValuationData();
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const search = normalizeSearch(query);
  const matches = data?.comparison.companies.filter((company) =>
    normalizeSearch(company.name).includes(search),
  );
  const company = matches?.find((entry) => entry.name === name);
  const year = data?.comparison.roic.years.at(-1);
  const source = company && year && data ? buildBase(company, year, data) : null;
  const context = company && year ? annualComparisonContext(company, year) : null;
  const result =
    source?.status === 'ready' && ipca.status === 'ready' && cdi.status === 'ready' && !context
      ? evaluateAutomaticValuation(source.base, ipca.rate.value, cdi.rate.value)
      : null;

  return (
    <>
      <div className="valuation-premises-grid valuation-rates">
        <Panel className="valuation-panel" aria-labelledby="valuation-ipca">
          <div>
            <h2 id="valuation-ipca">IPCA de 12 meses</h2>
            <p>Correção anual dos fluxos projetados.</p>
          </div>
          {ipca.status === 'ready' ? (
            <p>
              <strong>{percent.format(ipca.rate.value)} a.a.</strong>
              {' · '}
              <time dateTime={ipca.rate.provenance.referenceDate.slice(0, 7)}>
                {month.format(new Date(ipca.rate.provenance.referenceDate))}
              </time>
            </p>
          ) : ipca.status === 'loading' ? (
            <p role="status">Consultando o IPCA no Banco Central…</p>
          ) : (
            <div className="valuation-actions">
              <p role="status">IPCA indisponível no Banco Central.</p>
              <Button onClick={reloadIpca}>Atualizar IPCA</Button>
            </div>
          )}
          <p>
            <a href={ipcaRateUrl} target="_blank" rel="noreferrer">
              Banco Central do Brasil · SGS 13522
            </a>
          </p>
        </Panel>
        <RiskFreeRatePanel state={cdi} reload={reloadCdi} />
      </div>
      <Panel className="valuation-panel" aria-labelledby="valuation-automatic">
        <h2 id="valuation-automatic">Valuation automático</h2>
        <p>
          Estimativa simplificada com dez anos de projeção. O IPCA corrige os fluxos e a
          perpetuidade, e o CDI anualizado desconta os valores sem prêmio de risco.
        </p>
        {data === undefined && <p role="status">Carregando as companhias e os balanços da CVM…</p>}
        {data === null && <p role="status">Comparativos anuais da CVM indisponíveis.</p>}
        {matches && (
          <div className="valuation-premises-grid">
            <Input
              id="valuation-search"
              label="Buscar companhia"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setName('');
              }}
            />
            <Select
              id="valuation-automatic-company"
              label="Companhia"
              value={name}
              disabled={matches.length === 0}
              onChange={(event) => setName(event.currentTarget.value)}
            >
              <option value="">
                {matches.length === 0 ? 'Nenhuma companhia encontrada' : 'Selecione uma companhia'}
              </option>
              {matches.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {company && (
          <h3>
            {company.name} · {company.metric === 'ROIC' ? 'DCF' : 'DDM'}
          </h3>
        )}
        {context ? (
          <p role="status">
            Estimativa indisponível para o perímetro atual da companhia. {context.note}{' '}
            <a href={context.sourceUrl} target="_blank" rel="noreferrer">
              Documento da CVM
            </a>
          </p>
        ) : (
          <>
            {source?.status === 'unavailable' && <p role="status">{source.reason}</p>}
            {source?.status === 'ready' && !result && (
              <p role="status">O cálculo aguarda o IPCA e o CDI do Banco Central.</p>
            )}
            {result?.status === 'unavailable' && <p role="status">{result.reason}</p>}
            {source?.status === 'ready' && result?.status === 'ready' && (
              <AutomaticResults base={source.base} result={result} />
            )}
          </>
        )}
      </Panel>
    </>
  );
}
