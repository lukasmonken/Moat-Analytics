# MOAT ANALYTICS — Especificação técnica e funcional

**Versão da especificação:** 1.0 — 18/11/2026  
**Estado:** projeto a implementar; requisitos aprovados, ainda não equivalem a código funcional.  
**Idioma da interface:** português brasileiro (`pt-BR`); moeda BRL; fuso `America/Sao_Paulo`.  
**Produto:** aplicativo web público de análise fundamentalista de empresas brasileiras, rankings de qualidade e preço, valuation, construção de carteiras e backtest.  
**Filosofia de UX:** menos é mais. Dados corretos, verificáveis e claros antes de qualquer sofisticação visual.

> **Instrução para agentes de programação:** este documento é a fonte de verdade do escopo. Não inventar APIs, licenças, dados, retornos, empresas elegíveis ou resultados financeiros. Não marcar uma funcionalidade como concluída quando houver apenas UI e números fictícios. Registrar limitações e decisões no repositório. Implementar incrementalmente sem deixar o aplicativo quebrado.

## 1. Visão do produto

A plataforma deverá responder a quatro perguntas:
1. **Qualidade:** a empresa gera ROIC/ROE elevado e consistente, acima da taxa de referência de 10 anos e dos pares, durante ao menos cinco anos?
2. **Preço:** pelo fechamento do último pregão, qual o rendimento operacional implícito no preço de compra? O preço é interessante em comparação ao benchmark, ao setor e ao histórico?
3. **Valor:** qual o valor intrínseco estimado por DCF ou DDM, sob premissas explícitas e editáveis?
4. **Carteira:** como uma seleção de ativos, automatizada ou manual, teria se comportado, sob diferentes pesos, aportes, horizontes e benchmarks?

A metodologia é **inspirada** em temas associados a Buffett/Munger, não uma fórmula oficial ou comprovação automática de *moat*. Identificar vantagem competitiva duradoura exige avaliação qualitativa adicional. A taxa pública de dez anos é um **benchmark/custo de oportunidade**; ela não substitui automaticamente WACC ou custo de equity e o spread calculado contra ela não deve ser rotulado equivocadamente como EVA.

### Entregáveis e fases

**Primeira sessão (M0):** site real publicado, estrutura modular inicial, navegação funcional entre páginas, tema claro/escuro persistente, identidade visual e estados vazios honestos. Não exigir dados reais nem modelos financeiros completos em M0. Meta de entrada: página online sem quebrar builds, com CI básico.

**V1 completa (alvo funcional, desenvolvida por etapas):** dados elegíveis da B3 e CVM, qualidade, preço de fechamento, ranking/percentis, DCF/DDM, premissas editáveis, carteiras, backtesting histórico e exportação Excel. Uma V1 com cobertura parcial pode ser liberada **somente** se a cobertura e limitações forem explicitadas. Não prometer que todas as integrações gratuitas tenham cobertura suficiente antes de validação.

## 2. Universo de ativos

- Incluir **somente companhias brasileiras listadas na B3** que pertençam à carteira vigente de **ao menos um** destes índices: **Ibovespa (IBOV)**, **Índice Small Cap (SMLL)** ou **Índice Dividendos (IDIV)**.
- Universo = **união** dos componentes dos três índices; nunca exigir participação simultânea. Se uma empresa estiver em vários, mostrar todas as afiliações.
- Não acrescentar filtro externo de liquidez: a presença em um índice é o critério de entrada acordado. Podem existir filtros manuais na interface, mas desligados por padrão.
- Excluir FIIs, ETFs, BDRs, instrumentos estrangeiros e veículos que não sejam companhias brasileiras elegíveis. **SMAL11 não é componente do universo:** é ETF para comparação no backtest.
- Cada **companhia** ocupa **uma linha**: deduplicar por identificador estável (p. ex. código CVM/CNPJ). ON, PN e UNIT da mesma companhia não viram empresas distintas.
- Selecionar como **ticker representativo de preço a classe com maior liquidez**, com definição documentada (proposta: média do volume financeiro negociado nos últimos 60 pregões). UNIT só prevalece se for a mais líquida. Manter mapeamento completo e exceções auditáveis.
- Versão histórica da carteira dos índices e do ticker representativo deve ser arquivada para backtests; usar a composição atual no passado introduz viés de sobrevivência/seleção. Se o histórico não existir, a modalidade historicamente investível deve ficar indisponível ou explicitamente limitada.
- Validar **fonte, acessibilidade e licença de uso/redistribuição** das composições oficiais antes de publicá-las.

