# Sprint 4 — Recebimento e Estoque — desenho

Referências: `docs/1_ESPECIFICACAO_REQUISITOS.md` (RF2, RF3.5, RN1, RN2, RN5),
`docs/3_ESPECIFICACAO_APIS.md` (§APIs - Estoque, §PEDIDOS_COMPRA), migrations
`002_criar_tabelas_estoque.sql` e `003_criar_tabelas_compras.sql` (já existentes,
sem migration nova nesta sprint), `docs/6_CRONOGRAMA_TECNICO.md` (Sprint 4,
semanas 7-8).

## 1. Problema

Compras (Sprint 3) fecha o ciclo até "PC emitido", mas o pedido nunca chega ao
estoque de verdade: não há como registrar que os itens de um PC chegaram,
não há saldo de estoque visível em tela nenhuma, e o widget "Pedidos de compra
a receber" hoje é o único ponto de contato com o assunto. RF2 e RF3.5 pedem um
módulo de estoque com saldo por peça, histórico de movimentações, e o
recebimento de PC como a operação que finalmente conecta compra → estoque.

## 2. Escopo

**Dentro:**
- Saldo de estoque de Partes/Peças (leitura): total, reservado (sempre 0 nesta
  sprint), disponível, status (OK/CRÍTICO), localização.
- Movimentação de estoque (leitura): histórico com filtros por data,
  motivo, peça.
- Ajuste manual de estoque (RF2.1): entrada/saída avulsa com justificativa.
- Registrar recebimento de PC (RF3.5): recebimento total ou parcial, atualiza
  saldo, avança o status do PC.
- Alerta de estoque crítico: endpoint dedicado + widget no Painel.

**Fora, com o motivo:**
- Relatório de estoque/movimentações em PDF/CSV — Sprint 5, junto da mesma
  infraestrutura de exportação usada pelos relatórios de compras e produção.
- Reserva/bloqueio de estoque por OP e o status `BLOQUEADO` (RN1) — depende de
  Ordem de Produção, que não existe no código ainda (Sprint 6).
- Entrada de PA por conclusão de OP / `saldo_produto_acabado` (RF2.2) — mesma
  dependência de OP.
- Geração automática de necessidade de compra (RF3.2) — precisa cruzar OPs
  abertas + BOM, nenhum dos dois existe ainda.

Essas quatro decisões de corte foram validadas com o usuário: os itens
dependentes de OP ficam para o Sprint 6 (quando OP existir de verdade, em vez
de um substituto descartável agora), e o relatório fica para o Sprint 5 (uma
infraestrutura de exportação só, reaproveitada pelos três módulos).

## 3. Decisões tomadas

1. **`Emitir` do PC vai direto para `"Aguardando Entrega"`**, pulando
   `Emitido`/`Aceito`. Não existe, em nenhum RF, um passo de "confirmar aceite
   do fornecedor" — manter os dois estados intermediários sem transição própria
   seria inventar processo sem lastro no requisito. `Emitido`/`Aceito`
   continuam no enum (fiéis ao `CHECK chk_pc_status` do banco), só ficam
   inalcançáveis por enquanto.
2. **Ajuste manual de estoque entra nesta sprint**, apesar de a tabela do
   cronograma não citar o endpoint literalmente — RF2.1 e a doc 3 já o
   especificam, e o custo é baixo (reusa a mesma rotina de recálculo de saldo
   do recebimento).
3. **Recebimento é um Modal a partir do detalhe do PC**, não uma página nova —
   segue o precedente direto do Sprint 3 ("Registrar resposta" da cotação:
   mesma forma, lista fixa de itens, edita um campo por linha), em vez do nome
   literal "Página Recebimento de PC" do cronograma.
4. **Todo `parte_peca` criado ganha uma linha `saldo_estoque` zerada**, na
   mesma transação do cadastro — é o único jeito de `GET /estoque` listar
   "todas as Partes/Peças com status" (doc 3), não só as que já tiveram
   movimento.
5. **`quantidade_reservada` fica sempre 0 e `BLOQUEADO` nunca é usado** nesta
   sprint — os dois só ganham sentido com reserva por OP (Sprint 6). Os campos
   existem no schema desde a migration 002 e são preservados no domínio, só não
   são escritos por nenhum código novo.

## 4. Arquitetura

### 4.1 Domínio `estoque` (backend)

Pacote novo `backend/internal/domain/estoque`, mirror de `peca`/`produto`:

```go
const (
    StatusOK        = "OK"
    StatusCritico   = "CRITICO"
    StatusBloqueado = "BLOQUEADO" // reservado para o Sprint 6, nada escreve isso aqui
)

var (
    ErrPartePecaObrigatoria            = errors.New("informe a parte/peca")
    ErrPartePecaInexistente            = errors.New("a parte/peca informada nao existe")
    ErrQuantidadeAjusteObrigatoria     = errors.New("informe a quantidade do ajuste (diferente de zero)")
    ErrMotivoAjusteObrigatorio         = errors.New("informe o motivo do ajuste")
    ErrSaldoInsuficienteParaAjuste     = errors.New("o ajuste deixaria o saldo negativo")
    ErrNaoEncontrado                   = errors.New("saldo de estoque nao encontrado")
)

type Saldo struct {
    ID                  int64
    PartePecaID         int64
    QuantidadeAtual     int
    QuantidadeReservada int
    LocalizacaoArmazem  string
    Status              string
    UpdatedAt           time.Time
    UpdatedBy           *string
}

type Movimentacao struct {
    ID               int64
    PartePecaID      int64
    Tipo             string // "Entrada" | "Ajuste"
    Quantidade       int    // o delta aplicado ao saldo; nunca zero (CHECK chk_mov_quantidade),
                            // pode ser negativo num Ajuste de saida — o sinal carrega a direcao
    Motivo           string // "Compra" | "Ajuste"
    ReferenciaNumero *string
    Observacoes      string
    UsuarioID        *int64
    DataHora         time.Time
}

type AjusteDados struct {
    PartePecaID int64
    Quantidade  int // pode ser negativo (saida) ou positivo (entrada); nunca zero
    Motivo      string
    Observacoes string
}
```

`Repositorio` expõe: `BuscarSaldo(ctx, partePecaID)`, `ListarSaldo(ctx, params)`,
`ListarCriticos(ctx)`, `ListarMovimentacoes(ctx, params)`,
`BuscarMovimentacao(ctx, id)`, e o método transacional central:

```go
// AplicarMovimento grava uma movimentacao e ajusta o saldo, recalculando o
// status (OK/CRITICO) contra o estoque_minimo da peca. delta pode ser
// negativo. Usado tanto pelo ajuste manual quanto pelo recebimento de PC
// (Servico de pedidocompra chama isto atraves da interface, nao repete a
// logica).
AplicarMovimento(ctx context.Context, partePecaID int64, delta int, tipo, motivo string, referencia *string, observacoes string, autor string) (*Saldo, error)
```

`Servico.Ajustar(ctx, dados AjusteDados, autor string) (*Saldo, error)`: valida
`dados` (peça informada, quantidade != 0, motivo não vazio), chama
`repo.AplicarMovimento` com `tipo="Ajuste"`; o repositório mapeia violação do
`CHECK chk_saldo_quantidade` (saldo negativo) para `ErrSaldoInsuficienteParaAjuste`.

### 4.2 Mudanças em `pedidocompra`

- `Servico.Emitir`: `AtualizarStatus(ctx, id, StatusAguardandoEntrega, autor)`
  em vez de `StatusEmitido`.
- Novo erro: `ErrQuantidadeRecebidaExcedeSolicitada`.
- Novo tipo: `ItemRecebimentoDados { PartePecaID int64; QuantidadeRecebida int }`.
- Novo método:

```go
// RegistrarRecebimento soma quantidade_recebida por item (cumulativo — uma
// segunda chamada parcial soma sobre a primeira), aciona
// estoque.AplicarMovimento para cada item recebido nesta chamada (Entrada,
// motivo Compra, referencia = numero_pc), e recalcula o status do pedido:
// todos os itens completos -> Concluido (grava data_entrega_real = hoje);
// ao menos um item com recebimento parcial -> Recebido Parcial.
func (s *Servico) RegistrarRecebimento(ctx context.Context, id int64, itens []ItemRecebimentoDados, autor string) (*PedidoCompra, error)
```

Exige `Status` em `AguardandoEntrega` ou `RecebidoParcial`, senão
`ErrStatusInvalidoParaAcao`. Para receber o `Servico` de `pedidocompra` precisa
de uma dependência nova, `estoque.Servico` (ou uma interface estreita só com
`AplicarMovimento`) — injetada no construtor, mesmo padrão do acoplamento
`CotacaoHandler`→`pedidocompra.Servico` do Sprint 3.

### 4.3 Peça ganha saldo zerado ao nascer

`peca_repo.go` (`Criar`, já transacional): depois do `INSERT` em `partes_pecas`,
mais um `INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, status)
VALUES ($1, 0, 'CRITICO')` na mesma transação. Sempre nasce `CRITICO`
(`0 <= estoque_minimo` é verdade para qualquer `estoque_minimo >= 0`
cadastrável).

