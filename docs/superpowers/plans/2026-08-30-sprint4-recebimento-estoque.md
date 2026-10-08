# Sprint 4 — Recebimento e Estoque — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o ciclo compra→estoque: saldo de estoque visível e consultável, ajuste manual, recebimento de Pedido de Compra (total ou parcial) que atualiza saldo e avança o status do PC, e alerta de estoque crítico no Painel.

**Architecture:** Pacote de domínio novo `estoque` (mirror de `peca`/`cotacao`), com um único método de escrita central (`AplicarMovimento`) usado tanto pelo ajuste manual quanto — via dependência direta de `pedidocompra.Servico` sobre `*estoque.Servico`, mesmo padrão de acoplamento concreto já usado por `CotacaoHandler`→`pedidocompra.Servico` no Sprint 3 — pelo recebimento de PC. Frontend replica o padrão de `compras.ts`/`useListagemCompras` num módulo próprio `estoque.ts`/`useListagemEstoque`, e o recebimento vira um Modal dentro de `DetalhePedidoCompra.tsx` (mesmo padrão do "Registrar resposta" da cotação), não uma página nova.

**Tech Stack:** Go 1.25 + Echo + pgx/v5 (backend), React 18 + TypeScript + Vite + Tailwind + TanStack Query v5 + react-hook-form (frontend), Vitest + Testing Library, Playwright para verificação final. TDD, sem mocks (`testsupport.BancoMigrado` roda contra Postgres real).

## Global Constraints

- Spec aprovada: `docs/superpowers/specs/2026-08-30-sprint4-estoque-recebimento-design.md` — toda tarefa abaixo implementa uma seção dela.
- Sem migration nova: `saldo_estoque`, `movimentacao_estoque` já existem desde `002_criar_tabelas_estoque.sql`, e `peca_repo.go.Criar` **já** grava a linha de saldo zerada/`CRITICO` na mesma transação da peça (achado durante a pesquisa desta sprint — não é preciso nenhum código novo para isso; ver Notas de revisão).
- `quantidade_reservada` e o status `BLOQUEADO` permanecem sempre 0 / inalcançáveis nesta sprint (dependem de OP, Sprint 6) — não escrever nenhum código que os produza.
- Filtro de status do estoque usa a query string `status` (não `filtro_status`, como a doc 3 sugere) — mesma convenção já implementada por `consulta.AnalisarComStatus` nas Sprints 3 (cotação/PC), reaproveitada sem alterar `consulta.go`.
- Emitir um PC vai direto para `"Aguardando Entrega"` (não mais `"Emitido"`) — `StatusEmitido`/`StatusAceito` continuam no enum (fiéis ao `CHECK chk_pc_status`), só ficam inalcançáveis.
- Todo texto de interface em português, sentence-case, ícone+cor+texto (nunca só cor) — §7 do design system.
- `noValidate` em todo `<form>`/formulário novo desde o primeiro commit — lição do Sprint 2, não esperar a verificação final.
- Branch: `feat/sprint4-recebimento-estoque`, empilhada sobre `feat/sprint3-cotacoes-pedidos-compra` (PR #2, ainda aberta).

---

## Backend

### Task B1: Domínio `estoque` — modelo, erros e validação

**Files:**
- Create: `backend/internal/domain/estoque/estoque.go`
- Create: `backend/internal/domain/estoque/estoque_test.go`

**Interfaces:**
- Consumes: nada (pacote novo, sem dependência de outro domínio).
- Produces: `estoque.Saldo`, `estoque.Movimentacao`, `estoque.AjusteDados`, as constantes `estoque.StatusOK`/`StatusCritico`/`StatusBloqueado`, `estoque.TipoEntrada`/`TipoAjuste`, `estoque.MotivoCompra`/`MotivoAjuste`, e as sentinelas de erro — usados pela Task B2 (serviço) e pela Task B4 (`pedidocompra`).

```go
// Package estoque controla o saldo de Partes/Pecas e o historico de
// movimentacoes (RF2). Reserva por OP e o status BLOQUEADO ficam para o
// Sprint 6 -- o campo QuantidadeReservada e a constante StatusBloqueado
// existem para espelhar o schema (CHECK chk_saldo_status), mas nenhum
// codigo desta sprint os escreve.
package estoque

import (
	"errors"
	"strings"
	"time"
)

// Status possiveis do saldo (CHECK chk_saldo_status da migration 002).
const (
	StatusOK        = "OK"
	StatusCritico   = "CRITICO"
	StatusBloqueado = "BLOQUEADO"
)

// Tipo de movimentacao (CHECK chk_mov_tipo). Saida fica para o Sprint 6,
// junto da baixa de estoque por abertura de OP.
const (
	TipoEntrada = "Entrada"
	TipoAjuste  = "Ajuste"
)

// Motivo da movimentacao (RF2.3). Devolucao/OP ficam para sprints futuras.
const (
	MotivoCompra = "Compra"
	MotivoAjuste = "Ajuste"
)

var (
	ErrPartePecaObrigatoria        = errors.New("informe a parte/peca")
	ErrPartePecaInexistente        = errors.New("a parte/peca informada nao existe")
	ErrQuantidadeAjusteObrigatoria = errors.New("informe a quantidade do ajuste (diferente de zero)")
	ErrMotivoAjusteObrigatorio     = errors.New("informe o motivo do ajuste")
	ErrSaldoInsuficienteParaAjuste = errors.New("o ajuste deixaria o saldo negativo")
	ErrNaoEncontrado               = errors.New("saldo de estoque nao encontrado")
	ErrMovimentacaoNaoEncontrada   = errors.New("movimentacao nao encontrada")
)

// Saldo e a posicao de estoque de uma Parte/Peca.
type Saldo struct {
	ID                  int64     `json:"id"`
	PartePecaID         int64     `json:"parte_peca_id"`
	Codigo              string    `json:"codigo"`
	Descricao           string    `json:"descricao"`
	QuantidadeAtual     int       `json:"quantidade_atual"`
	QuantidadeReservada int       `json:"quantidade_reservada"`
	Disponivel          int       `json:"disponivel"`
	EstoqueMinimo       int       `json:"estoque_minimo"`
	LocalizacaoArmazem  string    `json:"localizacao_armazem,omitempty"`
	Status              string    `json:"status"`
	UpdatedAt           time.Time `json:"updated_at"`
	UpdatedBy           *string   `json:"updated_by,omitempty"`
}

// Movimentacao e um lancamento de entrada/ajuste no historico (RF2.3).
type Movimentacao struct {
	ID               int64     `json:"id"`
	PartePecaID      int64     `json:"parte_peca_id"`
	Codigo           string    `json:"codigo_pp"`
	Tipo             string    `json:"tipo"`
	Quantidade       int       `json:"quantidade"`
	Motivo           string    `json:"motivo"`
	ReferenciaNumero *string   `json:"referencia_numero,omitempty"`
	Observacoes      string    `json:"observacoes,omitempty"`
	Usuario          *string   `json:"usuario,omitempty"`
	DataHora         time.Time `json:"data_hora"`
}

// AjusteDados sao os campos informados no ajuste manual (RF2.1).
type AjusteDados struct {
	PartePecaID int64
	// Quantidade e o delta a aplicar: positivo (entrada) ou negativo
	// (saida), nunca zero.
	Quantidade  int
	Motivo      string
	Observacoes string
}

// Normalizar limpa espacos do motivo e das observacoes.
func (d *AjusteDados) Normalizar() {
	d.Motivo = strings.TrimSpace(d.Motivo)
	d.Observacoes = strings.TrimSpace(d.Observacoes)
}

// Validar aplica as regras de forma do ajuste (nao a de saldo suficiente --
// essa depende do saldo atual, verificada pelo repositorio dentro da
// transacao, para nao correr risco de condicao de corrida).
func (d AjusteDados) Validar() error {
	if d.PartePecaID <= 0 {
		return ErrPartePecaObrigatoria
	}
	if d.Quantidade == 0 {
		return ErrQuantidadeAjusteObrigatoria
	}
	if strings.TrimSpace(d.Motivo) == "" {
		return ErrMotivoAjusteObrigatorio
	}
	return nil
}

// SituacaoDoSaldo classifica o saldo informado contra o minimo (RN5) --
// mesma regra de fronteira inclusiva de peca.PartePeca.SituacaoDoSaldo:
// saldo igual ao minimo ja e critico.
func SituacaoDoSaldo(saldo, minimo int) string {
	if saldo <= minimo {
		return StatusCritico
	}
	return StatusOK
}
```

- [ ] **Step 1: Escrever os testes (falhando)**

```go
package estoque_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidarExigePartePeca(t *testing.T) {
	d := estoque.AjusteDados{Quantidade: 10, Motivo: "Inventario"}
	require.ErrorIs(t, d.Validar(), estoque.ErrPartePecaObrigatoria)
}

func TestValidarExigeQuantidadeDiferenteDeZero(t *testing.T) {
	d := estoque.AjusteDados{PartePecaID: 1, Quantidade: 0, Motivo: "Inventario"}
	require.ErrorIs(t, d.Validar(), estoque.ErrQuantidadeAjusteObrigatoria)
}

func TestValidarAceitaQuantidadeNegativa(t *testing.T) {
	d := estoque.AjusteDados{PartePecaID: 1, Quantidade: -5, Motivo: "Perda"}
	require.NoError(t, d.Validar())
}

func TestValidarExigeMotivo(t *testing.T) {
	d := estoque.AjusteDados{PartePecaID: 1, Quantidade: 10}
	require.ErrorIs(t, d.Validar(), estoque.ErrMotivoAjusteObrigatorio)
}

func TestNormalizarLimpaEspacos(t *testing.T) {
	d := estoque.AjusteDados{PartePecaID: 1, Quantidade: 10, Motivo: "  Inventario  ", Observacoes: "  ok  "}
	d.Normalizar()
	assert.Equal(t, "Inventario", d.Motivo)
	assert.Equal(t, "ok", d.Observacoes)
}

func TestSituacaoDoSaldoCriticoNaFronteira(t *testing.T) {
	assert.Equal(t, estoque.StatusCritico, estoque.SituacaoDoSaldo(5, 5))
}

func TestSituacaoDoSaldoOKAcimaDoMinimo(t *testing.T) {
	assert.Equal(t, estoque.StatusOK, estoque.SituacaoDoSaldo(6, 5))
}

func TestSituacaoDoSaldoCriticoAbaixoDoMinimo(t *testing.T) {
	assert.Equal(t, estoque.StatusCritico, estoque.SituacaoDoSaldo(0, 5))
}
```

Run: `cd backend && go test ./internal/domain/estoque/...`
Expected: FAIL — pacote `estoque` não existe.

- [ ] **Step 2: Implementar `estoque.go`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd backend && go test ./internal/domain/estoque/...`
Expected: PASS — 8 testes.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/domain/estoque
git commit -m "feat(backend): dominio de estoque"
```

---

### Task B2: `estoque.Servico` e `EstoqueRepositorio` (Postgres)

**Files:**
- Create: `backend/internal/domain/estoque/servico.go`
- Create: `backend/internal/domain/estoque/servico_test.go`
- Create: `backend/internal/infra/repository/estoque_repo.go`
- Create: `backend/internal/infra/repository/estoque_repo_test.go`

**Interfaces:**
- Consumes: `estoque.Saldo`/`Movimentacao`/`AjusteDados`/erros/constantes (Task B1); `consulta.Parametros`/`consulta.AnalisarComStatus` (já existentes); `violouChaveEstrangeira` (já existente em `infra/repository/erros.go`).
- Produces: `estoque.Servico` com `Ajustar`, `AplicarMovimento`, `BuscarSaldo`, `ListarSaldo`, `ListarCriticos`, `ListarMovimentacoes`, `BuscarMovimentacao`, `ColunasOrdenaveis`, `StatusPermitidos` — consumidos pela Task B3 (handler) e pela Task B4 (`pedidocompra.Servico.RegistrarRecebimento`, via `AplicarMovimento`).

**Por que domínio e repositório juntos nesta tarefa**: como nas Sprints 3 (B2+B3+B4, B7+B8), `servico_test.go` só compila e passa contra uma implementação real de `Repositorio` — os testes de serviço de domínio deste projeto rodam sobre Postgres real via `testsupport.BancoMigrado`, sem mocks.

```go
// servico.go
package estoque

import (
	"context"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
)

// ColunasOrdenaveis restringe o `ordenar_por` da listagem de saldo.
var ColunasOrdenaveis = []string{"codigo", "quantidade_atual", "status", "updated_at"}

// StatusPermitidos restringe o filtro `status` (consulta.AnalisarComStatus).
// BLOQUEADO entra na lista por fidelidade ao CHECK do banco, mesmo
// inalcançavel nesta sprint -- um filtro que nunca traz resultado nao e o
// mesmo que um filtro invalido.
var StatusPermitidos = []string{StatusOK, StatusCritico, StatusBloqueado}

// Repositorio e a porta de persistencia do estoque.
type Repositorio interface {
	BuscarSaldo(ctx context.Context, partePecaID int64) (*Saldo, error)
	ListarSaldo(ctx context.Context, params consulta.Parametros) ([]Saldo, int, error)
	ListarCriticos(ctx context.Context) ([]Saldo, error)
	ListarMovimentacoes(ctx context.Context, params consulta.Parametros) ([]Movimentacao, int, error)
	BuscarMovimentacao(ctx context.Context, id int64) (*Movimentacao, error)
	// AplicarMovimento grava uma movimentacao e ajusta o saldo dentro de
	// uma unica transacao, recalculando o status (OK/CRITICO) contra o
	// estoque_minimo da peca. delta pode ser negativo (ajuste de saida).
	AplicarMovimento(ctx context.Context, partePecaID int64, delta int, tipo, motivo string, referencia *string, observacoes, autor string) (*Saldo, error)
}

// Servico reune os casos de uso de estoque.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo}
}

func (s *Servico) BuscarSaldo(ctx context.Context, partePecaID int64) (*Saldo, error) {
	return s.repo.BuscarSaldo(ctx, partePecaID)
}

func (s *Servico) ListarSaldo(ctx context.Context, params consulta.Parametros) ([]Saldo, int, error) {
	return s.repo.ListarSaldo(ctx, params)
}

func (s *Servico) ListarCriticos(ctx context.Context) ([]Saldo, error) {
	return s.repo.ListarCriticos(ctx)
}

func (s *Servico) ListarMovimentacoes(ctx context.Context, params consulta.Parametros) ([]Movimentacao, int, error) {
	return s.repo.ListarMovimentacoes(ctx, params)
}

func (s *Servico) BuscarMovimentacao(ctx context.Context, id int64) (*Movimentacao, error) {
	return s.repo.BuscarMovimentacao(ctx, id)
}

// Ajustar registra um ajuste manual de estoque (RF2.1).
func (s *Servico) Ajustar(ctx context.Context, dados AjusteDados, autor string) (*Saldo, error) {
	dados.Normalizar()
	if err := dados.Validar(); err != nil {
		return nil, err
	}
	return s.repo.AplicarMovimento(ctx, dados.PartePecaID, dados.Quantidade, TipoAjuste, MotivoAjuste, nil, dados.Observacoes, autor)
}

// AplicarMovimento e o ponto de entrada usado por quem nao e um ajuste
// manual -- hoje so pedidocompra.Servico.RegistrarRecebimento, via
// dependencia direta deste *Servico (mesmo padrao de acoplamento concreto
// que CotacaoHandler ja usa sobre *pedidocompra.Servico).
func (s *Servico) AplicarMovimento(ctx context.Context, partePecaID int64, delta int, tipo, motivo string, referencia *string, observacoes, autor string) (*Saldo, error) {
	return s.repo.AplicarMovimento(ctx, partePecaID, delta, tipo, motivo, referencia, observacoes, autor)
}
```

`estoque_repo.go`:

```go
package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasSaldo = `se.id, se.parte_peca_id, pp.codigo, pp.descricao, se.quantidade_atual,
	se.quantidade_reservada, pp.estoque_minimo, coalesce(se.localizacao_armazem, ''),
	se.status, se.updated_at, se.updated_by`

const colunasMovimentacao = `m.id, m.parte_peca_id, pp.codigo, m.tipo, m.quantidade, m.motivo,
	m.referencia_numero, coalesce(m.observacoes, ''), u.username, m.data_hora`

// EstoqueRepositorio implementa estoque.Repositorio sobre PostgreSQL.
type EstoqueRepositorio struct {
	pool *pgxpool.Pool
}

// NovoEstoqueRepositorio cria o repositorio de estoque.
func NovoEstoqueRepositorio(pool *pgxpool.Pool) *EstoqueRepositorio {
	return &EstoqueRepositorio{pool: pool}
}

func escanearSaldo(linha interface{ Scan(...any) error }) (estoque.Saldo, error) {
	var s estoque.Saldo
	err := linha.Scan(
		&s.ID, &s.PartePecaID, &s.Codigo, &s.Descricao, &s.QuantidadeAtual,
		&s.QuantidadeReservada, &s.EstoqueMinimo, &s.LocalizacaoArmazem,
		&s.Status, &s.UpdatedAt, &s.UpdatedBy,
	)
	s.Disponivel = s.QuantidadeAtual - s.QuantidadeReservada
	return s, err
}

// BuscarSaldo devolve o saldo de uma Parte/Peca especifica.
func (r *EstoqueRepositorio) BuscarSaldo(ctx context.Context, partePecaID int64) (*estoque.Saldo, error) {
	linha := r.pool.QueryRow(ctx,
		`SELECT `+colunasSaldo+` FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id
		 WHERE se.parte_peca_id = $1`, partePecaID)
	s, err := escanearSaldo(linha)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, estoque.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar saldo de estoque: %w", err)
	}
	return &s, nil
}

// ListarSaldo traz o saldo de todas as Partes/Pecas, paginado e filtrado por
// status -- e um JOIN com partes_pecas, nao um SELECT isolado em
// saldo_estoque, porque a listagem nao faz sentido sem codigo/descricao.
func (r *EstoqueRepositorio) ListarSaldo(ctx context.Context, params consulta.Parametros) ([]estoque.Saldo, int, error) {
	filtros, argumentos := filtrosDeEstoque(params)

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT count(*) FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id `+filtros,
		argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar saldo de estoque: %w", err)
	}

	ordenarPor := params.OrdenarPor
	if ordenarPor == "codigo" || ordenarPor == "quantidade_atual" || ordenarPor == "status" || ordenarPor == "updated_at" {
		ordenarPor = "se." + ordenarPor
		if params.OrdenarPor == "codigo" {
			ordenarPor = "pp.codigo"
		}
	}
	sql := fmt.Sprintf(
		"SELECT %s FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id %s ORDER BY %s %s LIMIT $%d OFFSET $%d",
		colunasSaldo, filtros, ordenarPor, params.Ordem.SQL(), len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := r.pool.Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar saldo de estoque: %w", err)
	}
	defer linhas.Close()

	itens := make([]estoque.Saldo, 0, params.Limite)
	for linhas.Next() {
		s, err := escanearSaldo(linhas)
		if err != nil {
			return nil, 0, err
		}
		itens = append(itens, s)
	}
	return itens, total, linhas.Err()
}