### Tabela do screener

Pesquisa por empresa/ticker; filtros por índice (IBOV/SMLL/IDIV), setor e categoria; ordenação por qualquer coluna suportada; estado vazio e ausência de dados; total do universo e total filtrado. Controle no cabeçalho para mostrar **5, 10, 20, 30, 40 ou 50** linhas (padrão 10), paginação real. Este controle **não** altera a quantidade de ativos de uma carteira.

## 3. Métricas contábeis e de qualidade

A página Empresas reúne todas as companhias da seleção anual em uma lista com setor, exercício, indicador e valor. Os detalhes de cada companhia mostram as principais contas usadas no cálculo, a fonte ou o motivo da indisponibilidade do indicador. A comparação de históricos reúne duas companhias com o mesmo indicador.

### 3.1 ROIC para as demais companhias

- `NOPAT = EBIT operacional ajustado × (1 − alíquota tributária apropriada)`; o EBIT pode demandar conciliação/normalização a partir do resultado antes do financeiro e tributos da CVM. Não somar impostos ao EBIT como se fossem lucro.
- `ROIC = NOPAT anual ou TTM / capital investido médio`.
- CI financeiro simplificado: `PL ajustado + dívida onerosa − caixa excedente`; documentar ajustes para arrendamentos, minoritários, ativos/passivos não operacionais e equivalentes. Preferir reconciliação operacional e financeira quando houver dados.
- Capital investido é contábil/operacional ajustado, **não** enterprise value de mercado. Usar média dos saldos de abertura e fechamento do período.
- Considerar valores negativos, denominadores zerados, aquisições, períodos fiscais atípicos, empresas de baixa capitalização contábil e extraordinários. Sinalizar observações inadequadas para classificação.
- Preservar a companhia e o exercício na lista quando o ROIC estimado estiver indisponível. A observação informa a lacuna nas contas ou na conciliação.

### 3.2 ROE para bancos e seguradoras

- `ROE = lucro líquido atribuível aos acionistas / patrimônio líquido médio correspondente`.
- Usar ROE como indicador de qualidade de bancos e seguradoras, considerando a atividade dos grupos bancários e de seguros. Comparar pares adequados e interpretar alavancagem e capital regulatório.

### 3.3 Série e qualidade

Histórico mínimo desejado: **5 exercícios**, idealmente **10 a 20+ anos**, quando existente. Analisar média, mediana, desvio-padrão, amplitude, variação anual em **pontos percentuais**, estabilidade, tendência, evolução do spread, quantidade de anos positivos e sequência consecutiva. Crescimento percentual do ROIC com valores negativos/próximos de zero pode ser enganoso; usar variação em p.p. como indicador primário. Comparação por pares/segmentos. ROIIC (retorno incremental sobre capital adicional) como métrica complementar, com metodologia própria.

### 3.4 Curva de juros e spread

