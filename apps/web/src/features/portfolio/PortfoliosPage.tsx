import type { CompanyDirectorySnapshot } from '@moat/data-contracts';
import { useEffect, useState } from 'react';
import { loadCompanyDirectory } from '../../shared/data-client/companyDirectory';
import { ExportWorkbookButton } from '../../shared/export/ExportWorkbookButton';
import { Button, ButtonLink, Input, PageHeader, Panel, Select, Table } from '../../shared/ui';
import { compareNames, formatDate, normalizeSearch } from '../screener/presentation';
import {
  equalWeightUnits,
  portfolioTargetSize,
  totalWeightUnits,
  useSavedPortfolio,
  validatePortfolio,
  type PortfolioDraft,
} from './portfolio';
import { buildPortfolioReport } from './portfolioReport';
import './portfolio.css';

type DirectoryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; snapshot: CompanyDirectorySnapshot };

const weightFormat = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 4 });

function formatWeight(units: number) {
  return weightFormat.format(units / totalWeightUnits);
}

function PortfolioSelection({
  draft,
  onChange,
  target,
  state,
  retry,
}: {
  draft: PortfolioDraft;
  onChange: (draft: PortfolioDraft) => void;
  target: number | null;
  state: DirectoryState;
  retry: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState('');

  if (state.status === 'loading') return <p role="status">Carregando companhias…</p>;

  if (state.status === 'error') {
    return (
      <div className="portfolio-actions">
        <p role="status">Falha ao carregar o diretório da CVM.</p>
        <Button onClick={retry}>Recarregar diretório</Button>
      </div>
    );
  }

  const selected = new Set(draft.positions.map(({ name }) => name));
  const searchTerm = normalizeSearch(search);
  const options = state.snapshot.companies
    .filter((name) => !selected.has(name) && normalizeSearch(name).includes(searchTerm))
    .sort(compareNames);
  const selectedName = options.includes(selection) ? selection : '';

  function addCompany() {
    if (!selectedName || target === null || draft.positions.length >= target) return;
    onChange({
      ...draft,
      positions: [...draft.positions, { name: selectedName, weight: '' }],
    });
    setSelection('');
  }

  return (
    <>
      <div className="portfolio-add">
        <Input
          id="portfolio-search"
          label="Buscar companhia"
          placeholder="Buscar pelo nome"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setSelection('');
          }}
        />
        <Select
          id="portfolio-add-company"
          label="Companhia para adicionar"
          value={selectedName}
          disabled={options.length === 0}
          onChange={(event) => setSelection(event.currentTarget.value)}
        >
          <option value="">Selecione uma companhia</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Button
          onClick={addCompany}
          disabled={!selectedName || target === null || draft.positions.length >= target}
        >
          Adicionar companhia
        </Button>
      </div>
      {options.length === 0 && <p role="status">Nenhuma companhia disponível para essa busca.</p>}
      <p className="portfolio-source">
        <a href={state.snapshot.source.datasetUrl}>Cadastro de companhias abertas da CVM</a> ·
        data-base de <time dateTime={state.snapshot.asOf}>{formatDate(state.snapshot.asOf)}</time>
      </p>
    </>
  );
}

