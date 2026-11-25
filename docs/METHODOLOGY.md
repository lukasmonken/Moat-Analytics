# Metodologia

## Contas CVM na prova de conceito

A amostra do M1 usa os DFP anuais consolidados de WEG, Lojas Renner e Itaú Unibanco de 2021 a 2025. São três perfis contábeis conhecidos, com seleção pelo código CVM. Os campos do ativo, passivo, patrimônio e resultado provêm das linhas mapeadas de cada formulário. As conciliações confrontam totais com as contas que os compõem, respeitando a escala declarada. A interface mostra o valor em BRL, o formulário e o código de conta de origem.

Os registros usam a versão anual disponível no arquivo coletado. Uma reapresentação pode alterar o resultado para a mesma data-base. A data de recebimento e a versão ficam visíveis. O instante em que o documento se tornou público permanece desconhecido quando a fonte oferece apenas a data de recebimento. O lote serve à revisão de contas. Uma reconstrução histórica exigirá versões anteriores e a verificação do momento de publicação de cada registro.

## Séries de qualidade da amostra

A amostra inicial do M2 cobre WEG, Lojas Renner e Itaú Unibanco de 2021 a 2025. Usa a versão mais recente disponível da DFP anual consolidada. A abertura vem da coluna comparativa do mesmo formulário. Assim, o exercício de 2021 inclui o balanço de 2020 e o de 2023 do Itaú incorpora a reapresentação de seu saldo comparativo. Cada exercício mantém o hash do ZIP, a versão, a referência e as contas usadas.

- **ROIC estimado de WEG e Renner.** O numerador aplica 34% ao resultado de referência antes do financeiro e dos tributos da DRE (`3.05`). A alíquota é uma premissa padronizada baseada nas alíquotas marginais gerais de IRPJ e CSLL, inclusive o adicional de IRPJ. O EBIT informado pode conter efeitos não recorrentes e equivalência patrimonial. A estimativa usa o PL consolidado, os financiamentos e os arrendamentos declarados fora da conta de financiamentos. Caixa e equivalentes totais aproximam o caixa excedente. O denominador é a média do capital estimado na abertura e no encerramento. [IRPJ](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/IRPJ) · [CSLL](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/CSLL)
- **ROE do Itaú.** O numerador é o lucro atribuível à controladora (`3.09.01`). O patrimônio do mesmo grupo corresponde ao saldo consolidado (`2.08`) menos a participação dos não controladores (`2.08.09`), calculado nos dois balanços. A média desses saldos é o denominador.
- **Série anual.** A variação entre exercícios consecutivos é expressa em pontos percentuais. As estatísticas usam as observações disponíveis e apresentam média, mediana, desvio-padrão populacional, amplitude e tendência linear em p.p. por ano. Ausências permanecem identificadas.

## Comparação de ROE entre bancos

Em **Dados complementares**, o painel do piloto bancário reúne Itaú Unibanco, Banco do Brasil, Banrisul, Bradesco e Santander. Cada banco com cinco exercícios completos de 2021 a 2025 integra a amostra com a média aritmética de seu ROE atribuível à controladora. O percentil usa a posição da média em ordem crescente, escalada de 0 a 100 entre os extremos e com posto médio nos empates. O cálculo exige pelo menos cinco bancos no grupo.

