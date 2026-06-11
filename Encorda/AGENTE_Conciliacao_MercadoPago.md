# Instrução para Agente de IA — Conciliação Mercado Pago
## Extrato de Contas × Movimento Financeiro

---

## 1. Contexto do Problema

A Encorda realiza vendas no Mercado Livre, que utiliza o **Mercado Pago** como intermediário financeiro. O Mercado Pago disponibiliza dois relatórios distintos:

| Relatório | Característica |
|---|---|
| **Extrato de Contas** | Sintético. Registra apenas o que foi **efetivamente debitado ou creditado** na conta. É o que impacta o financeiro da empresa. |
| **Movimento Financeiro** | Analítico. Detalha **todas as operações e custos** envolvidos em cada evento: taxas do Mercado Livre, fretes, devoluções, ressarcimentos, parcelamentos, etc. |

**O problema:** o Extrato é a fonte financeira oficial, mas carece de detalhamento para fins contábeis. O Movimento tem o detalhe, mas não reflete diretamente os créditos/débitos na conta. A conciliação une os dois, enriquecendo o Extrato com as informações do Movimento.

---

## 2. Estrutura dos Arquivos de Entrada

### 2.1 Extrato de Contas (`Extrato__Mercado_Pago.xlsx`)

O arquivo possui um **cabeçalho de 3 linhas** antes dos dados reais (linhas 1–3 contêm totalizadores e metadados do relatório exportado). Os dados começam na **linha 4**.

| Coluna | Descrição |
|---|---|
| `RELEASE_DATE` | Data do lançamento (formato `DD-MM-YYYY`) |
| `TRANSACTION_TYPE` | Descrição do lançamento (texto livre) |
| `REFERENCE_ID` | **Chave de conciliação** — ID único do evento |
| `TRANSACTION_NET_AMOUNT` | Valor líquido do lançamento (formato BR: `1.234,56`) |
| `PARTIAL_BALANCE` | Saldo parcial após o lançamento (formato BR: `1.234,56`) |

**Atenção:** a linha 3 repete os nomes das colunas como parte do cabeçalho do relatório. Ela deve ser removida durante o carregamento.

### 2.2 Movimento Financeiro (`Movimento_Financeiro__Mercado_Pago.xlsx`)

Os dados começam na **linha 1** (sem cabeçalho extra). Utilizar apenas as 5 primeiras colunas (as demais estão vazias).

| Coluna | Descrição |
|---|---|
| `Data de pagamento` | Timestamp do evento (formato ISO 8601: `YYYY-MM-DDTHH:MM:SSZ`) |
| `Tipo de operação` | Tipo da movimentação (ex: `Recebimento`, `Tarifa de processamento`) |
| `Número do movimento` | ID único da linha no Movimento (não é a chave de conciliação) |
| `Operação relacionada` | **Chave de conciliação** — corresponde ao `REFERENCE_ID` do Extrato |
| `Valor` | Valor da operação (numérico, negativo = débito) |

---

## 3. Lógica de Conciliação

### 3.1 Chave de Junção

```
Extrato.REFERENCE_ID  ==  Movimento.Operação relacionada
```

Esta é a **única** chave de conciliação entre os dois arquivos. Ambas as colunas devem ser tratadas como string (`str`) antes do join, pois podem ter tipos diferentes ao carregar (int64 vs object).

```python
df_ext['REFERENCE_ID'] = df_ext['REFERENCE_ID'].astype(str).str.strip()
df_mov['Operação relacionada'] = df_mov['Operação relacionada'].astype(str).str.strip()
```

### 3.2 Cardinalidade do Relacionamento

O relacionamento é **1 para N**: cada linha do Extrato corresponde a **múltiplas linhas** no Movimento (tipicamente 4 a 6, podendo chegar a 11).

Exemplo — uma "Liberação de dinheiro" (1 linha no Extrato) gera no Movimento:
```
Recebimento                         +157,38
Reembolso do frete                   -18,45
Tarifa de financiamento               -6,83
Tarifa de processamento               -4,69
Tarifa por vender no Mercado Livre   -14,45
─────────────────────────────────────────
Total líquido                        +112,96  ← igual ao TRANSACTION_NET_AMOUNT do Extrato
```

### 3.3 Enriquecimento: Pivoteamento do Movimento

