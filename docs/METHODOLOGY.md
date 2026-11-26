# Metodologia

## Contas CVM na prova de conceito

A amostra do M1 usa os DFP anuais consolidados de WEG, Lojas Renner e Itaú Unibanco de 2021 a 2025. São três perfis contábeis conhecidos, com seleção pelo código CVM. Os campos do ativo, passivo, patrimônio e resultado provêm das linhas mapeadas de cada formulário. As conciliações confrontam totais com as contas que os compõem, respeitando a escala declarada. A interface mostra o valor em BRL, o formulário e o código de conta de origem.

Os registros usam a versão anual disponível no arquivo coletado. Uma reapresentação pode alterar o resultado para a mesma data-base. A data de recebimento e a versão ficam visíveis. O instante em que o documento se tornou público permanece desconhecido quando a fonte oferece apenas a data de recebimento. O lote serve à revisão de contas. Uma reconstrução histórica exigirá versões anteriores e a verificação do momento de publicação de cada registro.

## Séries de qualidade da amostra

A amostra inicial do M2 cobre WEG, Lojas Renner e Itaú Unibanco de 2021 a 2025. Usa a versão mais recente disponível da DFP anual consolidada. A abertura vem da coluna comparativa do mesmo formulário. Assim, o exercício de 2021 inclui o balanço de 2020 e o de 2023 do Itaú incorpora a reapresentação de seu saldo comparativo. Cada exercício mantém o hash do ZIP, a versão, a referência e as contas usadas.

- **ROIC estimado de WEG e Renner.** O NOPAT usa o resultado antes do financeiro e dos tributos da DRE (`3.05`) multiplicado por `1 − 34%`. A alíquota é uma premissa padronizada baseada nas alíquotas marginais gerais de IRPJ e CSLL, inclusive o adicional de IRPJ. O EBIT informado pode conter efeitos não recorrentes e equivalência patrimonial. O capital investido usa o PL consolidado mais empréstimos e financiamentos de curto e longo prazo, menos caixa e equivalentes. O denominador é a média do capital estimado na abertura e no encerramento. [IRPJ](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/IRPJ) · [CSLL](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/CSLL)
- **ROE do Itaú.** O numerador é o lucro atribuível à controladora (`3.09.01`). O patrimônio do mesmo grupo corresponde ao saldo consolidado (`2.08`) menos a participação dos não controladores (`2.08.09`), calculado nos dois balanços. A média desses saldos é o denominador.
- **Série anual.** A variação entre exercícios consecutivos é expressa em pontos percentuais. As estatísticas usam as observações disponíveis e apresentam média, mediana, desvio-padrão populacional, amplitude e tendência linear em p.p. por ano. Ausências permanecem identificadas.

## Comparação de ROE entre bancos

Em **Dados complementares**, o painel do piloto bancário reúne Itaú Unibanco, Banco do Brasil, Banrisul, Bradesco e Santander. Cada banco com cinco exercícios completos de 2021 a 2025 integra a amostra com a média aritmética de seu ROE atribuível à controladora. O percentil usa a posição da média em ordem crescente, escalada de 0 a 100 entre os extremos e com posto médio nos empates. O cálculo exige pelo menos cinco bancos no grupo.

