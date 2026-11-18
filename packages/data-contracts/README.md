# Contratos de dados

`@moat/data-contracts` exporta os códigos dos índices elegíveis e tipos TypeScript preliminares para companhias, observações anuais, fechamentos e o manifesto público. O frontend do M0 usa os códigos para os filtros. As afiliações de companhias serão preenchidas a partir da composição validada.

Os tipos seguem a seção 11 da [especificação](../../docs/SPEC.md). Um `publishedAt` desconhecido fica explícito com `null`. A simulação historicamente investível depende de uma data de publicação conhecida para cada observação usada. A cobertura do manifesto mantém o tamanho do universo como `null` enquanto ele for desconhecido.

Antes de publicar o primeiro lote, a integração definirá unidades e convenções por campo, a versão do esquema e a validação em execução dos JSON produzidos pelo pipeline.
