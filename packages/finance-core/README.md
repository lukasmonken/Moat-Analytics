# Motor financeiro

`moat_finance` calcula em decimal as séries contábeis do M2. A coleta e o mapeamento por emissor ficam no pipeline. A interface consome seus resultados pelo contrato JSON.

- `invested_capital`, `calculate_roic` e `calculate_roe` recebem valores em BRL e taxas como frações. A base média usa saldos comparáveis de abertura e encerramento. Caso falte um dado necessário ou um saldo seja não positivo, o resultado fica indisponível.
- `spread_to_10y` recebe a referência fiscal e a referência da taxa alinhada e retorna a diferença em pontos percentuais. A integração da fonte histórica depende de validação de acesso e reuso.
- `summarize_quality` calcula estatísticas dos exercícios disponíveis, mantém lacunas nas diferenças anuais e mede persistência quando há taxa de referência.
- `rank_quality` exige um grupo do mesmo segmento e métrica, cinco companhias elegíveis e cinco encerramentos consecutivos em comum. Usa percentis de postos médios em nível de retorno, spread e volatilidade, com menor volatilidade recebendo maior percentil. Os pesos de qualidade 30:25:20 são normalizados entre os critérios disponíveis nesta versão. A amostra CVM fica fora do ranking.

Execute os testes com `python3 -m unittest discover -s tests/pipeline`. Veja [Metodologia](../../docs/METHODOLOGY.md) para o recorte validado e as premissas por métrica.
