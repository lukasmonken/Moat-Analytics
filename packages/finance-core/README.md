# Motor financeiro

`moat_finance` calcula em decimal as métricas contábeis, de preço e os cenários de valuation. A coleta e o mapeamento por emissor ficam no pipeline. Os cenários editáveis no navegador usam a implementação TypeScript com a mesma convenção de cálculo.

- `invested_capital`, `calculate_roic` e `calculate_roe` recebem valores em BRL e taxas como frações. A base média usa saldos comparáveis de abertura e encerramento. Caso falte um dado necessário ou um saldo seja não positivo, o resultado fica indisponível.
- `spread_to_10y` recebe a referência fiscal e a referência da taxa alinhada e retorna a diferença em pontos percentuais. A integração da fonte histórica depende de validação de acesso e reuso.
- `summarize_quality` calcula estatísticas dos exercícios disponíveis, mantém lacunas nas diferenças anuais e mede persistência quando há taxa de referência.
- `rank_quality` exige um grupo do mesmo segmento e métrica, cinco companhias elegíveis e cinco encerramentos consecutivos em comum. Usa percentis de postos médios em nível de retorno, spread e volatilidade, com menor volatilidade recebendo maior percentil. Os pesos de qualidade 30:25:20 são normalizados entre os critérios disponíveis nesta versão. A amostra CVM fica fora do ranking.
- `market_capitalization` exige todas as classes esperadas, com fechamentos não ajustados do mesmo pregão e quantidades efetivas naquela data. O pipeline comprova os saldos e eventos societários, usa ações emitidas em poder dos acionistas incluindo controladores e desconta tesouraria. As ações reunidas em units entram nas respectivas classes uma única vez.
- `enterprise_value` exige capitalização, dívida líquida e ajustes explicitamente apurados. `operating_yield` divide NOPAT de doze meses pelo EV positivo e `earnings_yield` divide lucro atribuível à controladora de doze meses pela capitalização positiva. `spread_to_cdi` usa a taxa anual como fração e expressa a diferença em pontos percentuais. A validade temporal das entradas vem do pipeline.

Execute os testes com `python3 -m unittest discover -s tests/pipeline`. Veja [Metodologia](../../docs/METHODOLOGY.md) para o recorte validado e as premissas por métrica.
