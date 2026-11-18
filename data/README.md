# Dados

- `raw/` recebe os ZIPs originais de fontes verificadas e seus metadados. O Git ignora esse conteúdo.
- `processed/` recebe saídas internas de normalização. O Git ignora esse conteúdo.
- `public/` contém apenas snapshots cuja redistribuição foi validada. O build inclui os arquivos consumidos explicitamente pelo frontend.

O arquivo [cvm-sample.json](public/cvm-sample.json) é uma base derivada das [Demonstrações Financeiras Padronizadas da CVM](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp), disponibilizada sob a [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). O Moat Analytics seleciona uma amostra, normaliza as unidades e acrescenta verificações contábeis e proveniência.

O arquivo [cvm-identity.json](public/cvm-identity.json) é uma base derivada do [Formulário Cadastral da CVM](https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca), sob a mesma licença. Ele contém os códigos de negociação e as classes declarados pelas três companhias da amostra.
