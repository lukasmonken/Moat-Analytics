# Decisões técnicas

## M0

- **Aplicação estática.** React 19, TypeScript 6 estrito, Vite 8 e npm workspaces. O framework resolve a UI e o pipeline permanece um módulo batch planejado. O Node.js 24.22.3 e npm 12.2.3 foram usados na validação. Os manifestos e o lockfile registram as versões exatas.
- **Rotas em hash e assets relativos.** `HashRouter` mantém a rota inteira no fragmento e o `base: './'` do Vite resolve o build tanto no domínio raiz quanto no subdiretório do GitHub Pages. Isso evita depender de regras de reescrita do servidor.
- **CSS e controles nativos.** Tailwind e tokens CSS cobrem a base visual. Os componentes React reutilizam elementos HTML nativos para os controles do M0. A adoção de shadcn/ui, Radix e ECharts será avaliada quando houver controles e gráficos que justifiquem essas dependências.
- **Tema.** A preferência inicial acompanha o sistema. A escolha manual é persistida no navegador e aplicada às sete rotas. Se o armazenamento estiver indisponível, o tema pode ser alterado durante a sessão.
- **Fronteiras de dados.** O M0 define contratos TypeScript preliminares, códigos de índice e limites do pipeline e do motor financeiro. A validação de fontes, a seleção de bibliotecas Python e a produção de snapshots partem da prova de conceito do M1.
- **Publicação aprovada por execução manual.** Push e pull request validam o projeto. A seleção explícita de publicação no workflow da `main` padrão habilita o deploy após os testes.
- **Auditoria de dependências.** O npm sinalizou o aviso [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) em `picomatch` 4.0.7, transitiva de ferramentas de desenvolvimento. O registro consultado ainda não oferecia uma versão corrigida compatível. O Dependabot está configurado para acompanhar atualizações.

## M1

- **Amostra de validação contábil.** O pipeline usa os demonstrativos consolidados anuais originais da CVM para três perfis de companhia. Mantém a versão do formulário e separa a data de recebimento da CVM da data de publicação. O instante de publicação fica como `null` quando a fonte não o identifica. O lote serve à validação contábil corrente. Uma reconstrução histórica precisa reter versões anteriores e verificar quando cada registro se tornou público.
- **Ingestão em lote com biblioteca padrão.** O volume da amostra permite leitura sequencial dos CSVs e aritmética decimal em Python. A coleta usa `curl` com a validação HTTPS do ambiente após o Python local rejeitar a cadeia de certificados. O snapshot JSON versionado é a saída desta prova. Parquet e bibliotecas adicionais entram quando houver processamento interno em escala.
- **Originais e últimas publicações.** O pipeline valida arquivos e conciliações antes de trocar o snapshot. Arquivos brutos ficam em cache local ignorado pelo Git. A publicação utiliza o snapshot revisado, com testes offline no CI. Uma falha da coleta mantém o último lote válido.
- **Fonte e cobertura visíveis.** O JSON derivado da CVM é oferecido sob ODbL 1.0, com atribuição e download na página Empresas. O Vite publica o snapshot selecionado como asset estático. A cobertura da amostra é independente do universo B3, cujo tamanho fica como `null`.
- **Códigos cadastrais e referências de mercado.** O FCA produz um snapshot independente que liga as companhias da amostra às classes declaradas. A seleção do ticker mais líquido e o benchmark prefixado de prazo constante dependem de fontes com acesso e direitos validados. Veja [Referências de mercado no M1](REFERENCE_DATA_M1.md).

- **Recorte anual fornecido pelo usuário.** A operação do screener adotou uma importação manual por ano, a partir da decisão de 18/11/2026. Cada recorte corresponde à sua data-base. Alterações intranuais e simulações que exijam um universo disponível em cada pregão dependem de carteiras históricas adicionais. A união por código CVM mantém a classe de cada ticker e suas afiliações.
- **Consulta privada das composições.** Para os três CSVs fornecidos, o snapshot e a entrada permanecem nos diretórios ignorados pelo Git. O Vite serve o snapshot processado só no servidor de desenvolvimento e via loopback. A promoção para `data/public` requer uma base de redistribuição verificada e registrada. As exceções cadastrais guardam a data-base, a classe e a fonte primária do emissor. A classe mais líquida e a taxa prefixada de dez anos seguem pendentes.
