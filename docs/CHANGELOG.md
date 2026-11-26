# Changelog

## M2 — Capital investido simplificado

- O ROIC de 2021 a 2025 usa patrimônio líquido mais empréstimos e financiamentos de curto e longo prazo, menos caixa e equivalentes. A tela e o Excel mostram as contas usadas.
- O comparativo de 2025 passa a ter 125 ROICs estimados e 15 ROEs. A base individual auditada permite calcular a TIM. Bradespar, Assaí, Camil e São Martinho seguem com lacunas em 2025.

## M2 — Insumos contábeis de 2025 e grupo de seguros

- O comparativo de 2025 tem valores disponíveis para 83 companhias, com 15 ROEs e 68 ROICs estimados. As 144 companhias continuam na lista.
- Bradsaúde e Porto Seguro aparecem em **Seguros e Resseguros**, com ROE. O histórico anterior à reorganização identifica os demonstrativos da Odontoprev. O setor cadastral da CVM permanece nos detalhes e no Excel.
- Novos saldos foram conciliados com notas auditadas para arrendamentos, financiamentos e o patrimônio de abertura do Banco ABC. O comparativo identifica a base individual auditada da Sanepar.

## M2 — Cobertura de ROIC de 2025

- O ROIC estimado de 2025 passou de 38 para 58 companhias com cálculo disponível. O lote incorpora novas descrições de arrendamento e passivos cuja classificação foi conferida nas notas dos emissores.
- Empresas e o Excel identificam os valores de arrendamento que a Ambev, a B3 e a Tupy já incluem nos financiamentos.

## M2 — Ordenação de Empresas por retorno

- Filtro por ROE ou ROIC e ordenação pelo maior retorno do exercício dentro do indicador escolhido. Lacunas ficam no fim da tabela ordenada.
- O Excel do recorte mantém a ordem dos resultados em todas as páginas.

## M2 — Comparativo unificado de Empresas

- Uma lista reúne as 144 companhias da seleção anual. ROE é o indicador de 14 bancos e seguradoras, e ROIC estimado é o indicador das outras 130 companhias.
- Os detalhes mostram as principais contas, a DFP de origem e o motivo das lacunas por exercício. O CDI atual continua associado ao exercício mais recente.
- A opção **Comparar histórico** mostra os exercícios de duas companhias com o mesmo indicador. O Excel exporta os valores do exercício e as contas de origem para as companhias filtradas ou para toda a seleção.

## M2 — ROE lado a lado

- Comparação anual de ROE de até quatro companhias da seleção, com média dos cinco exercícios, variação em pontos percentuais, mediana do setor, cobertura e links para as DFPs.
- Exportação da comparação em Excel. A seleção das companhias se mantém ao trocar a busca, o setor, o exercício ou a página do comparativo.

## M2 — ROIC de siderurgia e mineração

- Comparativo de ROIC estimado para as oito companhias dos setores Metalurgia e Siderurgia e Extração Mineral. A tela e o Excel mostram as contas conciliadas, os formulários e as lacunas por exercício.
- Os comparativos de ROE e ROIC mostram a diferença para o CDI atual no exercício mais recente da janela, com a data da taxa em separado.

## M2 — Comparativos setoriais da seleção anual

- As 144 companhias da seleção são consultáveis em Empresas por nome, setor declarado à CVM e exercício.
- ROE atribuível à controladora de 2021 a 2025 com contas, versão e DFP de origem. A tela exibe lacunas por exercício e calcula percentis nos setores com pelo menos cinco séries completas.
- Exportação em Excel do recorte ou da seleção completa, com contas, formulários e arquivos de origem.

## M5 — Cópia de carteira em JSON

- Exportação e restauração da composição, dos pesos e dos parâmetros em Carteiras. A importação carrega os valores para revisão antes de salvar neste navegador.
- A restauração verifica a versão, os parâmetros e os nomes no diretório atual da CVM.

## M5 — Análise por ativo na retrospectiva

- Ganho de mercado, custos, contribuição antes do tributo e peso final de cada posição, com o maior peso da carteira no resumo.
- Correlação de Pearson dos retornos mensais alinhados, com pelo menos três retornos e variação em ambas as séries. Composição e correlações também estão no Excel.

## M6 — Exportação Excel

- Exportação do screener filtrado ou completo, das contas e indicadores de Empresas, das premissas e resultados de Valuation, da carteira e da retrospectiva calculada.
- As planilhas preservam números e datas, cabeçalhos congelados, autofiltros e a aba Metodologia e fontes.

## M5 — Carteiras e retrospectiva com dados locais

- Seleção manual pelo nome oficial da companhia, pesos iguais ou personalizados e limite opcional por posição. A carteira é salva no navegador.
- Retrospectiva mensal da carteira atual a partir de séries de retorno total em reais importadas em JSON, com aportes, custos, rebalanceamento e imposto final parametrizados.
- Métricas de retorno e risco e comparação opcional com Ibovespa, IDIV e SMAL11 no mesmo período. A cobertura depende do arquivo carregado no navegador.

