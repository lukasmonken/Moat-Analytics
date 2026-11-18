# Motor financeiro

Diretório reservado ao pacote Python para os cálculos canônicos de métricas, rankings, valuation, carteiras e backtest. O M0 registra a fronteira do domínio. As implementações seguem os marcos da [especificação](../../docs/SPEC.md).

O motor receberá entradas normalizadas que identificam período, fonte, unidade e qualidade. Cada domínio terá uma API pública. Quando um cálculo precisar rodar no navegador, a implementação TypeScript deverá ser verificada com casos de teste compartilhados com o motor Python.

As convenções de cálculo e as condições de comparabilidade estão em [Metodologia](../../docs/METHODOLOGY.md).