Para cada `REFERENCE_ID`, agrupar as linhas do Movimento por `Tipo de operação` e somar os valores. Isso transforma N linhas em 1 linha enriquecida, com uma coluna para cada tipo de operação.

```python
mov_summary = df_mov[df_mov['Operação relacionada'] == ref_id] \
              .groupby('Tipo de operação')['Valor'].sum().to_dict()
```

### 3.4 Tipos de Operação a Criar como Colunas

Utilizar esta lista fixa como colunas do relatório final (mesmo que o valor seja nulo para alguns lançamentos):

```python
TIPOS_MOVIMENTO = [
    'Recebimento',
    'Dinheiro recebido',
    'Tarifa por vender no Mercado Livre',
    'Tarifa de processamento',
    'Tarifa de financiamento',
    'Reembolso do frete',
    'Custos de parcelamento',
    'Custo por absorção da tarifa parcelamento',
    'Devolução por Compra Garantida',
    'Cancelamento de tarifa por vender no Mercado Livre',
    'Cancelamento do custo de processamento',
    'Cancelamento do custo de envio',
    'Cancelamento de custos de parcelamento',
    'Cancelamento de custo por absorção da tarifa parcelamento',
    'Movimentação geral',
    'Pagamento',
    'Transferência via Pix',
    'Devolução de pagamento',
    'Devolução parcial de pagamento',
    'Entrada de dinheiro extra',
    'Custo pela devolução',
    'Devolução de recebimento',
    'Recebimento pelo desconto da sua contraparte',
    'Custo de gestao de venda',
    'Tarifa de venda',
    'Cancelamento de tarifa de venda',
    'Cancelamento de custo de gestao de venda',
    'Custo de envio por cross-docking',
    'Cancelamento de entrada de dinheiro extra',
]
```

> **Nota:** Se novos tipos aparecerem em períodos futuros, eles não serão perdidos — o agente deve verificar se existem `Tipo de operação` no Movimento que não estão nesta lista e adicioná-los dinamicamente ao final.

---

## 4. Casos de Lançamento e Sua Interpretação

A tabela abaixo descreve os padrões de `TRANSACTION_TYPE` encontrados no Extrato e o que esperar no Movimento correspondente:

| Tipo no Extrato | Interpretação | Tipos típicos no Movimento |
|---|---|---|
| **Liberação de dinheiro** | Venda realizada, liberação do valor após prazo de proteção | Recebimento + tarifas ML + frete |
| **Dinheiro recebido** | Pagamento à vista recebido imediatamente | Recebimento + Dinheiro recebido + tarifas + frete |
| **Reembolso Reclamações e devoluções** | Devolução de venda em que o comprador abriu reclamação | Recebimento original + tarifas |
| **Reembolso Envío cancelado a [nome]** | Venda cancelada antes do envio, valor devolvido ao comprador | Recebimento + cancelamentos de tarifa |
| **Reembolso** | Reembolso genérico | Recebimento + tarifas |
| **Débito por dívida Devoluções e reclamações** | Compra Garantida ativada — ML debitou o valor da conta | Recebimento + tarifas + Devolução por Compra Garantida + cancelamentos |
| **Débito por dívida/dinheiro retido** | Valor retido e depois debitado por disputa | Movimentação geral |
| **Dinheiro retido Reclamações e devoluções** | Valor bloqueado durante processo de reclamação | Movimentação geral |
| **Pagamento com Código QR Pix [nome]** | Venda via QR Code / Pix presencial | Recebimento + tarifas |
| **Pix enviado [nome]** | Transferência Pix enviada pela empresa | Pagamento / Devolução de pagamento |
| **Transferência enviada [nome]** | Transferência bancária saindo da conta | Transferência via Pix |
| **Pagamento Mercado Libre** | Pagamento de fatura/cobrança do ML | Pagamento |
| **Entrada de dinheiro** | Crédito avulso na conta | Entrada de dinheiro extra |

---

## 5. Tratamento de Casos Especiais