// ListarCriticos e um atalho de ListarSaldo para status=CRITICO, sem
// paginacao -- e um alerta operacional, lista curta por natureza.
func (r *EstoqueRepositorio) ListarCriticos(ctx context.Context) ([]estoque.Saldo, error) {
	linhas, err := r.pool.Query(ctx,
		`SELECT `+colunasSaldo+` FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id
		 WHERE se.status = $1 ORDER BY pp.codigo`, estoque.StatusCritico)
	if err != nil {
		return nil, fmt.Errorf("listar itens criticos: %w", err)
	}
	defer linhas.Close()

	itens := make([]estoque.Saldo, 0)
	for linhas.Next() {
		s, err := escanearSaldo(linhas)
		if err != nil {
			return nil, err
		}
		itens = append(itens, s)
	}
	return itens, linhas.Err()
}

// ListarMovimentacoes traz o historico, paginado e filtrado por
// data/motivo/parte_peca_id.
func (r *EstoqueRepositorio) ListarMovimentacoes(ctx context.Context, params consulta.Parametros) ([]estoque.Movimentacao, int, error) {
	filtros, argumentos := filtrosDeCadastro(params)

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT count(*) FROM movimentacao_estoque m JOIN partes_pecas pp ON pp.id = m.parte_peca_id `+filtros,
		argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar movimentacoes: %w", err)
	}

	sql := fmt.Sprintf(
		`SELECT %s FROM movimentacao_estoque m
		 JOIN partes_pecas pp ON pp.id = m.parte_peca_id
		 LEFT JOIN usuarios u ON u.id = m.usuario_id
		 %s ORDER BY m.data_hora DESC LIMIT $%d OFFSET $%d`,
		colunasMovimentacao, filtros, len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := r.pool.Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar movimentacoes: %w", err)
	}
	defer linhas.Close()

	itens := make([]estoque.Movimentacao, 0, params.Limite)
	for linhas.Next() {
		var m estoque.Movimentacao
		if err := linhas.Scan(
			&m.ID, &m.PartePecaID, &m.Codigo, &m.Tipo, &m.Quantidade, &m.Motivo,
			&m.ReferenciaNumero, &m.Observacoes, &m.Usuario, &m.DataHora,
		); err != nil {
			return nil, 0, err
		}
		itens = append(itens, m)
	}
	return itens, total, linhas.Err()
}

func (r *EstoqueRepositorio) BuscarMovimentacao(ctx context.Context, id int64) (*estoque.Movimentacao, error) {
	var m estoque.Movimentacao
	err := r.pool.QueryRow(ctx,
		`SELECT `+colunasMovimentacao+` FROM movimentacao_estoque m
		 JOIN partes_pecas pp ON pp.id = m.parte_peca_id
		 LEFT JOIN usuarios u ON u.id = m.usuario_id
		 WHERE m.id = $1`, id).Scan(
		&m.ID, &m.PartePecaID, &m.Codigo, &m.Tipo, &m.Quantidade, &m.Motivo,
		&m.ReferenciaNumero, &m.Observacoes, &m.Usuario, &m.DataHora,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, estoque.ErrMovimentacaoNaoEncontrada
		}
		return nil, fmt.Errorf("buscar movimentacao: %w", err)
	}
	return &m, nil
}

// AplicarMovimento e a unica escrita do modulo: le o saldo atual e o
// estoque_minimo com FOR UPDATE (trava a linha -- uma segunda chamada
// concorrente para a mesma peca espera esta transacao terminar, em vez de
// ler um valor que esta prestes a mudar), decide o novo saldo e status em
// Go, grava as duas tabelas na mesma transacao.
func (r *EstoqueRepositorio) AplicarMovimento(
	ctx context.Context, partePecaID int64, delta int, tipo, motivo string, referencia *string, observacoes, autor string,
) (*estoque.Saldo, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var quantidadeAtual, estoqueMinimo int
	err = tx.QueryRow(ctx,
		`SELECT se.quantidade_atual, pp.estoque_minimo
		 FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id
		 WHERE se.parte_peca_id = $1 FOR UPDATE OF se`, partePecaID,
	).Scan(&quantidadeAtual, &estoqueMinimo)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, estoque.ErrPartePecaInexistente
		}
		return nil, fmt.Errorf("travar saldo de estoque: %w", err)
	}

	novoSaldo := quantidadeAtual + delta
	if novoSaldo < 0 {
		return nil, estoque.ErrSaldoInsuficienteParaAjuste
	}
	novoStatus := estoque.SituacaoDoSaldo(novoSaldo, estoqueMinimo)

	if _, err := tx.Exec(ctx,
		`UPDATE saldo_estoque SET quantidade_atual = $1, status = $2, updated_by = $3 WHERE parte_peca_id = $4`,
		novoSaldo, novoStatus, autor, partePecaID,
	); err != nil {
		return nil, fmt.Errorf("atualizar saldo de estoque: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO movimentacao_estoque (parte_peca_id, tipo, quantidade, motivo, referencia_numero, observacoes, usuario_id)
		 VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), (SELECT id FROM usuarios WHERE username = $7))`,
		partePecaID, tipo, delta, motivo, referencia, observacoes, autor,
	); err != nil {
		return nil, fmt.Errorf("gravar movimentacao de estoque: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("confirmar movimento de estoque: %w", err)
	}
	return r.BuscarSaldo(ctx, partePecaID)
}
```

`filtrosDeEstoque` em `filtros.go` (nova função, mesmo arquivo das Tasks B3/B4 da Sprint 3):

```go
// filtrosDeEstoque monta o WHERE da listagem de saldo: filtro por status
// (OK/CRITICO/BLOQUEADO), sem busca textual nesta tela (a lista de estoque
// nao tem campo de busca no design aprovado).
func filtrosDeEstoque(params consulta.Parametros) (string, []any) {
	if params.FiltroStatus == nil {
		return "", nil
	}
	return "WHERE se.status = $1", []any{*params.FiltroStatus}
}
```

- [ ] **Step 1: Escrever `estoque_repo_test.go` e `servico_test.go` (falhando)**

`estoque_repo_test.go` (contra `testsupport.BancoMigrado`; a fixture de peça já grava um saldo zerado via `peca_repo.go`, então cada teste começa criando uma peça, não inserindo saldo diretamente):

```go
package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func criarPeca(t *testing.T, pool *pgxpool.Pool, codigo string, estoqueMinimo int) *peca.PartePeca {
	t.Helper()
	repo := repository.NovoPecaRepositorio(pool)
	p := &peca.PartePeca{
		Codigo: codigo, Descricao: "Peca de teste do estoque", UnidadeMedida: "und",
		EstoqueMinimo: estoqueMinimo, EstoqueMaximo: estoqueMinimo + 100, LeadTimeCompra: 7, Ativo: true,
	}
	require.NoError(t, repo.Criar(context.Background(), p, "teste"))
	return p
}

func TestAplicarMovimentoSomaEEntraOK(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	p := criarPeca(t, pool, "EST-001", 5)
	repo := repository.NovoEstoqueRepositorio(pool)

	saldo, err := repo.AplicarMovimento(context.Background(), p.ID, 10, estoque.TipoEntrada, estoque.MotivoCompra, nil, "", "teste")

	require.NoError(t, err)
	require.Equal(t, 10, saldo.QuantidadeAtual)
	require.Equal(t, estoque.StatusOK, saldo.Status)
}

func TestAplicarMovimentoNegativoQueDeixariaSaldoNegativoFalha(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	p := criarPeca(t, pool, "EST-002", 5)
	repo := repository.NovoEstoqueRepositorio(pool)

	_, err := repo.AplicarMovimento(context.Background(), p.ID, -1, estoque.TipoAjuste, estoque.MotivoAjuste, nil, "estorno", "teste")

	require.ErrorIs(t, err, estoque.ErrSaldoInsuficienteParaAjuste)
}