Banco do Brasil, Banrisul, Bradesco e Santander informam o lucro da controladora em `3.11.01` e seu patrimônio em `2.07.01`. O Itaú usa o mapeamento acima. A abertura de cada exercício vem do comparativo da mesma versão da DFP. No Santander de 2022, a linha de lucro dos não controladores na DRE estruturada diverge R$ 54 mil da conciliação. O lote preserva os registros e verifica a atribuição do lucro no demonstrativo IFRS auditado e na DMPL da DFP versão 2. O lucro atribuível à controladora coincide nessas fontes. [DFs IFRS de 2022 do Santander](https://cms.santander.com.br/sites/WRI/documentos/url-dfs-ifrs-4T22/23-02-28_185641_dfs%2520ifrs%25204t22.pdf)

## Comparativos setoriais da seleção anual

A lista de Empresas reúne os nomes oficiais da seleção anual e os setores declarados no FCA. Cada companhia tem um indicador de qualidade. Bancos e seguradoras usam ROE, inclusive os grupos com atividade bancária ou de seguros. As demais companhias usam ROIC estimado. A junção usa código CVM e versão do formulário conferidos na data-base da seleção. A companhia permanece na lista quando seu indicador não está disponível no exercício. [Catálogo FCA](https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca)

Na seleção de 18/11/2026, o ROE abrange 15 companhias. O grupo **Bancos** reúne os nove emissores no setor Bancos do FCA e a BR Partners. O grupo **Seguros e Resseguros** inclui BB Seguridade, Bradsaúde, Caixa Seguridade, IRB Brasil Resseguros e Porto Seguro. O grupo aplicado ao filtro e o setor cadastral da CVM são registrados no Excel. [DFs da BR Partners](https://www.sec.gov/Archives/edgar/data/2058601/000121390026012754/ea027565201ex99-1_brbi.htm) · [Estrutura da BB Seguridade](https://www.bbseguridaderi.com.br/a-bb-seguridade/estrutura-societaria) · [Estrutura da Caixa Seguridade](https://www.ri.caixaseguridade.com.br/a-companhia/estrutura-societaria-2/)

A Bradsaúde permanece com **Serviços médicos** no setor cadastral do FCA. O ROE histórico até 2025 usa os demonstrativos da Odontoprev. A incorporação da Bradesco Gestão de Saúde foi concluída em 30/04/2026 e a página identifica essa mudança de perímetro. [Fato relevante da Bradsaúde](https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&Tela=99&descTipo=IPE&numProtocolo=1514189&numSequencia=1038895&numVersao=1)

O ROIC estimado é o indicador das outras 129 companhias, incluindo Qualicorp, com atividades de corretagem e administração de planos, e Itaúsa, com participações em vários setores. [Perfil da Qualicorp](https://ri.qualicorp.com.br/quali/perfil-corporativo/) · [Atuação da Itaúsa](https://ri.itausa.com.br/servicos-aos-investidores/perguntas-frequentes/)

O ROE de cada exercício divide o lucro atribuível à controladora pelo patrimônio líquido médio da controladora. A série de 2021 a 2025 usa exercícios completos de janeiro a dezembro e saldos de abertura e encerramento da mesma versão da DFP consolidada. O cálculo normaliza as contas em BRL, confere sua classificação e concilia o resultado e o patrimônio com as parcelas atribuíveis aos controladores e não controladores. Abertura e encerramento precisam ser positivos. [Catálogo DFP](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp)

Quando a atribuição de lucro na DRE diverge do total consolidado, a rotina pode usar a DMPL da mesma versão da DFP. A linha de lucro da DMPL precisa conciliar controladora e não controladores e confirmar o mesmo total consolidado da DRE. O valor da controladora na DRE precisa coincidir com o da DMPL ou as duas parcelas na DRE precisam estar zeradas. O comparativo identifica a demonstração e a conta do lucro. A evidência auditada do Santander de 2022 conserva o vínculo com o documento de apoio.

O Banco ABC Brasil usa a DMPL auditada na página 18 para obter lucro e patrimônio atribuíveis no exercício de 2025. A abertura usa o saldo de 01/01/2025 após a adoção da Resolução CMN 4.966. O ZIP da CVM traz o cadastro da DFP, com os demonstrativos consolidados disponíveis no documento auditado. Linhas integralmente idênticas da DRE ou do BPP são tratadas como um único registro. [DMPL do Banco ABC](https://filemanager-cdn.mziq.com/published/6298ef6f-2b75-43f8-b2ab-99e3fe33e809/cf4c1a42-971e-42e9-8d93-507270859bec_df_banco_abc_pt_122025.pdf)

Cada lacuna informa o motivo, como período diferente de 31/12, falta de consolidado ou ausência de conciliação. A comparação usa dados contábeis e a seleção anual atual. O ranking composto, preços correntes e spreads históricos dependem das fontes descritas nesta metodologia.

A opção **Comparar histórico** exibe os exercícios de duas companhias que usam o mesmo indicador. Os valores indisponíveis aparecem no exercício correspondente. A exportação em Excel registra o exercício selecionado e as contas usadas para todo o recorte escolhido.

## ROIC estimado da seleção anual

O ROIC estimado usa DFPs consolidadas de janeiro a dezembro de 2021 a 2025, com saldos de abertura e fechamento da mesma versão. Uma DFP individual auditada cobre a companhia inteira quando a própria empresa declara ausência de subsidiárias. Para 2025, a Sanepar e a TIM têm a base individual auditada identificada. Cada observação válida mostra as principais contas e o formulário. [Catálogo DFP da CVM](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp) · [DFP de 2025 da Sanepar](https://ri.sanepar.com.br/docs/DFP-Sanepar-2025-12-31-BjdwmKcn.pdf) · [Demonstrações de 2025 da TIM](https://api.mziq.com/mzfilemanager/v2/d/4c4aa51f-1235-4aa1-8b83-adc92e8dacc3/197553f9-c229-4f09-b201-bcf48f2026d6?origin=2)

O NOPAT estimado é o EBIT conciliado multiplicado por `1 − 34%`. O EBIT usa o resultado antes do financeiro e dos tributos (DRE `3.05`). O ROIC divide o NOPAT pela média do capital investido na abertura e no fechamento do exercício.

Em cada balanço, o capital investido é `patrimônio líquido + empréstimos e financiamentos − caixa e equivalentes`. O cálculo usa o patrimônio (`2.03`), os totais publicados de dívida de curto (`2.01.04`) e longo prazo (`2.02.01`) e o caixa (`1.01.01`). Arrendamentos entram quando já fazem parte dos totais de financiamento. A metodologia `roic-dfp-comparisons.v2` aplica essa regra a todos os exercícios da série.

Empresas e o Excel mostram as contas e o formulário usados. Se faltar um insumo da DFP ou algum dos dois saldos de capital investido não for positivo, o ROIC do exercício fica indisponível.

### Risco histórico e endividamento

O drawdown do ROIC é a maior queda entre um pico e um exercício posterior na janela dos últimos cinco exercícios consecutivos. Por exemplo, de 24% para 15% a queda é de 9 p.p. Uma série completa sem queda tem drawdown de 0 p.p. **Empresa muito nova** indica que a base tem menos de cinco valores na janela, e a tabela mostra quantos existem.

Dívida líquida/EBITDA estimado usa os empréstimos e financiamentos de fechamento menos caixa e equivalentes. O EBITDA soma o EBIT à depreciação e amortização identificadas na DFC do mesmo exercício. O múltiplo pode ser negativo em empresas com caixa líquido. Um EBITDA ausente ou não positivo deixa o múltiplo indisponível.

### Qualidade do reinvestimento e crescimento

O capital de giro operacional soma o saldo de contas a receber (`1.01.03`) e estoques (`1.01.04`) e deduz fornecedores (`2.01.02`). O reinvestimento soma a variação entre fechamento e abertura ao CAPEX de caixa identificado na DFC. O CAPEX usa os desembolsos de imobilizado e intangível identificados, com fontes do mesmo exercício. O indicador divide o NOPAT já disponível na base de ROIC pelo reinvestimento positivo. O site informa o diagnóstico quando o reinvestimento é zero, negativo ou indisponível.

O crescimento é o CAGR do NOPAT para o grupo de ROIC e do lucro líquido atribuível à controladora para o grupo de ROE. Usa cinco observações anuais consecutivas e quatro intervalos entre as datas. A fórmula é `(valor final / valor inicial)^(1/4) − 1`, com os dois extremos positivos. O ranking mostra os valores inicial e final junto da taxa.

Cada indicador recebe um Z-score no grupo de ROIC ou de ROE, calculado com a média e o desvio-padrão populacional dos valores disponíveis para aquele fator. Um fator constante contribui com zero. São necessárias duas empresas com dados para padronizar o fator. Rentabilidade, NOPAT/reinvestimento, crescimento e rendimento implícito favorecem valores maiores. Dívida líquida/EBITDA e drawdown favorecem valores menores. Os filtros alteram o recorte exibido e a padronização usa o grupo inteiro.

A pontuação final é a média com pesos iguais dos seis Z-scores para empresas com ROIC. Para empresas com ROE, a pontuação final usa três Z-scores, ROE, crescimento do lucro e earnings yield. O cálculo exige todos os fatores aplicáveis. A pontuação contábil disponível no site usa os cinco fatores de ROIC que vêm da CVM. O fator preço e as pontuações finais ficam disponíveis na consulta local quando há um lote privado com valores de mercado.

### Margens do último exercício

Para as empresas com ROIC, a margem bruta divide o resultado bruto (`3.03`) pela receita de venda de bens e serviços (`3.01`). A margem operacional usa o resultado antes do financeiro e dos tributos (`3.05`). A margem líquida usa o lucro ou prejuízo total do período (`3.11`). As três usam a mesma receita positiva da DFP de referência.

## CDI atual

O CDI nominal anualizado em base de 252 dias úteis serve como taxa livre de risco provisória. Empresas e Valuation e Premissas exibem a última observação publicada pelo Banco Central (SGS 4389) com sua data-base. A página Empresas mostra a diferença entre o ROIC ou ROE do exercício mais recente e o CDI atual. Em pontos percentuais, a diferença é `(ROIC ou ROE − CDI anualizado) × 100`, com as taxas em fração. O exercício contábil e a data do CDI são identificados separadamente. [Série SGS 4389](https://www3.bcb.gov.br/sgspub/consultarmetadados/consultarMetadadosSeries.do?hdOidSerieSelecionada=4389&method=consultarMetadadosSeriesInternet)

A lista de Empresas exibe essa diferença apenas no último exercício comum da seleção. Quando o retorno ou o CDI está indisponível, a diferença também fica indisponível.

Os spreads históricos e o ranking composto dependem de uma série nominal de prazo constante com datas e direitos de uso verificados. A publicação mensal da SUSEP tem uma mudança de modelo para a curva prefixada em 2022. [Parâmetros SUSEP e ANBIMA de 2016 a 2021](https://www.gov.br/susep/pt-br/assuntos/informacoes-ao-mercado/solvencia-supervisao-prudencial/monitoramento-prudencial/capital-minimo-requerido-e-tap/modelo-de-interpolacao-e-extrapolacao-da-ettj-1) · [Metodologia e parâmetros atuais](https://www.gov.br/susep/pt-br/assuntos/informacoes-ao-mercado/solvencia-supervisao-prudencial/monitoramento-prudencial/capital-minimo-requerido-e-tap/modelo-de-interpolacao-e-extrapolacao-da-ettj)

## Rendimento implícito com valor de mercado diário

O lote privado associa um valor de mercado em reais a cada companhia da seleção. Para as empresas de ROIC, usa `NOPAT / (valor de mercado + dívida líquida)`. O NOPAT já vem calculado da série de ROIC. A dívida líquida usa os empréstimos e financiamentos de curto e longo prazo menos caixa e equivalentes no fechamento da mesma DFP. O indicador exige EV positivo.

Para as empresas de ROE, o earnings yield divide o lucro líquido atribuível à controladora pelo valor de mercado. Em ambos os casos, o numerador usa a DFP anual mais recente com dados disponíveis até o pregão. O lote registra a data do pregão e a referência contábil. Em desenvolvimento local, o exercício contábil aparece ao lado do indicador.

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