### 4.4 Repositório (Postgres)

`backend/internal/infra/repository/estoque_repo.go` — `ListarSaldo` faz
`JOIN` com `partes_pecas` para trazer código/descrição/estoque_minimo (a lista
de saldo não faz sentido sem esses dados, por isso não é um `SELECT` isolado em
`saldo_estoque`); `AplicarMovimento` é a única escrita, sempre dentro de uma
transação: `UPDATE saldo_estoque SET quantidade_atual = quantidade_atual +
$delta, status = CASE WHEN quantidade_atual + $delta <= estoque_minimo THEN
'CRITICO' ELSE 'OK' END, updated_by = $autor WHERE parte_peca_id = $1
RETURNING *` (o `estoque_minimo` vem de um `JOIN` com `partes_pecas` na mesma
query ou uma leitura antes, dentro da tx), seguido do `INSERT` em
`movimentacao_estoque`.

### 4.5 Endpoints (HTTP)

| Rota | Handler | Perfil |
|---|---|---|
| `GET /api/v1/estoque` | listar saldo (paginado, filtro `status`) | qualquer autenticado |
| `GET /api/v1/estoque/{parte_peca_id}` | saldo de uma PP | qualquer autenticado |
| `GET /api/v1/estoque/criticos` | atalho `status=CRITICO`, sem paginação | qualquer autenticado |
| `POST /api/v1/estoque/ajuste` | ajuste manual | Admin/Gestor |
| `GET /api/v1/movimentacoes` | histórico (filtros `data_inicio`/`data_fim`/`motivo`/`parte_peca_id`) | qualquer autenticado |
| `GET /api/v1/movimentacoes/{id}` | detalhe de uma movimentação | qualquer autenticado |
| `POST /api/v1/pedidos-compra/{id}/registrar-recebimento` | recebimento total/parcial | Admin/Gestor |

Mapa de erros (`errosEstoque`): `ErrNaoEncontrado`→404,
`ErrSaldoInsuficienteParaAjuste`→409 (conflito de estado, não erro de forma),
`ErrPartePecaInexistente`/`ErrPartePecaObrigatoria`/
`ErrQuantidadeAjusteObrigatoria`/`ErrMotivoAjusteObrigatorio`→400.
`registrar-recebimento` reusa `errosPedidoCompra` mais
`ErrQuantidadeRecebidaExcedeSolicitada`→400.

### 4.6 Frontend

- **`frontend/src/tipos/estoque.ts`**, **`servicos/estoque.ts`** — mirror de
  `compras.ts`: `SaldoEstoque`, `Movimentacao`, `listarEstoque`,
  `listarEstoqueCriticos`, `ajustarEstoque`, `listarMovimentacoes`.
- **`/estoque`** (nova, `paginas/estoque/Estoque.tsx`): `Tabela` com código,
  descrição, saldo atual, reservado, disponível (`atual - reservada`,
  calculado em tela), status (`Badge`: OK=done, CRITICO=warning,
  BLOQUEADO=blocked — mapa completo por consistência, embora inalcançável).
  Filtro de status inline (mesmo padrão de Cotações/PC). Botão "Ajustar
  saldo" por linha, abre `Modal` (quantidade, motivo, observações).
- **Modal de recebimento**, dentro de `DetalhePedidoCompra.tsx`: mesma
  estrutura do modal de "Registrar resposta" da cotação — lista fixa de itens
  (parte/peça, solicitada, já recebida, campo novo "receber agora"), soma
  client-side para não deixar exceder o saldo pendente por item, some ao
  fechar o PC.
- **Widget de alertas** no `Painel.tsx`: `listarEstoqueCriticos()`, mesmo
  padrão dos outros cards (vazio → "Nenhum item em estoque crítico."; com
  itens → contagem + lista de códigos).
- `NavegacaoLateral`: nova seção "Estoque" (não dentro de "Cadastros" nem
  "Compras") com o link `/estoque`. `Ajuda`: conteúdo novo para `/estoque`.

### 4.7 Erros e validação

Mesma convenção das sprints anteriores: sentinelas de domínio mapeadas por
`mapaDeErros`, `validator` com `dive` nos itens de recebimento, `noValidate`
nos formulários novos (Modal de ajuste, Modal de recebimento) desde o início —
não esperar a verificação final para aplicar a lição já conhecida do Sprint 2.

## 5. Testes

TDD, sem mocks (`testsupport.BancoMigrado`), mesmo rigor das sprints
anteriores. Casos-chave:

