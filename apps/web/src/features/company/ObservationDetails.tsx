import { Badge, Icon, Panel } from '../../shared/ui';
import {
  checkLabels,
  formatCurrency,
  formatDate,
  formatInstant,
  type CvmObservation,
} from './financialPresentation';

const qualityLabels = {
  validated: 'Validada',
  estimated: 'Estimada',
  unavailable: 'Indisponível',
} satisfies Record<CvmObservation['provenance']['qualityStatus'], string>;

function observationLabel(observation: CvmObservation) {
  if (observation.reconciliations.some(({ status }) => status === 'failed')) {
    return 'Divergência';
  }
  if (
    observation.reconciliations.length === 0 ||
    observation.reconciliations.some(({ status }) => status === 'unavailable')
  ) {
    return 'Conciliação parcial';
  }
  return 'Conciliado';
}

function FilingDetails({ observation }: { observation: CvmObservation }) {
  const { provenance } = observation;

  return (
    <div className="company-filing">
      <dl className="company-metadata">
        <div>
          <dt>Período</dt>
          <dd>
            {formatDate(observation.periodStart)} a {formatDate(observation.referenceDate)}
          </dd>
        </div>
        <div>
          <dt>Versão do envio</dt>
          <dd>{observation.filingVersion}</dd>
        </div>
        <div>
          <dt>Recebimento na CVM</dt>
          <dd>
            <time dateTime={observation.receiptDate}>{formatDate(observation.receiptDate)}</time>
          </dd>
        </div>
        <div>
          <dt>Publicação na fonte</dt>
          <dd>
            {provenance.publishedAt ? (
              <time dateTime={provenance.publishedAt}>{formatInstant(provenance.publishedAt)}</time>
            ) : (
              'Indisponível'
            )}
          </dd>
        </div>
        <div>
          <dt>Coleta</dt>
          <dd>
            <time dateTime={provenance.retrievedAt}>{formatInstant(provenance.retrievedAt)}</time>
          </dd>
        </div>
        <div>
          <dt>Metodologia</dt>
          <dd>{provenance.methodologyVersion}</dd>
        </div>
        <div>
          <dt>Fonte</dt>
          <dd>{provenance.source}</dd>
        </div>
        <div>
          <dt>Qualidade dos dados</dt>
          <dd>{qualityLabels[provenance.qualityStatus]}</dd>
        </div>
      </dl>
      <p className="company-source-links">
        <a href={observation.documentUrl} target="_blank" rel="noreferrer">
          Envio na CVM <Icon name="arrow-up-right" size={14} />
        </a>
        <a href={observation.archiveUrl} target="_blank" rel="noreferrer">
          ZIP original <Icon name="arrow-up-right" size={14} />
        </a>
      </p>
      <p className="company-filing-hash">
        SHA-256 do ZIP <code>{observation.archiveSha256}</code>
      </p>
    </div>
  );
}

export function ObservationDetails({ observations }: { observations: CvmObservation[] }) {
  return (
    <Panel className="company-panel" aria-labelledby="company-reconciliation">
      <div>
        <h2 id="company-reconciliation">Conciliação e proveniência</h2>
        <p>
          Abra um exercício para ver as verificações, as datas e os arquivos da CVM. Horários de
          Brasília.
        </p>
      </div>

      <div className="company-observations">
        {observations.map((observation) => (
          <details className="company-observation" key={observation.referenceDate}>
            <summary>
              <span>{observation.fiscalYear}</span>
              <Badge>{observationLabel(observation)}</Badge>
              <Icon className="company-observation-icon" name="chevron-down" size={18} />
            </summary>
            <div className="company-observation-body">
              {observation.reconciliations.length === 0 ? (
                <p>As verificações contábeis deste exercício estão indisponíveis.</p>
              ) : (
                <ul className="company-checks" aria-label="Verificações contábeis">
                  {observation.reconciliations.map((check) => (
                    <li key={check.key}>
                      <span>{check.label}</span>
                      <span className="company-check-result">
                        {check.differenceBrl !== null && (
                          <small>Diferença de {formatCurrency(check.differenceBrl)}</small>
                        )}
                        <Badge>{checkLabels[check.status]}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <FilingDetails observation={observation} />
            </div>
          </details>
        ))}
      </div>
    </Panel>
  );
}
