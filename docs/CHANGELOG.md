# Changelog

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