- **Referência provisória corrente.** Usar o CDI anualizado mais recente publicado pelo Banco Central do Brasil (SGS 4389) como única taxa livre de risco corrente. Exibir o percentual ao ano, a data de referência e a fonte em Empresas e em Valuation e Premissas.
- **Comparação corrente em Empresas.** Subtrair o CDI atual do ROIC ou ROE do exercício mais recente, em pontos percentuais, com as duas referências identificadas. A indisponibilidade de qualquer um dos dados deixa a diferença indisponível.
- **Referência histórica planejada.** Curva prefixada brasileira de prazo constante de aproximadamente dez anos, idealmente ETTJ ANBIMA. A integração depende de validação de acesso, cobertura e condições de uso. Tesouro Direto é uma fonte de apoio.
- Para cada ano, comparar o retorno com **taxa da mesma janela histórica**, segundo convenção documentada (p. ex. taxa na data de encerramento do exercício ou média anual); não usar a taxa atual retroativamente.
- `Spread histórico de qualidade (p.p.) = ROIC ou ROE − taxa nominal pública de 10 anos da mesma janela`.
- `Spread preço (p.p.) = yield implícito de mercado − benchmark público contemporâneo`.
- Exibir anos de spread positivo, mínimo de cinco consecutivos para o filtro escolhido, média/volatilidade e comparação dos pares. Um spread positivo não é prova de moat.

## 4. Preço, cotações e rendimento implícito

- Atualização **uma vez ao dia, por volta de 12h de Brasília**, usando **fechamento do último pregão** (não tempo real). Mostrar *data da cotação*, *data/hora da coleta*, provedor e eventual atraso. Em feriados/ausência de mercado, manter o fechamento válido mais recente.
- Para não financeiras: `EV mercado = capitalização de mercado + dívida líquida + ajustes relevantes`; `yield operacional = NOPAT TTM / EV mercado`.
- Para bancos: `earnings yield = lucro líquido TTM / capitalização de mercado`; equivalência com `ROE / P/VP` somente com bases/periodicidade coerentes.
- **ROIC/ROE não variam com a cotação.** O que se atualiza diariamente é o yield implícito, EV, múltiplos, spread de preço e margem de segurança.
- Essas métricas não são taxas de retorno total prometido ao acionista e podem ser distorcidas por eventos não recorrentes ou EV inadequado.
- Fazer tratamento de splits, grupamentos, bonificações, ações em circulação, dividendos e JCP.

## 5. Dados e automação

| Dados | Preferência inicial | Periodicidade |
|---|---|---|
| DFP/ITR, DRE, BP, DFC e cadastro | Arquivos públicos oficiais CVM | Conferir novos envios/retificações; anual/trimestral |
| Composição IBOV/SMLL/IDIV | Carteiras oficiais B3 ou fonte legalmente utilizável | A cada reconstituição/alteração |
| Fechamento/proventos/ações corporativas | Interface `MarketDataProvider` intercambiável; Yahoo Finance/yfinance apenas candidato experimental sujeito a termos | Diária para fechamento |
| CDI anualizado corrente | Banco Central do Brasil, SGS 4389 | Última observação publicada |
| Curva de juros prefixada 10 anos | ETTJ ANBIMA, validando permissão e histórico | Conforme disponibilidade da fonte |
| Selic e outras séries de referência | Banco Central/Tesouro conforme série | Conforme publicação |

**Não presumir** que preço do Yahoo Finance possa ser redistribuído publicamente sem licença. Não usar scraping que viole termos ou contorne limitações. Se fonte não estiver autorizada ou apresentar falhas, adotar fonte permitida, carregamento local/manual ou exibir `indisponível` — jamais inventar preços ou preencher com números aleatórios disfarçados de reais.

Pipeline idempotente: capturar originais, versionar com origem e hash, padronizar tipos/unidades, identificar consolidado vs individual, validar mapas contábeis por companhia, conciliar e produzir Parquet interno + JSON para frontend. Separar dados correntes e snapshots point-in-time; cada observação deve ter `referenceDate`, `publishedAt`, `retrievedAt`, `source`, `methodologyVersion`, `qualityStatus`. Incluir `schemaVersion`, `generatedAt`, `asOf`, `coverage` no manifesto público. Retificações devem ser identificáveis.

