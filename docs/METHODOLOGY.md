# Metodologia

## Contas CVM na prova de conceito

A amostra do M1 usa os DFP anuais consolidados de WEG, Lojas Renner e Itaú Unibanco de 2021 a 2025. São três perfis contábeis conhecidos, com seleção pelo código CVM. Os campos do ativo, passivo, patrimônio e resultado provêm das linhas mapeadas de cada formulário. As conciliações confrontam totais com as contas que os compõem, respeitando a escala declarada. A interface mostra o valor em BRL, o formulário e o código de conta de origem.

Os registros usam a versão anual disponível no arquivo coletado. Uma reapresentação pode alterar o resultado para a mesma data-base. A data de recebimento e a versão ficam visíveis. O instante em que o documento se tornou público permanece desconhecido quando a fonte oferece apenas a data de recebimento. O lote serve à revisão de contas. Uma reconstrução histórica exigirá versões anteriores e a verificação do momento de publicação de cada registro.

## Métricas e modelos previstos

Os próximos marcos da [especificação](SPEC.md#13-plano-por-marcos-e-definição-de-pronto) detalham as métricas e os modelos abaixo.

| Domínio             | Método previsto                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Universo            | União das carteiras de IBOV, SMLL e IDIV na data-base do recorte anual. Uma linha por companhia brasileira, com todas as afiliações e as classes presentes na composição. A classe mais líquida requer dados de volume.                                                                                |
| Qualidade           | ROIC com NOPAT e capital investido médio para empresas não financeiras. ROE com lucro líquido atribuível e patrimônio líquido médio correspondente para bancos. Série de ao menos cinco exercícios quando disponível.                                                                                  |
| Spread de qualidade | Diferença em pontos percentuais entre ROIC ou ROE e a referência prefixada brasileira de aproximadamente dez anos, alinhada à janela histórica do exercício.                                                                                                                                           |
| Preço               | Rendimento operacional implícito pelo NOPAT TTM sobre o EV de mercado para não financeiras ou pelo lucro líquido TTM sobre a capitalização de mercado para bancos. Usar o fechamento do último pregão válido.                                                                                          |
| Ranking             | Comparar nível de retorno, spread, estabilidade, preço e crescimento ou reinvestimento com pares adequados. Divulgar critérios, pesos e exclusões.                                                                                                                                                     |
| Valuation           | DCF de fluxo de caixa livre para a firma em não financeiras e DDM para bancos. Projetar cenários com premissas editáveis e taxas de desconto adequadas a cada modelo.                                                                                                                                  |
| Backtest            | Identificar a retrospectiva de uma carteira escolhida hoje. Na simulação historicamente investível, reconstruir o universo e usar as informações que eram públicas em cada decisão. Calcular os retornos com séries que tratam proventos, eventos corporativos e deslistagens quando houver cobertura. |

A referência pública de dez anos é um custo de oportunidade. O desconto de valuation considera o risco e a estrutura do modelo. A avaliação de uma vantagem competitiva duradoura exige também análise qualitativa.

As fórmulas, os ajustes contábeis, a composição do universo e as condições de comparabilidade estão nas seções 2 a 8 da [especificação](SPEC.md). As fontes candidatas e suas pendências estão em [Fontes de dados](DATA_SOURCES.md).
