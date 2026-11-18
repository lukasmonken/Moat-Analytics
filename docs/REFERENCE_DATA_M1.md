# M1 — Dados de referência

Fontes consultadas em 18/11/2026. O recorte financeiro e cadastral da CVM foi validado para três companhias. O universo dos índices, o ticker representativo e a referência prefixada de dez anos estão indisponíveis.

## Códigos informados à CVM

O arquivo `fca_cia_aberta_valor_mobiliario_2026.csv` do Formulário Cadastral fornece códigos e classes declarados pelos emissores. Para a amostra, foram verificadas as linhas de negociação em bolsa na B3 e a versão do cadastro. O conjunto está sob ODbL 1.0. [Catálogo do FCA](https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca) · [Arquivo oficial de 2026](https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_2026.zip)

| Companhia             | Código CVM | Versão | Códigos declarados     |
| --------------------- | ---------: | -----: | ---------------------- |
| WEG                   |       5410 |      1 | WEGE3 (ON)             |
| Lojas Renner          |       8133 |      1 | LREN3 (ON)             |
| Itaú Unibanco Holding |      19348 |      2 | ITUB3 (ON), ITUB4 (PN) |

As três observações têm referência em 01/01/2026. O cadastro identifica instrumentos por companhia. A elegibilidade depende da composição vigente de pelo menos um índice. A escolha de uma classe representativa depende de volumes financeiros autorizados e de uma janela de liquidez documentada.

## Carteiras e liquidez da B3

O Hub de Dados Públicos da B3 apresenta o Boletim Diário do Mercado, consultas por pregão e séries de cotações para consulta informativa. O Hub veda coleta automatizada, inclusive com ferramentas de inteligência artificial. O M1 manteve a composição dos índices e os dados de negociação fora do lote público. [Hub de dados públicos](https://www.b3.com.br/pt_br/dados/hub-de-dados-publicos/) · [Boletim Diário do Mercado](https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/consultas/boletim-diario/boletim-diario-do-mercado/)

O UP2DATA oferece composição de carteira para IBOV, SMLL e IDIV e canais de dados de negociação. O escopo de uso, inclusive distribuição, depende dos anexos contratuais. A regra de distribuição sem custo para dados D−1 citada na documentação de Market Data se refere a distribuidores ou redistribuidores e aos dados obtidos pelas plataformas de Market Data B3. O reuso de conteúdo do Hub tem suas condições próprias. [Dados disponíveis no UP2DATA](https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/up2data/dados-disponiveis/) · [Contratação do UP2DATA](https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/up2data/perguntas-frequentes/contratacao-e-precos.htm) · [Perguntas frequentes de Market Data](https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/distribuidores/perguntas-frequentes/)

Para integrar o universo, é preciso confirmar uma fonte autorizada para as três carteiras com vigência rastreável e volumes por classe. A classificação de liquidez requer correspondência entre classes e o mesmo intervalo de pregões para cada candidata.

## Curva prefixada de dez anos

O ANBIMA Feed documenta a ETTJ soberana zero-cupom, com taxa nominal em `taxa_prefixadas`, prazo em `vertice_du` e consulta por data de referência. O vértice candidato é 2.520 dias úteis pela convenção de dez anos de 252 dias úteis. A cobertura nas datas-base e os direitos de publicação permanecem pendentes. A produção exige credenciais e solicitação de acesso, com plano comercial para usuários não associados. [API de títulos públicos](https://developers.anbima.com.br/pt/documentacao/precos-indices/apis-de-precos/titulos-publicos/) · [Acesso ao ANBIMA Feed](https://developers.anbima.com.br/pt/documentacao/visao-geral/como-acessar-nossas-apis/)

O Tesouro Transparente oferece uma série diária sob ODbL de preços e taxas dos títulos ofertados no Tesouro Direto. Cada observação corresponde a um título com vencimento próprio. Uma curva de prazo constante exigiria metodologia e validação próprias. O M1 publica a referência de dez anos como indisponível. [Conjunto de dados do Tesouro Transparente](https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3)
