import { Badge, PageHeader, Panel, Table } from '../../shared/ui';

export function MethodologyPage() {
  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Metodologia"
        description="Consulte o universo elegível, as métricas propostas e a referência de juros."
      />
      <div className="methodology-sections">
        <Panel className="methodology-panel" aria-labelledby="methodology-universe">
          <h2 id="methodology-universe">Universo de análise</h2>
          <p>
            O universo reúne companhias brasileiras que integram pelo menos um dos três índices.
            Cada companhia terá uma ficha e será representada pelo ticker de maior liquidez.
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
                <th scope="row">Spread de qualidade</th>
                <td>
                  ROIC ou ROE menos a taxa prefixada de aproximadamente 10 anos da janela histórica
                  correspondente.
                </td>
              </tr>
            </tbody>
          </Table>
          <p>
            A taxa pública serve como referência de custo de oportunidade. A taxa de desconto do
            valuation refletirá o risco dos fluxos avaliados.
          </p>
        </Panel>

        <Panel className="methodology-panel" aria-labelledby="methodology-sources">
          <h2 id="methodology-sources">Fontes previstas</h2>
          <p>
            Os demonstrativos virão da CVM. A composição dos índices da B3 e a curva prefixada de
            ANBIMA serão avaliadas quanto ao acesso, histórico e condições de uso. As cotações
            usarão o fechamento do último pregão disponível, com a data e o provedor identificados.
          </p>
        </Panel>
      </div>
    </div>
  );
}
