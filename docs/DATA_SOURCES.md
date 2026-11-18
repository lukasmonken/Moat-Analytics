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

## Cobertura e pendências

A composição de 18/11/2026 foi importada dos três CSVs fornecidos pelo usuário para consulta local. O Formulário Cadastral da CVM resolve a identidade de cada companhia. Exceções de ticker ou classe exigem uma fonte primária registrada com a data-base.

O [diretório público](../data/public/cvm-company-selection.json) lista os nomes oficiais da seleção, obtidos no FCA aberto, sob a mesma licença do cadastro. A relação de cada companhia com os índices pertence ao snapshot local.

| Dados                                            | Fonte ou candidata                                                        | Estado                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| DFP anual consolidado                            | Catálogo oficial da CVM                                                   | Amostra de três companhias, cinco exercícios por companhia |
| ITR, DFC e universo amplo de demonstrações       | Catálogo oficial da CVM                                                   | Cobertura futura                                           |
| Carteiras IBOV, SMLL e IDIV                      | CSVs fornecidos pelo usuário em formato B3                                | Recorte anual local. Direitos de publicação pendentes      |
| Classe de maior liquidez                         | Histórico de volume financeiro negociado, por classe, em fonte autorizada | Pendente                                                   |
| Fechamentos, proventos e eventos corporativos    | Provedor intercambiável após validação de direitos, calendário e ajustes  | Pendente                                                   |
| CDI anualizado corrente                          | Banco Central do Brasil, SGS 4389                                         | Referência provisória consultada diretamente               |
| Referência prefixada de aproximadamente dez anos | ETTJ ANBIMA de 2520 dias úteis                                            | Acesso e direitos de publicação pendentes                  |
| Selic e séries auxiliares                        | Banco Central ou Tesouro, conforme a série                                | Avaliação futura                                           |

Veja [Referências de mercado no M1](REFERENCE_DATA_M1.md) para os detalhes sobre acesso, licença e comportamento quando a fonte está indisponível. Os requisitos gerais constam nas seções 2, 4, 5 e 12 da [especificação](SPEC.md).