### 5.1 Carregamento do Extrato (cabeçalho extra)
```python
df_ext = pd.read_excel('Extrato__Mercado_Pago.xlsx', skiprows=3)
df_ext.columns = ['RELEASE_DATE','TRANSACTION_TYPE','REFERENCE_ID',
                  'TRANSACTION_NET_AMOUNT','PARTIAL_BALANCE']
# Remover linha fantasma que repete o cabeçalho (linha 3 original)
df_ext = df_ext[
    df_ext['RELEASE_DATE'].notna() &
    (df_ext['RELEASE_DATE'] != 'RELEASE_DATE')
].copy().reset_index(drop=True)
```

### 5.2 Movimento Financeiro (colunas extras vazias)
```python
df_mov = pd.read_excel('Movimento_Financeiro__Mercado_Pago.xlsx', usecols=[0,1,2,3,4])
```

### 5.3 Lançamentos sem correspondência no Movimento
- Marcar com `STATUS_CONCILIACAO = 'Sem correspondência no Movimento'`
- Preencher `TOTAL_MOVIMENTO = None`
- Todas as colunas de tipo de operação ficam em branco
- Destacar em **laranja claro** no relatório final
- Listar separadamente na aba "Sem Correspondência"

### 5.4 Novos tipos de operação não mapeados
```python
# Detectar tipos não previstos na lista
tipos_presentes = set(df_mov['Tipo de operação'].unique())
tipos_nao_mapeados = tipos_presentes - set(TIPOS_MOVIMENTO)
if tipos_nao_mapeados:
    # Adicionar ao final da lista antes de gerar as colunas
    TIPOS_MOVIMENTO.extend(sorted(tipos_nao_mapeados))
```

---

## 6. Estrutura do Relatório Final

O arquivo de saída deve ser nomeado `Conciliacao_MercadoPago.xlsx` e conter **3 abas**.

---

### Aba 1 — `Conciliação Completa`

**Cabeçalho na linha 2** (linha 1 reservada para possível agrupamento visual futuro). Dados a partir da linha 3.

#### Grupo A — Dados do Extrato (fundo azul escuro `#1F4E79`)
| Coluna | Rótulo |
|---|---|
| `DATA_LANCAMENTO` | Data Lançamento |
| `TIPO_EXTRATO` | Tipo (Extrato) |
| `REFERENCE_ID` | Reference ID |
| `VALOR_LIQUIDO_EXTRATO` | Valor Líquido (Extrato) |
| `SALDO_PARCIAL` | Saldo Parcial |

#### Grupo B — Controle da Conciliação (fundo laranja `#BF5700`)
| Coluna | Rótulo |
|---|---|
| `STATUS_CONCILIACAO` | Status Conciliação |
| `TOTAL_MOVIMENTO` | Total Movimento |

#### Grupo C — Detalhamento do Movimento (fundo verde escuro `#375623`)
Uma coluna para cada tipo em `TIPOS_MOVIMENTO`, com o nome exato como rótulo.

#### Formatação das linhas de dados:
- **Linhas conciliadas:** fundo azul claro `#DAE8FC` (grupo A), amarelo claro `#FFF2CC` (grupo B), verde claro `#D5E8D4` (grupo C)
- **Linhas sem correspondência:** fundo laranja muito claro `#FCE4D6` em todas as colunas
- Fonte: Arial, tamanho 9
- Bordas finas em todas as células (`#B0B0B0`)
- Alinhamento central horizontal e vertical
- Linha do cabeçalho com altura 40px e texto com `wrap_text=True`
- **Congelar painéis em `A3`** para facilitar a navegação

#### Larguras de coluna sugeridas:
| Coluna | Largura |
|---|---|
| DATA_LANCAMENTO | 14 |
| TIPO_EXTRATO | 40 |
| REFERENCE_ID | 18 |
| VALOR_LIQUIDO_EXTRATO | 18 |
| SALDO_PARCIAL | 14 |
| STATUS_CONCILIACAO | 22 |
| TOTAL_MOVIMENTO | 16 |
| Colunas de Movimento | 22 |

---

### Aba 2 — `Resumo por Tipo`

Tabela agregada por `TIPO_EXTRATO` com as colunas:

| Coluna | Descrição |
|---|---|
| Tipo de Lançamento (Extrato) | Nome do tipo |
| Qtd Lançamentos | Contagem de linhas |
| Valor Total Extrato | Soma do VALOR_LIQUIDO_EXTRATO (converter formato BR para float antes) |
| Valor Total Movimento | Soma do TOTAL_MOVIMENTO |
| Conciliados | Qtd com STATUS = 'Conciliado' |
| Sem Correspondência | Qtd com STATUS ≠ 'Conciliado' |

