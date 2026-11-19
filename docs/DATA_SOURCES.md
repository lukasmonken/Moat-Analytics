# Fontes de dados

## Amostra do M1

A página Empresas lê um snapshot das [Demonstrações Financeiras Padronizadas da CVM](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp). A amostra reúne WEG, Lojas Renner e Itaú Unibanco para verificar o mapeamento contábil em indústria, varejo e banco. Usa os formulários consolidados anuais do período de 2021 a 2025. Cada exercício informa versão, data de referência, data de recebimento, data da coleta, documento CVM e hash do ZIP de origem.

O [snapshot em JSON](../data/public/cvm-sample.json) deriva do catálogo da CVM e está disponível sob a [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). O site também oferece download do arquivo completo. Os originais e as etapas internas do pipeline ficam fora dos assets do site.

Os endereços de cada envio vêm do próprio arquivo DFP. A disponibilidade desses links individuais depende do sistema da CVM. O ZIP anual permanece como fonte direta para conferir os CSVs. [Consulta oficial de documentos](https://www.rad.cvm.gov.br/ENETWEB/frmConsultaExternaCVM.aspx)

O [lote de qualidade](../data/public/cvm-quality.json) usa as mesmas DFP consolidadas e seus saldos comparativos. As contas em BRL, a proveniência e os indicadores derivados são disponibilizados sob ODbL 1.0.

O [lote de comparação bancária](../data/public/cvm-bank-roe.json) usa DFP consolidadas da CVM de cinco bancos, com 25 observações de ROE de 2021 a 2025. A fonte, a versão de cada formulário e as contas usadas acompanham o indicador. O lote está disponível sob ODbL 1.0.

O [Formulário Cadastral da CVM](https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca) fornece os códigos e as classes declarados pelas três companhias em 2026. A página Empresas mostra essa evidência separadamente, com data de referência, recebimento e versão. O [snapshot cadastral em JSON](../data/public/cvm-identity.json) é disponibilizado sob ODbL 1.0. A qualificação do universo e a escolha do ticker representativo dependem da composição oficial dos índices e do volume por classe.

## CDI atual

O navegador consulta a última observação do CDI anualizado em base de 252 dias úteis no serviço público do Banco Central do Brasil (SGS 4389). A interface exibe o valor em percentual ao ano, a data-base da observação e a fonte. Os termos dos serviços digitais do Banco Central permitem reproduzir o conteúdo com atribuição e integridade. Em caso de falha ou ausência de observação válida, a taxa fica indisponível e a consulta pode ser refeita. [Última observação](https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json) · [Metadados da série](https://www3.bcb.gov.br/sgspub/consultarmetadados/consultarMetadadosSeries.do?hdOidSerieSelecionada=4389&method=consultarMetadadosSeriesInternet) · [Termos do Banco Central](https://www.bcb.gov.br/acessoinformacao/politicaprivacidade)

## Fundamentos de preço

O lote com os numeradores de 12 meses usa DFP anual de 2025 e ITR consolidado de setembro de 2026 para WEG, Lojas Renner e Itaú Unibanco. As duas fontes têm licença ODbL 1.0. O JSON guarda a versão, o período, o recebimento na CVM, os links e o hash do ZIP por insumo. As quantidades de ações em circulação por classe, a dívida líquida e os ajustes de EV ainda precisam de validação para o cálculo dos denominadores. [Lote em JSON](../data/public/cvm-price-fundamentals.json) · [Catálogo DFP](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp) · [Catálogo ITR](https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr)

## Fechamentos de mercado

O importador recebe preços de fechamento por ação em um CSV local. A página de cotações históricas da B3 documenta os fechamentos sem ajustes e restringe o conteúdo à consulta informativa. A regra de distribuição D−1 da B3 se aplica a distribuidores e redistribuidores que obtêm os dados pelas plataformas Market Data. Os termos da brapi também restringem redistribuição. A fonte para publicação no Moat Analytics segue pendente. [Cotações históricas da B3](https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/mercado-a-vista/cotacoes-historicas/) · [Perguntas frequentes de Market Data B3](https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/distribuidores/perguntas-frequentes/) · [Termos da brapi](https://brapi.dev/legal/terms-of-use)

## Cobertura e pendências

A composição de 18/11/2026 foi importada dos três CSVs fornecidos pelo usuário para consulta local. O Formulário Cadastral da CVM resolve a identidade de cada companhia. Exceções de ticker ou classe exigem uma fonte primária registrada com a data-base.

O [diretório público](../data/public/cvm-company-selection.json) lista os nomes oficiais da seleção, obtidos no FCA aberto, sob a mesma licença do cadastro. A relação de cada companhia com os índices pertence ao snapshot local.

| Dados                                            | Fonte ou candidata                                                        | Estado                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| DFP anual consolidado                            | Catálogo oficial da CVM                                                   | Amostras contábeis de 2021 a 2025                     |
| ITR consolidado                                  | Catálogo oficial da CVM                                                   | DRE de três companhias para o resultado de 12 meses   |
| DFC e cobertura ampla de demonstrações           | Catálogo oficial da CVM                                                   | Cobertura futura                                      |
| Carteiras IBOV, SMLL e IDIV                      | CSVs fornecidos pelo usuário em formato B3                                | Recorte anual local. Direitos de publicação pendentes |
| Classe de maior liquidez                         | Histórico de volume financeiro negociado, por classe, em fonte autorizada | Pendente                                              |
| Fechamentos                                      | CSV local e futuro provedor com direitos verificados                      | Importação local. Publicação pendente                 |
| Proventos e eventos corporativos                 | Provedor após validação de direitos                                       | Pendente                                              |
| CDI anualizado corrente                          | Banco Central do Brasil, SGS 4389                                         | Referência provisória consultada diretamente          |
| Referência prefixada de aproximadamente dez anos | ETTJ ANBIMA de 2520 dias úteis                                            | Acesso e direitos de publicação pendentes             |
| Selic e séries auxiliares                        | Banco Central ou Tesouro, conforme a série                                | Avaliação futura                                      |

Veja [Referências de mercado no M1](REFERENCE_DATA_M1.md) para os detalhes sobre acesso, licença e comportamento quando a fonte está indisponível. Os requisitos gerais constam nas seções 2, 4, 5 e 12 da [especificação](SPEC.md).