func TestAplicarMovimentoRecalculaStatusCritico(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	p := criarPeca(t, pool, "EST-003", 5)
	repo := repository.NovoEstoqueRepositorio(pool)

	_, err := repo.AplicarMovimento(context.Background(), p.ID, 10, estoque.TipoEntrada, estoque.MotivoCompra, nil, "", "teste")
	require.NoError(t, err)

	saldo, err := repo.AplicarMovimento(context.Background(), p.ID, -8, estoque.TipoAjuste, estoque.MotivoAjuste, nil, "saida", "teste")
	require.NoError(t, err)
	require.Equal(t, 2, saldo.QuantidadeAtual)
	require.Equal(t, estoque.StatusCritico, saldo.Status)
}

func TestAplicarMovimentoComPartePecaInexistenteFalha(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoEstoqueRepositorio(pool)

	_, err := repo.AplicarMovimento(context.Background(), 999999, 10, estoque.TipoEntrada, estoque.MotivoCompra, nil, "", "teste")

	require.ErrorIs(t, err, estoque.ErrPartePecaInexistente)
}

func TestAplicarMovimentoGravaReferenciaEMotivo(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	p := criarPeca(t, pool, "EST-004", 5)
	repo := repository.NovoEstoqueRepositorio(pool)
	ref := "PC-2026-001"

	_, err := repo.AplicarMovimento(context.Background(), p.ID, 20, estoque.TipoEntrada, estoque.MotivoCompra, &ref, "", "teste")
	require.NoError(t, err)

	movs, total, err := repo.ListarMovimentacoes(context.Background(), consulta.Parametros{Pagina: 1, Limite: 10, OrdenarPor: "data_hora", Ordem: consulta.Decrescente})
	require.NoError(t, err)
	require.Equal(t, 1, total)
	require.Equal(t, "PC-2026-001", *movs[0].ReferenciaNumero)
	require.Equal(t, estoque.MotivoCompra, movs[0].Motivo)
}

func TestListarSaldoFiltraPorStatus(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	criarPeca(t, pool, "EST-005", 100) // nasce critico (saldo 0 <= minimo 100)
	repo := repository.NovoEstoqueRepositorio(pool)
	statusCritico := estoque.StatusCritico

	itens, total, err := repo.ListarSaldo(context.Background(), consulta.Parametros{
		Pagina: 1, Limite: 50, OrdenarPor: "codigo", Ordem: consulta.Crescente, FiltroStatus: &statusCritico,
	})

	require.NoError(t, err)
	require.GreaterOrEqual(t, total, 1)
	for _, item := range itens {
		require.Equal(t, estoque.StatusCritico, item.Status)
	}
}

func TestListarCriticosNaoPagina(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	criarPeca(t, pool, "EST-006", 100)
	repo := repository.NovoEstoqueRepositorio(pool)

	itens, err := repo.ListarCriticos(context.Background())

	require.NoError(t, err)
	require.NotEmpty(t, itens)
}

func TestBuscarSaldoDeParteInexistenteFalha(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoEstoqueRepositorio(pool)

	_, err := repo.BuscarSaldo(context.Background(), 999999)

	require.ErrorIs(t, err, estoque.ErrNaoEncontrado)
}
```

`servico_test.go` (mais leve — a maior parte da lógica já está coberta no repositório; o serviço só testa a validação de `Ajustar`):

```go
package estoque_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/require"
)

func TestAjustarRejeitaQuantidadeZero(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	servico := estoque.NovoServico(repository.NovoEstoqueRepositorio(pool))

	_, err := servico.Ajustar(context.Background(), estoque.AjusteDados{PartePecaID: 1, Quantidade: 0, Motivo: "x"}, "teste")

	require.ErrorIs(t, err, estoque.ErrQuantidadeAjusteObrigatoria)
}

func TestAjustarNormalizaEAplica(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	pecaRepo := repository.NovoPecaRepositorio(pool)
	p := &peca.PartePeca{Codigo: "SRV-001", Descricao: "Peca do servico", UnidadeMedida: "und", EstoqueMinimo: 1, EstoqueMaximo: 100, LeadTimeCompra: 5, Ativo: true}
	require.NoError(t, pecaRepo.Criar(context.Background(), p, "teste"))

	servico := estoque.NovoServico(repository.NovoEstoqueRepositorio(pool))
	saldo, err := servico.Ajustar(context.Background(), estoque.AjusteDados{
		PartePecaID: p.ID, Quantidade: 15, Motivo: "  Inventario  ", Observacoes: "  recontagem  ",
	}, "teste")

	require.NoError(t, err)
	require.Equal(t, 15, saldo.QuantidadeAtual)
}
```

Run: `cd backend && go test ./internal/domain/estoque/... ./internal/infra/repository/... -run Estoque`
Expected: FAIL — `EstoqueRepositorio`/`estoque.Servico` não existem.

- [ ] **Step 2: Implementar `servico.go`, `estoque_repo.go` e `filtrosDeEstoque`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd backend && go test ./internal/domain/estoque/... ./internal/infra/repository/... -run Estoque`
Expected: PASS — 9 testes de repositório + 2 de serviço.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/domain/estoque backend/internal/infra/repository/estoque_repo.go backend/internal/infra/repository/estoque_repo_test.go backend/internal/infra/repository/filtros.go
git commit -m "feat(backend): servico e repositorio de estoque"
```

---

### Task B3: Handler HTTP `/estoque` e `/movimentacoes`

**Files:**
- Create: `backend/internal/api/handlers/estoque.go`
- Create: `backend/internal/api/handlers/estoque_test.go`

**Interfaces:**
- Consumes: `estoque.Servico` (Task B2), `consulta.Analisar`/`AnalisarComStatus`, `mapaDeErros`/`erroDeNegocio` (já existentes), `httpx.OK`/`Lista`/`Criado`.
- Produces: `handlers.NovoEstoqueHandler(servico).Registrar(grupo, autenticacao)` — usado pela Task B5 (wiring).

```go
package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