function PositionsTable({
  draft,
  onChange,
  weightUnits,
}: {
  draft: PortfolioDraft;
  onChange: (draft: PortfolioDraft) => void;
  weightUnits: number | null;
}) {
  return (
    <div className="portfolio-table" role="region" aria-label="Posições da carteira" tabIndex={0}>
      <Table aria-label="Composição e pesos">
        <thead>
          <tr>
            <th scope="col">Companhia</th>
            <th scope="col">Peso</th>
            <th scope="col">Posição</th>
          </tr>
        </thead>
        <tbody>
          {draft.positions.map((position, index) => (
            <tr key={position.name}>
              <th scope="row">{position.name}</th>
              <td>
                {draft.method === 'equal' ? (
                  formatWeight(equalWeightUnits(draft.positions.length, index))
                ) : (
                  <Input
                    className="portfolio-weight"
                    id={`portfolio-weight-${index}`}
                    label={`Peso de ${position.name} (%)`}
                    inputMode="decimal"
                    maxLength={10}
                    value={position.weight}
                    onChange={(event) => {
                      const weight = event.currentTarget.value;
                      onChange({
                        ...draft,
                        positions: draft.positions.map((row, at) =>
                          at === index ? { ...row, weight } : row,
                        ),
                      });
                    }}
                  />
                )}
              </td>
              <td>
                <Button
                  variant="quiet"
                  aria-label={`Remover ${position.name}`}
                  onClick={() =>
                    onChange({
                      ...draft,
                      positions: draft.positions.filter((row) => row.name !== position.name),
                    })
                  }
                >
                  Remover
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Peso total</th>
            <td colSpan={2}>{weightUnits === null ? 'Indisponível' : formatWeight(weightUnits)}</td>
          </tr>
        </tfoot>
      </Table>
    </div>
  );
}

const settingFields = [
  ['capital', 'Capital inicial (R$)'],
  ['contribution', 'Aporte mensal (R$)'],
  ['cost', 'Custo por operação (%)'],
  ['gainTax', 'Tributo sobre ganho ao final (%), hipótese'],
  ['maxWeight', 'Limite por companhia (%, opcional)'],
] as const;

export function PortfoliosPage() {
  const { draft, setDraft, save } = useSavedPortfolio();
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [status, setStatus] = useState('');
  const [directory, setDirectory] = useState<DirectoryState>({ status: 'loading' });
  const [directoryAttempt, setDirectoryAttempt] = useState(0);
  const { portfolio, errors, weightUnits } = validatePortfolio(draft);
  const target = portfolioTargetSize(draft);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadCompanyDirectory(signal).then(
      (snapshot) => {
        if (!signal.aborted) setDirectory({ status: 'ready', snapshot });
      },
      () => {
        if (!signal.aborted) setDirectory({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [directoryAttempt]);

  function changeDraft(next: PortfolioDraft) {
    setDraft(next);
    setStatus('');
  }

  function savePortfolio() {
    setAttemptedSave(true);
    if (portfolio === null) {
      setStatus('');
      return;
    }
    const saved = save();
    setStatus(
      saved ? 'Carteira salva neste navegador.' : 'O navegador não conseguiu salvar a carteira.',
    );
    if (saved) setAttemptedSave(false);
  }

  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Carteiras"
        description="Monte uma carteira de companhias e defina as condições para simular."
      />
      <Panel className="portfolio-panel" aria-labelledby="portfolio-builder">
        <h2 id="portfolio-builder">Composição da carteira</h2>
        <div className="portfolio-settings">
          <Select
            id="portfolio-target"
            label="Quantidade de companhias"
            value={draft.target}
            onChange={(event) =>
              changeDraft({
                ...draft,
                target: event.currentTarget.value as PortfolioDraft['target'],
              })
            }
          >
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="20">20</option>
            <option value="custom">Personalizada</option>
          </Select>
          {draft.target === 'custom' && (
            <Input
              id="portfolio-custom-target"
              label="Quantidade personalizada (1 a 50)"
              inputMode="numeric"
              maxLength={2}
              value={draft.customTarget}
              onChange={(event) =>
                changeDraft({ ...draft, customTarget: event.currentTarget.value })
              }
            />
          )}
          <Select
            id="portfolio-weights"
            label="Distribuição de pesos"
            value={draft.method}
            onChange={(event) =>
              changeDraft({
                ...draft,
                method: event.currentTarget.value as PortfolioDraft['method'],
              })
            }
          >
            <option value="equal">Iguais</option>
            <option value="custom">Personalizados</option>
          </Select>
        </div>
        <PortfolioSelection
          draft={draft}
          onChange={changeDraft}
          target={target}
          state={directory}
          retry={() => {
            setDirectory({ status: 'loading' });
            setDirectoryAttempt((current) => current + 1);
          }}
        />
        <p role="status">
          {target === null
            ? 'Informe uma quantidade de 1 a 50 para adicionar companhias.'
            : `${draft.positions.length} de ${target} companhias selecionadas.`}
          {target !== null && draft.positions.length > target && ' Remova as posições excedentes.'}
        </p>
        {draft.positions.length > 0 && (
          <PositionsTable draft={draft} onChange={changeDraft} weightUnits={weightUnits} />
        )}
        {draft.method === 'custom' && draft.positions.length > 0 && (
          <p role="status">
            {weightUnits === null
              ? 'Preencha todos os pesos com valores positivos, de até 100%.'
              : weightUnits === totalWeightUnits
                ? 'Os pesos somam 100%.'
                : `Os pesos precisam somar 100%. Total de ${formatWeight(weightUnits)}.`}
          </p>
        )}
        <p>Exposição por setor indisponível no diretório atual.</p>
      </Panel>
      <Panel className="portfolio-panel" aria-labelledby="portfolio-conditions">
        <h2 id="portfolio-conditions">Parâmetros da carteira</h2>
        <div className="portfolio-settings">
          {settingFields.map(([key, label]) => (
            <Input
              key={key}
              id={`portfolio-${key}`}
              label={label}
              inputMode="decimal"
              maxLength={24}
              value={draft[key]}
              onChange={(event) => changeDraft({ ...draft, [key]: event.currentTarget.value })}
            />
          ))}
          <Select
            id="portfolio-rebalance"
            label="Rebalanceamento"
            value={draft.rebalance}
            onChange={(event) =>
              changeDraft({
                ...draft,
                rebalance: event.currentTarget.value as PortfolioDraft['rebalance'],
              })
            }
          >
            <option value="hold">Sem rebalanceamento</option>
            <option value="monthly">Mensal</option>
          </Select>
        </div>
        <p>
          Use vírgula para decimais e deixe os valores sem separador de milhar. O custo por operação
          vale para a alocação inicial, compras com aportes e rebalanceamentos. O tributo é uma
          hipótese aplicada ao ganho ao fim da simulação.
        </p>
        {attemptedSave && errors.length > 0 && (
          <ul className="portfolio-errors" aria-label="Pendências da carteira" role="alert">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
        <div className="portfolio-actions">
          <Button variant="primary" onClick={savePortfolio}>
            Salvar carteira
          </Button>
          {portfolio && (
            <ExportWorkbookButton
              label="Exportar carteira em Excel"
              filename="moat-carteira.xlsx"
              build={() =>
                buildPortfolioReport(
                  portfolio,
                  draft,
                  directory.status === 'ready' ? directory.snapshot : null,
                )
              }
            />
          )}
          <ButtonLink to="/simulador">Abrir simulador</ButtonLink>
        </div>
        {status && <p role="status">{status}</p>}
      </Panel>
    </div>
  );
}