Rotinas independentes: preços diários; demonstrativos e universo periodicamente; validação e publicação. Execuções programadas no GitHub Actions podem atrasar; publicar apenas lote validado. Se atualização falhar, manter o último snapshot bom, registrar erro e sinalizar dado desatualizado no app.

## 6. Rankings e pontuação

- Rankings geral e por setor/categoria, ajustados por setor. Percentis por amostra comparável com tamanhos mínimos e método estatístico documentado.
- Critérios: nível de ROIC/ROE, spread, estabilidade/persistência, preço, crescimento/reinvestimento. Inverter sinais para métricas em que **menor** é melhor (volatilidade, por exemplo).
- Pontuação por posição opcional: 1º = 1 ponto, 2º = 2, etc.; **menor** soma ponderada vence.
- Alternativa: score ponderado de percentis 0 a 100, **maior** vence. Peso inicial *proposto*, editável: retorno 30%, spread 25%, estabilidade 20%, preço 15%, crescimento/reinvestimento 10%.
- Transparência de exclusões, faltantes, critérios, empates, comparáveis e metodologia. O score é heurístico, não recomendação automática de investimento.

## 7. Valuation e premissas

### 7.1 Empresas não financeiras — DCF (FCFF)

Horizonte padrão 10 anos. Projeções anuais: receita, crescimento, margem/EBIT, impostos normalizados, depreciação/amortização, CAPEX, variação de capital de giro. `FCFF = NOPAT + D&A − CAPEX − Δcapital de giro`. Calcular valor terminal por perpetuidade (quando taxa de desconto > crescimento terminal) ou múltiplo explicitado; descontar fluxos e terminal, ajustar dívida líquida/minoritários e ações para valor por ação. Exibir cotação, valor intrínseco estimado, potencial/margem de segurança e sensibilidade.

### 7.2 Bancos — DDM

Projeção de 10 anos para lucros/dividendos, retenção/payout, crescimento, restrições de capital regulatório e perpetuidade/terminal. Variante simplificada corrigindo dividendos pela inflação pode existir como cenário explicitamente mecânico; não é projeção robusta de banco.

### 7.3 Premissas e descontos

Aba separada para premissas automáticas (derivadas de históricos disponíveis com regras documentadas), edição manual por ano/variável, reset, salvar localmente, importar/exportar e cenários conservador/base/otimista. Exibir WACC/custo de equity ou desconto ajustado ao risco como padrão técnico quando aplicável; taxa livre de risco isolada como cenário alternativo explícito, com aviso de que pode superestimar valor. Alinhar valores nominais/reais, inflação e taxa de desconto. Evitar fluxo nulo/retorno esperado positivo inventado sem fonte.

## 8. Carteiras e simulações

### Montagem

Carteira de **10 ativos por padrão**, opção 15, 20 ou N, seleção manual ou via ranking. Pesos iguais ou personalizados, com validação exata/adequada para soma de 100%, limites por setor/ativo, exposição, liquidez como opção **de construção de carteira** (não filtro obrigatório do universo). Capital inicial em BRL, aportes opcionais, periodicidade de rebalanceamento, custos e tributação em parâmetros documentados.

### Histórico e métricas

Horizontes YTD e 2, 3, 4, 5, 6, 7 anos e customizado quando dados disponíveis. Patrimônio/capital inicial e final, aportes, lucro, retorno total, CAGR, retornos anuais, dividendos/JCP (com e sem reinvestimento), fluxo de caixa, volatilidade anualizada, drawdown máximo e série de drawdown, Sharpe com benchmark explícito, contribuição por ativo, concentração e correlação.

Benchmarks: Ibovespa, IDIV e **SMAL11 (ETF, não índice)**; metodologia equivalente de total return, ajustando adequadamente dividendos, splits, custos, datas e impostos e informando diferenças.

### Dois tipos de backtest, sem confundir

