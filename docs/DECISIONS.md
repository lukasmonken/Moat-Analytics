# Decisões técnicas

## M0

- **Aplicação estática.** React 19, TypeScript 6 estrito, Vite 8 e npm workspaces. O framework resolve a UI e o pipeline permanece um módulo batch planejado. O Node.js 24.22.3 e npm 12.2.3 foram usados na validação. Os manifestos e o lockfile registram as versões exatas.
- **Rotas em hash e assets relativos.** `HashRouter` mantém a rota inteira no fragmento e o `base: './'` do Vite resolve o build tanto no domínio raiz quanto no subdiretório do GitHub Pages. Isso evita depender de regras de reescrita do servidor.
- **CSS e controles nativos.** Tailwind e tokens CSS cobrem a base visual. Os componentes React reutilizam elementos HTML nativos para os controles do M0. A adoção de shadcn/ui, Radix e ECharts será avaliada quando houver controles e gráficos que justifiquem essas dependências.
- **Tema.** A preferência inicial acompanha o sistema. A escolha manual é persistida no navegador e aplicada às sete rotas. Se o armazenamento estiver indisponível, o tema pode ser alterado durante a sessão.
- **Fronteiras de dados.** O M0 define contratos TypeScript preliminares, códigos de índice e limites do pipeline e do motor financeiro. A validação de fontes, a seleção de bibliotecas Python e a produção de snapshots partem da prova de conceito do M1.
- **Publicação aprovada por execução manual.** Push e pull request validam o projeto. A seleção explícita de publicação no workflow da `main` padrão habilita o deploy após os testes. A cópia local não tem remoto configurado.
- **Auditoria de dependências.** O npm sinalizou o aviso [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) em `picomatch` 4.0.7, transitiva de ferramentas de desenvolvimento. O registro consultado ainda não oferecia uma versão corrigida compatível. O Dependabot está configurado para acompanhar atualizações.
