# Pipeline de dados

Diretório reservado ao processamento em lote com Python. O M0 registra a fronteira do pipeline. A primeira execução será a prova de conceito com demonstrativos CVM do M1.

O pipeline terá etapas independentes para coleta, normalização, validação e publicação. A coleta guarda arquivos originais com origem, momento da coleta e hash. A normalização trata tipos, unidades, consolidados, individuais e retificações. As observações preservam a data de referência, a data de publicação e a versão da metodologia.

O processamento interno previsto usa Parquet. O site consumirá snapshots JSON autorizados e versionados, descritos em [contratos de dados](../../packages/data-contracts/README.md). A publicação só promove lotes validados e preserva o último snapshot válido em caso de falha.

As fontes e os requisitos de publicação estão em [Fontes de dados](../../docs/DATA_SOURCES.md) e na [especificação](../../docs/SPEC.md).