A. **Carteira de hoje no passado:** retrospectiva dos ativos escolhidos na data atual, sujeita a viés de seleção. Identificar claramente.

B. **Estratégia historicamente investível:** reconstituir universo, dados, rankings e rebalanceamentos apenas com informações efetivamente públicas em cada data (`publishedAt`), considerar ativos posteriormente deslistados quando possível, evitar *look-ahead bias* e reduzir *survivorship bias*. Se dados históricos não permitem B, informar limitação e não chamar A de B.

Projeção de retorno esperado = **cenário** com premissas e intervalo de sensibilidade, separada de backtest/retorno realizado. Nunca afirmar certeza de retorno.

## 9. Exportação Excel

Exportar `.xlsx` a partir de screener/rankings, empresa e séries de ROIC/ROE/spread, valuation/premissas, carteira e backtest. Opção para linhas filtradas ou todas elegíveis; formatos monetários BRL, percentuais, datas, casas decimais corretas, números como números e não texto, cabeçalho sóbrio, autofiltros, congelar cabeçalho, larguras apropriadas e múltiplas abas quando útil. Aba `Metodologia e fontes` com fonte, data-base, hora de atualização, premissas, modelo e ressalvas. Testar compatibilidade Excel; prevenir CSV/XLSX formula injection e conteúdo não confiável. Escolher biblioteca XLSX mantida, verificar licença e segurança. **Não implementar exportação de imagens**.

## 10. Design e navegação

**Direção:** Notion-inspired, limpo, discreto, elegante, premium, tipografia Inter ou equivalente bem mantida, cores neutras (branco/cinza/preto), verde/vermelho apenas para sinais necessários; contraste acessível. Modo claro e modo escuro, preferência persistente, respeitar modo do sistema. **Páginas separadas**: `Visão geral`, `Screener/Rankings`, `Empresa`, `Valuation/Premissas`, `Carteiras`, `Simulador/Backtest`, `Metodologia`. Homepage com resumo e atalhos; **nunca um único dashboard abarrotado**. Menus claros, navegação acessível, estados vazios e dados ausentes honestos.

CSS moderno e Tailwind com tokens de tema, tipografia, espaçamento, borda, raio, sombra e animação. Efeito de **vidro fosco translúcido tipo iPhone** em poucos menus/barras/overlays (`backdrop-filter`, alpha, bordas suaves), com fallback sólido. Conteúdo analítico/tabelas/gráficos com superfícies legíveis e preferencialmente opacas. Transições curtas por `opacity`/`transform`, evitando dependências pesadas, ruído visual, blur excessivo, gradientes chamativos e movimentos constantes. Acessibilidade: `prefers-reduced-motion`, foco visível, contraste, teclado, responsividade e performance no iPhone.

## 11. Arquitetura técnica e limites de domínio

**Decisão:** monólito modular com pipeline batch, frontend estático e dados processados. Backend/API persistente, autenticação e banco multiusuário ficam para o futuro se houver necessidade concreta. Por ora, preferências/carteiras podem ser salvas localmente com export/import; não sincronizam entre dispositivos nem sobrevivem necessariamente à limpeza do navegador.

**Stack pretendida, sujeita à revisão de versões/licenças antes de instalar:**
- Frontend: React + TypeScript estrito + Vite + Tailwind CSS; shadcn/ui + Radix para componentes acessíveis; ECharts para gráficos financeiros; roteador leve; CSS nativo para animação.
- Cálculo e ETL: Python + Pandas + NumPy + Pydantic; DuckDB e Parquet internos; JSON versionado e enxuto para o navegador.
- Hospedagem/build: GitHub Pages e GitHub Actions; configuração correta do `base` no Vite para repositório de projeto.
- Qualidade: pytest, Vitest, Playwright, Ruff, ESLint, formatador, lockfiles, Dependabot, CI, versões fixadas e `permissions` mínimos nos workflows.
- Não começar com Kubernetes, microserviços, SSR/server Next.js, Supabase, PostgreSQL ou FastAPI sem requisitos que justifiquem manutenção adicional.

