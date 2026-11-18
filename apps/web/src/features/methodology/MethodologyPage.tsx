import { Badge, ButtonLink, PageHeader, Panel, Table } from '../../shared/ui';

export function MethodologyPage() {
  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Metodologia"
        description="Consulte o universo elegível, as métricas propostas e a referência de juros."
      />
      <div className="methodology-sections">
        <Panel className="methodology-panel" aria-labelledby="methodology-cvm">
          <h2 id="methodology-cvm">Amostra contábil da CVM</h2>
          <p>
            A amostra usa Demonstrações Financeiras Padronizadas consolidadas de uma indústria, um
            varejista e um banco. Cada exercício informa a versão do envio, a origem e as
            verificações contábeis. Os valores são apresentados em reais e as lacunas ficam
            sinalizadas como indisponíveis.
          </p>
          <ButtonLink to="/empresas" className="methodology-link">
            Consultar contas da CVM
          </ButtonLink>
        </Panel>
        <Panel className="methodology-panel" aria-labelledby="methodology-universe">
          <h2 id="methodology-universe">Universo de análise</h2>
          <p>
            O recorte anual reúne companhias brasileiras presentes em pelo menos um dos três índices
            na data-base. O diretório público usa os nomes do cadastro da CVM. A consulta local
            mantém as classes e afiliações, e a escolha do ticker representativo depende de volume.
          </p>
          <ul className="methodology-indexes" aria-label="Índices elegíveis" role="list">
            <li>
              <Badge>IBOV</Badge> Ibovespa
            </li>
            <li>
              <Badge>SMLL</Badge> Índice Small Cap
            </li>
            <li>
              <Badge>IDIV</Badge> Índice Dividendos
            </li>
          </ul>
        </Panel>

        <Panel className="methodology-panel" aria-labelledby="methodology-returns">
          <h2 id="methodology-returns">Rentabilidade e preço</h2>
          <Table aria-labelledby="methodology-returns">
            <thead>
              <tr>
                <th scope="col">Métrica</th>
                <th scope="col">Base de cálculo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">ROIC</th>
                <td>Lucro operacional após impostos dividido pelo capital investido médio.</td>
              </tr>
              <tr>
                <th scope="row">ROE de bancos</th>
                <td>
                  Lucro líquido atribuível aos acionistas dividido pelo patrimônio líquido médio
                  correspondente.
                </td>
              </tr>
              <tr>
                <th scope="row">Diferença para o CDI atual</th>
                <td>
                  ROIC ou ROE do último exercício menos o CDI anualizado mais recente, em pontos
                  percentuais.
                </td>
              </tr>
            </tbody>
          </Table>
          <p>
            O CDI atual é a taxa livre de risco provisória. A página Empresas informa o exercício
            contábil e a data da taxa. O ranking composto requer uma série histórica alinhada aos
            exercícios.
          </p>
          <p>
            A comparação bancária calcula a média de ROE de 2021 a 2025. O percentil descreve a
            posição dessa média no grupo de cinco bancos e usa a posição média em caso de empate.
          </p>
        </Panel>

        <Panel className="methodology-panel" aria-labelledby="methodology-sources">
          <h2 id="methodology-sources">Fontes e disponibilidade</h2>
          <p>
            Os demonstrativos da amostra vêm dos dados abertos da CVM. O Banco Central publica o CDI
            anualizado na série SGS 4389. As cotações previstas usarão o fechamento do último pregão
            disponível e informarão a data e o provedor.
          </p>
        </Panel>
      </div>
    </div>
  );
}