var errosEstoque = mapaDeErros{
	{estoque.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{estoque.ErrMovimentacaoNaoEncontrada, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{estoque.ErrSaldoInsuficienteParaAjuste, http.StatusConflict, httpx.CodigoConflito},
	{estoque.ErrPartePecaInexistente, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estoque.ErrPartePecaObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estoque.ErrQuantidadeAjusteObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estoque.ErrMotivoAjusteObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// EstoqueHandler atende /estoque e /movimentacoes (RF2).
type EstoqueHandler struct {
	servico *estoque.Servico
}

// NovoEstoqueHandler cria o handler de estoque.
func NovoEstoqueHandler(servico *estoque.Servico) *EstoqueHandler {
	return &EstoqueHandler{servico: servico}
}

// Registrar publica as rotas do modulo.
func (h *EstoqueHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	gestao := middleware.ExigirPerfil(usuario.PerfilAdmin, usuario.PerfilGestor)

	estoqueRotas := grupo.Group("/estoque", autenticacao)
	// /criticos antes de /:parte_peca_id: rota estatica, nao pode ser
	// capturada pelo parametro.
	estoqueRotas.GET("/criticos", h.Criticos)
	estoqueRotas.GET("", h.Listar)
	estoqueRotas.GET("/:parte_peca_id", h.Obter)
	estoqueRotas.POST("/ajuste", h.Ajustar, gestao)

	movRotas := grupo.Group("/movimentacoes", autenticacao)
	movRotas.GET("", h.ListarMovimentacoes)
	movRotas.GET("/:id", h.ObterMovimentacao)
}

type ajusteEstoqueRequest struct {
	PartePecaID int64  `json:"parte_peca_id" validate:"required"`
	Quantidade  int    `json:"quantidade" validate:"required"`
	Motivo      string `json:"motivo" validate:"required,max=50"`
	Observacoes string `json:"observacoes" validate:"max=1000"`
}

// Listar devolve a pagina de saldo de estoque.
func (h *EstoqueHandler) Listar(c echo.Context) error {
	params, err := consulta.AnalisarComStatus(c.QueryParams(), estoque.ColunasOrdenaveis, "codigo", estoque.StatusPermitidos)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens, total, err := h.servico.ListarSaldo(c.Request().Context(), params)
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Obter devolve o saldo de uma Parte/Peca especifica.
func (h *EstoqueHandler) Obter(c echo.Context) error {
	id, err := parsePartePecaID(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da parte/peca deve ser numerico")
	}

	saldo, err := h.servico.BuscarSaldo(c.Request().Context(), id)
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.OK(c, saldo)
}

// Criticos devolve os itens com saldo critico, sem paginacao.
func (h *EstoqueHandler) Criticos(c echo.Context) error {
	itens, err := h.servico.ListarCriticos(c.Request().Context())
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.OK(c, itens)
}

// Ajustar registra um ajuste manual de estoque.
func (h *EstoqueHandler) Ajustar(c echo.Context) error {
	var req ajusteEstoqueRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}

	saldo, err := h.servico.Ajustar(c.Request().Context(), estoque.AjusteDados{
		PartePecaID: req.PartePecaID, Quantidade: req.Quantidade, Motivo: req.Motivo, Observacoes: req.Observacoes,
	}, autorDaRequisicao(c))
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.Criado(c, saldo)
}

// ListarMovimentacoes devolve a pagina de historico.
func (h *EstoqueHandler) ListarMovimentacoes(c echo.Context) error {
	params, err := consulta.Analisar(c.QueryParams(), []string{"data_hora"}, "data_hora")
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens, total, err := h.servico.ListarMovimentacoes(c.Request().Context(), params)
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// ObterMovimentacao devolve uma movimentacao especifica.
func (h *EstoqueHandler) ObterMovimentacao(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da movimentacao deve ser numerico")
	}

	mov, err := h.servico.BuscarMovimentacao(c.Request().Context(), id)
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.OK(c, mov)
}

func parsePartePecaID(c echo.Context) (int64, error) {
	return idDaRotaComNome(c, "parte_peca_id")
}
```

`idDaRotaComNome` é um pequeno helper novo em `erros.go` (o `idDaRota` existente é fixo em `"id"`; `/estoque/:parte_peca_id` usa outro nome de parâmetro):

```go
// idDaRotaComNome le um parametro de rota com nome diferente de "id" —
// /estoque/:parte_peca_id, por exemplo.
func idDaRotaComNome(c echo.Context, nome string) (int64, error) {
	return strconv.ParseInt(c.Param(nome), 10, 64)
}
```

- [ ] **Step 1: Escrever `estoque_test.go` (falhando)**

Mirror exato de `pedidos_compra_test.go`: o pacote `handlers_test` já tem, em `testapi_test.go`, a infraestrutura de teste HTTP inteira — `apiProtegida` (struct com `echo`/`tokens`/`pool`), `novaAPIProtegida(t, pool) *apiProtegida`, `api.chamar(metodo, rota, corpoJSON string, perfil usuario.Perfil) *httptest.ResponseRecorder`, e os extratores `dados(t, rec)`/`lista(t, rec)`/`codigoErro(t, rec)`/`mensagemErro(t, rec)`. Nenhum "cliente"/"token" novo — use exatamente esse padrão:

```go
package handlers_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/require"
)

// apiEstoque monta o EstoqueHandler sobre um banco migrado e devolve tambem
// o id de uma peca de apoio ja cadastrada (raw SQL, mesmo padrao de
// criarFornecedorEPecaDeApoio em pedidos_compra_test.go — o handler de Peca
// nao precisa estar registrado so para ter uma FK valida).
func apiEstoque(t *testing.T) (*apiProtegida, int64) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoEstoqueHandler(estoque.NovoServico(repository.NovoEstoqueRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())

	pecaID := criarPecaDeApoio(t, api, "HND-001", 5)
	return api, pecaID
}

// criarPecaDeApoio cadastra a peca direto no banco (incluindo o saldo
// zerado, ja que a migration/peca_repo.go real so faz isso via
// PecaRepositorio.Criar) e devolve o id.
func criarPecaDeApoio(t *testing.T, api *apiProtegida, codigo string, estoqueMinimo int) int64 {
	t.Helper()
	ctx := context.Background()

	var pecaID int64
	require.NoError(t, api.pool.QueryRow(ctx,
		`INSERT INTO partes_pecas (codigo, descricao, unidade_medida, estoque_minimo, estoque_maximo, lead_time_compra)
		 VALUES ($1, $2, 'UN', $3, $3 + 100, 7) RETURNING id`,
		codigo, "Peca de teste do handler de estoque", estoqueMinimo).Scan(&pecaID))

	// Saldo nasce em 0 (mesma regra de peca_repo.go.Criar) — com
	// estoque_minimo sempre >= 0, isso e sempre CRITICO de saida (RN5,
	// fronteira inclusiva).
	_, err := api.pool.Exec(ctx,
		`INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, quantidade_reservada, status) VALUES ($1, 0, 0, 'CRITICO')`,
		pecaID)
	require.NoError(t, err)
	return pecaID
}

func TestListarEstoqueResponde200(t *testing.T) {
	api, _ := apiEstoque(t)

	rec := api.chamar(http.MethodGet, "/api/v1/estoque", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
}

func TestObterEstoqueDeParteInexistenteResponde404(t *testing.T) {
	api, _ := apiEstoque(t)

	rec := api.chamar(http.MethodGet, "/api/v1/estoque/999999", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestCriticosNaoPagina(t *testing.T) {
	api, _ := apiEstoque(t)

	rec := api.chamar(http.MethodGet, "/api/v1/estoque/criticos", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	itens := lista(t, rec)
	require.NotEmpty(t, itens) // a peca de apoio nasce critica (minimo 5, saldo 0)
}

func TestAjustarComoGestorResponde201(t *testing.T) {
	api, pecaID := apiEstoque(t)

	rec := api.chamar(http.MethodPost, "/api/v1/estoque/ajuste",
		`{"parte_peca_id":`+formatarID(float64(pecaID))+`,"quantidade":10,"motivo":"Inventario"}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, float64(10), dados(t, rec)["quantidade_atual"])
}

func TestAjustarComoOperadorResponde403(t *testing.T) {
	api, pecaID := apiEstoque(t)

	rec := api.chamar(http.MethodPost, "/api/v1/estoque/ajuste",
		`{"parte_peca_id":`+formatarID(float64(pecaID))+`,"quantidade":10,"motivo":"Inventario"}`,
		usuario.PerfilOperador)

	require.Equal(t, http.StatusForbidden, rec.Code)
}

func TestAjustarQueDeixariaSaldoNegativoResponde409(t *testing.T) {
	api, pecaID := apiEstoque(t)

	rec := api.chamar(http.MethodPost, "/api/v1/estoque/ajuste",
		`{"parte_peca_id":`+formatarID(float64(pecaID))+`,"quantidade":-1,"motivo":"Perda"}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestListarMovimentacoesResponde200(t *testing.T) {
	api, _ := apiEstoque(t)

	rec := api.chamar(http.MethodGet, "/api/v1/movimentacoes", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
}

func TestObterMovimentacaoInexistenteResponde404(t *testing.T) {
	api, _ := apiEstoque(t)

	rec := api.chamar(http.MethodGet, "/api/v1/movimentacoes/999999", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusNotFound, rec.Code)
}
```

(acrescente `"github.com/stretchr/testify/assert"` ao import se `assert.Equal` for usado — `pedidos_compra_test.go` já importa os dois.)

Run: `cd backend && go test ./internal/api/handlers/... -run Estoque`
Expected: FAIL — `handlers.NovoEstoqueHandler` não existe.

- [ ] **Step 2: Implementar `estoque.go` e `idDaRotaComNome`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd backend && go test ./internal/api/handlers/... -run Estoque`
Expected: PASS — 8 testes.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/api/handlers/estoque.go backend/internal/api/handlers/estoque_test.go backend/internal/api/handlers/erros.go
git commit -m "feat(backend): handler HTTP de estoque"
```

---

### Task B4: Recebimento de Pedido de Compra (`pedidocompra`)

**Files:**
- Modify: `backend/internal/domain/pedidocompra/pedidocompra.go`
- Modify: `backend/internal/domain/pedidocompra/servico.go`
- Modify: `backend/internal/domain/pedidocompra/servico_test.go`
- Modify: `backend/internal/infra/repository/pedido_compra_repo.go`
- Modify: `backend/internal/infra/repository/pedido_compra_repo_test.go`

**Interfaces:**
- Consumes: `estoque.Servico.AplicarMovimento` (Task B2), `estoque.TipoEntrada`/`MotivoCompra`.
- Produces: `pedidocompra.Servico.RegistrarRecebimento`, `pedidocompra.ErrQuantidadeRecebidaExcedeSolicitada`, `pedidocompra.ItemRecebimentoDados`, `pedidocompra.NovoServico(repo, estoqueServico)` (assinatura muda) — consumidos pela Task B5 (handler) e pela Task B6 (wiring).

**Mudança 1 — `Emitir` vai direto para `Aguardando Entrega`** em `servico.go`:

```go
// Emitir marca o pedido de compra como emitido e ja aguardando a entrega —
// nao existe, em nenhum requisito, um passo separado de "o fornecedor
// confirmou o aceite" (Emitido/Aceito ficam no enum por fidelidade ao CHECK
// do banco, mas inalcancaveis).
func (s *Servico) Emitir(ctx context.Context, id int64, autor string) (*PedidoCompra, error) {
	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Status != StatusRascunho {
		return nil, ErrStatusInvalidoParaAcao
	}
	if err := s.repo.AtualizarStatus(ctx, id, StatusAguardandoEntrega, autor); err != nil {
		return nil, err
	}
	p.Status = StatusAguardandoEntrega
	return p, nil
}
```

**Mudança 2 — novo erro** em `pedidocompra.go`:

```go
ErrQuantidadeRecebidaExcedeSolicitada = errors.New("a quantidade recebida nao pode exceder a quantidade solicitada")
```

**Mudança 3 — `NovoServico` ganha a dependência de estoque, e `RegistrarRecebimento`** em `servico.go`:

```go
import (
	// ... imports existentes ...
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
)

// Servico ganha uma dependencia direta de *estoque.Servico (tipo concreto,
// nao uma interface nova) para o recebimento poder dar entrada em estoque —
// mesmo padrao de acoplamento que CotacaoHandler ja usa sobre
// *pedidocompra.Servico.
type Servico struct {
	repo    Repositorio
	estoque *estoque.Servico
}

// NovoServico monta o servico sobre o repositorio e o servico de estoque
// informados — recebimento precisa dar entrada em estoque.
func NovoServico(repo Repositorio, estoqueServico *estoque.Servico) *Servico {
	return &Servico{repo: repo, estoque: estoqueServico}
}

// ItemRecebimentoDados e um item recebido nesta chamada — a quantidade e a
// desta chamada, nao o acumulado (o acumulado vive em
// ItemPedido.QuantidadeRecebida e e somado pelo repositorio).
type ItemRecebimentoDados struct {
	PartePecaID        int64
	QuantidadeRecebida int
}

// RegistrarRecebimento soma quantidade_recebida por item (cumulativo — uma
// segunda chamada parcial soma sobre a primeira), da entrada no estoque para
// cada item recebido nesta chamada, e recalcula o status do pedido: todos os
// itens completos -> Concluido (grava data_entrega_real); ao menos um item
// com recebimento parcial -> Recebido Parcial.
//
// Ordem deliberada: o repositorio grava a atualizacao do PC (itens + status)
// primeiro, numa unica transacao; so depois, ja fora dela, a entrada em
// estoque e aplicada item a item. Se a etapa de estoque falhar no meio, o PC
// ja registrou o recebimento (nao gera dupla contagem numa nova tentativa) e
// a discrepancia de saldo fica visivel e corrigivel por um ajuste manual —
// o inverso (estoque primeiro) arriscaria aplicar a entrada duas vezes se o
// passo do PC falhasse depois e o operador tentasse de novo.
func (s *Servico) RegistrarRecebimento(ctx context.Context, id int64, itens []ItemRecebimentoDados, autor string) (*PedidoCompra, error) {
	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Status != StatusAguardandoEntrega && p.Status != StatusRecebidoParcial {
		return nil, ErrStatusInvalidoParaAcao
	}

	atualizado, err := s.repo.RegistrarRecebimento(ctx, id, itens, autor)
	if err != nil {
		return nil, err
	}

	for _, item := range itens {
		if item.QuantidadeRecebida <= 0 {
			continue
		}
		if _, err := s.estoque.AplicarMovimento(
			ctx, item.PartePecaID, item.QuantidadeRecebida, estoque.TipoEntrada, estoque.MotivoCompra,
			&atualizado.NumeroPC, "", autor,
		); err != nil {
			return nil, fmt.Errorf("dar entrada em estoque apos recebimento: %w", err)
		}
	}

	return atualizado, nil
}
```

(acrescente `"fmt"` aos imports se ainda não estiver presente.)

**Repositório** (`pedido_compra_repo.go`), novo método `RegistrarRecebimento`:

```go
// RegistrarRecebimento soma quantidade_recebida por item (com FOR UPDATE
// para evitar corrida entre duas chamadas concorrentes), recalcula o status
// do pedido e devolve o pedido atualizado — tudo na mesma transacao.
func (r *PedidoCompraRepositorio) RegistrarRecebimento(
	ctx context.Context, id int64, itens []pedidocompra.ItemRecebimentoDados, autor string,
) (*pedidocompra.PedidoCompra, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, item := range itens {
		if item.QuantidadeRecebida <= 0 {
			continue
		}
		var recebidaAtual, solicitada int
		err := tx.QueryRow(ctx,
			`SELECT quantidade_recebida, quantidade_solicitada FROM itens_pedido_compra
			 WHERE pedido_compra_id = $1 AND parte_peca_id = $2 FOR UPDATE`,
			id, item.PartePecaID,
		).Scan(&recebidaAtual, &solicitada)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, pedidocompra.ErrFornecedorOuPecaInexistente
			}
			return nil, fmt.Errorf("travar item do pedido: %w", err)
		}

		novaRecebida := recebidaAtual + item.QuantidadeRecebida
		if novaRecebida > solicitada {
			return nil, pedidocompra.ErrQuantidadeRecebidaExcedeSolicitada
		}

		if _, err := tx.Exec(ctx,
			`UPDATE itens_pedido_compra SET quantidade_recebida = $1
			 WHERE pedido_compra_id = $2 AND parte_peca_id = $3`,
			novaRecebida, id, item.PartePecaID,
		); err != nil {
			return nil, fmt.Errorf("atualizar quantidade recebida: %w", err)
		}
	}

	var pendentes int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM itens_pedido_compra WHERE pedido_compra_id = $1 AND quantidade_recebida < quantidade_solicitada`,
		id).Scan(&pendentes); err != nil {
		return nil, fmt.Errorf("verificar itens pendentes: %w", err)
	}

	novoStatus := pedidocompra.StatusRecebidoParcial
	var dataEntregaReal tempo.Data
	if pendentes == 0 {
		novoStatus = pedidocompra.StatusConcluido
		dataEntregaReal = tempo.Hoje()
	}

	if _, err := tx.Exec(ctx,
		`UPDATE pedidos_compra SET status = $2, data_entrega_real = $3, updated_by = $4 WHERE id = $1`,
		id, novoStatus, dataEntregaReal, autor,
	); err != nil {
		return nil, fmt.Errorf("atualizar status do pedido apos recebimento: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("confirmar recebimento: %w", err)
	}

	return r.BuscarPorID(ctx, id)
}
```

(acrescente `"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"` aos imports — `errors`, `fmt`, `pgx` e `pedidocompra` já são usados no arquivo.)

Adicione o método à interface `Repositorio` em `servico.go`:

```go
RegistrarRecebimento(ctx context.Context, id int64, itens []ItemRecebimentoDados, autor string) (*PedidoCompra, error)
```

- [ ] **Step 1: Escrever os testes novos (falhando)**

O arquivo já existente `pedidocompra/servico_test.go` tem os helpers `servicoComBanco(t) (*pedidocompra.Servico, *pgxpool.Pool)`, `criarFornecedorDeTeste(ctx, t, pool) int64`, `criarPecaDeTeste(ctx, t, pool) int64` e `dadosDeTeste(fornecedorID, pecaID) pedidocompra.Dados` (este último já fixa `QuantidadeSolicitada: 100` no único item — reaproveite-o em vez de criar um helper novo). Duas mudanças no que já existe, mais os testes novos:

1. **`servicoComBanco`** passa a montar o serviço de estoque também:

```go
func servicoComBanco(t *testing.T) (*pedidocompra.Servico, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	estoqueServico := estoque.NovoServico(repository.NovoEstoqueRepositorio(pool))
	return pedidocompra.NovoServico(repository.NovoPedidoCompraRepositorio(pool), estoqueServico), pool
}
```

(acrescente o import de `"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"`.)

2. **`TestEmitirMudaStatusParaEmitido`** (linha 107) renomeia para `TestEmitirVaiDiretoParaAguardandoEntrega` e troca a asserção final:

```go
func TestEmitirVaiDiretoParaAguardandoEntrega(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)

	emitido, err := servico.Emitir(ctx, criado.ID, "gestor01")

	require.NoError(t, err)
	assert.Equal(t, pedidocompra.StatusAguardandoEntrega, emitido.Status)
}
```

3. **Testes novos** (mesmo estilo dos já existentes — `ctx := context.Background()`, `servicoComBanco(t)`, `criarFornecedorDeTeste`/`criarPecaDeTeste`, `dadosDeTeste`):

```go
func TestRegistrarRecebimentoParcialNaoFechaOPedido(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Emitir(ctx, criado.ID, "gestor01")
	require.NoError(t, err)

	recebido, err := servico.RegistrarRecebimento(ctx, criado.ID,
		[]pedidocompra.ItemRecebimentoDados{{PartePecaID: pecaID, QuantidadeRecebida: 40}}, "gestor01")

	require.NoError(t, err)
	assert.Equal(t, pedidocompra.StatusRecebidoParcial, recebido.Status)
}

func TestRegistrarRecebimentoSomaSobreOAnterior(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Emitir(ctx, criado.ID, "gestor01")
	require.NoError(t, err)
	_, err = servico.RegistrarRecebimento(ctx, criado.ID,
		[]pedidocompra.ItemRecebimentoDados{{PartePecaID: pecaID, QuantidadeRecebida: 40}}, "gestor01")
	require.NoError(t, err)

	concluido, err := servico.RegistrarRecebimento(ctx, criado.ID,
		[]pedidocompra.ItemRecebimentoDados{{PartePecaID: pecaID, QuantidadeRecebida: 60}}, "gestor01")

	require.NoError(t, err)
	assert.Equal(t, pedidocompra.StatusConcluido, concluido.Status)
	assert.False(t, concluido.DataEntregaReal.IsZero())
}

func TestRegistrarRecebimentoAcimaDoSolicitadoFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Emitir(ctx, criado.ID, "gestor01")
	require.NoError(t, err)

	_, err = servico.RegistrarRecebimento(ctx, criado.ID,
		[]pedidocompra.ItemRecebimentoDados{{PartePecaID: pecaID, QuantidadeRecebida: 200}}, "gestor01")

	require.ErrorIs(t, err, pedidocompra.ErrQuantidadeRecebidaExcedeSolicitada)
}

func TestRegistrarRecebimentoForaDeAguardandoEntregaFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01") // fica em Rascunho
	require.NoError(t, err)

	_, err = servico.RegistrarRecebimento(ctx, criado.ID, nil, "gestor01")

	require.ErrorIs(t, err, pedidocompra.ErrStatusInvalidoParaAcao)
}

func TestRegistrarRecebimentoDaEntradaNoEstoque(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Emitir(ctx, criado.ID, "gestor01")
	require.NoError(t, err)

	_, err = servico.RegistrarRecebimento(ctx, criado.ID,
		[]pedidocompra.ItemRecebimentoDados{{PartePecaID: pecaID, QuantidadeRecebida: 30}}, "gestor01")
	require.NoError(t, err)

	estoqueRepo := repository.NovoEstoqueRepositorio(pool)
	saldo, err := estoqueRepo.BuscarSaldo(ctx, pecaID)
	require.NoError(t, err)
	assert.Equal(t, 30, saldo.QuantidadeAtual)
}
```

Run: `cd backend && go test ./internal/domain/pedidocompra/...`
Expected: FAIL — `RegistrarRecebimento`/`ItemRecebimentoDados`/`ErrQuantidadeRecebidaExcedeSolicitada` não existem; `NovoServico` com 1 argumento não compila mais.

- [ ] **Step 2: Implementar as três mudanças acima** (`pedidocompra.go`, `servico.go`, `pedido_compra_repo.go`).

- [ ] **Step 3: Rodar os testes**

Run: `cd backend && go test ./internal/domain/pedidocompra/... ./internal/infra/repository/... -run PedidoCompra`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/domain/pedidocompra backend/internal/infra/repository/pedido_compra_repo.go backend/internal/infra/repository/pedido_compra_repo_test.go
git commit -m "feat(backend): recebimento de pedido de compra da entrada em estoque"
```

---

### Task B5: Handler de recebimento em `/pedidos-compra/{id}/registrar-recebimento`

**Files:**
- Modify: `backend/internal/api/handlers/pedidos_compra.go`
- Modify: `backend/internal/api/handlers/pedidos_compra_test.go`

**Interfaces:**
- Consumes: `pedidocompra.Servico.RegistrarRecebimento`/`ItemRecebimentoDados`/`ErrQuantidadeRecebidaExcedeSolicitada` (Task B4).
- Produces: rota `POST /pedidos-compra/:id/registrar-recebimento`, usada pelo frontend (Task F4).

Adicione a rota em `Registrar`:

```go
rotas.POST("/:id/registrar-recebimento", h.RegistrarRecebimento, gestao)
```

Adicione ao `errosPedidoCompra`:

```go
{pedidocompra.ErrQuantidadeRecebidaExcedeSolicitada, http.StatusBadRequest, httpx.CodigoErroValidacao},
```

Novo tipo de requisição e handler:

```go
type itemRecebimentoRequest struct {
	PartePecaID        int64 `json:"parte_peca_id" validate:"required"`
	QuantidadeRecebida int   `json:"quantidade_recebida" validate:"required,gt=0"`
}

type registrarRecebimentoRequest struct {
	Itens []itemRecebimentoRequest `json:"itens" validate:"required,min=1,dive"`
}

// RegistrarRecebimento registra o recebimento total ou parcial de um pedido.
func (h *PedidoCompraHandler) RegistrarRecebimento(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do pedido de compra deve ser numerico")
	}

	var req registrarRecebimentoRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}

	itens := make([]pedidocompra.ItemRecebimentoDados, len(req.Itens))
	for i, item := range req.Itens {
		itens[i] = pedidocompra.ItemRecebimentoDados{PartePecaID: item.PartePecaID, QuantidadeRecebida: item.QuantidadeRecebida}
	}

	atualizado, err := h.servico.RegistrarRecebimento(c.Request().Context(), id, itens, autorDaRequisicao(c))
	if err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	return httpx.OK(c, atualizado)
}
```

- [ ] **Step 1: Escrever os testes (falhando)**

Primeiro, ajuste o `apiPedidosCompra` já existente (linha ~22 do arquivo) para passar o `estoque.Servico` — mesma mudança de assinatura da Task B4:

```go
func apiPedidosCompra(t *testing.T) (*apiProtegida, int64, int64) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoPedidoCompraHandler(
		pedidocompra.NovoServico(repository.NovoPedidoCompraRepositorio(pool), estoque.NovoServico(repository.NovoEstoqueRepositorio(pool))),
	)
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())

	fornecedorID, pecaID := criarFornecedorEPecaDeApoio(t, api)
	return api, fornecedorID, pecaID
}
```

(acrescente o import de `"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"` no topo do arquivo.)

Depois, um helper para criar e emitir um pedido via HTTP (reaproveita `corpoPedidoCompraValido`, já existente, que sempre pede `quantidade_solicitada: 10`) e os testes novos:

```go
// criarEEmitirPedido cria um pedido de compra (100 unidades solicitadas, uma
// unica peca) e o emite, devolvendo o id do pedido -- reaproveita o mesmo
// caminho HTTP que TestCriarPedidoCompraResponde201 ja exercita, em vez de
// inserir direto no banco.
func criarEEmitirPedido(t *testing.T, api *apiProtegida, fornecedorID, pecaID int64) int64 {
	t.Helper()
	corpo := `{
		"numero_pc": "PC-2026-900",
		"fornecedor_id": ` + formatarID(float64(fornecedorID)) + `,
		"data_entrega_prevista": "2026-12-25",
		"itens": [{"parte_peca_id": ` + formatarID(float64(pecaID)) + `, "quantidade_solicitada": 100, "preco_unitario": 10.00}]
	}`
	criarRec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra", corpo, usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, criarRec.Code, criarRec.Body.String())
	pedidoID := int64(dados(t, criarRec)["id"].(float64))

	emitirRec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra/"+formatarID(float64(pedidoID))+"/emitir", "", usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, emitirRec.Code, emitirRec.Body.String())
	return pedidoID
}

func TestRegistrarRecebimentoParcialResponde200(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)
	pedidoID := criarEEmitirPedido(t, api, fornecedorID, pecaID)

	rec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra/"+formatarID(float64(pedidoID))+"/registrar-recebimento",
		`{"itens":[{"parte_peca_id":`+formatarID(float64(pecaID))+`,"quantidade_recebida":40}]}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "Recebido Parcial", dados(t, rec)["status"])
}

func TestRegistrarRecebimentoAcimaDoSolicitadoResponde400(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)
	pedidoID := criarEEmitirPedido(t, api, fornecedorID, pecaID)

	rec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra/"+formatarID(float64(pedidoID))+"/registrar-recebimento",
		`{"itens":[{"parte_peca_id":`+formatarID(float64(pecaID))+`,"quantidade_recebida":500}]}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestRegistrarRecebimentoEmRascunhoResponde409(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)
	corpo := `{
		"numero_pc": "PC-2026-901",
		"fornecedor_id": ` + formatarID(float64(fornecedorID)) + `,
		"data_entrega_prevista": "2026-12-25",
		"itens": [{"parte_peca_id": ` + formatarID(float64(pecaID)) + `, "quantidade_solicitada": 100, "preco_unitario": 10.00}]
	}`
	criarRec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra", corpo, usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, criarRec.Code)
	pedidoID := int64(dados(t, criarRec)["id"].(float64)) // ainda em Rascunho, nao emitido

	rec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra/"+formatarID(float64(pedidoID))+"/registrar-recebimento",
		`{"itens":[{"parte_peca_id":`+formatarID(float64(pecaID))+`,"quantidade_recebida":10}]}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestRegistrarRecebimentoComoOperadorResponde403(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)
	pedidoID := criarEEmitirPedido(t, api, fornecedorID, pecaID)

	rec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra/"+formatarID(float64(pedidoID))+"/registrar-recebimento",
		`{"itens":[{"parte_peca_id":`+formatarID(float64(pecaID))+`,"quantidade_recebida":10}]}`,
		usuario.PerfilOperador)

	require.Equal(t, http.StatusForbidden, rec.Code)
}
```

(acrescente `"github.com/stretchr/testify/assert"` ao import se ainda não presente.)

Run: `cd backend && go test ./internal/api/handlers/... -run Recebimento`
Expected: FAIL — rota/handler não existem.

- [ ] **Step 2: Implementar a rota, o mapeamento de erro e o handler** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd backend && go test ./internal/api/handlers/... -run Recebimento`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/api/handlers/pedidos_compra.go backend/internal/api/handlers/pedidos_compra_test.go
git commit -m "feat(backend): rota HTTP de registrar recebimento"
```

---

### Task B6: Wiring e verificação final do backend

**Files:**
- Modify: `backend/internal/api/routes.go`

**Interfaces:**
- Consumes: `handlers.NovoEstoqueHandler` (B3), `pedidocompra.NovoServico` com nova assinatura (B4).

```go
func registrarEstoque(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc) *estoque.Servico {
	estoqueServico := estoque.NovoServico(repository.NovoEstoqueRepositorio(dep.Pool))
	handlers.NovoEstoqueHandler(estoqueServico).Registrar(v1, autenticacao)
	return estoqueServico
}
```

Em `registrarCompras`, troque a criação de `pedidoServico` para receber o `estoque.Servico` — isso muda a ordem de chamada em `NovoRoteador`: `registrarEstoque` precisa rodar antes de `registrarCompras` para o serviço estar disponível.

```go
func registrarCompras(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc, estoqueServico *estoque.Servico) {
	pedidoServico := pedidocompra.NovoServico(repository.NovoPedidoCompraRepositorio(dep.Pool), estoqueServico)
	cotacaoServico := cotacao.NovoServico(repository.NovoCotacaoRepositorio(dep.Pool))

	handlers.NovoCotacaoHandler(cotacaoServico, pedidoServico).Registrar(v1, autenticacao)
	handlers.NovoPedidoCompraHandler(pedidoServico).Registrar(v1, autenticacao)
}
```

Em `NovoRoteador`, troque:

```go
estoqueServico := registrarEstoque(v1, dep, autenticacao)
registrarCompras(v1, dep, autenticacao, estoqueServico)
```

no lugar de `registrarCompras(v1, dep, autenticacao)` (chamada logo após `registrarCadastros`, mesma posição de antes).

- [ ] **Step 1: Implementar o wiring** (código completo acima).

- [ ] **Step 2: Build, vet, format e suíte inteira**

```bash
cd backend
go build ./...
go vet ./...
gofmt -l .
go test ./...
```

Expected: build/vet/gofmt limpos; suíte inteira verde (336 testes anteriores + os novos desta sprint).

- [ ] **Step 3: Fluxo manual ponta a ponta contra Postgres real**

Com o ambiente no ar (`docker compose up -d postgres`, `go run ./cmd/api`), via `curl` ou script Node (`fetch`), na ordem: criar peça → `GET /estoque` mostra saldo 0/CRÍTICO → criar cotação com essa peça → enviar → registrar-resposta → converter-pc → `GET /pedidos-compra/{id}` mostra status `"Aguardando Entrega"` → `POST /pedidos-compra/{id}/registrar-recebimento` parcial → status `"Recebido Parcial"` → registrar o restante → status `"Concluido"`, `data_entrega_real` preenchida → `GET /estoque/{parte_peca_id}` mostra o saldo somado → `POST /estoque/ajuste` negativo maior que o saldo devolve 409.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/api/routes.go
git commit -m "feat(backend): registra as rotas de estoque e liga o recebimento ao pedido de compra"
```

---

## Frontend

### Task F1: Tipos e serviço de estoque

**Files:**
- Create: `frontend/src/tipos/estoque.ts`
- Create: `frontend/src/servicos/estoque.ts` + `.test.ts`

**Interfaces:**
- Consumes: `Ordem` (de `tipos/cadastros.ts`), `DadosPaginacao`/`Pagina` (idem), `api` (de `servicos/api.ts`).
- Produces: `SaldoEstoque`, `Movimentacao`, `ParametrosListagemEstoque`, `listarEstoque`, `obterEstoque`, `listarEstoqueCriticos`, `ajustarEstoque`, `listarMovimentacoes` — usados pelas Tasks F2, F3, F5.

```ts
// tipos/estoque.ts
import type { Ordem } from './cadastros';

export type StatusEstoque = 'OK' | 'CRITICO' | 'BLOQUEADO';

export interface SaldoEstoque {
  id: number;
  parte_peca_id: number;
  codigo: string;
  descricao: string;
  quantidade_atual: number;
  quantidade_reservada: number;
  disponivel: number;
  estoque_minimo: number;
  localizacao_armazem?: string;
  status: StatusEstoque;
  updated_at: string;
}

export interface Movimentacao {
  id: number;
  parte_peca_id: number;
  codigo_pp: string;
  tipo: 'Entrada' | 'Ajuste';
  quantidade: number;
  motivo: string;
  referencia_numero?: string;
  observacoes?: string;
  usuario?: string;
  data_hora: string;
}

/** Espelha o que o backend aceita em GET /estoque — mesma forma de
 * ParametrosListagemCompras, mas sem busca (a tela de estoque nao tem
 * campo de busca no design aprovado). */
export interface ParametrosListagemEstoque {
  pagina: number;
  limite: number;
  ordenar_por: string;
  ordem: Ordem;
  /** null significa "sem filtro": traz todos os status. */
  status: string | null;
}
```

```ts
// servicos/estoque.ts
import { api } from './api';
import type { DadosPaginacao, Pagina } from '@/tipos/cadastros';
import type { Movimentacao, ParametrosListagemEstoque, SaldoEstoque } from '@/tipos/estoque';

interface EnvelopeLista<T> {
  dados: T[];
  paginacao: DadosPaginacao;
}
interface EnvelopeItem<T> {
  dados: T;
}

function paramsDeConsultaEstoque(params: ParametrosListagemEstoque): Record<string, string | number> {
  const query: Record<string, string | number> = {
    pagina: params.pagina,
    limite: params.limite,
    ordenar_por: params.ordenar_por,
    ordem: params.ordem,
  };
  if (params.status !== null) {
    query.status = params.status;
  }
  return query;
}

export async function listarEstoque(params: ParametrosListagemEstoque): Promise<Pagina<SaldoEstoque>> {
  const { data } = await api.get<EnvelopeLista<SaldoEstoque>>('/estoque', { params: paramsDeConsultaEstoque(params) });
  return { itens: data.dados, paginacao: data.paginacao };
}

export async function obterEstoque(partePecaId: number): Promise<SaldoEstoque> {
  const { data } = await api.get<EnvelopeItem<SaldoEstoque>>(`/estoque/${partePecaId}`);
  return data.dados;
}

export async function listarEstoqueCriticos(): Promise<SaldoEstoque[]> {
  const { data } = await api.get<{ dados: SaldoEstoque[] }>('/estoque/criticos');
  return data.dados;
}

export interface CorpoAjusteEstoque {
  parte_peca_id: number;
  quantidade: number;
  motivo: string;
  observacoes?: string;
}

export async function ajustarEstoque(corpo: CorpoAjusteEstoque): Promise<SaldoEstoque> {
  const { data } = await api.post<EnvelopeItem<SaldoEstoque>>('/estoque/ajuste', corpo);
  return data.dados;
}

export async function listarMovimentacoes(pagina: number, limite: number): Promise<Pagina<Movimentacao>> {
  const { data } = await api.get<EnvelopeLista<Movimentacao>>('/movimentacoes', { params: { pagina, limite } });
  return { itens: data.dados, paginacao: data.paginacao };
}
```

- [ ] **Step 1: Escrever `estoque.test.ts` (falhando)**

Mirror de `compras.test.ts`, usando `instalarServidorFalso`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { ajustarEstoque, listarEstoque, listarEstoqueCriticos, listarMovimentacoes, obterEstoque } from './estoque';

describe('servicos/estoque', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('listarEstoque desembrulha o envelope', async () => {
    servidor.responder([
      { metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [{ id: 1 }], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
    ]);
    const resultado = await listarEstoque({ pagina: 1, limite: 20, ordenar_por: 'codigo', ordem: 'asc', status: null });
    expect(resultado.itens).toHaveLength(1);
  });

  it('listarEstoque omite status nulo da query', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [], paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 } } }]);
    await listarEstoque({ pagina: 1, limite: 20, ordenar_por: 'codigo', ordem: 'asc', status: null });
    expect(servidor.requisicoes[0].params.status).toBeUndefined();
  });

  it('listarEstoque envia o status quando informado', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [], paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 } } }]);
    await listarEstoque({ pagina: 1, limite: 20, ordenar_por: 'codigo', ordem: 'asc', status: 'CRITICO' });
    expect(servidor.requisicoes[0].params.status).toBe('CRITICO');
  });

  it('obterEstoque busca por parte_peca_id', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque/1', status: 200, corpo: { dados: { id: 1, parte_peca_id: 1 } } }]);
    const resultado = await obterEstoque(1);
    expect(resultado.parte_peca_id).toBe(1);
  });

  it('listarEstoqueCriticos bate em /estoque/criticos', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque/criticos', status: 200, corpo: { dados: [] } }]);
    const resultado = await listarEstoqueCriticos();
    expect(resultado).toEqual([]);
  });

  it('ajustarEstoque envia POST para /estoque/ajuste', async () => {
    servidor.responder([{ metodo: 'post', url: '/estoque/ajuste', status: 201, corpo: { dados: { id: 1 } } }]);
    await ajustarEstoque({ parte_peca_id: 1, quantidade: 10, motivo: 'Inventario' });
    expect(servidor.requisicoes[0].corpo).toEqual({ parte_peca_id: 1, quantidade: 10, motivo: 'Inventario' });
  });

  it('listarMovimentacoes desembrulha o envelope', async () => {
    servidor.responder([{ metodo: 'get', url: '/movimentacoes', status: 200, corpo: { dados: [], paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 } } }]);
    const resultado = await listarMovimentacoes(1, 20);
    expect(resultado.itens).toEqual([]);
  });
});
```

Run: `cd frontend && npm test -- src/servicos/estoque.test.ts`
Expected: FAIL — `./estoque` não existe.

- [ ] **Step 2: Implementar `tipos/estoque.ts` e `servicos/estoque.ts`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd frontend && npm test -- src/servicos/estoque.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/tipos/estoque.ts frontend/src/servicos/estoque.ts frontend/src/servicos/estoque.test.ts
git commit -m "feat(frontend): tipos e servico de estoque"
```

---

### Task F2: `useListagemEstoque`

**Files:**
- Create: `frontend/src/hooks/useListagemEstoque.ts` + `.test.tsx`

**Interfaces:**
- Consumes: `listarEstoque` (Task F1), `useDebounce` (já existente).
- Produces: `useListagemEstoque()` — usado pela Task F3.

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ErroApi } from '@/servicos/api';
import { listarEstoque } from '@/servicos/estoque';
import type { DadosPaginacao, Ordem } from '@/tipos/cadastros';
import type { ParametrosListagemEstoque, SaldoEstoque } from '@/tipos/estoque';
import { useDebounce } from './useDebounce';

const LIMITE_PADRAO = 20;
const PAGINACAO_VAZIA: DadosPaginacao = { pagina: 1, limite: LIMITE_PADRAO, total: 0, total_paginas: 0 };

export interface ListagemEstoque {
  pagina: number;
  definirPagina: (pagina: number) => void;
  ordenarPor: string;
  ordem: Ordem;
  alternarOrdenacao: (chave: string) => void;
  status: string | null;
  definirStatus: (valor: string | null) => void;
  itens: SaldoEstoque[];
  paginacao: DadosPaginacao;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Estado da tela de estoque: mesma forma de useListagemCompras, mas sem
 * busca textual (a lista de saldo nao tem campo de busca no design
 * aprovado) — extraido a parte, nao reaproveitando useListagemCompras, para
 * nao acoplar o modulo de estoque ao de compras por uma coincidencia de
 * formato.
 */
export function useListagemEstoque(): ListagemEstoque {
  const [pagina, definirPagina] = useState(1);
  const [ordenarPor, definirOrdenarPor] = useState('codigo');
  const [ordem, definirOrdem] = useState<Ordem>('asc');
  const [status, definirStatus] = useState<string | null>(null);

  useEffect(() => {
    definirPagina(1);
  }, [status]);

  const params: ParametrosListagemEstoque = { pagina, limite: LIMITE_PADRAO, ordenar_por: ordenarPor, ordem, status };

  const consulta = useQuery({
    queryKey: ['estoque', params],
    queryFn: () => listarEstoque(params),
    placeholderData: keepPreviousData,
  });

  function alternarOrdenacao(chave: string) {
    if (chave === ordenarPor) {
      definirOrdem(ordem === 'asc' ? 'desc' : 'asc');
    } else {
      definirOrdenarPor(chave);
      definirOrdem('asc');
    }
    definirPagina(1);
  }

  const erro = consulta.error
    ? consulta.error instanceof ErroApi
      ? consulta.error.message
      : 'Não foi possível carregar a lista. Tente de novo.'
    : null;

  return {
    pagina,
    definirPagina,
    ordenarPor,
    ordem,
    alternarOrdenacao,
    status,
    definirStatus,
    itens: consulta.data?.itens ?? [],
    paginacao: consulta.data?.paginacao ?? PAGINACAO_VAZIA,
    carregando: consulta.isPending,
    erro,
    recarregar: () => void consulta.refetch(),
  };
}
```

(`useDebounce` importado mas não usado nesta versão — remova o import se `busca` não entrar; deixe só se decidir adicionar busca depois. Nesta tarefa, sem campo de busca, **não importe `useDebounce`**.)

- [ ] **Step 1: Escrever `useListagemEstoque.test.tsx` (falhando)**

Mirror de `useListagemCompras.test.tsx`, adaptado (sem os casos de debounce de busca):

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { useListagemEstoque } from './useListagemEstoque';
import { criarQueryClientDeTeste } from '@/testes/utilitarios'; // ou o helper equivalente já usado por useListagemCompras.test.tsx

describe('useListagemEstoque', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('reseta a pagina ao mudar o status', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [], paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 } } }]);
    const { result } = renderHook(() => useListagemEstoque(), { wrapper: envolverComQueryClient });

    result.current.definirPagina(2);
    result.current.definirStatus('CRITICO');

    await waitFor(() => expect(result.current.pagina).toBe(1));
  });

  it('alterna ordenacao na mesma coluna', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [], paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 } } }]);
    const { result } = renderHook(() => useListagemEstoque(), { wrapper: envolverComQueryClient });

    result.current.alternarOrdenacao('codigo');

    await waitFor(() => expect(result.current.ordem).toBe('desc'));
  });
});
```

Abra `useListagemCompras.test.tsx` para copiar o wrapper `envolverComQueryClient`/`QueryClientProvider` exato já usado nesse arquivo (evita reinventar o setup de teste de hook).

Run: `cd frontend && npm test -- src/hooks/useListagemEstoque.test.tsx`
Expected: FAIL — `./useListagemEstoque` não existe.

- [ ] **Step 2: Implementar `useListagemEstoque.ts`** (código completo acima, sem `useDebounce`).

- [ ] **Step 3: Rodar os testes**

Run: `cd frontend && npm test -- src/hooks/useListagemEstoque.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useListagemEstoque.ts frontend/src/hooks/useListagemEstoque.test.tsx
git commit -m "feat(frontend): hook de listagem de estoque"
```

---

### Task F3: Tela de Estoque (lista + ajuste)

**Files:**
- Create: `frontend/src/paginas/estoque/Estoque.tsx` + `.test.tsx`

**Interfaces:**
- Consumes: `useListagemEstoque` (F2), `ajustarEstoque` (F1), `usePartesPecasAtivas` (já existente, Sprint 3) só para nada — **não é necessário**: a lista de estoque já traz `codigo`/`descricao` embutidos no próprio `SaldoEstoque` (via `JOIN` no backend), diferente de cotação/PC que só tinham o id.
- Produces: `Estoque` — usado pela Task F5 (rota).

```tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, type TomBadge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import type { NomeIcone } from '@/componentes/ui/icones';
import { useListagemEstoque } from '@/hooks/useListagemEstoque';
import { separarErro } from '@/lib/errosDeFormulario';
import { ajustarEstoque } from '@/servicos/estoque';
import type { SaldoEstoque, StatusEstoque } from '@/tipos/estoque';

