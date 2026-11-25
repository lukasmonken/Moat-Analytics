# Fontes de dados

## Amostra do M1

A página Empresas lê um snapshot das [Demonstrações Financeiras Padronizadas da CVM](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp). A amostra reúne WEG, Lojas Renner e Itaú Unibanco para verificar o mapeamento contábil em indústria, varejo e banco. Usa os formulários consolidados anuais do período de 2021 a 2025. Cada exercício informa versão, data de referência, data de recebimento, data da coleta, documento CVM e hash do ZIP de origem.

O [snapshot em JSON](../data/public/cvm-sample.json) deriva do catálogo da CVM e está disponível sob a [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). O site também oferece download do arquivo completo. Os originais e as etapas internas do pipeline ficam fora dos assets do site.

Os endereços de cada envio vêm do próprio arquivo DFP. A disponibilidade desses links individuais depende do sistema da CVM. O ZIP anual permanece como fonte direta para conferir os CSVs. [Consulta oficial de documentos](https://www.rad.cvm.gov.br/ENETWEB/frmConsultaExternaCVM.aspx)

O [lote de qualidade](../data/public/cvm-quality.json) usa as mesmas DFP consolidadas e seus saldos comparativos. As contas em BRL, a proveniência e os indicadores derivados são disponibilizados sob ODbL 1.0.

O [lote de comparação bancária](../data/public/cvm-bank-roe.json) usa DFP consolidadas da CVM de cinco bancos, com 25 observações de ROE de 2021 a 2025. A fonte, a versão de cada formulário e as contas usadas acompanham o indicador. O lote está disponível sob ODbL 1.0.

Os comparativos setoriais cruzam as 144 companhias da seleção de 18/11/2026 com o setor declarado no FCA de 2026 e os exercícios consolidados de 2021 a 2025. O arquivo registra a coleta, o hash dos ZIPs, a versão e o recebimento dos formulários. Os nomes, setores e indicadores derivados da CVM são distribuídos sob ODbL 1.0. [Comparativo setorial em JSON](../data/public/cvm-sector-comparison.json) · [Catálogo FCA](https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca) · [Catálogo DFP](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp)

O lote de ROIC estimado aplica a mesma janela aos setores de Metalurgia e Siderurgia e Extração Mineral. O recorte inicial tem 14 observações conciliadas em 40 e duas séries completas. As contas e os saldos vêm da CVM. Quando a classificação de um passivo depende das notas do emissor, a observação aponta também as demonstrações de apoio. [ROIC setorial em JSON](../data/public/cvm-sector-roic.json) · [Metodologia do ROIC](METHODOLOGY.md#roic-estimado-em-siderurgia-e-mineração)

O [Formulário Cadastral da CVM](https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca) fornece os códigos e as classes declarados pelas três companhias em 2026. A página Empresas mostra essa evidência separadamente, com data de referência, recebimento e versão. O [snapshot cadastral em JSON](../data/public/cvm-identity.json) é disponibilizado sob ODbL 1.0. A qualificação do universo e a escolha do ticker representativo dependem da composição oficial dos índices e do volume por classe.

## CDI atual

O navegador consulta a última observação do CDI anualizado em base de 252 dias úteis no serviço público do Banco Central do Brasil (SGS 4389). A interface exibe o valor em percentual ao ano, a data-base da observação e a fonte. Os termos dos serviços digitais do Banco Central permitem reproduzir o conteúdo com atribuição e integridade. Em caso de falha ou ausência de observação válida, a taxa fica indisponível e a consulta pode ser refeita. [Última observação](https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json) · [Metadados da série](https://www3.bcb.gov.br/sgspub/consultarmetadados/consultarMetadadosSeries.do?hdOidSerieSelecionada=4389&method=consultarMetadadosSeriesInternet) · [Termos do Banco Central](https://www.bcb.gov.br/acessoinformacao/politicaprivacidade)

## Fundamentos de preço

O lote com os numeradores de 12 meses usa DFP anual de 2025 e ITR consolidado de setembro de 2026 para WEG, Lojas Renner e Itaú Unibanco. As duas fontes têm licença ODbL 1.0. O JSON guarda a versão, o período, o recebimento na CVM, os links e o hash do ZIP por insumo. Inclui também dívida líquida simplificada de WEG e Renner e a posição de ações da WEG e do Itaú fora da tesouraria por classe em 30/09/2026. [Lote em JSON](../data/public/cvm-price-fundamentals.json) · [Catálogo DFP](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp) · [Catálogo ITR](https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr)

A Nota 19 do demonstrativo IFRS anexado ao Formulário 6-K do Itaú é a fonte dos valores de mercado por ação no último dia de setembro de 2026. A SEC permite reusar o conteúdo dos formulários públicos do EDGAR. Essa base de reuso vale para o ponto do demonstrativo do Itaú atribuído no lote. A atualização diária de mercado exige outra fonte com direitos aplicáveis. [Nota 19 do Itaú no EDGAR](https://www.sec.gov/Archives/edgar/data/1132597/000113259726000279/condensedconsolidatedfin.htm) · [Política de reuso da SEC](https://www.sec.gov/about/webmaster-frequently-asked-questions)

## Fechamentos de mercado

O importador recebe preços de fechamento por ação em um CSV local. A página de cotações históricas da B3 documenta os fechamentos sem ajustes e restringe o conteúdo à consulta informativa. Os termos da brapi restringem a redistribuição. [Cotações históricas da B3](https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/mercado-a-vista/cotacoes-historicas/) · [Termos da brapi](https://brapi.dev/legal/terms-of-use)

Uma via contratual para a atualização diária é solicitar fechamento D−1 sem ajustes a um distribuidor licenciado, como a Cedro, com autorização para cálculo, exibição e disponibilização do JSON público do Moat. A regra D−1 da B3 vale para distribuidores e redistribuidores que obtêm os dados pelas plataformas Market Data. Para UP2DATA, a versão 2.4.5 da política prevê divulgação em site aberto mediante contrato e Anexo III, com atraso mínimo de um dia e exibição em tela por até seis meses. Essa modalidade veda downloads manipuláveis e o uso em derivados exige autorização específica. A contratação para o Moat segue pendente. [Perguntas frequentes de Market Data B3](https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/distribuidores/perguntas-frequentes/) · [Distribuidores licenciados](https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/distribuidores/distribuidores-licenciados/) · [Cedro EOD](https://ajuda.cedrotech.com/market-data/quais-sao-as-apis-do-market-data-cedro/) · [Política do UP2DATA](https://www.b3.com.br/data/files/44/20/90/B2/E7D5F910CEC024F9AC094EA8/UP2DATA_Politica_Comercial_2.4.5.pdf)

## Cobertura e pendências

### Séries para a retrospectiva

O simulador lê um JSON fornecido pelo usuário dentro do navegador. O arquivo identifica fonte, instante de coleta e metodologia e declara retorno total em BRL. A comparação requer a mesma convenção de retorno e as mesmas datas em toda a janela solicitada. Séries de preço sem ajuste, proventos reaplicados em duplicidade e níveis preenchidos artificialmente produzem uma base incompatível. A publicação de históricos depende de verificar cobertura, origem e direitos de utilização. [Cotações históricas e condições da B3](https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/mercado-a-vista/cotacoes-historicas/) · [Documentos de eventos e divulgações na CVM](https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe)

O Ibovespa e o IDIV padrão são índices de retorno total. O IDIV tem uma versão distinta de retorno de preço. O SMAL11 é um ETF da BlackRock que acompanha o índice SMLL. O Informe Diário da CVM oferece valor patrimonial por cota sob ODbL 1.0, sujeito à cobertura. A BlackRock também publica a rentabilidade total do SMAL11 com base patrimonial. O benchmark negociado do ETF exige uma série de cotação em bolsa com eventos reconciliados. [Ibovespa B3](https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/ibovespa-b3.htm) · [IDIV B3](https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-de-segmentos-e-setoriais/indice-dividendos-idiv.htm) · [SMAL11 na BlackRock](https://www.blackrock.com/br/products/251752/) · [Informe Diário da CVM](https://dados.cvm.gov.br/dataset/fi-doc-inf_diario)

O SGS 4391 do Banco Central é candidato ao CDI histórico acumulado no mês. O cálculo de Sharpe depende de verificar a correspondência com os períodos da simulação. A série anualizada corrente usada em Empresas e Valuation descreve uma taxa de outra janela. [SGS 4391](https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?hdOidSeriesSelecionadas=4391&method=consultarGraficoPorId)

### Universo e fontes de mercado

A composição de 18/11/2026 foi importada dos três CSVs fornecidos pelo usuário para consulta local. O Formulário Cadastral da CVM resolve a identidade de cada companhia. Exceções de ticker ou classe exigem uma fonte primária registrada com a data-base.

O [diretório público](../data/public/cvm-company-selection.json) lista os nomes oficiais da seleção, obtidos no FCA aberto, sob a mesma licença do cadastro. A relação de cada companhia com os índices pertence ao snapshot local.

| Dados                                            | Fonte ou candidata                                                        | Estado                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| DFP anual consolidado                            | Catálogo oficial da CVM                                                   | Amostras contábeis de 2021 a 2025                     |
| ITR consolidado                                  | Catálogo oficial da CVM                                                   | DRE de três companhias e balanço de WEG e Renner      |
| DFC e cobertura ampla de demonstrações           | Catálogo oficial da CVM                                                   | Cobertura futura                                      |
| Carteiras IBOV, SMLL e IDIV                      | CSVs fornecidos pelo usuário em formato B3                                | Recorte anual local. Direitos de publicação pendentes |
| Classe de maior liquidez                         | Histórico de volume financeiro negociado, por classe, em fonte autorizada | Pendente                                              |
| Fechamentos diários                              | CSV local e futuro provedor com direitos verificados                      | Importação local. Publicação diária pendente          |
| Valor de mercado histórico por ação do Itaú      | Nota 19 das demonstrações IFRS arquivadas no EDGAR                        | Ponto retrospectivo em 30/09/2026                     |
| Proventos e eventos corporativos                 | Provedor após validação de direitos                                       | Pendente                                              |
| CDI anualizado corrente                          | Banco Central do Brasil, SGS 4389                                         | Referência provisória consultada diretamente          |
| Referência prefixada de aproximadamente dez anos | ETTJ ANBIMA de 2520 dias úteis                                            | Acesso e direitos de publicação pendentes             |
| Selic e séries auxiliares                        | Banco Central ou Tesouro, conforme a série                                | Avaliação futura                                      |

Veja [Referências de mercado no M1](REFERENCE_DATA_M1.md) para os detalhes sobre acesso, licença e comportamento quando a fonte está indisponível. Os requisitos gerais constam nas seções 2, 4, 5 e 12 da [especificação](SPEC.md).