- **`estoque.Servico`**: ajuste positivo soma; ajuste negativo que mantém
  saldo ≥ 0 subtrai e recalcula status; ajuste negativo que deixaria saldo
  negativo falha (`ErrSaldoInsuficienteParaAjuste`); status vira `CRITICO`
  quando `quantidade_atual <= estoque_minimo` e volta a `OK` quando sobe
  acima; peça nova aparece em `ListarSaldo` com saldo 0 e `CRITICO` antes de
  qualquer movimento.
- **`pedidocompra.Servico.RegistrarRecebimento`**: recebimento parcial não
  fecha o PC (`Recebido Parcial`); segunda chamada soma sobre a primeira, não
  substitui; recebimento que completa todos os itens fecha o PC
  (`Concluido`) e grava `data_entrega_real`; receber além do solicitado falha;
  recebimento fora de `AguardandoEntrega`/`RecebidoParcial` falha; cada
  recebimento gera uma `movimentacao_estoque` do tipo `Entrada`/`Compra` com
  a referência do `numero_pc`.
- **Handlers**: `GET /estoque` pagina e filtra por status; `GET
  /estoque/criticos` não pagina; `POST /estoque/ajuste` 201/400/409 conforme
  os casos de domínio; `POST /pedidos-compra/{id}/registrar-recebimento`
  200/400/409; perfil Operador recebe 403 em `POST /estoque/ajuste` e no
  recebimento, mas 200 nos `GET`.
- **Frontend**: página de Estoque mostra saldo/status/filtro; modal de ajuste
  envia o corpo certo e trata 409; modal de recebimento não deixa exceder o
  saldo pendente por item e atualiza a trilha/status do PC ao fechar; widget
  do Painel mostra a lista de críticos ou a mensagem vazia.
- **Verificação final** (mesmo roteiro das sprints 2 e 3): suíte + lint +
  build, Playwright real cobrindo ajuste de estoque, recebimento parcial e
  recebimento total de um PC, checagem de grayscale/teclado/800px nas telas
  novas, passo "tirar um acessório".

## 6. Verificação antes de entregar

- `go build ./...`, `go vet ./...`, `gofmt -l .`, `go test ./...` (backend)
  e `npm test`, `npm run lint`, `npm run build` (frontend) — todos verdes,
  incluindo a suíte inteira das sprints anteriores (336 backend / 275
  frontend antes desta sprint).
- Fluxo manual ponta a ponta contra Postgres real: criar peça → aparece em
  `/estoque` com saldo 0/CRÍTICO → criar cotação → enviar → responder →
  converter em PC → emitir (já cai em Aguardando Entrega) → registrar
  recebimento parcial → registrar o restante → PC fecha como Concluído →
  saldo da peça sobe e sai de CRÍTICO (se acima do mínimo) → ajuste manual
  negativo demais é rejeitado.
- Screenshots da tela de Estoque, do modal de recebimento e do widget de
  alertas em `docs/screenshots/`, seguindo a numeração sequencial já em uso.
- `docs/8_MANUAL_OPERACAO.md` ganha a seção de Estoque/Recebimento.
- `.superpowers/sdd/progress.md` atualizado tarefa por tarefa, com
  `task-N-brief.md`/`task-N-report.md` registrados no mesmo momento de cada
  tarefa — não repetir a lacuna já corrigida retroativamente para as Tasks 18
  e 20 anteriores.

## 7. Riscos

- **Recebimento cumulativo com concorrência**: duas chamadas simultâneas de
  `RegistrarRecebimento` no mesmo PC poderiam ler o mesmo `quantidade_recebida`
  antes de somar (perda de atualização). Mitigado com `UPDATE ... SET
  quantidade_recebida = quantidade_recebida + $delta ... RETURNING` (soma
  atômica no banco, não um `SELECT` seguido de `UPDATE` em Go) — mesmo
  cuidado que `cotacao_repo.go` já teve com o cast `::numeric` no Sprint 3.
- **`BLOQUEADO`/`quantidade_reservada` inalcançáveis nesta sprint**: risco de
  parecerem "mortos" no código. Mitigado documentando no próprio domínio
  (comentário) que são reservados para o Sprint 6, não recém-esquecidos.
- **Acoplamento `pedidocompra` → `estoque`**: o `Servico` de PC passa a
  depender de `estoque.Servico`. Mitigado com uma interface estreita
  (`AplicadorDeMovimento` ou similar) em vez do tipo concreto, mesmo padrão
  já usado para as demais dependências entre módulos.
