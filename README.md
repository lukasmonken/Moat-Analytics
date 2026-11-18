# Moat Analytics

Aplicativo web para análise fundamentalista de companhias brasileiras. O M1 acrescenta uma amostra de DFP anuais da CVM com contas de indústria, varejo e banco. Em **Empresas**, consulte os exercícios de cada companhia, as conciliações e os documentos de origem. O universo B3 e a referência de juros de dez anos dependem de fontes autorizadas.

## Executar localmente

Use Node.js 24.22.3 (ver `.node-version`) e npm 12.2.3.

```bash
npm install --global npm@12.2.3
npm ci
npm run dev
```

Abra o endereço local informado pelo Vite. O comando `npm install` também funciona e é o indicado ao alterar dependências. O site usa o snapshot versionado e funciona sem variáveis de ambiente ou credenciais.

## Validação

```bash
npm run lint
npm run format:check
npm run typecheck
python3 -m unittest discover -s tests/pipeline
npm test
npm run build
npm exec -- playwright install chromium
npm run test:e2e
```

O build fica em `apps/web/dist`. O Playwright serve esse build em `/moat-analytics/` para verificar navegação e recarga sob um prefixo de repositório. Para usar o Chrome já instalado, execute `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:e2e` após o build. Use `npm run format` para formatar os arquivos editáveis e `npm run preview` para conferir o build manualmente.

As versões estão fixadas no [manifesto raiz](package.json), no [manifesto web](apps/web/package.json) e no [lockfile](package-lock.json). A fonte Inter é distribuída com a [licença OFL 1.1](apps/web/public/licenses/inter.txt).

## Atualizar a amostra CVM

Use Python 3.11 ou superior. A coleta em lote requer `curl` e acesso ao portal da CVM. O build, os testes e a navegação local usam os snapshots versionados.

```bash
python3 apps/pipeline/run_cvm.py --output data/public/cvm-sample.json
python3 apps/pipeline/run_cvm_identity.py --output data/public/cvm-identity.json
```

Confira [Pipeline de dados](apps/pipeline/README.md) para as opções da CLI e [Fontes de dados](docs/DATA_SOURCES.md) para licença e cobertura. O CI testa offline. O workflow de publicação usa o snapshot revisado no Git.

## Publicar no GitHub Pages

O repositório no GitHub precisa de permissão de escrita e suporte a Pages. Use `main` como branch padrão.

1. Envie a `main` do clone com `git push origin main`. Em uma cópia inicializada localmente, associe o remoto antes do primeiro push.
2. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions** como fonte.
3. Em **Actions → CI e GitHub Pages → Run workflow**, selecione `main` e marque **Publicar no GitHub Pages**. O deploy aguarda a validação do build e dos testes.
4. Após o job de publicação concluir, abra a URL exibida no ambiente `github-pages`. Abra o screener e recarregue a página para verificar a rota direta.

O Vite usa caminhos relativos para os assets. As rotas ficam no fragmento da URL, como `#/screener`, e funcionam sob o prefixo do repositório. O workflow publica apenas `apps/web/dist`.

## Estrutura

| Caminho                          | Responsabilidade                                 |
| -------------------------------- | ------------------------------------------------ |
| `apps/web/src/app`               | Roteamento, shell e preferência de tema          |
| `apps/web/src/features`          | Páginas e UI organizadas por domínio             |
| `apps/web/src/shared` e `styles` | Componentes reutilizáveis, tipos e estilos       |
| `apps/pipeline`                  | Coleta, mapeamento e validação da amostra CVM    |
| `packages/finance-core`          | Limites do futuro motor financeiro               |
| `packages/data-contracts`        | Contratos TypeScript e códigos de índices        |
| `data`                           | Áreas de armazenamento previstas para o pipeline |
| `tests` e `.github/workflows`    | Testes, CI e publicação                          |

Consulte a [especificação](docs/SPEC.md), as [decisões](docs/DECISIONS.md), as [fontes previstas](docs/DATA_SOURCES.md), a [metodologia](docs/METHODOLOGY.md) e o [changelog](docs/CHANGELOG.md).