### Estrutura de diretórios

```text
moat-analytics/
├── README.md
├── AGENTS.md
├── docs/
│   ├── SPEC.md
│   ├── DECISIONS.md
│   ├── DATA_SOURCES.md
│   ├── METHODOLOGY.md
│   └── CHANGELOG.md
├── apps/
│   ├── web/
│   │   ├── public/
│   │   └── src/
│   │       ├── app/                 # router, layout, providers
│   │       ├── features/
│   │       │   ├── dashboard/
│   │       │   ├── screener/
│   │       │   ├── company/
│   │       │   ├── ranking/
│   │       │   ├── valuation/
│   │       │   ├── assumptions/
│   │       │   ├── portfolio/
│   │       │   └── backtest/
│   │       ├── shared/             # ui, charts, data-client, types
│   │       └── styles/
│   └── pipeline/                   # coleta, normalização, publicação
├── packages/
│   ├── finance-core/               # lógica financeira canônica
│   └── data-contracts/             # esquemas compartilhados
├── data/
│   ├── raw/                        # não publicar material restrito
│   ├── processed/                  # parquet interno
│   └── public/                     # snapshots JSON permitidos
├── tests/                           # integração e fixtures
└── .github/workflows/
```

**Contrato:** cada domínio tem API pública; não permitir importações arbitrárias de detalhes internos. Fontes de dados implementam interfaces trocáveis; ranking não lê arquivos CSV brutos; páginas não reinventam ROIC, séries de retorno ou valuation. Para interações de valuation no navegador, usar biblioteca TypeScript testada com *fixtures* provenientes do motor Python, garantindo paridade numérica ou expondo claramente limites de arredondamento. Definir `schemaVersion` e migrar contratos quando mudarem.

### Exemplo de contratos de dados (orientativo)

```ts
export type QualityStatus = 'validated' | 'estimated' | 'unavailable';
export interface DataProvenance {
  source: string;
  referenceDate: string;
  publishedAt?: string;
  retrievedAt: string;
  methodologyVersion: string;
  qualityStatus: QualityStatus;
}
export interface Company {
  companyId: string;  // ID estável CVM/CNPJ
  name: string;
  sector: string | null;
  representativeTicker: string | null;
  indexMemberships: Array<'IBOV'|'SMLL'|'IDIV'>;
}
export interface FundamentalAnnual {
  companyId: string;
  fiscalYear: number;
  nopat?: number | null;
  investedCapitalAverage?: number | null;
  roic?: number | null;
  roe?: number | null;
  riskFree10y?: number | null;
  spreadTo10y?: number | null;
  provenance: DataProvenance;
}
export interface MarketClose {
  ticker: string;
  tradeDate: string;
  close: number;
  currency: 'BRL';
  provenance: DataProvenance;
}
```

## 12. Testes, segurança, critérios de publicação

- Testes unitários das fórmulas com exemplos manuais revisados, zero/ausência/negativos, comparabilidade de períodos, impostos e reconciliação; teste de contratos API/JSON; snapshots de preço e data; testes UI claros/escuros e responsivos; export XLSX sem injeção.
- Automatizar build, lint, typecheck e testes; deploy somente após aprovação. GitHub Actions com permissões mínimas; secrets fora de commits/assets estáticos, validação de entradas e checagem de dependências. Não publicar dados restritos em um repositório/site públicos.
- Manter arquivo válido anterior quando coleta falhar, métricas de frescor/cobertura, logging e possibilidade de rollback.
- Verificar licenças antes de qualquer distribuição pública de dados financeiros, mesmo quando a coleta é tecnicamente possível.
- Todos os números exibidos devem ser reais com proveniência, ou visivelmente rotulados `Demonstração — dados fictícios`, ou indisponíveis.
- Interface sem credenciais ou backends ocultos. Não assumir que GitHub Pages executa Python: Python executa no CI/batch, e o browser consome JSON estático.