Cabeçalho com fundo azul escuro `#1F4E79`, texto branco, negrito. Dados com fundo cinza claro `#F2F2F2`. Largura da coluna A = 55.

**Conversão de valor formato BR:**
```python
def parse_br(v):
    if pd.isna(v): return None
    try:
        return float(str(v).replace('.', '').replace(',', '.'))
    except:
        return None
```

---

### Aba 3 — `Sem Correspondência`

Lista apenas os lançamentos do Extrato que **não foram encontrados** no Movimento. Colunas:
- Data Lançamento
- Tipo Extrato
- Reference ID
- Valor Líquido
- Saldo Parcial

Cabeçalho com fundo laranja `#BF5700`, texto branco. Linhas com fundo `#FCE4D6`.

---

## 7. Fluxo de Execução do Agente

```
1. Receber os dois arquivos:
   └─ Extrato__Mercado_Pago.xlsx
   └─ Movimento_Financeiro__Mercado_Pago.xlsx

2. Carregar o Extrato
   ├─ skiprows=3
   ├─ Renomear colunas
   └─ Filtrar linhas inválidas (NaN e repetição de cabeçalho)

3. Carregar o Movimento Financeiro
   ├─ usecols=[0,1,2,3,4]
   └─ Converter Operação relacionada para str

4. Normalizar chaves de conciliação (str + strip)

5. Verificar novos tipos de operação não mapeados → adicionar à lista

6. Para cada linha do Extrato:
   ├─ Buscar linhas correspondentes no Movimento pelo REFERENCE_ID
   ├─ Pivotar por Tipo de operação (groupby + sum)
   ├─ Calcular TOTAL_MOVIMENTO (soma de todos os valores)
   ├─ Definir STATUS_CONCILIACAO
   └─ Montar linha enriquecida

7. Construir DataFrame de saída com todas as colunas

8. Gerar Excel com openpyxl:
   ├─ Aba 1: Conciliação Completa (formatada por grupos de colunas)
   ├─ Aba 2: Resumo por Tipo (agregado)
   └─ Aba 3: Sem Correspondência (filtrado)

9. Salvar como Conciliacao_MercadoPago.xlsx

10. Reportar ao usuário:
    ├─ Total de linhas processadas
    ├─ Total conciliadas
    ├─ Total sem correspondência
    └─ Eventuais tipos novos detectados
```

---

## 8. Validação de Qualidade

Após gerar o arquivo, o agente deve verificar:

- [ ] O número de linhas na aba 1 é igual ao número de linhas do Extrato (excluindo cabeçalho)
- [ ] `TOTAL_MOVIMENTO` ≈ `VALOR_LIQUIDO_EXTRATO` para linhas conciliadas (pequenas diferenças podem existir por arredondamento)
- [ ] Nenhuma linha do Extrato foi duplicada ou omitida
- [ ] Todas as colunas de `TIPOS_MOVIMENTO` estão presentes, mesmo que completamente vazias
- [ ] A aba "Sem Correspondência" lista exatamente os mesmos IDs sem match
- [ ] Não há erros de fórmula (`#REF!`, `#DIV/0!`, `#VALUE!`) — rodar `scripts/recalc.py` se necessário

---

## 9. Dependências Python

```python
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
```

Não são necessárias bibliotecas externas além de `pandas` e `openpyxl`, ambas disponíveis no ambiente padrão.

---

## 10. Observações para Períodos Futuros

- Os arquivos exportados do Mercado Pago mantêm a mesma estrutura entre períodos
- O Extrato sempre terá 3 linhas de cabeçalho antes dos dados — isso é padrão do sistema
- Novos tipos de operação podem surgir (ex: novos tipos de tarifa ou crédito). O agente deve detectá-los e adicioná-los dinamicamente
- O campo `TRANSACTION_TYPE` no Extrato pode incluir o nome do destinatário/remetente (ex: `Pix enviado João da Silva`) — tratar como texto livre, sem normalização
- A coluna `PARTIAL_BALANCE` pode estar ausente em alguns lançamentos — preencher com `None` quando vazio
