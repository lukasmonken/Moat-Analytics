# Pipeline de dados

Use Python 3.11 ou superior, com a base de fusos IANA disponível. A coleta online usa `curl` no PATH para aproveitar os certificados de confiança do ambiente. A amostra do M1 usa os DFP anuais consolidados de 2021 a 2025 e os códigos declarados no FCA de 2026 para WEG, Lojas Renner e Itaú Unibanco.

## Gerar ou atualizar os snapshots

Execute na raiz do clone.

```bash
python3 apps/pipeline/run_cvm.py
python3 apps/pipeline/run_cvm_identity.py
```

Os scripts usam o cache local em `data/raw/cvm` e baixam da CVM os originais que faltarem. Use `--refresh` para buscar versões atualizadas e `--offline` para exigir cache completo. Ao importar ZIPs coletados separadamente, preserve os nomes, bytes e horário de gravação do original. A hora de gravação do ZIP é registrada como instante de coleta. É possível apontar para outro cache com `--raw-dir`.

O DFP aceita `--start-year` e `--end-year`. O FCA aceita `--year`. Ambos aceitam `--output`. O comando padrão gera `data/public/cvm-sample.json` ou `data/public/cvm-identity.json`. Revise o diff antes de enviar o snapshot e mantenha os ZIPs e os arquivos de trabalho fora do Git. O cache arquiva a versão anterior por SHA-256 quando o conteúdo da fonte muda.

## Validação e promoção

O DFP seleciona a maior versão para o código CVM e o exercício. Usa a coluna `ÚLTIMO` de BPA, BPP e DRE consolidados e confere CNPJ, encerramento e início da DRE. As contas são normalizadas com aritmética decimal, conforme a unidade informada no CSV, e o banco usa o elenco financeiro.

Cada exercício verifica o ativo total contra o passivo total, a composição do ativo e do passivo, o resultado bruto e o resultado consolidado. A tolerância é metade da soma das unidades de arredondamento dos valores envolvidos. Diferenças acima desse limite, contas obrigatórias ausentes e arquivos inválidos impedem a substituição do snapshot. O FCA vincula os valores mobiliários ao documento mais recente pelo CNPJ, data, versão e identificador do envio, e registra separadamente as classes declaradas.

A escrita é atômica. Diante de erro, cada rotina encerra com código diferente de zero e mantém a saída anterior. Uma nova execução com os mesmos dados mantém o snapshot existente. A data de recebimento do formulário é distinta do instante de publicação, que continua desconhecido quando ausente na fonte.

Valide com `python3 -m unittest discover -s tests/pipeline`. Veja [fontes e licenças](../../docs/DATA_SOURCES.md) e [referências de mercado do M1](../../docs/REFERENCE_DATA_M1.md).

## Importar a composição anual

Use os três CSVs com a mesma data-base. Os arquivos **Carteira do Dia** da B3 podem ser usados diretamente. O importador verifica o índice e a data do cabeçalho e confere a quantidade teórica das linhas contra o rodapé. Um CSV consolidado aceita as colunas `indice` e `ticker` via `--input`. As colunas `codigo_cvm`, `cnpj` e `tipo` são opcionais nesse formato.

```bash
python3 apps/pipeline/run_index_universe.py \
  --ibov data/raw/indices/2026-11-18/IBOVDia_18-11-26.csv \
  --smll data/raw/indices/2026-11-18/SMLLDia_18-11-26.csv \
  --idiv data/raw/indices/2026-11-18/IDIVDia_18-11-26.csv \
  --as-of 2026-11-18 \
  --source 'Arquivos de composição fornecidos pelo usuário (formato B3)' \
  --identity-overrides data/raw/indices/2026-11-18/correcoes-fca.csv
```

Para outro ano, use o FCA correspondente em `data/raw/cvm` ou passe `--fca-archive` para cada ZIP pertinente. O corte usa envios recebidos pela CVM até a data-base. Um ZIP coletado depois pode ter perdido seções de versões antigas e gerar lacunas. Os arquivos originais e as exceções ficam em `data/raw`.

Quando o FCA contém um erro cadastral, `--identity-overrides` aceita um CSV UTF-8 com `data_base,ticker,codigo_cvm,cnpj,companhia,tipo,fonte_url,justificativa`. A data deve ser a do lote e a identidade deve corresponder a um emissor doméstico apto no FCA. Cada linha requer evidência primária para a classe ou o código corrigido.

A saída privada padrão fica em `data/processed/index-universe/index-universe.json`. Cada lote válido é arquivado por data-base e hash em `data/processed/index-universe/history`. Uma importação antiga entra no histórico e preserva a saída mais recente. O screener local usa o lote mais recente no `npm run dev`. A saída pública requer `--redistribution-basis` com a autorização verificada.

## Atualizar o diretório público

O diretório público usa os códigos CVM do recorte local para buscar, no FCA aberto, os nomes oficiais das companhias. O JSON público contém apenas a lista de nomes, a data-base e a atribuição à CVM.

```bash
python3 apps/pipeline/run_company_selection.py --fca-archive data/raw/cvm/fca_cia_aberta_2026.zip
```

## Gerar as séries de qualidade

```bash
python3 apps/pipeline/run_quality.py
```

A rotina usa os ZIPs DFP locais e gera `data/public/cvm-quality.json`. Aceita `--raw-dir`, `--output`, `--start-year` e `--end-year`. Valida o layout contábil por companhia, os comparativos de abertura e a conciliação dos numeradores. A reexecução sobre os mesmos insumos preserva o arquivo. [Metodologia das séries](../../docs/METHODOLOGY.md#séries-de-qualidade-da-amostra)