const OPCOES_STATUS = [
  { valor: 'OK', rotulo: 'OK' },
  { valor: 'CRITICO', rotulo: 'Crítico' },
  { valor: 'BLOQUEADO', rotulo: 'Bloqueado' },
];

const TOM_STATUS: Record<StatusEstoque, { tom: TomBadge; icone: NomeIcone }> = {
  OK: { tom: 'done', icone: 'check-circle-2' },
  CRITICO: { tom: 'warning', icone: 'alert-triangle' },
  BLOQUEADO: { tom: 'blocked', icone: 'shield-alert' },
};

export function Estoque() {
  const lista = useListagemEstoque();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const [itemEmAjuste, definirItemEmAjuste] = useState<SaldoEstoque | null>(null);
  const [quantidade, definirQuantidade] = useState('');
  const [motivo, definirMotivo] = useState('');
  const [observacoes, definirObservacoes] = useState('');

  const mutacaoAjuste = useMutation({
    mutationFn: () =>
      ajustarEstoque({
        parte_peca_id: itemEmAjuste!.parte_peca_id,
        quantidade: Number(quantidade),
        motivo,
        observacoes: observacoes || undefined,
      }),
    onSuccess: () => {
      void clienteQuery.invalidateQueries({ queryKey: ['estoque'] });
      mostrarToast('Estoque ajustado');
      fecharModal();
    },
  });

  function abrirModal(item: SaldoEstoque) {
    definirItemEmAjuste(item);
    definirQuantidade('');
    definirMotivo('');
    definirObservacoes('');
  }
  function fecharModal() {
    definirItemEmAjuste(null);
  }

  const colunas: Coluna<SaldoEstoque>[] = [
    { chave: 'codigo', rotulo: 'Código', ordenavel: true, renderizar: (i) => <span className="font-mono">{i.codigo}</span> },
    { chave: 'descricao', rotulo: 'Descrição', renderizar: (i) => i.descricao },
    { chave: 'quantidade_atual', rotulo: 'Saldo atual', ordenavel: true, alinhamento: 'direita', renderizar: (i) => i.quantidade_atual },
    { chave: 'quantidade_reservada', rotulo: 'Reservado', alinhamento: 'direita', renderizar: (i) => i.quantidade_reservada },
    { chave: 'disponivel', rotulo: 'Disponível', alinhamento: 'direita', renderizar: (i) => i.disponivel },
    {
      chave: 'status',
      rotulo: 'Situação',
      ordenavel: true,
      renderizar: (i) => (
        <Badge tom={TOM_STATUS[i.status].tom} icone={TOM_STATUS[i.status].icone}>
          {i.status === 'CRITICO' ? 'Crítico' : i.status === 'BLOQUEADO' ? 'Bloqueado' : 'OK'}
        </Badge>
      ),
    },
    {
      chave: 'acao',
      rotulo: 'Ação',
      renderizar: (i) => (
        <Botao variante="fantasma" icone="pencil" onClick={() => abrirModal(i)}>
          Ajustar
        </Botao>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Estoque</h1>
        <p className="text-body text-texto-secondary">Saldo de partes e peças em armazém.</p>
      </div>

      <div className="w-[200px]">
        <Selecao
          rotulo="Situação"
          opcoes={OPCOES_STATUS}
          placeholder="Todos"
          value={lista.status ?? ''}
          onChange={(evento) => lista.definirStatus(evento.target.value || null)}
        />
      </div>

      <div>
        <Tabela<SaldoEstoque>
          rotulo="Estoque"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(i) => i.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhum item de estoque cadastrado ainda."
        />
        <Paginacao
          pagina={lista.paginacao.pagina}
          totalPaginas={lista.paginacao.total_paginas}
          total={lista.paginacao.total}
          aoMudar={lista.definirPagina}
        />
      </div>

      {itemEmAjuste && (
        <Modal aberto aoFechar={fecharModal} titulo={`Ajustar saldo — ${itemEmAjuste.codigo}`}>
          <form
            noValidate
            onSubmit={(evento) => {
              evento.preventDefault();
              mutacaoAjuste.mutate();
            }}
            className="flex flex-col gap-4"
          >
            {mutacaoAjuste.isError && (
              <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
                {separarErro(mutacaoAjuste.error).geral}
              </p>
            )}
            <p className="text-body text-texto-secondary">
              Saldo atual: {itemEmAjuste.quantidade_atual}. Use um número negativo para registrar saída.
            </p>
            <Campo
              rotulo="Quantidade"
              obrigatorio
              tipoDado="quantidade"
              value={quantidade}
              onChange={(evento) => definirQuantidade(evento.target.value)}
            />
            <Campo rotulo="Motivo" obrigatorio value={motivo} onChange={(evento) => definirMotivo(evento.target.value)} />
            <Campo
              rotulo="Observações"
              value={observacoes}
              onChange={(evento) => definirObservacoes(evento.target.value)}
            />
            <div className="flex items-center justify-end gap-2">
              <Botao variante="secundaria" onClick={fecharModal} disabled={mutacaoAjuste.isPending}>
                Cancelar
              </Botao>
              <Botao type="submit" icone="save" ocupado={mutacaoAjuste.isPending} rotuloOcupado="Salvando…">
                Salvar ajuste
              </Botao>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
```

- [ ] **Step 1: Escrever `Estoque.test.tsx` (falhando)**

```tsx
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderizarComProvedores, instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { useToasts } from '@/componentes/ui/Toast';
import { Estoque } from './Estoque';

const ITEM = {
  id: 1, parte_peca_id: 10, codigo: 'CON-001', descricao: 'Conector RCA Macho',
  quantidade_atual: 250, quantidade_reservada: 100, disponivel: 150,
  estoque_minimo: 50, status: 'OK', updated_at: '2026-08-30T12:00:00Z',
};

describe('Estoque', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    useToasts.setState({ itens: [] });
  });

  it('mostra as colunas e o saldo', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } }]);
    renderizarComProvedores(<Estoque />);

    expect(await screen.findByText('CON-001')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('badge de status critico usa o tom certo', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [{ ...ITEM, status: 'CRITICO' }], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } }]);
    renderizarComProvedores(<Estoque />);

    expect(await screen.findByText('Crítico')).toBeInTheDocument();
  });

  it('filtro de status muda a query', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } }]);
    renderizarComProvedores(<Estoque />);
    await screen.findByText('CON-001');

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'CRITICO');

    await waitFor(() => expect(servidor.requisicoes.at(-1)?.params.status).toBe('CRITICO'));
  });

  it('ajustar saldo envia o corpo certo e mostra toast', async () => {
    servidor.responder([
      { metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
      { metodo: 'post', url: '/estoque/ajuste', status: 201, corpo: { dados: { ...ITEM, quantidade_atual: 260 } } },
    ]);
    renderizarComProvedores(<Estoque />);
    await screen.findByText('CON-001');

    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }));
    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText('Quantidade'), '10');
    await userEvent.type(within(modal).getByLabelText('Motivo'), 'Inventário físico');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ajuste' }));

    await waitFor(() =>
      expect(servidor.requisicoes.find((r) => r.url === '/estoque/ajuste')?.corpo).toEqual({
        parte_peca_id: 10, quantidade: 10, motivo: 'Inventário físico',
      }),
    );
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Estoque ajustado');
  });

  it('erro 409 no ajuste mostra alerta com o modal aberto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
      { metodo: 'post', url: '/estoque/ajuste', status: 409, corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'O ajuste deixaria o saldo negativo' } } },
    ]);
    renderizarComProvedores(<Estoque />);
    await screen.findByText('CON-001');

    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }));
    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText('Quantidade'), '-1000');
    await userEvent.type(within(modal).getByLabelText('Motivo'), 'Perda');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ajuste' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('saldo negativo');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npm test -- src/paginas/estoque/Estoque.test.tsx`