Banco do Brasil, Banrisul, Bradesco e Santander informam o lucro da controladora em `3.11.01` e seu patrimônio em `2.07.01`. O Itaú usa o mapeamento acima. A abertura de cada exercício vem do comparativo da mesma versão da DFP. No Santander de 2022, a linha de lucro dos não controladores na DRE estruturada diverge R$ 54 mil da conciliação. O lote preserva os registros e verifica a atribuição do lucro no demonstrativo IFRS auditado e na DMPL da DFP versão 2. O lucro atribuível à controladora coincide nessas fontes. [DFs IFRS de 2022 do Santander](https://cms.santander.com.br/sites/WRI/documentos/url-dfs-ifrs-4T22/23-02-28_185641_dfs%2520ifrs%25204t22.pdf)

## Comparativos setoriais da seleção anual

A lista de Empresas reúne os nomes oficiais da seleção anual e os setores declarados no FCA. Cada companhia tem um indicador de qualidade. Bancos e seguradoras usam ROE, inclusive os grupos com atividade bancária ou de seguros. As demais companhias usam ROIC estimado. A junção usa código CVM e versão do formulário conferidos na data-base da seleção. A companhia permanece na lista quando seu indicador não está disponível no exercício. [Catálogo FCA](https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca)

Na seleção de 18/11/2026, o ROE abrange 14 companhias. São os nove emissores no setor Bancos do FCA, a BR Partners como grupo bancário e BB Seguridade, Caixa Seguridade, IRB Brasil Resseguros e Porto Seguro como grupos de seguros ou resseguros. [DFs da BR Partners](https://www.sec.gov/Archives/edgar/data/2058601/000121390026012754/ea027565201ex99-1_brbi.htm) · [Estrutura da BB Seguridade](https://www.bbseguridaderi.com.br/a-bb-seguridade/estrutura-societaria) · [Estrutura da Caixa Seguridade](https://www.ri.caixaseguridade.com.br/a-companhia/estrutura-societaria-2/)

O ROIC estimado é o indicador das outras 130 companhias, incluindo Qualicorp, com atividades de corretagem e administração de planos, e Itaúsa, com participações em vários setores. [Perfil da Qualicorp](https://ri.qualicorp.com.br/quali/perfil-corporativo/) · [Atuação da Itaúsa](https://ri.itausa.com.br/servicos-aos-investidores/perguntas-frequentes/)

O ROE de cada exercício divide o lucro atribuível à controladora pelo patrimônio líquido médio da controladora. A série de 2021 a 2025 usa exercícios completos de janeiro a dezembro e saldos de abertura e encerramento da mesma versão da DFP consolidada. O cálculo normaliza as contas em BRL, confere sua classificação e concilia o resultado e o patrimônio com as parcelas atribuíveis aos controladores e não controladores. Abertura e encerramento precisam ser positivos. [Catálogo DFP](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp)

Quando a atribuição de lucro na DRE diverge do total consolidado, a rotina pode usar a DMPL da mesma versão da DFP. A linha de lucro da DMPL precisa conciliar controladora e não controladores e confirmar o mesmo total consolidado da DRE. O valor da controladora na DRE precisa coincidir com o da DMPL ou as duas parcelas na DRE precisam estar zeradas. O comparativo identifica a demonstração e a conta do lucro. A evidência auditada do Santander de 2022 conserva o vínculo com o documento de apoio.

Cada lacuna informa o motivo, como período diferente de 31/12, falta de consolidado ou ausência de conciliação. A comparação usa dados contábeis e a seleção anual atual. O ranking composto, preços correntes e spreads históricos dependem das fontes descritas nesta metodologia.

A opção **Comparar histórico** exibe os exercícios de duas companhias que usam o mesmo indicador. Os valores indisponíveis aparecem no exercício correspondente. A exportação em Excel registra o exercício selecionado e as contas usadas para todo o recorte escolhido.

## ROIC estimado da seleção anual

O ROIC estimado usa DFPs consolidadas de janeiro a dezembro de 2021 a 2025, com saldos de abertura e fechamento da mesma versão. Cada observação válida mostra as principais contas e o formulário. [Catálogo DFP da CVM](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp)

O NOPAT estimado é o EBIT conciliado multiplicado por `1 − 34%`. O EBIT parte do resultado contábil antes do financeiro e dos tributos e é conferido com os subtotais do resultado bruto e operacional. O capital de abertura e o de encerramento usam patrimônio consolidado, dívida onerosa e arrendamentos identificados, menos caixa e equivalentes como aproximação de caixa excedente. O ROIC estimado divide o NOPAT pela média dos dois capitais positivos. [CPC 06 (R2) sobre arrendamentos](https://conteudo.cvm.gov.br/legislacao/resolucoes/resol095.html)

Um arrendamento incluído em empréstimos e financiamentos entra uma vez. Uma conta de arrendamento apresentada à parte entra quando a descrição contábil identifica o passivo e os subtotais do mesmo balanço conciliam. Obrigações com fornecedores, cessões de recebíveis e compras a prazo podem exigir revisão das notas do emissor.

Em 2025, as notas de Ambev, B3 e Tupy detalham arrendamentos já incluídos nos financiamentos. A conciliação confere os subtotais de curto e longo prazo da abertura e do fechamento na versão correta da DFP. O comparativo preserva os saldos estruturados e mostra o detalhamento auditado na tela e no Excel. A nota da Ambev apresenta os arrendamentos em milhões de reais. [Ambev, nota 23](https://www.sec.gov/Archives/edgar/data/1565025/000129281426000640/abevform20f_2025.htm) · [B3, nota 9](https://vipfiles.valor.com.br/BDEmpresas/bfc245c3-7342-4b02-a2ff-96206f033415.pdf) · [Tupy, nota 17](https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=155493)

As revisões de passivos separados em 2025 incluem obrigações financeiras de ALLOS, Energisa, MAHLE e OceanPact e contas operacionais de Embraer, EcoRodovias, Telefônica, Tupy e Vivara. A classificação exige a descrição, a conciliação dos saldos de abertura e fechamento e o vínculo com a versão e o documento revisados. Em Vivara, o saldo de despesas variáveis e condomínio fica separado dos arrendamentos de direito de uso. Em Telefônica, a provisão para multas de cancelamento fica separada dos arrendamentos incluídos em financiamentos.

Os valores revistos de risco sacado da Gerdau ficam como fornecedores operacionais, com prazos originais e custo financeiro do fornecedor. As debêntures participativas identificadas no passivo da Vale entram no capital investido. Os saldos de concessões ferroviárias da Vale se referem aos direitos de operação. [Notas anuais da Gerdau](https://www.sec.gov/Archives/edgar/data/1073404/000110465926027678/ggb-20251231x20f.htm) · [Notas anuais da Vale](https://www.sec.gov/Archives/edgar/data/917851/000129281426001844/valeform20f_2025.htm)

A Suzano inclui obrigações de aquisição com juros ou atualização monetária nos exercícios de 2021, 2024 e 2025, conforme a nota 23 e os saldos da DFP. Em 2025, a Klabin inclui o risco sacado florestal, cujos juros contratuais são despesa financeira, e mantém o risco sacado comum em fornecedores operacionais. [Suzano 2021](https://www.sec.gov/Archives/edgar/data/909327/000110465922053794/suz-20211231x20f.htm) · [Suzano 2024](https://www.sec.gov/Archives/edgar/data/909327/000162828025020368/suz-20241231.htm) · [Suzano 2025](https://www.sec.gov/Archives/edgar/data/909327/000090932726000022/suz-20251231.htm) · [Klabin 2025](https://api.mziq.com/mzfilemanager/v2/d/1c41fa99-efe7-4e72-81dd-5b571f5aa376/fcad7df5-9607-78ed-3455-ffa6e0470211?origin=2)

Empresas mostra o EBIT, o NOPAT e as contas de patrimônio, dívida, arrendamentos e caixa usadas nos balanços. Classificação de passivos pendente, contas ausentes ou uma conciliação divergente deixam o ROIC do exercício indisponível.

Na Ferbasa, a revisão tornou indisponíveis as estimativas de 2021 a 2025 enquanto a obrigação de R$ 4.978.000 pela aquisição de controlada aguarda classificação nas contas de capital. [DFP de 2025 da Ferbasa](https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=155153)

## CDI atual

O CDI nominal anualizado em base de 252 dias úteis serve como taxa livre de risco provisória. Empresas e Valuation e Premissas exibem a última observação publicada pelo Banco Central (SGS 4389) com sua data-base. A página Empresas mostra a diferença entre o ROIC ou ROE do exercício mais recente e o CDI atual. Em pontos percentuais, a diferença é `(ROIC ou ROE − CDI anualizado) × 100`, com as taxas em fração. O exercício contábil e a data do CDI são identificados separadamente. [Série SGS 4389](https://www3.bcb.gov.br/sgspub/consultarmetadados/consultarMetadadosSeries.do?hdOidSerieSelecionada=4389&method=consultarMetadadosSeriesInternet)

A lista de Empresas exibe essa diferença apenas no último exercício comum da seleção. Quando o retorno ou o CDI está indisponível, a diferença também fica indisponível.

Os spreads históricos e o ranking composto dependem de uma série nominal de prazo constante com datas e direitos de uso verificados. A publicação mensal da SUSEP tem uma mudança de modelo para a curva prefixada em 2022. [Parâmetros SUSEP e ANBIMA de 2016 a 2021](https://www.gov.br/susep/pt-br/assuntos/informacoes-ao-mercado/solvencia-supervisao-prudencial/monitoramento-prudencial/capital-minimo-requerido-e-tap/modelo-de-interpolacao-e-extrapolacao-da-ettj-1) · [Metodologia e parâmetros atuais](https://www.gov.br/susep/pt-br/assuntos/informacoes-ao-mercado/solvencia-supervisao-prudencial/monitoramento-prudencial/capital-minimo-requerido-e-tap/modelo-de-interpolacao-e-extrapolacao-da-ettj)

## Resultados dos últimos 12 meses e preço

A amostra encerra os 12 meses em 30/09/2026. O cálculo soma o resultado de todo o exercício de 2025 ao acumulado de janeiro a setembro de 2026 e subtrai o acumulado equivalente de 2025. Os dois períodos de nove meses vêm da mesma versão do ITR consolidado de 2026. O cálculo usa contas conciliadas e preserva datas, versões e fontes. [Catálogo DFP](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp) · [Catálogo ITR](https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr)

Para WEG e Lojas Renner, o NOPAT estimado usa o resultado antes do financeiro e dos tributos da DRE (`3.05`) e aplica alíquota padronizada de 34%. Para Itaú Unibanco, o resultado de 12 meses é o lucro líquido atribuível à controladora (`3.09.01`).

O rendimento implícito de mercado usa NOPAT dividido pelo valor da firma (EV) nas não financeiras e lucro da controladora de 12 meses dividido pela capitalização nos bancos. A capitalização soma o valor de cada classe multiplicado pelas suas ações fora da tesouraria válidas na mesma data. O EV soma à capitalização a dívida líquida e os ajustes pertinentes. A WEG tinha 4.195.829.691 ações ordinárias fora da tesouraria em 30/09/2026. A contagem exata de Lojas Renner permanece indisponível porque o ITR registra a quantidade em milhares. [ITR da WEG](https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=161774) · [ITR de Lojas Renner](https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=162059)

Em 30/09/2026, a dívida líquida simplificada era de −R$ 937.479.000 na WEG e de R$ 2.074.041.000 em Lojas Renner. O cálculo soma financiamentos e arrendamentos IFRS 16 registrados separadamente e deduz caixa e equivalentes. As aplicações financeiras circulantes são apresentadas à parte. Aplicações não circulantes, derivativos e participações societárias ficam fora dos ajustes. O patrimônio contábil dos não controladores serve como aproximação para o EV. O balanço consolidado de Lojas Renner inclui a Realize, braço de serviços financeiros do grupo. [ITR da WEG](https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=161774) · [ITR de Lojas Renner](https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=162059)

O ponto retrospectivo de Itaú em 30/09/2026 usa os valores unitários de mercado do último dia da data-base e as quantidades da Nota 19 do demonstrativo IFRS. O cálculo soma 5.617.742.977 ações ordinárias a R$ 48,47 e 5.404.282.925 preferenciais a R$ 44,28, ambas líquidas de tesouraria, para chegar a R$ 511.593.650.014,19 de capitalização. O lucro de 12 meses atribuível à controladora de R$ 47.749.000.000 gera um rendimento implícito de 9,33%. As demonstrações foram divulgadas depois da data-base. Este ponto isolado serve à leitura retrospectiva e fica fora do rendimento corrente, da diferença para o CDI atual e das simulações históricas de investimento. [Nota 19 do Itaú no EDGAR](https://www.sec.gov/Archives/edgar/data/1132597/000113259726000279/condensedconsolidatedfin.htm) · [ITR do Itaú na CVM](https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=161944)

Os fechamentos importados localmente exibem a data do pregão, a coleta e a fonte. Uma observação anterior ao pregão de referência do lote aparece como defasada. O cálculo do rendimento atual e de sua diferença em pontos percentuais para o CDI requer entradas de mercado verificadas.

## Valuation e premissas

Os cenários usam valores e taxas nominais. O DCF calcula EBIT como receita vezes margem EBIT, aplica a alíquota informada e soma depreciação e amortização ao NOPAT. O CAPEX e o aumento do capital de giro consomem caixa. No DDM, dividendos projetados são o lucro atribuível aos acionistas vezes o payout de cada ano. Previsões de payout e adequação ao capital regulatório ficam a cargo das premissas do usuário.

Os fluxos dos dez anos são descontados a partir do fim de cada ano. A perpetuidade usa o fluxo do último ano multiplicado por (1 + g) e dividido pela diferença entre a taxa de desconto e o crescimento terminal (g). O cálculo exige desconto maior que crescimento, crescimento acima de −100% e fluxo terminal não negativo. O valor do patrimônio no DCF deduz dívida líquida do valor da firma e soma os demais ajustes com o sinal informado. O DDM estima diretamente o patrimônio. A divisão pelo número total de ações produz um valor médio por ação quando existem classes com direitos distintos.

O preço informado permite calcular potencial como valor estimado dividido pelo preço menos um. A margem de segurança é um menos o preço dividido pelo valor estimado e requer valor estimado positivo. Uma matriz varia desconto e crescimento em um ponto percentual de cada lado das premissas. Combinações que violam a condição da perpetuidade ficam indisponíveis.

O desconto parte de WACC ou custo de capital próprio informados. O CDI anualizado, com fonte e data no módulo, pode ser aplicado como cenário alternativo e pode superestimar valor. As referências da CVM de dívida, ajustes e ações são opcionais e datadas. O editor começa com projeções em branco.

## Carteiras e retrospectiva mensal

A carteira é montada pelos nomes oficiais do diretório da CVM e salva neste navegador. A seleção começa com 10 posições e permite 15, 20 ou um tamanho personalizado de 1 a 50. Os pesos iguais dividem a carteira em unidades de 0,0001 ponto percentual e distribuem o restante entre as primeiras posições. Os pesos personalizados usam a mesma precisão, devem ser positivos e somar exatamente 100%. O limite opcional por companhia se aplica aos pesos-alvo. Limites setoriais e seleção por ranking aguardam dados próprios.

Em Carteiras, **Exportar carteira em JSON** cria uma cópia editável da composição, dos pesos e dos parâmetros válidos no formulário. **Importar carteira em JSON** lê o arquivo local e exige os nomes exatos da seleção atual da CVM. Revise os campos importados e use **Salvar carteira** para aplicar a composição ao simulador. As séries de retorno total são carregadas em separado no Simulador.

O simulador retrospectivo aplica a seleção atual a séries mensais de retorno total em reais. O arquivo JSON fornecido pelo usuário é lido no navegador. O aplicativo verifica estrutura e cobertura. A identificação da classe, a origem dos níveis e os ajustes para proventos e eventos societários dependem da fonte declarada. Cada posição exige um nível positivo por mês e as datas de pregão precisam coincidir entre todas as posições. A janela precisa ser contínua. O período desde o início do ano usa dezembro do ano anterior como base. As demais opções cobrem dois a sete anos ou um intervalo personalizado de 1 a 600 meses.

### Formato do arquivo local

| Campo                     | Conteúdo                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion` e `basis` | Literais `"1.0.0"` e `"total-return-brl"`.                                                                                                                                                        |
| `source`                  | `name`, `retrievedAt` em ISO 8601 com fuso e `methodology` com a descrição da série. O campo `url` HTTPS é opcional.                                                                              |
| `assets`                  | Cada série contém `company` com o nome oficial exato, `instrument` com o código do ativo e `observations` com objetos `{ date, level }`. A data usa `AAAA-MM-DD` e o nível é numérico e positivo. |
| `benchmarks`              | Lista opcional de séries com `symbol` igual a `IBOV`, `IDIV` ou `SMAL11` e `observations` no mesmo formato.                                                                                       |

O arquivo tem limite de 2 MiB. A série precisa incluir a observação inicial e todas as observações mensais seguintes da janela. O nível de cada mês representa a evolução de uma série com reinvestimento incorporado. O simulador aplica a razão entre dois níveis consecutivos para atualizar a posição.

### Fluxos, custos e métricas

O capital inicial e cada aporte bruto são alocados segundo os pesos-alvo após o custo de compra informado. Esse custo é a taxa por operação aplicada ao valor bruto que entra. A cada mês, o simulador atualiza as posições pela variação de seus níveis e depois registra o aporte. Com rebalanceamento mensal, calcula a soma das diferenças absolutas entre o valor de cada posição e seu alvo após o aporte. Aplica a taxa de custo a esse giro estimado e redistribui o saldo líquido pelos pesos-alvo. O período final recebe o aporte e seu custo de compra, sem rebalanceamento adicional.

O tributo hipotético é a alíquota informada sobre a parcela positiva do ganho ao final, após os custos de transação. O ganho antes de tributo é o patrimônio final menos o capital inicial e os aportes. O patrimônio e o lucro líquidos descontam esse tributo ao final. As posições remanescentes são avaliadas pelo último nível disponível, sem custo de liquidação.

A contribuição por ativo soma as variações de mercado em reais dos saldos de abertura de cada mês e deduz os custos atribuídos à posição. A compra inicial e os aportes distribuem seus custos pelos pesos-alvo. O rebalanceamento atribui custos conforme o giro de cada posição. A soma dessas contribuições corresponde ao ganho antes do tributo da carteira. A participação de cada posição no patrimônio final antes do tributo forma o peso final. O maior peso indica a concentração da carteira ao encerrar a janela.

A correlação de Pearson usa a variação percentual entre níveis mensais consecutivos dos ativos. Todos os pares usam a mesma janela da retrospectiva. O coeficiente vai de −1 a +1 e fica indisponível com menos de três retornos ou sem variação em uma das séries.

O retorno ponderado pelo tempo encadeia as variações mensais após custos de transação, retirando o aporte bruto da variação do mês e incorporando o custo de compra inicial. A série mensal e as métricas de retorno e risco são calculadas antes do tributo final. O retorno por ano agrupa os fatores mensais pelo ano de encerramento do período, com o custo inicial no primeiro grupo e indicação de meses cobertos. O CAGR anualiza o retorno pelo número de dias corridos dividido por 365,2425. A volatilidade usa o desvio-padrão amostral dos retornos mensais multiplicado pela raiz de 12 e exige ao menos dois retornos mensais. O drawdown mede a queda em relação ao pico anterior da série mensal de retorno acumulado, com pico inicial antes do custo da primeira compra.

O retorno total e o CAGR de IBOV, IDIV e SMAL11 usam os níveis declarados no arquivo para as mesmas datas da carteira. Custos e tributo parametrizados se aplicam à carteira simulada. O Sharpe aguarda uma série histórica de taxa livre de risco alinhada a cada mês.

A retrospectiva está sujeita ao viés da seleção atual. A modalidade historicamente investível aguarda dados que permitam reconstruir o universo, as empresas deslistadas, o ranking e as informações disponíveis em cada decisão. [Fontes e premissas de cobertura](DATA_SOURCES.md#séries-para-a-retrospectiva)

## Métricas e modelos previstos

Os próximos marcos da [especificação](SPEC.md#13-plano-por-marcos-e-definição-de-pronto) detalham as métricas e os modelos abaixo.

| Domínio             | Método previsto                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Universo            | União das carteiras de IBOV, SMLL e IDIV na data-base do recorte anual. Uma linha por companhia brasileira, com todas as afiliações e as classes presentes na composição. A classe mais líquida requer dados de volume.                                                                                |
| Qualidade           | ROE com lucro atribuível e patrimônio líquido médio da controladora para bancos e seguradoras. ROIC estimado com NOPAT e capital investido médio para as demais companhias. Série de ao menos cinco exercícios quando disponível.                                                                      |
| Spread de qualidade | Diferença em pontos percentuais entre ROIC ou ROE e a referência prefixada brasileira de aproximadamente dez anos, alinhada à janela histórica do exercício.                                                                                                                                           |
| Preço               | Rendimento operacional implícito pelo NOPAT TTM sobre o EV de mercado para não financeiras ou pelo lucro líquido TTM sobre a capitalização de mercado para bancos. Usar o fechamento do último pregão válido.                                                                                          |
| Ranking             | Comparar nível de retorno, spread, estabilidade, preço e crescimento ou reinvestimento com pares adequados. Divulgar critérios, pesos e exclusões.                                                                                                                                                     |
| Valuation           | DCF de fluxo de caixa livre para a firma em não financeiras e DDM para bancos. Projetar cenários com premissas editáveis e taxas de desconto adequadas a cada modelo.                                                                                                                                  |
| Backtest            | Identificar a retrospectiva de uma carteira escolhida hoje. Na simulação historicamente investível, reconstruir o universo e usar as informações que eram públicas em cada decisão. Calcular os retornos com séries que tratam proventos, eventos corporativos e deslistagens quando houver cobertura. |

A referência pública de dez anos é um custo de oportunidade. O desconto de valuation considera o risco e a estrutura do modelo. A avaliação de uma vantagem competitiva duradoura exige também análise qualitativa.

As fórmulas, os ajustes contábeis, a composição do universo e as condições de comparabilidade estão nas seções 2 a 8 da [especificação](SPEC.md). As fontes candidatas e suas pendências estão em [Fontes de dados](DATA_SOURCES.md).
