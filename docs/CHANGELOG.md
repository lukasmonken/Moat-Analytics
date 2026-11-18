# Changelog

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
