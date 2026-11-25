import type { SectorComparisonSnapshot } from '@moat/data-contracts';
import { ExportWorkbookButton } from '../../shared/export/ExportWorkbookButton';
import { Button, Table } from '../../shared/ui';
import { formatPoints, formatRate } from './QualityHistory';
import { sideBySideRoeReport } from './sectorComparisonReport';
import {
  maximumSideBySideCompanies,
  minimumSectorPeers,
  type SideBySideRoe as Comparison,
} from './sectorComparisonRows';

export function SideBySideRoe({
  snapshot,
  comparison,
  onRemove,
  onClear,
}: {
  snapshot: SectorComparisonSnapshot;
  comparison: Comparison;
  onRemove: (name: string) => void;
  onClear: () => void;
}) {
  const { companies, years } = comparison;
  const ready = companies.length >= 2;

  return (
    <section className="side-by-side-roe" aria-labelledby="side-by-side-roe-heading">
      <div className="side-by-side-roe-heading">
        <h3 id="side-by-side-roe-heading">ROE lado a lado</h3>
        <Button variant="quiet" onClick={onClear}>
          Limpar seleção
        </Button>
      </div>
      <p role="status">
        {companies.length} de {maximumSideBySideCompanies} companhias selecionadas.
        {!ready && ' Selecione mais uma companhia para comparar os exercícios.'}
      </p>
      <ul className="side-by-side-roe-companies" aria-label="Companhias selecionadas para comparar">
        {companies.map(({ company }) => (
          <li key={company.name}>
            <Button
              variant="quiet"
              aria-label={`Remover ${company.name}`}
              onClick={() => onRemove(company.name)}
            >
              {company.name} <span aria-hidden="true">×</span>
            </Button>
          </li>
        ))}
      </ul>
      {ready && (
        <>
          <p>
            A variação compara dois exercícios consecutivos. A mediana inclui as companhias com ROE
            disponível no mesmo setor cadastral da CVM e exige ao menos {minimumSectorPeers}{' '}
            companhias no exercício.
          </p>
          <div
            className="company-table-scroll"
            role="region"
            aria-label="Histórico das companhias selecionadas"
            tabIndex={0}
          >
            <Table className="company-history-table" aria-label="ROE por exercício">
              <thead>
                <tr>
                  <th scope="col">Exercício</th>
                  {companies.map(({ company }) => (
                    <th scope="col" key={company.name}>
                      {company.name}
                      <small>{company.sector}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {years.map((year, index) => (
                  <tr key={year}>
                    <th scope="row">{year}</th>
                    {companies.map(({ company, observations }) => {
                      const point = observations[index];
                      return (
                        <td key={company.name}>
                          <strong>{formatRate(point?.observation?.roe ?? null)}</strong>
                          {index > 0 && (
                            <small>Variação {formatPoints(point?.deltaPp ?? null, true)}</small>
                          )}
                          {point && (
                            <small>
                              Mediana do setor {formatRate(point.sectorMedian)} ·{' '}
                              {point.sectorPeers}{' '}
                              {point.sectorPeers === 1 ? 'companhia' : 'companhias'}
                            </small>
                          )}
                          {point?.observation?.filing && (
                            <a
                              href={point.observation.filing.filingUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`DFP ${year} de ${company.name}`}
                            >
                              DFP
                            </a>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <th scope="row">Média do período</th>
                  {companies.map(({ company, mean, validYears }) => (
                    <td key={company.name}>
                      <strong>{formatRate(mean)}</strong>
                      <small>
                        {validYears} de {years.length} exercícios
                      </small>
                    </td>
                  ))}
                </tr>
              </tbody>
            </Table>
          </div>
          <div>
            <ExportWorkbookButton
              filename="moat-roe-lado-a-lado.xlsx"
              label="Exportar comparação em Excel"
              build={() => sideBySideRoeReport(snapshot, comparison)}
            />
          </div>
        </>
      )}
    </section>
  );
}