Expected: FAIL — `./Estoque` não existe.

- [ ] **Step 2: Implementar `Estoque.tsx`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd frontend && npm test -- src/paginas/estoque/Estoque.test.tsx`
Expected: PASS — 6 testes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/paginas/estoque
git commit -m "feat(frontend): tela de estoque com ajuste manual"
```

---

### Task F4: Modal de recebimento em `DetalhePedidoCompra`

**Files:**
- Modify: `frontend/src/paginas/compras/DetalhePedidoCompra.tsx`
- Modify: `frontend/src/paginas/compras/DetalhePedidoCompra.test.tsx`
- Modify: `frontend/src/servicos/compras.ts` (nova ação)
- Modify: `frontend/src/servicos/compras.test.ts` (novo caso)

**Interfaces:**
- Consumes: `TrilhaEtapas`/`Etapa`/`EstadoEtapa` (já existentes), `separarErro` (já existente).
- Produces: `registrarRecebimentoPedidoCompra` em `servicos/compras.ts`.

Em `servicos/compras.ts`, adicione:

```ts
export interface CorpoRegistrarRecebimento {
  itens: { parte_peca_id: number; quantidade_recebida: number }[];
}

export async function registrarRecebimentoPedidoCompra(
  id: number,
  corpo: CorpoRegistrarRecebimento,
): Promise<PedidoCompra> {
  const { data } = await api.post<EnvelopeItem<PedidoCompra>>(`/pedidos-compra/${id}/registrar-recebimento`, corpo);
  return data.dados;
}
```