## 13. Plano por marcos e definição de pronto

| Marco | Meta | Critério de aceite |
|---|---|---|
| M0 — Fundação e site no ar | Repositório, Vite/React/TS, CSS/tema, rotas/páginas separadas, GitHub Pages, CI | URL abre, navegação real, tema persiste, sem erros de build, sem dados inventados |
| M1 — Dados e prova de conceito | CVM para amostra industrial/varejo/banco, índice/ticker, históricos e curva 10a | Contas mapeadas com proveniência e conciliações; falhas explícitas |
| M2 — Qualidade | ROIC/ROE, spreads, séries, percentis, ranking | Fixtures revisadas, período correto, filtros 5/10/20/30/40/50 |
| M3 — Preço | Fechamento diário, EV, yields | Timestamp, fallback seguro e direitos de fonte validados |
| M4 — Valuation | DCF/DDM e editor de premissas | Resultados coerentes, sensitividade, nominal/real validado |
| M5 — Carteiras e backtest | Composição/pesos, proventos, risco, benchmarks e 2 modos de histórico | Sem uso de informação futura; métricas e limites explícitos |
| M6 — Export e homologação | XLSX profissional, testes E2E, segurança, documentação | Arquivos abrem corretamente; regressões verificadas |

### DoD por etapa

1. Código funcional, modular e testado; sem warnings críticos.
2. Fonte, versão, premissas e datas visíveis.
3. Loading, erro, vazio e ausência de dados tratados.
4. Tema claro/escuro, desktop/mobile, acessibilidade.
5. Teste unitário ou integração cobrindo a regra principal.
6. Documento `CHANGELOG.md` e `DECISIONS.md` atualizados.
7. Nenhum escopo futuro apresentado como concluído.

### Riscos bloqueantes

- Licença pública de cotações, proventos e composições de índices; cobertura histórica insuficiente; qualidade do mapeamento contábil CVM; curva histórica de juros de 10 anos; dados para universo histórico/deslistagens; limitação de armazenamento/tráfego no Pages; divergência de cálculos Python/TS; fonte de preços indisponível. Registrar decisão e fallback em vez de ocultar o problema.

## 14. Regras de trabalho com Codex

- Ler todo este documento antes de alterar arquitetura ou dependências.
- Inspecionar primeiro o repositório, arquivos e configurações existentes; **não sobrescrever trabalho preexistente**. Se a pasta estiver vazia, criar o projeto gradualmente.
- Preferir soluções simples e maduras. Não adicionar tecnologias, endpoints e serviços desnecessários.
- Implementar marcos com commits pequenos e verificáveis. Não juntar dashboard inteiro numa tela; páginas por módulo.
- Não executar scraping proibido, não publicar chaves nem buscar contornar licenças.
- Para dados faltantes, mostrar mensagem explícita e indicação de fonte esperada, nunca preencher silenciosamente com números de exemplo.
- Ao concluir cada marco, informar arquivos alterados, comandos de teste executados e resultado, riscos pendentes e próxima etapa.
- **Início solicitado:** começar pelo **M0** e publicar uma base funcional. Prosseguir em marcos posteriores somente quando a base estiver estável e os dados necessários forem validados.

## 15. Referências de acompanhamento

- [Projeto e requisitos no Todoist](https://app.todoist.com/app/task/6j3CC2J6wg5VXrCJ)
- [Primeira sessão de implementação no Todoist](https://app.todoist.com/app/task/6j3CHHJM38rp4rMr)

**Nota final:** a especificação tem escopo abrangente, mas a arquitetura deve permitir incorporar cada domínio independentemente. O maior risco não é a implementação visual; é atribuir confiabilidade excessiva a dados e backtests não auditados.
