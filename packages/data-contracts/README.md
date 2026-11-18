# Contratos de dados

`@moat/data-contracts` exporta os códigos de índice e tipos para companhias, observações anuais, fechamentos e manifesto de cobertura. A composição de companhias elegíveis depende de fonte autorizada.

`CvmSnapshot` e `parseCvmSnapshot` definem e validam a prova de conceito da CVM (`schemaVersion: "1.0.0"`). O parser verifica a estrutura e as datas, a cobertura, a unicidade de companhias e exercícios, as URLs de origem e os valores finitos. As conciliações são produzidas em Python no pipeline. Contas e diferenças de conciliação usam BRL. Valores de contas desconhecidos usam `null`.

A observação mantém `publishedAt: null` quando só se dispõe da data de recebimento do formulário. O manifesto usa `eligibleCompanies: null` enquanto o tamanho do universo B3 for desconhecido. Consulte os [contratos orientativos](../../docs/SPEC.md#11-arquitetura-técnica-e-limites-de-domínio) e a [metodologia](../../docs/METHODOLOGY.md).

`CvmIdentitySnapshot` e `parseCvmIdentity` validam a evidência cadastral do FCA em separado. A associação por código CVM preserva as classes declaradas, a versão e a data do cadastro.

`IndexUniverseSnapshot` e `parseIndexUniverse` validam a composição anual. O contrato preserva a data-base e separa as afiliações das classes da união por companhia. A contagem por índice é calculada por código CVM e o ticker representativo fica indisponível até a validação de volume.

`QualitySnapshot` e `parseQualitySnapshot` validam as séries e as contas-fonte do M2. ROIC, ROE e estatísticas de nível são frações. Variação, spread e tendência usam pontos percentuais. O estado do benchmark e do ranking fica explícito.