Em `DetalhePedidoCompra.tsx`, as mudanças (por cima do arquivo já existente):

```tsx
// tipo do modal ganha 'recebimento'
type ModalAberto = 'emitir' | 'cancelar' | 'recebimento' | null;

// import novo
import { cancelarPedidoCompra, emitirPedidoCompra, obterCompra, registrarRecebimentoPedidoCompra } from '@/servicos/compras';
import { separarErro } from '@/lib/errosDeFormulario';

// a etapa "Concluido" passa a ser acionavel quando ha recebimento pendente
function estadoDaEtapaConcluido(status: PedidoCompra['status']): EstadoEtapa {
  if (status === 'Concluido') return 'concluida';
  if (status === 'Aguardando Entrega' || status === 'Recebido Parcial') return 'pendente-acionavel';
  return 'pendente-futura';
}
```

Dentro do componente, adicione a mutação e troque a etapa "Concluído" para levar `aoAcionar`:

```tsx
const mutacaoRecebimento = useMutation({
  mutationFn: (corpo: Parameters<typeof registrarRecebimentoPedidoCompra>[1]) =>
    registrarRecebimentoPedidoCompra(pedidoId, corpo),
  onSuccess: () => {
    invalidar();
    void clienteQuery.invalidateQueries({ queryKey: ['pedidos-compra', pedidoId] });
    mostrarToast('Recebimento registrado');
    definirModalAberto(null);
  },
});
```

```tsx
{
  chave: 'concluido',
  nome: 'Concluído',
  estado: estadoDaEtapaConcluido(pedido.status),
  timestamp: pedido.data_entrega_real ? formatarData(pedido.data_entrega_real) : undefined,
  aoAcionar: () => definirModalAberto('recebimento'),
},
```

E, ao final do JSX (junto aos outros `Confirmacao`), o modal novo:

```tsx
{modalAberto === 'recebimento' && (
  <ModalRegistrarRecebimento
    pedido={pedido}
    pecaPorId={pecaPorId}
    ocupado={mutacaoRecebimento.isPending}
    erro={separarErro(mutacaoRecebimento.error).geral}
    aoFechar={() => definirModalAberto(null)}
    aoEnviar={(corpo) => mutacaoRecebimento.mutate(corpo)}
  />
)}
```

E o componente local, no fim do arquivo (mirror exato de `ModalRegistrarResposta` em `DetalheCotacao.tsx`, trocando preço por quantidade a receber, com o limite do que ainda falta por item):

```tsx
interface ModalRegistrarRecebimentoProps {
  pedido: PedidoCompra;
  pecaPorId: Map<number, string>;
  ocupado: boolean;
  erro: string | null;
  aoFechar: () => void;
  aoEnviar: (corpo: Parameters<typeof registrarRecebimentoPedidoCompra>[1]) => void;
}

function ModalRegistrarRecebimento({ pedido, pecaPorId, ocupado, erro, aoFechar, aoEnviar }: ModalRegistrarRecebimentoProps) {
  const [receberAgora, definirReceberAgora] = useState<Record<number, string>>(
    Object.fromEntries(pedido.itens.map((item) => [item.parte_peca_id, ''])),
  );

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Registrar recebimento">
      <div className="flex flex-col gap-4">
        {erro && (
          <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
            {erro}
          </p>
        )}
        {pedido.itens.map((item) => {
          const pendente = item.quantidade_solicitada - item.quantidade_recebida;
          return (
            <div key={item.id} className="flex flex-col gap-1">
              <Campo
                rotulo={`${pecaPorId.get(item.parte_peca_id) ?? item.parte_peca_id} — receber agora`}
                tipoDado="quantidade"
                ajuda={`Já recebido: ${item.quantidade_recebida} de ${item.quantidade_solicitada}. Pendente: ${pendente}.`}
                value={receberAgora[item.parte_peca_id] ?? ''}
                onChange={(evento) =>
                  definirReceberAgora((atual) => ({ ...atual, [item.parte_peca_id]: evento.target.value }))
                }
              />
            </div>
          );
        })}
        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </Botao>
          <Botao
            icone="save"
            ocupado={ocupado}
            rotuloOcupado="Registrando…"
            onClick={() =>
              aoEnviar({
                itens: pedido.itens
                  .map((item) => ({
                    parte_peca_id: item.parte_peca_id,
                    quantidade_recebida: Number(receberAgora[item.parte_peca_id] ?? 0),
                  }))
                  .filter((item) => item.quantidade_recebida > 0),
              })
            }
          >
            Registrar recebimento
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 1: Escrever os testes novos (falhando)**

Em `servicos/compras.test.ts`, adicione:

```ts
it('registrarRecebimentoPedidoCompra envia POST para .../registrar-recebimento', async () => {
  servidor.responder([{ metodo: 'post', url: '/pedidos-compra/1/registrar-recebimento', status: 200, corpo: { dados: { id: 1 } } }]);
  await registrarRecebimentoPedidoCompra(1, { itens: [{ parte_peca_id: 10, quantidade_recebida: 5 }] });
  expect(servidor.requisicoes[0].corpo).toEqual({ itens: [{ parte_peca_id: 10, quantidade_recebida: 5 }] });
});
```

Em `DetalhePedidoCompra.test.tsx`, adicione (com um pedido em `status: 'Aguardando Entrega'` no mock, e o item com `quantidade_solicitada: 100, quantidade_recebida: 0`):

```tsx
it('mostra a etapa Concluido como acionavel quando aguardando entrega', async () => {
  servidor.responder([{ metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { dados: PEDIDO_AGUARDANDO_ENTREGA } }]);
  renderizarComProvedores(<DetalhePedidoCompra />, { rota: '/pedidos-compra/1' });

  expect(await screen.findByRole('button', { name: /Concluído/ })).toHaveAttribute('aria-current', 'step');
});

it('registrar recebimento parcial envia o corpo certo e atualiza a tela', async () => {
  servidor.responder([
    { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { dados: PEDIDO_AGUARDANDO_ENTREGA } },
    { metodo: 'post', url: '/pedidos-compra/1/registrar-recebimento', status: 200, corpo: { dados: { ...PEDIDO_AGUARDANDO_ENTREGA, status: 'Recebido Parcial' } } },
  ]);
  renderizarComProvedores(<DetalhePedidoCompra />, { rota: '/pedidos-compra/1' });

  await userEvent.click(await screen.findByRole('button', { name: /Concluído/ }));
  const modal = screen.getByRole('dialog');
  await userEvent.type(within(modal).getByLabelText(/receber agora/), '40');
  await userEvent.click(within(modal).getByRole('button', { name: 'Registrar recebimento' }));

  await waitFor(() =>
    expect(servidor.requisicoes.find((r) => r.url === '/pedidos-compra/1/registrar-recebimento')?.corpo).toEqual({
      itens: [{ parte_peca_id: PEDIDO_AGUARDANDO_ENTREGA.itens[0].parte_peca_id, quantidade_recebida: 40 }],
    }),
  );
  expect(useToasts.getState().itens[0]?.mensagem).toBe('Recebimento registrado');
});
```

Defina `PEDIDO_AGUARDANDO_ENTREGA` no topo do arquivo de teste (mirror do fixture `PEDIDO` já existente, trocando `status` para `'Aguardando Entrega'`).

Run: `cd frontend && npm test -- src/paginas/compras/DetalhePedidoCompra.test.tsx src/servicos/compras.test.ts`
Expected: FAIL — `registrarRecebimentoPedidoCompra` não existe; etapa "Concluído" não é botão.

- [ ] **Step 2: Implementar as mudanças acima** (`compras.ts`, `DetalhePedidoCompra.tsx`).

- [ ] **Step 3: Rodar os testes**

Run: `cd frontend && npm test -- src/paginas/compras/DetalhePedidoCompra.test.tsx src/servicos/compras.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/paginas/compras/DetalhePedidoCompra.tsx frontend/src/paginas/compras/DetalhePedidoCompra.test.tsx frontend/src/servicos/compras.ts frontend/src/servicos/compras.test.ts
git commit -m "feat(frontend): modal de registrar recebimento no detalhe do pedido de compra"
```

---

### Task F5: Navegação, Ajuda, Painel e rota

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/componentes/layout/NavegacaoLateral.tsx` + `.test.tsx`
- Modify: `frontend/src/componentes/layout/Ajuda.tsx` + `.test.tsx`
- Modify: `frontend/src/paginas/Painel.tsx` + `.test.tsx`

