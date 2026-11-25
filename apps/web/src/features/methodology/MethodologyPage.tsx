import { Badge, ButtonLink, PageHeader, Panel, Table } from '../../shared/ui';

export function MethodologyPage() {
  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Metodologia"
        description="Consulte o universo elegível, os cálculos e a referência de juros."
      />
      <div className="methodology-sections">
        <Panel className="methodology-panel" aria-labelledby="methodology-cvm">
          <h2 id="methodology-cvm">Dados contábeis da CVM</h2>
          <p>
            A página Empresas reúne a seleção anual e consulta as demonstrações consolidadas da CVM.
            Os detalhes de cada exercício mostram as contas do cálculo e o formulário de origem
            quando disponíveis. As lacunas informam o motivo.
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
                <th scope="row">ROE de bancos e seguradoras</th>
                <td>
                  Lucro líquido atribuível à controladora dividido pelo patrimônio líquido médio da
                  controladora.
                </td>
              </tr>
              <tr>
                <th scope="row">ROIC estimado</th>
                <td>
                  Para as demais companhias, EBIT conciliado após a alíquota padronizada de 34%,
                  dividido pelo capital investido médio.
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
            Em Empresas, <strong>Comparar histórico</strong> reúne duas companhias com o mesmo
            indicador.
          </p>
        </Panel>

        <Panel className="methodology-panel" aria-labelledby="methodology-sources">
          <h2 id="methodology-sources">Fontes e disponibilidade</h2>
          <p>
            Os demonstrativos vêm dos dados abertos da CVM. O Banco Central publica o CDI anualizado
            na série SGS 4389. As cotações previstas usarão o fechamento do último pregão disponível
            e informarão a data e o provedor.
          </p>
        </Panel>
        <Panel className="methodology-panel" aria-labelledby="methodology-backtest">
          <h2 id="methodology-backtest">Retrospectiva mensal</h2>
          <p>
            O simulador aplica a composição escolhida hoje a séries mensais de retorno total em
            reais. As posições precisam ter observações no mesmo pregão de cada mês da janela.
            Aportes entram ao fim do mês. Custos entram nas métricas de retorno e risco, e o tributo
            informado é aplicado ao ganho positivo no fim da simulação.
          </p>
          <ButtonLink to="/simulador" className="methodology-link">
            Abrir simulador
          </ButtonLink>
        </Panel>
      </div>
    </div>
  );
}
