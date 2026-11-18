# Fontes de dados

O M0 não coleta nem publica dados financeiros. A tabela registra as fontes previstas e o que precisa ser validado antes de usá-las.

| Dados                                            | Fonte prevista                                                                 | Validação pendente                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| DFP, ITR e cadastro de companhias                | Arquivos públicos oficiais da CVM                                              | Cobertura, escala, consolidado e individual, retificações e conciliação das contas                            |
| Carteiras IBOV, SMLL e IDIV                      | Composições oficiais da B3 ou fonte autorizada                                 | Acesso, direitos de redistribuição, histórico por vigência e correspondência entre companhia e classe de ação |
| Fechamentos, proventos e eventos corporativos    | Provedor intercambiável. Yahoo Finance e yfinance são candidatos experimentais | Permissão de uso e redistribuição, calendário, cobertura histórica e ajustes de preços                        |
| Referência prefixada de aproximadamente dez anos | ETTJ ANBIMA como candidata principal e Tesouro Direto como apoio               | Acesso, histórico, convenção de prazo constante e direitos de uso                                             |
| Selic e séries auxiliares                        | Banco Central ou Tesouro, conforme a série                                     | Definição, periodicidade e disponibilidade                                                                    |

O pipeline futuro manterá os originais com origem e hash. A publicação usará snapshots JSON versionados com data-base, cobertura e proveniência. Para fechamentos, a rotina prevista coleta o último pregão válido por volta das 12h de Brasília, com data do pregão e momento da coleta. Em caso de falha, a interface deverá manter a última publicação válida e indicar o atraso.

Para os requisitos de cada fonte e o plano de validação, consulte as seções 2, 4, 5 e 12 da [especificação](SPEC.md).