**Interfaces:**
- Consumes: `Estoque` (Task F3), `listarEstoqueCriticos` (Task F1).

`App.tsx`: adicione o import de `Estoque` e a rota:

```tsx
import { Estoque } from '@/paginas/estoque/Estoque';
// ...
<Route path="/estoque" element={<Estoque />} />
```

`NavegacaoLateral.tsx`: nova seção "Estoque" (entre "Cadastros" e "Compras", ou depois de "Compras" — manter a ordem do menu igual à ordem do fluxo operacional: Cadastros → Compras → Estoque):

```tsx
const ESTOQUE: ItemNavegacao[] = [{ rota: '/estoque', rotulo: 'Estoque', icone: 'warehouse' }];
```

(confira em `componentes/ui/icones.ts` se `'warehouse'` já está no registro; se não estiver, use `'boxes'` — já usado por "Partes e peças", mas aceitável repetir um ícone entre módulos diferentes já que o texto ao lado desambigua.)

```tsx
<p className="mb-1 mt-6 px-3 text-label text-texto-disabled">Estoque</p>
<ul className="flex flex-col gap-1">
  {ESTOQUE.map((item) => (
    <li key={item.rota}>
      <Link item={item} />
    </li>
  ))}
</ul>
```

`Ajuda.tsx`: novo conteúdo em `CONTEUDO_POR_ROTA`:

```tsx
'/estoque': {
  titulo: 'Ajuda · Estoque',
  itens: [
    'O saldo de cada peça nasce em zero, sempre em situação Crítica, assim que ela é cadastrada.',
    'Situação Crítica significa saldo menor ou igual ao estoque mínimo cadastrado na peça; filtre por situação para ver só o que precisa de atenção.',
    '"Ajustar" registra uma entrada ou saída avulsa (use um número negativo para saída), com motivo obrigatório — útil para corrigir uma contagem física.',
    'O recebimento de um pedido de compra também atualiza este saldo automaticamente — veja o detalhe do pedido em Pedidos de compra.',
  ],
},
```

`Painel.tsx`: novo widget substituindo a entrada `'Insumos em nível crítico'` de `WIDGETS` por um card com dado real (mesmo padrão do card "Pedidos de compra em atraso"):

```tsx
// remove o segundo item de WIDGETS (o de "Insumos em nivel critico") e o
// Cartao correspondente que usava WIDGETS[1]; troca por:

const estoqueCritico = useQuery({
  queryKey: ['estoque', 'criticos'],
  queryFn: listarEstoqueCriticos,
});
```

```tsx
<Cartao titulo="Insumos em nível crítico">
  {estoqueCritico.isPending && <p className="text-body text-texto-secondary">Verificando…</p>}

  {estoqueCritico.isError && (
    <p data-widget-vazio className="text-body text-texto-secondary">
      Não foi possível verificar agora.
    </p>
  )}

  {estoqueCritico.data && estoqueCritico.data.length === 0 && (
    <p data-widget-vazio className="text-body text-texto-secondary">
      Nenhum insumo em estoque crítico.
    </p>
  )}

  {estoqueCritico.data && estoqueCritico.data.length > 0 && (
    <p className="flex items-center gap-2 text-body text-estado-warning">
      <IconeFalha size={16} aria-hidden="true" />
      {estoqueCritico.data.length === 1
        ? '1 insumo em estoque crítico.'
        : `${estoqueCritico.data.length} insumos em estoque crítico.`}
    </p>
  )}
</Cartao>
```

(import novo: `import { listarEstoqueCriticos } from '@/servicos/estoque';`. O card de "Ordens de produção em atraso" continua como está — depende de OP, Sprint 6.)

- [ ] **Step 1: Escrever os testes novos (falhando)**

Em `NavegacaoLateral.test.tsx`: um caso a mais confirmando o link "Estoque" e a rota `/estoque`.
Em `Ajuda.test.tsx`: um caso a mais confirmando o conteúdo de `/estoque`.
Em `Painel.test.tsx`: casos mirror dos já existentes para "Pedidos de compra em atraso", trocando a rota mockada para `/estoque/criticos` e o texto esperado.

```tsx
// Painel.test.tsx — novos casos
it('mostra "Nenhum insumo em estoque crítico." quando a lista vem vazia', async () => {
  servidor.responder([
    { metodo: 'get', url: '/pedidos-compra/em-atraso', status: 200, corpo: { dados: [] } },
    { metodo: 'get', url: '/estoque/criticos', status: 200, corpo: { dados: [] } },
  ]);
  renderizarComProvedores(<Painel />);

  expect(await screen.findByText('Nenhum insumo em estoque crítico.')).toBeInTheDocument();
});

it('mostra a contagem de insumos criticos quando ha itens', async () => {
  servidor.responder([
    { metodo: 'get', url: '/pedidos-compra/em-atraso', status: 200, corpo: { dados: [] } },
    { metodo: 'get', url: '/estoque/criticos', status: 200, corpo: { dados: [{ id: 1 }, { id: 2 }] } },
  ]);
  renderizarComProvedores(<Painel />);

  expect(await screen.findByText('2 insumos em estoque crítico.')).toBeInTheDocument();
});
```

Run: `cd frontend && npm test -- src/componentes/layout/NavegacaoLateral.test.tsx src/componentes/layout/Ajuda.test.tsx src/paginas/Painel.test.tsx`
Expected: FAIL — os novos casos não encontram o conteúdo/rota ainda.

- [ ] **Step 2: Implementar as mudanças acima** (`App.tsx`, `NavegacaoLateral.tsx`, `Ajuda.tsx`, `Painel.tsx`).

- [ ] **Step 3: Rodar os testes**

Run: `cd frontend && npm test -- src/componentes/layout/NavegacaoLateral.test.tsx src/componentes/layout/Ajuda.test.tsx src/paginas/Painel.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/componentes/layout/NavegacaoLateral.tsx frontend/src/componentes/layout/NavegacaoLateral.test.tsx frontend/src/componentes/layout/Ajuda.tsx frontend/src/componentes/layout/Ajuda.test.tsx frontend/src/paginas/Painel.tsx frontend/src/paginas/Painel.test.tsx
git commit -m "feat(frontend): navegacao, ajuda, painel e rota para estoque"
```

---

### Task F6: Verificação final do frontend

- [ ] **Step 1: Suíte, lint e build**

```bash
cd frontend
npm test
npm run lint
npm run build
```

Expected: os três verdes — suíte inteira (275 testes anteriores + os novos desta sprint).

- [ ] **Step 2: Roteiro de navegador real (Playwright, não API direta)**

Com o ambiente no ar: criar peça → abrir `/estoque`, confirmar saldo 0/Crítico; ajustar saldo (positivo e negativo), confirmar 409 ao tentar deixar negativo; criar cotação → enviar → responder → converter em PC → confirmar que o PC nasce em "Aguardando Entrega" (não mais "Emitido") no detalhe; registrar recebimento parcial no modal (etapa "Concluído" acionável), confirmar status "Recebido Parcial"; registrar o restante, confirmar "Concluído" e a trilha fechada; voltar em `/estoque` e confirmar que o saldo da peça subiu. Checagem do §8.4: escala de cinza (badge Crítico/Bloqueado legível por ícone+texto), só teclado (Tab até "Ajustar"/a etapa acionável, abrir/preencher/salvar/fechar o modal), 1280px e 800px sem rolagem horizontal na tela de Estoque.

- [ ] **Step 3: Corrigir achados e "tirar um acessório"**

Aplicar o mesmo rigor das rodadas anteriores (Sprints 2 e 3 encontraram bugs reais de acessibilidade cada vez que essa verificação foi feita a sério — não pular esta etapa) e o passo de revisão do §5/§8 do design system: olhar a tela de Estoque e o modal de recebimento e remover o elemento que menos serve à decisão de quem opera.

- [ ] **Step 4: Commit** (se houver correções)

```bash
git add -A
git commit -m "fix(frontend): ajustes da verificacao visual do modulo de estoque"
```

---

## Documentação e entrega

### Task 21: Screenshots, manual e ledger

- [ ] Capturar telas novas em `docs/screenshots/` (mesmo processo das Tasks 19/20 anteriores — Playwright contra o app real, dados de exemplo realistas, numeração sequencial a partir de `24-`): lista de estoque com saldo OK e crítico, modal de ajuste, detalhe do PC com a etapa de recebimento acionável, modal de recebimento, painel com o widget de estoque crítico real.
- [ ] Atualizar `docs/8_MANUAL_OPERACAO.md`: nova seção "Estoque e recebimento" com o fluxo completo (consultar saldo → ajustar manualmente → registrar recebimento de um PC, parcial e total), screenshots incluídas, entrada na tabela de perguntas frequentes para "por que uma peça nasce em situação Crítica".
- [ ] Atualizar `.superpowers/sdd/progress.md`: nova seção "## Ledger — Sprint 4: Recebimento e Estoque", plano referenciado, decisões de pré-voo (achado do saldo já criado por `peca_repo.go`, ordem escolhida para `RegistrarRecebimento`), ledger tarefa por tarefa no mesmo formato `Task N: complete (commits X..Y, review ...)` das demais.
- [ ] Escrever `task-N-brief.md`/`task-N-report.md` em `.superpowers/sdd/` **no momento de cada tarefa**, não ao final — é o próprio ponto que motivou o usuário a pedir a correção retroativa nas Sprints 2/3 (ver `task-18-report.md` e `task-20-report.md`).
- [ ] Commit final, push, abrir PR com base em `feat/sprint3-cotacoes-pedidos-compra` (não `main`).

---

## Notas de revisão do plano

**Achado durante a pesquisa: o saldo de estoque zerado já é criado desde o Sprint 2.** A spec (§4.3, aprovada) previa uma mudança em `peca_repo.go.Criar` para abrir a linha de `saldo_estoque` — mas essa mudança já existe no código (`peca.go` já tem `SituacaoSaldo`/`SituacaoDoSaldo`, e `peca_repo.go` já grava a linha na mesma transação da peça). Nenhuma tarefa deste plano toca `peca_repo.go`; `estoque.SituacaoDoSaldo` (Task B1) é uma função solta, não um método de `peca.PartePeca`, para não criar uma dependência de `estoque` sobre `peca` só por causa de uma regra de uma linha — o pacote `peca` mantém a sua própria cópia (`SituacaoDoSaldo`), e `estoque` tem a dele; ambas implementam a mesma regra do RN5 (fronteira inclusiva), documentada nos dois lugares.

**Correção em relação à spec aprovada, seção 7 ("Riscos")**: a spec dizia que o acoplamento `pedidocompra`→`estoque` seria mitigado "com uma interface estreita... mesmo padrão já usado para as demais dependências entre módulos" — na verdade, o padrão real já em produção (`CotacaoHandler` sobre `*pedidocompra.Servico`, Sprint 3) usa o **tipo concreto**, não uma interface. Este plano segue o padrão real (`pedidocompra.Servico` guarda um campo `*estoque.Servico`), não o que a spec descreveu incorretamente — sem mudança de comportamento externo, só uma correção de precisão técnica interna.

**Ordem de escrita em `RegistrarRecebimento`** (Task B4): o repositório grava a atualização do PC (itens + status) primeiro; a entrada em estoque é aplicada depois, item a item, fora dessa transação. Se a etapa de estoque falhar no meio, o PC já registrou o recebimento (uma nova tentativa não conta a mesma entrada duas vezes) e a diferença de saldo é visível e corrigível por um ajuste manual (Task B2/F3). É uma limitação aceita, documentada aqui em vez de escondida — este código-base não tem (e esta sprint não constrói) uma abstração de transação compartilhada entre repositórios de módulos diferentes.

**Ordem de execução sugerida**: B1→B2→B3 (estoque sozinho, sem tocar `pedidocompra`) podem ser feitas em paralelo com F1→F2→F3 (frontend usa servidor falso). B4→B5 dependem de B2 (precisam de `estoque.Servico` pronto) e mudam a assinatura de `pedidocompra.NovoServico` — B6 (wiring) só depois de B4/B5. F4 depende de F1 (o tipo `PedidoCompra` já existe desde a Sprint 3, só a ação nova). F5 depende de F3 (rota de `/estoque`) e F1 (`listarEstoqueCriticos`). Screenshots e manual são sempre a última etapa.

**Contagem de testes esperada ao fim**: backend 8 (estoque domínio) + 11 (estoque serviço+repositório) + 8 (handler de estoque) + 6 (pedidocompra: recebimento) + 4 (handler de recebimento) = 37 testes novos no backend, somados aos 336 já existentes (**373** ao final). Frontend: 7 (serviço de estoque) + 2 (hook) + 6 (tela de estoque) + 2 (recebimento no detalhe do PC) + 4 (navegação/ajuda/painel) = 21 testes novos, somados aos 275 já existentes (**296** ao final).