## M4 — Valuation e premissas

- DCF de fluxo de caixa livre para a firma e DDM para bancos, com projeções editáveis de dez anos e perpetuidade.
- Valor intrínseco por ação, sensibilidade à taxa de desconto e crescimento, potencial e margem de segurança sobre preço informado.
- Três cenários independentes por modelo, com opção de salvar no navegador e transferir as premissas em JSON.
- Referências contábeis datadas da CVM e opção explícita de usar o CDI atual como taxa de desconto.

## M3 — Dívida líquida, ações por classe e preço histórico

- Dívida líquida simplificada de WEG e Lojas Renner em 30/09/2026, com empréstimos, arrendamentos, caixa, aplicações financeiras e participação de não controladores discriminados.
- Posição exata de ações fora da tesouraria na data-base para WEG e Itaú. O ITR de Lojas Renner informa a quantidade em milhares e a contagem exata segue pendente.
- Capitalização e rendimento implícito retrospectivos do Itaú em 30/09/2026, com valores por classe atribuídos ao demonstrativo do emissor arquivado no EDGAR.

## M3 — Fundamentos de preço e fechamentos locais

- Resultado dos 12 meses encerrados em 30/09/2026 para WEG, Lojas Renner e Itaú Unibanco, com contas, períodos e formulários de origem.
- Importação local de fechamentos por ticker, com data do pregão, fonte, coleta e preservação do último valor válido.
- Motor decimal para capitalização por classe, valor da firma, rendimentos implícitos e diferença para o CDI. A exibição dessas métricas depende da validação dos dados de mercado e dos denominadores.

## M2 — CDI atual

- CDI anualizado do Banco Central como taxa livre de risco provisória em Empresas e Valuation e Premissas, com data-base e fonte.
- Diferença em pontos percentuais entre o ROIC ou ROE do exercício mais recente e o CDI atual.

## M2 — Comparação bancária

- ROE atribuível à controladora de Banco do Brasil, Banrisul, Bradesco, Itaú Unibanco e Santander de 2021 a 2025, com média e percentil no grupo.
- Comparação em Empresas, com abertura das contas por banco e exercício e download do lote atribuído à CVM.
- A conciliação do Santander de 2022 documenta a divergência da DRE estruturada e a conferência com a DMPL e o demonstrativo IFRS auditado.
- Verificação de cobertura da referência de dez anos nos dados abertos do BCB. Spreads e ranking composto permanecem indisponíveis.

## M2 — Séries de qualidade da amostra

- Cinco exercícios de ROE atribuível à controladora para Itaú e de ROIC estimado para WEG e Renner, com saldos de abertura do mesmo formulário.
- Histórico de qualidade em Empresas, com variação anual em p.p., estatísticas, contas-fonte, versão e download do JSON atribuído à CVM.
- Motor decimal e testes de casos-limite. Spreads e ranking da amostra exibem indisponibilidade.

## M1 — Amostra CVM

- Diretório público da seleção anual com nomes do cadastro da CVM, data-base e busca pelo nome da companhia.

- Importação manual de um recorte anual de IBOV, SMLL e IDIV, com data-base, histórico por hash, união por companhia e classes verificadas pelo código CVM.
- O screener local consulta o lote importado com busca, filtros, ordenação e paginação. O build público exige base de redistribuição verificada para incorporar uma composição.

- Ingestão em lote de DFP anuais consolidados oficiais, com normalização de escala, seleção de versão e conciliações.
- Amostra de WEG, Lojas Renner e Itaú Unibanco de 2021 a 2025 com fonte, data-base, recebimento, coleta, versão e hash de origem.
- Página Empresas consulta históricos de contas, detalha conciliações e oferece download do snapshot sob ODbL 1.0.
- Códigos e classes declarados no FCA de 2026, com proveniência e download independentes do snapshot contábil.
- As pendências de publicação do universo B3, liquidez e taxa de referência de dez anos ficam documentadas.
- Validação de contrato em execução, regressões de pipeline offline e teste no build hospedado em subdiretório.

## M0 — Fundação

- Visão geral, Screener e Rankings, Empresas, Valuation e Premissas, Carteiras, Simulador e Backtest e Metodologia em rotas independentes.
- Navegação adaptativa, tema claro e escuro persistente, foco de teclado e suporte a movimento reduzido.
- Interface do screener com pesquisa, índices IBOV, SMLL e IDIV e seletor de 5, 10, 20, 30, 40 ou 50 linhas. A base de empresas aguarda integração.
- Estrutura modular, contratos de dados iniciais, documentação de fontes e metodologia.
- Validação com ESLint, TypeScript, Vitest e Playwright. CI e publicação manual pelo GitHub Pages preparados.
