import type { CvmSnapshot } from '@moat/data-contracts';
import { useState } from 'react';
import { cvmSnapshotUrl } from '../../shared/data-client/cvmSnapshot';
import { Badge, ButtonLink, Icon, Panel, Select } from '../../shared/ui';
import { AccountHistory } from './AccountHistory';
import { CompanyIdentity } from './CompanyIdentity';
import { categories, formatDate, formatInstant } from './financialPresentation';
import { ObservationDetails } from './ObservationDetails';

export function CompanySample({ snapshot }: { snapshot: CvmSnapshot }) {
  const { companies, manifest, issues } = snapshot;
  const [selectedId, setSelectedId] = useState<string>();
  const company = companies.find(({ companyId }) => companyId === selectedId) ?? companies[0];

  if (!company) return null;

  const observations = [...company.observations].sort((a, b) => b.fiscalYear - a.fiscalYear);
  const companyIssues = issues.filter(({ companyId }) => companyId === company.companyId);
  const { source } = manifest;

  return (
    <>
      <Panel className="company-panel" aria-labelledby="company-sample">
        <div className="company-panel-head">
          <div>
            <h2 id="company-sample">Amostra da CVM</h2>
            <p>
              Demonstrações Financeiras Padronizadas (DFP) de companhias selecionadas para validar o
              mapeamento contábil. A composição do universo da B3 aguarda uma fonte autorizada.
            </p>
          </div>
          <Badge>{manifest.coverage.includedCompanies} companhias</Badge>
        </div>
        <Select
          id="company-select"
          label="Companhia"
          value={company.companyId}
          onChange={(event) => setSelectedId(event.currentTarget.value)}
        >
          {companies.map((option) => (
            <option key={option.companyId} value={option.companyId}>
              {option.name} · {categories[option.category]}
            </option>
          ))}
        </Select>
        <dl className="company-metadata">
          <div>
            <dt>Código CVM</dt>
            <dd>{company.cvmCode}</dd>
          </div>
          <div>
            <dt>Categoria</dt>
            <dd>{categories[company.category]}</dd>
          </div>
          <div>
            <dt>Data-base do lote</dt>
            <dd>
              <time dateTime={manifest.asOf}>{formatDate(manifest.asOf)}</time>
            </dd>
          </div>
          <div>
            <dt>Lote gerado em</dt>
            <dd>
              <time dateTime={manifest.generatedAt}>{formatInstant(manifest.generatedAt)}</time>
            </dd>
          </div>
        </dl>
        <CompanyIdentity companyId={company.companyId} />
      </Panel>

      {companyIssues.length > 0 && (
        <Panel className="company-panel" aria-labelledby="company-issues">
          <h2 id="company-issues">Lacunas da companhia</h2>
          <ul className="company-issues">
            {companyIssues.map(({ fiscalYear, message }, index) => (
              <li key={`${fiscalYear}-${index}`}>
                <strong>{fiscalYear}</strong> · {message}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {observations.length > 0 ? (
        <>
          <AccountHistory observations={observations} />
          <ObservationDetails key={company.companyId} observations={observations} />
        </>
      ) : (
        <Panel className="company-panel">
          <p>Os exercícios desta companhia estão indisponíveis.</p>
        </Panel>
      )}

      <Panel className="company-panel" aria-labelledby="company-sources">
        <div>
          <h2 id="company-sources">Fonte e licença</h2>
          <p>
            Dados das DFP da {source.name}. A amostra processada pelo Moat Analytics está disponível
            sob a licença {source.license}.
          </p>
        </div>
        <p className="company-source-links">
          <a href={source.datasetUrl} target="_blank" rel="noreferrer">
            Catálogo da CVM <Icon name="arrow-up-right" size={14} />
          </a>
          <a href={source.licenseUrl} target="_blank" rel="noreferrer">
            {source.license} <Icon name="arrow-up-right" size={14} />
          </a>
          <a href={cvmSnapshotUrl} download="cvm-sample.json">
            Baixar amostra em JSON
          </a>
        </p>
        <ButtonLink to="/metodologia" className="methodology-link" variant="quiet">
          Ler metodologia
        </ButtonLink>
      </Panel>
    </>
  );
}
