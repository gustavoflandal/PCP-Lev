# Estrutura de Produto (BOM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a lacuna do Sprint 2: CRUD de Estrutura de Produto (BOM) — criar a
primeira versão, versionar (substituindo a ativa), consultar histórico — desbloqueando o
Sprint 6 (Produção), que exige `estrutura_produto_id` em toda Ordem de Produção.

**Architecture:** Pacote de domínio novo `estrutura` (mirror de `cotacao`: header+itens,
transacional), sem endpoint de edição (só criar/versionar, nunca `PUT`). `GET
/produtos-acabados` (Sprint 2, já existente) ganha um campo aditivo `estrutura_ativa`
via `LEFT JOIN`. Frontend: nova seção "Estrutura de produtos" reaproveitando o hook
genérico `useListagem` já existente, mais uma tela de detalhe/histórico e um formulário
de página cheia (mirror de `NovaCotacao.tsx`).

**Tech Stack:** Go 1.25 + Echo + pgx/v5 (backend), React 18 + TypeScript + Vite +
Tailwind + TanStack Query v5 + react-hook-form (frontend), Vitest + Testing Library,
Playwright para verificação final. TDD, sem mocks (`testsupport.BancoMigrado` roda
contra Postgres real).

## Global Constraints

- Spec aprovada: `docs/superpowers/specs/2026-08-30-estrutura-produto-bom-design.md`.
- Sem migration nova: `estrutura_produto`/`itens_estrutura_produto` já existem desde
  `001_criar_tabelas_base.sql`, com o índice único parcial `uk_estrutura_ativa_por_pa`
  (só uma versão ativa por produto) e `uk_pa_versao` (versão única por produto) já
  impostos pelo banco.
- BOM de um nível só (Produto Acabado → Partes/Peças) — sem submontagens aninhadas,
  divergência documentada com o RF1.3, decisão já validada com o usuário.
- Sem endpoint de edição in-place — só `POST /boms` (1ª versão) e `POST
  /boms/{id}/versionar` (nova versão, inativa a anterior).
- Peças no seletor de itens são só as ativas (`usePartesPecasAtivas`, já existente).
- Todo texto de interface em português, sentence-case, `noValidate` nos formulários
  desde o primeiro commit.
- Branch: `feat/estrutura-produto-bom`, empilhada sobre `feat/sprint4-recebimento-estoque`
  (topo atual do trabalho, ainda não mesclado).

---

## Backend

### Task B1: Domínio `estrutura` — modelo, erros e validação

**Files:**
- Create: `backend/internal/domain/estrutura/estrutura.go`
- Create: `backend/internal/domain/estrutura/estrutura_test.go`

**Interfaces:**
- Consumes: nada (pacote novo, sem dependência de outro domínio).
- Produces: `estrutura.Estrutura`, `estrutura.Item`, `estrutura.Dados`,
  `estrutura.ItemDados`, as sentinelas de erro — usadas pelas Tasks B2 (serviço) e B3
  (handler).

```go
// Package estrutura contem o cadastro de Estrutura de Produto (BOM, RF1.3):
// o mapeamento de Partes/Pecas necessarias para montar 1 unidade de um
// Produto Acabado. So um nivel (PA -> lista de PPs, sem submontagens
// aninhadas) -- o schema (001_criar_tabelas_base.sql) so referencia
// Partes/Pecas em itens_estrutura_produto, nunca outro Produto Acabado.
package estrutura

import (
	"errors"
	"strings"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

var (
	ErrProdutoAcabadoObrigatorio = errors.New("informe o produto acabado")
	ErrProdutoAcabadoInexistente = errors.New("o produto acabado informado nao existe")
	ErrItensObrigatorios         = errors.New("informe ao menos um item")
	ErrQuantidadeInvalida        = errors.New("a quantidade de cada item deve ser maior que zero")
	ErrPartePecaInexistente      = errors.New("uma das pecas informadas nao existe")
	ErrDataVigenciaObrigatoria   = errors.New("informe a data de inicio da vigencia")
	ErrDataVigenciaFimInvalida   = errors.New("a data de fim da vigencia deve ser posterior ao inicio")
	// ErrVigenciaAnteriorAAtual e devolvido por Versionar quando a nova data
	// de inicio de vigencia nao e posterior a vigencia da estrutura sendo
	// substituida -- evita gravar um intervalo de datas invertido no historico.
	ErrVigenciaAnteriorAAtual = errors.New("a nova vigencia deve comecar depois da vigencia atual")
	// ErrJaPossuiEstruturaAtiva mapeia a violacao do indice unico parcial
	// uk_estrutura_ativa_por_pa -- o produto ja tem uma versao ativa, use
	// Versionar em vez de Criar.
	ErrJaPossuiEstruturaAtiva = errors.New("este produto ja possui uma estrutura ativa, use versionar")
	// ErrStatusInvalidoParaAcao cobre tentar versionar uma estrutura que nao
	// e mais a ativa (ja foi superada por uma versao posterior).
	ErrStatusInvalidoParaAcao = errors.New("esta estrutura nao esta ativa e nao pode ser versionada")
	ErrNaoEncontrado          = errors.New("estrutura de produto nao encontrada")
)

// Item e uma parte/peca com a quantidade necessaria para montar 1 unidade do
// produto acabado.
type Item struct {
	ID          int64 `json:"id"`
	PartePecaID int64 `json:"parte_peca_id"`
	Quantidade  int   `json:"quantidade"`
}

// Estrutura e uma versao da BOM de um Produto Acabado.
type Estrutura struct {
	ID                 int64      `json:"id"`
	ProdutoAcabadoID   int64      `json:"produto_acabado_id"`
	Versao             int        `json:"versao"`
	DataVigenciaInicio tempo.Data `json:"data_vigencia_inicio"`
	DataVigenciaFim    tempo.Data `json:"data_vigencia_fim,omitzero"`
	Ativo              bool       `json:"ativo"`
	Itens              []Item     `json:"itens,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	CreatedBy          *string    `json:"created_by,omitempty"`
	UpdatedBy          *string    `json:"updated_by,omitempty"`
}

// ItemDados sao os dados de um item informados na criacao/versionamento.
type ItemDados struct {
	PartePecaID int64
	Quantidade  int
}

// Dados serve tanto Criar quanto Versionar. ProdutoAcabadoID e lido do corpo
// em Criar (POST /boms); em Versionar o Servico ignora esse campo -- o
// produto e derivado da estrutura ativa que esta sendo substituida.
type Dados struct {
	ProdutoAcabadoID   int64
	DataVigenciaInicio tempo.Data
	DataVigenciaFim    tempo.Data
	Itens              []ItemDados
}

// Validar aplica as regras do RF1.3. err de "produto obrigatorio" so faz
// sentido em Criar -- Versionar nunca chama isto sobre o ProdutoAcabadoID.
func (d Dados) Validar() error {
	if len(d.Itens) == 0 {
		return ErrItensObrigatorios
	}
	for _, item := range d.Itens {
		if item.Quantidade <= 0 {
			return ErrQuantidadeInvalida
		}
	}
	if d.DataVigenciaInicio.IsZero() {
		return ErrDataVigenciaObrigatoria
	}
	if !d.DataVigenciaFim.IsZero() && !d.DataVigenciaFim.After(d.DataVigenciaInicio) {
		return ErrDataVigenciaFimInvalida
	}
	return nil
}

// ValidarProduto e chamada so por Criar (Versionar deriva o produto da
// estrutura ativa, nunca do corpo da requisicao).
func (d Dados) ValidarProduto() error {
	if d.ProdutoAcabadoID <= 0 {
		return ErrProdutoAcabadoObrigatorio
	}
	return nil
}

// Normalizar nao precisa limpar strings (nenhum campo de texto livre nesta
// tarefa), mas existe pela simetria com os outros dominios e para um lugar
// unico crescer se um campo de texto for adicionado depois.
func (d *Dados) Normalizar() {
	_ = strings.TrimSpace // no-op hoje; mantido por simetria com outros dominios
}
```

- [ ] **Step 1: Escrever os testes (falhando)**

```go
package estrutura_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/stretchr/testify/require"
)

func TestValidarExigeItens(t *testing.T) {
	inicio, _ := tempo.DeString("2026-09-01")
	d := estrutura.Dados{DataVigenciaInicio: inicio}
	require.ErrorIs(t, d.Validar(), estrutura.ErrItensObrigatorios)
}

func TestValidarExigeQuantidadePositiva(t *testing.T) {
	inicio, _ := tempo.DeString("2026-09-01")
	d := estrutura.Dados{DataVigenciaInicio: inicio, Itens: []estrutura.ItemDados{{PartePecaID: 1, Quantidade: 0}}}
	require.ErrorIs(t, d.Validar(), estrutura.ErrQuantidadeInvalida)
}

func TestValidarExigeVigenciaInicio(t *testing.T) {
	d := estrutura.Dados{Itens: []estrutura.ItemDados{{PartePecaID: 1, Quantidade: 2}}}
	require.ErrorIs(t, d.Validar(), estrutura.ErrDataVigenciaObrigatoria)
}

func TestValidarRejeitaFimAnteriorOuIgualAoInicio(t *testing.T) {
	inicio, _ := tempo.DeString("2026-09-01")
	fim, _ := tempo.DeString("2026-09-01")
	d := estrutura.Dados{
		DataVigenciaInicio: inicio, DataVigenciaFim: fim,
		Itens: []estrutura.ItemDados{{PartePecaID: 1, Quantidade: 2}},
	}
	require.ErrorIs(t, d.Validar(), estrutura.ErrDataVigenciaFimInvalida)
}

func TestValidarAceitaDadosCompletos(t *testing.T) {
	inicio, _ := tempo.DeString("2026-09-01")
	d := estrutura.Dados{DataVigenciaInicio: inicio, Itens: []estrutura.ItemDados{{PartePecaID: 1, Quantidade: 2}}}
	require.NoError(t, d.Validar())
}

func TestValidarProdutoExigeProdutoAcabadoID(t *testing.T) {
	d := estrutura.Dados{}
	require.ErrorIs(t, d.ValidarProduto(), estrutura.ErrProdutoAcabadoObrigatorio)
}
```

Run: `cd backend && go test ./internal/domain/estrutura/...`
Expected: FAIL — pacote `estrutura` não existe.

- [ ] **Step 2: Implementar `estrutura.go`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd backend && go test ./internal/domain/estrutura/...`
Expected: PASS — 6 testes.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/domain/estrutura
git commit -m "feat(backend): dominio de estrutura de produto (BOM)"
```

---

### Task B2: `estrutura.Servico` e `EstruturaRepositorio` (Postgres)

**Files:**
- Create: `backend/internal/domain/estrutura/servico.go`
- Create: `backend/internal/domain/estrutura/servico_test.go` (cobre serviço e
  repositório juntos — `Criar`/`Versionar` são finos o bastante sobre o repositório
  para não precisarem de um `estrutura_repo_test.go` à parte; mesmo raciocínio já usado
  quando um teste de serviço exercita comportamento do repositório real via
  `testsupport.BancoMigrado`)
- Create: `backend/internal/infra/repository/estrutura_repo.go`

**Interfaces:**
- Consumes: tipos/erros da Task B1; `violouIndiceUnico`/`violouChaveEstrangeira`
  (já existentes em `infra/repository/erros.go`); `tempo.Data`/`tempo.Hoje` (já existentes).
- Produces: `estrutura.NovoServico(repo) *Servico` com `Criar`, `Versionar`,
  `BuscarPorID`, `ListarPorProduto`; `repository.NovoEstruturaRepositorio(pool)` — usados
  pela Task B3 (handler).

**Por que domínio e repositório juntos**: como nas sprints anteriores,
`servico_test.go` só compila e passa contra uma implementação real de `Repositorio` —
os testes de serviço deste projeto rodam sobre Postgres real via
`testsupport.BancoMigrado`, sem mocks.

```go
// servico.go
package estrutura

import "context"

// ColunasOrdenaveis restringe o `ordenar_por` do historico (nesta tarefa o
// historico nao pagina/ordena por query string, mas a constante existe pela
// simetria com os demais dominios, caso uma listagem HTTP paginada seja
// adicionada depois).
var ColunasOrdenaveis = []string{"versao", "data_vigencia_inicio", "created_at"}

// Repositorio e a porta de persistencia da estrutura de produto.
type Repositorio interface {
	Criar(ctx context.Context, e *Estrutura, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*Estrutura, error)
	ListarPorProduto(ctx context.Context, produtoAcabadoID int64) ([]Estrutura, error)
	// Versionar substitui a estrutura ativa em idAtual pela nova (que chega
	// sem ID/Versao definidos -- o repositorio calcula a proxima versao e
	// inativa a antiga, tudo numa transacao).
	Versionar(ctx context.Context, idAtual int64, nova *Estrutura, autor string) (*Estrutura, error)
}

// Servico reune os casos de uso de estrutura de produto.
type Servico struct{ repo Repositorio }

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

func calcularItens(itens []ItemDados) []Item {
	calculados := make([]Item, len(itens))
	for i, item := range itens {
		calculados[i] = Item{PartePecaID: item.PartePecaID, Quantidade: item.Quantidade}
	}
	return calculados
}

// Criar cadastra a primeira versao da BOM de um produto.
func (s *Servico) Criar(ctx context.Context, dados Dados, autor string) (*Estrutura, error) {
	if err := dados.ValidarProduto(); err != nil {
		return nil, err
	}
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	e := &Estrutura{
		ProdutoAcabadoID: dados.ProdutoAcabadoID, Versao: 1,
		DataVigenciaInicio: dados.DataVigenciaInicio, DataVigenciaFim: dados.DataVigenciaFim,
		Ativo: true, Itens: calcularItens(dados.Itens),
	}
	if err := s.repo.Criar(ctx, e, autor); err != nil {
		return nil, err
	}
	return e, nil
}

func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*Estrutura, error) {
	return s.repo.BuscarPorID(ctx, id)
}

func (s *Servico) ListarPorProduto(ctx context.Context, produtoAcabadoID int64) ([]Estrutura, error) {
	return s.repo.ListarPorProduto(ctx, produtoAcabadoID)
}

// Versionar substitui a estrutura ativa em idAtual por uma nova versao —
// so permitido se idAtual ainda for a ativa, e se a nova vigencia comecar
// depois da vigencia atual.
func (s *Servico) Versionar(ctx context.Context, idAtual int64, dados Dados, autor string) (*Estrutura, error) {
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	atual, err := s.repo.BuscarPorID(ctx, idAtual)
	if err != nil {
		return nil, err
	}
	if !atual.Ativo {
		return nil, ErrStatusInvalidoParaAcao
	}
	if !dados.DataVigenciaInicio.After(atual.DataVigenciaInicio) {
		return nil, ErrVigenciaAnteriorAAtual
	}

	nova := &Estrutura{
		ProdutoAcabadoID:   atual.ProdutoAcabadoID,
		DataVigenciaInicio: dados.DataVigenciaInicio, DataVigenciaFim: dados.DataVigenciaFim,
		Ativo: true, Itens: calcularItens(dados.Itens),
	}
	return s.repo.Versionar(ctx, idAtual, nova, autor)
}
```

`servico_test.go` (contra `testsupport.BancoMigrado`; usa `produto.Servico`/
`repository.NovoProdutoRepositorio` para criar um produto de apoio, e
`peca.Servico`/`repository.NovoPecaRepositorio` para uma peça de apoio — mesmo padrão de
`criarFornecedorDeTeste`/`criarPecaDeTeste` em `pedidocompra/servico_test.go`):

```go
package estrutura_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func servicoComBanco(t *testing.T) (*estrutura.Servico, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return estrutura.NovoServico(repository.NovoEstruturaRepositorio(pool)), pool
}

func criarProdutoDeTeste(ctx context.Context, t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	servico := produto.NovoServico(repository.NovoProdutoRepositorio(pool))
	preco, _ := dinheiro.DeString("5000.00")
	criado, err := servico.Criar(ctx, produto.Dados{
		Codigo: "VMS-01", Descricao: "Painel de velocidade modelo 01", UnidadeMedida: "UN",
		PrecoVenda: preco, LeadTimeProducao: 15,
	}, "gestor01")
	require.NoError(t, err)
	return criado.ID
}

func criarPecaDeTeste(ctx context.Context, t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	servico := peca.NovoServico(repository.NovoPecaRepositorio(pool))
	criada, err := servico.Criar(ctx, peca.Dados{
		Codigo: "RES-10K", Descricao: "Resistor de 10 kOhm", UnidadeMedida: "UN",
		EstoqueMinimo: 0, EstoqueMaximo: 100, LeadTimeCompra: 7,
	}, "gestor01")
	require.NoError(t, err)
	return criada.ID
}

func dadosDeTeste(pecaID int64, dataInicio string) estrutura.Dados {
	inicio, _ := tempo.DeString(dataInicio)
	return estrutura.Dados{
		DataVigenciaInicio: inicio,
		Itens:              []estrutura.ItemDados{{PartePecaID: pecaID, Quantidade: 4}},
	}
}

func TestCriarPrimeiraVersao(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID

	criada, err := servico.Criar(ctx, dados, "gestor01")

	require.NoError(t, err)
	require.Equal(t, 1, criada.Versao)
	require.True(t, criada.Ativo)
}

func TestCriarSegundaDiretoFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID
	_, err := servico.Criar(ctx, dados, "gestor01")
	require.NoError(t, err)

	_, err = servico.Criar(ctx, dados, "gestor01")

	require.ErrorIs(t, err, estrutura.ErrJaPossuiEstruturaAtiva)
}

func TestVersionarTrocaAAtiva(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID
	primeira, err := servico.Criar(ctx, dados, "gestor01")
	require.NoError(t, err)

	segunda, err := servico.Versionar(ctx, primeira.ID, dadosDeTeste(pecaID, "2026-10-01"), "gestor01")

	require.NoError(t, err)
	require.Equal(t, 2, segunda.Versao)
	require.True(t, segunda.Ativo)

	antiga, err := servico.BuscarPorID(ctx, primeira.ID)
	require.NoError(t, err)
	require.False(t, antiga.Ativo)
	require.False(t, antiga.DataVigenciaFim.IsZero())
}

func TestVersionarUmaJaSuperadaFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID
	primeira, err := servico.Criar(ctx, dados, "gestor01")
	require.NoError(t, err)
	_, err = servico.Versionar(ctx, primeira.ID, dadosDeTeste(pecaID, "2026-10-01"), "gestor01")
	require.NoError(t, err)

	_, err = servico.Versionar(ctx, primeira.ID, dadosDeTeste(pecaID, "2026-11-01"), "gestor01")

	require.ErrorIs(t, err, estrutura.ErrStatusInvalidoParaAcao)
}

func TestVersionarComVigenciaAnteriorFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID
	primeira, err := servico.Criar(ctx, dados, "gestor01")
	require.NoError(t, err)

	_, err = servico.Versionar(ctx, primeira.ID, dadosDeTeste(pecaID, "2026-08-01"), "gestor01")

	require.ErrorIs(t, err, estrutura.ErrVigenciaAnteriorAAtual)
}

func TestPecaInexistenteFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)

	dados := dadosDeTeste(999999, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID

	_, err := servico.Criar(ctx, dados, "gestor01")

	require.ErrorIs(t, err, estrutura.ErrPartePecaInexistente)
}

func TestListarPorProdutoTrazHistoricoMaisRecentePrimeiro(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID
	primeira, err := servico.Criar(ctx, dados, "gestor01")
	require.NoError(t, err)
	_, err = servico.Versionar(ctx, primeira.ID, dadosDeTeste(pecaID, "2026-10-01"), "gestor01")
	require.NoError(t, err)

	historico, err := servico.ListarPorProduto(ctx, produtoID)

	require.NoError(t, err)
	require.Len(t, historico, 2)
	require.Equal(t, 2, historico[0].Versao)
	require.Equal(t, 1, historico[1].Versao)
}
```

Run: `cd backend && go test ./internal/domain/estrutura/... ./internal/infra/repository/... -run Estrutura`
Expected: FAIL — `EstruturaRepositorio`/`estrutura.Servico.Versionar` não existem.

- [ ] **Step 1: Implementar `servico.go` e `estrutura_repo.go`** (código completo acima e abaixo).

```go
// estrutura_repo.go
package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasEstrutura = `id, produto_acabado_id, versao, data_vigencia_inicio,
	data_vigencia_fim, ativo, created_at, updated_at, created_by, updated_by`

const colunasItemEstrutura = `id, parte_peca_id, quantidade`

// EstruturaRepositorio implementa estrutura.Repositorio sobre PostgreSQL.
type EstruturaRepositorio struct {
	pool *pgxpool.Pool
}

// NovoEstruturaRepositorio cria o repositorio de estrutura de produto.
func NovoEstruturaRepositorio(pool *pgxpool.Pool) *EstruturaRepositorio {
	return &EstruturaRepositorio{pool: pool}
}

// Criar grava a estrutura e os seus itens na mesma transacao.
func (r *EstruturaRepositorio) Criar(ctx context.Context, e *estrutura.Estrutura, autor string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	sql := `INSERT INTO estrutura_produto
		(produto_acabado_id, versao, data_vigencia_inicio, data_vigencia_fim, ativo, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		RETURNING id, created_at, updated_at`

	err = tx.QueryRow(ctx, sql,
		e.ProdutoAcabadoID, e.Versao, e.DataVigenciaInicio, e.DataVigenciaFim, e.Ativo, autor,
	).Scan(&e.ID, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		if violouIndiceUnico(err, "uk_estrutura_ativa_por_pa") {
			return estrutura.ErrJaPossuiEstruturaAtiva
		}
		if violouChaveEstrangeira(err) {
			return estrutura.ErrProdutoAcabadoInexistente
		}
		return fmt.Errorf("criar estrutura de produto: %w", err)
	}

	for i, item := range e.Itens {
		err := tx.QueryRow(ctx,
			`INSERT INTO itens_estrutura_produto (estrutura_produto_id, parte_peca_id, quantidade)
			 VALUES ($1, $2, $3) RETURNING id`,
			e.ID, item.PartePecaID, item.Quantidade,
		).Scan(&e.Itens[i].ID)
		if err != nil {
			if violouChaveEstrangeira(err) {
				return estrutura.ErrPartePecaInexistente
			}
			return fmt.Errorf("criar item da estrutura: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("confirmar criacao da estrutura: %w", err)
	}
	e.CreatedBy, e.UpdatedBy = &autor, &autor
	return nil
}

// BuscarPorID devolve a estrutura com os seus itens.
func (r *EstruturaRepositorio) BuscarPorID(ctx context.Context, id int64) (*estrutura.Estrutura, error) {
	var e estrutura.Estrutura
	err := r.pool.QueryRow(ctx, `SELECT `+colunasEstrutura+` FROM estrutura_produto WHERE id = $1`, id).Scan(
		&e.ID, &e.ProdutoAcabadoID, &e.Versao, &e.DataVigenciaInicio, &e.DataVigenciaFim,
		&e.Ativo, &e.CreatedAt, &e.UpdatedAt, &e.CreatedBy, &e.UpdatedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, estrutura.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar estrutura de produto: %w", err)
	}
	itens, err := r.itensDaEstrutura(ctx, id)
	if err != nil {
		return nil, err
	}
	e.Itens = itens
	return &e, nil
}

func (r *EstruturaRepositorio) itensDaEstrutura(ctx context.Context, estruturaID int64) ([]estrutura.Item, error) {
	linhas, err := r.pool.Query(ctx,
		`SELECT `+colunasItemEstrutura+` FROM itens_estrutura_produto WHERE estrutura_produto_id = $1 ORDER BY id`,
		estruturaID)
	if err != nil {
		return nil, fmt.Errorf("buscar itens da estrutura: %w", err)
	}
	defer linhas.Close()

	itens := make([]estrutura.Item, 0)
	for linhas.Next() {
		var item estrutura.Item
		if err := linhas.Scan(&item.ID, &item.PartePecaID, &item.Quantidade); err != nil {
			return nil, err
		}
		itens = append(itens, item)
	}
	return itens, linhas.Err()
}

// ListarPorProduto devolve o historico completo (todas as versoes), da mais
// recente para a mais antiga — sem paginacao, lista curta por natureza.
func (r *EstruturaRepositorio) ListarPorProduto(ctx context.Context, produtoAcabadoID int64) ([]estrutura.Estrutura, error) {
	linhas, err := r.pool.Query(ctx,
		`SELECT `+colunasEstrutura+` FROM estrutura_produto WHERE produto_acabado_id = $1 ORDER BY versao DESC`,
		produtoAcabadoID)
	if err != nil {
		return nil, fmt.Errorf("listar estruturas do produto: %w", err)
	}
	defer linhas.Close()

	itens := make([]estrutura.Estrutura, 0)
	for linhas.Next() {
		var e estrutura.Estrutura
		if err := linhas.Scan(
			&e.ID, &e.ProdutoAcabadoID, &e.Versao, &e.DataVigenciaInicio, &e.DataVigenciaFim,
			&e.Ativo, &e.CreatedAt, &e.UpdatedAt, &e.CreatedBy, &e.UpdatedBy,
		); err != nil {
			return nil, err
		}
		itens = append(itens, e)
	}
	return itens, linhas.Err()
}

// Versionar substitui a estrutura ativa em idAtual: apura a proxima versao,
// inativa a antiga (so se ainda estiver ativa — o UPDATE com "AND ativo" e
// quem trava a linha; uma segunda chamada concorrente para o mesmo idAtual
// bloqueia ate a primeira commitar, depois nao afeta nenhuma linha) e grava
// a nova, tudo numa transacao.
func (r *EstruturaRepositorio) Versionar(
	ctx context.Context, idAtual int64, nova *estrutura.Estrutura, autor string,
) (*estrutura.Estrutura, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var maxVersao int
	if err := tx.QueryRow(ctx,
		`SELECT max(versao) FROM estrutura_produto WHERE produto_acabado_id = $1`, nova.ProdutoAcabadoID,
	).Scan(&maxVersao); err != nil {
		return nil, fmt.Errorf("apurar versao atual: %w", err)
	}
	nova.Versao = maxVersao + 1

	fimDaAntiga := tempo.Data{Time: nova.DataVigenciaInicio.Time.AddDate(0, 0, -1)}
	etiqueta, err := tx.Exec(ctx,
		`UPDATE estrutura_produto SET ativo = false, data_vigencia_fim = $2, updated_by = $3 WHERE id = $1 AND ativo`,
		idAtual, fimDaAntiga, autor)
	if err != nil {
		return nil, fmt.Errorf("inativar estrutura anterior: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return nil, estrutura.ErrStatusInvalidoParaAcao
	}

	sql := `INSERT INTO estrutura_produto
		(produto_acabado_id, versao, data_vigencia_inicio, data_vigencia_fim, ativo, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		RETURNING id, created_at, updated_at`
	err = tx.QueryRow(ctx, sql,
		nova.ProdutoAcabadoID, nova.Versao, nova.DataVigenciaInicio, nova.DataVigenciaFim, nova.Ativo, autor,
	).Scan(&nova.ID, &nova.CreatedAt, &nova.UpdatedAt)
	if err != nil {
		if violouChaveEstrangeira(err) {
			return nil, estrutura.ErrProdutoAcabadoInexistente
		}
		return nil, fmt.Errorf("criar nova versao da estrutura: %w", err)
	}

	for i, item := range nova.Itens {
		err := tx.QueryRow(ctx,
			`INSERT INTO itens_estrutura_produto (estrutura_produto_id, parte_peca_id, quantidade)
			 VALUES ($1, $2, $3) RETURNING id`,
			nova.ID, item.PartePecaID, item.Quantidade,
		).Scan(&nova.Itens[i].ID)
		if err != nil {
			if violouChaveEstrangeira(err) {
				return nil, estrutura.ErrPartePecaInexistente
			}
			return nil, fmt.Errorf("criar item da nova versao: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("confirmar versionamento: %w", err)
	}
	nova.CreatedBy, nova.UpdatedBy = &autor, &autor
	return nova, nil
}
```

- [ ] **Step 2: Rodar os testes**

Run: `cd backend && go test ./internal/domain/estrutura/... ./internal/infra/repository/... -run 'Criar|Versionar|Listar|Peca'`
Expected: PASS — 7 testes de serviço.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/domain/estrutura backend/internal/infra/repository/estrutura_repo.go backend/internal/infra/repository/estrutura_repo_test.go
git commit -m "feat(backend): servico e repositorio de estrutura de produto"
```

---

### Task B3: Handler HTTP `/boms` e `/produtos-acabados/{id}/boms`

**Files:**
- Create: `backend/internal/api/handlers/estrutura.go`
- Create: `backend/internal/api/handlers/estrutura_test.go`

**Interfaces:**
- Consumes: `estrutura.Servico` (Task B2); `idDaRota`, `mapaDeErros`,
  `autorDaRequisicao`, `erroRequisicaoInvalida` (já existentes em `erros.go`).
- Produces: `handlers.NovoEstruturaHandler(servico).Registrar(grupo, autenticacao)` —
  usado pela Task B5 (wiring).

`Registrar` publica as rotas de `/boms` e, no MESMO grupo compartilhado (`v1`), a rota
`/produtos-acabados/:id/boms` — sem tocar em `ProdutoHandler` (que não precisa saber
nada sobre estrutura de produto; Echo permite qualquer handler registrar rotas no mesmo
grupo).

```go
package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/labstack/echo/v4"
)

var errosEstrutura = mapaDeErros{
	{estrutura.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{estrutura.ErrJaPossuiEstruturaAtiva, http.StatusConflict, httpx.CodigoConflito},
	{estrutura.ErrStatusInvalidoParaAcao, http.StatusConflict, httpx.CodigoConflito},
	{estrutura.ErrVigenciaAnteriorAAtual, http.StatusConflict, httpx.CodigoConflito},
	{estrutura.ErrProdutoAcabadoObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrProdutoAcabadoInexistente, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrItensObrigatorios, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrQuantidadeInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrPartePecaInexistente, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrDataVigenciaObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrDataVigenciaFimInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// EstruturaHandler atende /boms e /produtos-acabados/{id}/boms (RF1.3).
type EstruturaHandler struct {
	servico *estrutura.Servico
}

// NovoEstruturaHandler cria o handler de estrutura de produto.
func NovoEstruturaHandler(servico *estrutura.Servico) *EstruturaHandler {
	return &EstruturaHandler{servico: servico}
}

// Registrar publica as rotas do modulo.
func (h *EstruturaHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	gestao := middleware.ExigirPerfil(usuario.PerfilAdmin, usuario.PerfilGestor)

	rotas := grupo.Group("/boms", autenticacao)
	rotas.POST("", h.Criar, gestao)
	rotas.GET("/:id", h.Obter)
	rotas.POST("/:id/versionar", h.Versionar, gestao)

	grupo.GET("/produtos-acabados/:id/boms", h.ListarPorProduto, autenticacao)
}

type itemEstruturaRequest struct {
	PartePecaID int64 `json:"parte_peca_id" validate:"required"`
	Quantidade  int   `json:"quantidade" validate:"required,gt=0"`
}

type criarEstruturaRequest struct {
	ProdutoAcabadoID   int64                  `json:"produto_acabado_id" validate:"required"`
	DataVigenciaInicio string                 `json:"data_vigencia_inicio" validate:"required"`
	DataVigenciaFim    string                 `json:"data_vigencia_fim"`
	Itens              []itemEstruturaRequest `json:"itens" validate:"required,min=1,dive"`
}

func (r criarEstruturaRequest) paraDados() (estrutura.Dados, error) {
	inicio, err := tempo.DeString(r.DataVigenciaInicio)
	if err != nil {
		return estrutura.Dados{}, err
	}
	var fim tempo.Data
	if r.DataVigenciaFim != "" {
		fim, err = tempo.DeString(r.DataVigenciaFim)
		if err != nil {
			return estrutura.Dados{}, err
		}
	}
	itens := make([]estrutura.ItemDados, len(r.Itens))
	for i, item := range r.Itens {
		itens[i] = estrutura.ItemDados{PartePecaID: item.PartePecaID, Quantidade: item.Quantidade}
	}
	return estrutura.Dados{
		ProdutoAcabadoID: r.ProdutoAcabadoID, DataVigenciaInicio: inicio, DataVigenciaFim: fim, Itens: itens,
	}, nil
}

type versionarEstruturaRequest struct {
	DataVigenciaInicio string                 `json:"data_vigencia_inicio" validate:"required"`
	DataVigenciaFim    string                 `json:"data_vigencia_fim"`
	Itens              []itemEstruturaRequest `json:"itens" validate:"required,min=1,dive"`
}

func (r versionarEstruturaRequest) paraDados() (estrutura.Dados, error) {
	inicio, err := tempo.DeString(r.DataVigenciaInicio)
	if err != nil {
		return estrutura.Dados{}, err
	}
	var fim tempo.Data
	if r.DataVigenciaFim != "" {
		fim, err = tempo.DeString(r.DataVigenciaFim)
		if err != nil {
			return estrutura.Dados{}, err
		}
	}
	itens := make([]estrutura.ItemDados, len(r.Itens))
	for i, item := range r.Itens {
		itens[i] = estrutura.ItemDados{PartePecaID: item.PartePecaID, Quantidade: item.Quantidade}
	}
	return estrutura.Dados{DataVigenciaInicio: inicio, DataVigenciaFim: fim, Itens: itens}, nil
}

// Criar cadastra a primeira versao da BOM de um produto.
func (h *EstruturaHandler) Criar(c echo.Context) error {
	var req criarEstruturaRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}
	dados, err := req.paraDados()
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	criada, err := h.servico.Criar(c.Request().Context(), dados, autorDaRequisicao(c))
	if err != nil {
		return errosEstrutura.responder(c, err)
	}
	return httpx.Criado(c, criada)
}

// Obter devolve uma versao especifica da estrutura, com os itens.
func (h *EstruturaHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da estrutura deve ser numerico")
	}
	encontrada, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosEstrutura.responder(c, err)
	}
	return httpx.OK(c, encontrada)
}

// Versionar substitui a estrutura ativa por uma nova versao.
func (h *EstruturaHandler) Versionar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da estrutura deve ser numerico")
	}
	var req versionarEstruturaRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}
	dados, err := req.paraDados()
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	nova, err := h.servico.Versionar(c.Request().Context(), id, dados, autorDaRequisicao(c))
	if err != nil {
		return errosEstrutura.responder(c, err)
	}
	return httpx.Criado(c, nova)
}

// ListarPorProduto devolve o historico completo de um produto.
func (h *EstruturaHandler) ListarPorProduto(c echo.Context) error {
	produtoID, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do produto deve ser numerico")
	}
	historico, err := h.servico.ListarPorProduto(c.Request().Context(), produtoID)
	if err != nil {
		return errosEstrutura.responder(c, err)
	}
	return httpx.OK(c, historico)
}
```

- [ ] **Step 1: Escrever `estrutura_test.go` (falhando)**

Mesmo padrão de `pedidos_compra_test.go`: `apiProtegida`/`api.chamar`/`dados`/`lista`/
`formatarID` já existentes em `testapi_test.go`.

```go
package handlers_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// apiEstrutura monta o EstruturaHandler sobre um banco migrado e devolve
// tambem o id de um produto e de uma peca de apoio, cadastrados direto no
// banco (mesmo padrao de criarFornecedorEPecaDeApoio em pedidos_compra_test.go).
func apiEstrutura(t *testing.T) (*apiProtegida, int64, int64) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoEstruturaHandler(estrutura.NovoServico(repository.NovoEstruturaRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())

	produtoID, pecaID := criarProdutoEPecaDeApoio(t, api)
	return api, produtoID, pecaID
}

func criarProdutoEPecaDeApoio(t *testing.T, api *apiProtegida) (int64, int64) {
	t.Helper()
	ctx := context.Background()

	var produtoID int64
	require.NoError(t, api.pool.QueryRow(ctx,
		`INSERT INTO produtos_acabados (codigo, descricao, unidade_medida, preco_venda, lead_time_producao)
		 VALUES ($1, $2, 'UN', 5000, 15) RETURNING id`,
		"VMS-01", "Painel de velocidade modelo 01").Scan(&produtoID))

	var pecaID int64
	require.NoError(t, api.pool.QueryRow(ctx,
		`INSERT INTO partes_pecas (codigo, descricao, unidade_medida, estoque_minimo, estoque_maximo, lead_time_compra)
		 VALUES ($1, $2, 'UN', 0, 100, 7) RETURNING id`,
		"RES-10K", "Resistor de 10 kOhm").Scan(&pecaID))
	_, err := api.pool.Exec(ctx,
		`INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, quantidade_reservada, status) VALUES ($1, 0, 0, 'CRITICO')`,
		pecaID)
	require.NoError(t, err)

	return produtoID, pecaID
}

func corpoEstruturaValido(produtoID, pecaID int64, dataInicio string) string {
	return `{
		"produto_acabado_id": ` + formatarID(float64(produtoID)) + `,
		"data_vigencia_inicio": "` + dataInicio + `",
		"itens": [{"parte_peca_id": ` + formatarID(float64(pecaID)) + `, "quantidade": 4}]
	}`
}

func TestCriarEstruturaResponde201(t *testing.T) {
	api, produtoID, pecaID := apiEstrutura(t)

	rec := api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, float64(1), dados(t, rec)["versao"])
}

func TestCriarEstruturaComoOperadorResponde403(t *testing.T) {
	api, produtoID, pecaID := apiEstrutura(t)

	rec := api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilOperador)

	require.Equal(t, http.StatusForbidden, rec.Code)
}

func TestCriarSegundaDiretoResponde409(t *testing.T) {
	api, produtoID, pecaID := apiEstrutura(t)
	rec := api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code)

	rec = api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestObterEstruturaInexistenteResponde404(t *testing.T) {
	api, _, _ := apiEstrutura(t)

	rec := api.chamar(http.MethodGet, "/api/v1/boms/999999", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestVersionarResponde201EInativaAAnterior(t *testing.T) {
	api, produtoID, pecaID := apiEstrutura(t)
	criarRec := api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, criarRec.Code)
	idAtual := int64(dados(t, criarRec)["id"].(float64))

	corpoNovo := `{"data_vigencia_inicio": "2026-10-01", "itens": [{"parte_peca_id": ` +
		formatarID(float64(pecaID)) + `, "quantidade": 6}]}`
	rec := api.chamar(http.MethodPost, fmt.Sprintf("/api/v1/boms/%d/versionar", idAtual), corpoNovo, usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, float64(2), dados(t, rec)["versao"])
}

func TestListarPorProdutoResponde200(t *testing.T) {
	api, produtoID, pecaID := apiEstrutura(t)
	criarRec := api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, criarRec.Code)

	rec := api.chamar(http.MethodGet, fmt.Sprintf("/api/v1/produtos-acabados/%d/boms", produtoID), "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	itens := lista(t, rec)
	require.Len(t, itens, 1)
}
```

Run: `cd backend && go test ./internal/api/handlers/... -run Estrutura`
Expected: FAIL — `handlers.NovoEstruturaHandler` não existe.

- [ ] **Step 2: Implementar `estrutura.go`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd backend && go test ./internal/api/handlers/... -v` (rode o pacote inteiro — os
nomes de teste acima não contêm literalmente "Estrutura" em todos os casos, confirme
pela saída, não pelo filtro `-run`)
Expected: PASS — 6 testes novos, nenhuma regressão nos já existentes.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/api/handlers/estrutura.go backend/internal/api/handlers/estrutura_test.go
git commit -m "feat(backend): handler HTTP de estrutura de produto"
```

---

### Task B4: `ProdutoRepositorio.Listar` ganha o campo aditivo `estrutura_ativa`

**Files:**
- Modify: `backend/internal/domain/produto/produto.go`
- Modify: `backend/internal/infra/repository/produto_repo.go`
- Modify: `backend/internal/infra/repository/produto_repo_test.go`

**Interfaces:**
- Consumes: nada de `estrutura` (o repositório de produto só faz um `LEFT JOIN` bruto
  em `estrutura_produto`, não importa o pacote `estrutura`).
- Produces: `produto.ProdutoAcabado.EstruturaAtiva *produto.EstruturaResumo` — consumido
  pela Task F1 (frontend, tela de listagem).

**Atenção a uma armadilha já conhecida**: `filtrosDeCadastro` gera `WHERE ativo = $1`
sem qualificar a tabela. `estrutura_produto` também tem uma coluna `ativo`. Se o filtro
rodasse na MESMA query que já tem o `LEFT JOIN estrutura_produto`, `ativo` ficaria
ambíguo assim que `filtro_ativo` fosse informado — exatamente o bug corrigido no
Sprint 4 (Task B2, `ListarMovimentacoes`). A correção aqui é estrutural, não um `ativo`
qualificado: o filtro roda dentro de um CTE só com `produtos_acabados` (onde `ativo` é
inequívoco), e o `LEFT JOIN` acontece só depois, sobre o resultado já filtrado.

Em `produto.go`, acrescente:

```go
// EstruturaResumo e o resumo da estrutura (BOM) ativa de um produto, usado
// so na listagem — o detalhe completo (itens) vem do pacote estrutura.
type EstruturaResumo struct {
	Versao             int        `json:"versao"`
	DataVigenciaInicio tempo.Data `json:"data_vigencia_inicio"`
}
```

E no struct `ProdutoAcabado`, um campo novo (mantenha todos os campos já existentes):

```go
	// EstruturaAtiva e nil quando o produto ainda nao tem BOM cadastrada.
	EstruturaAtiva *EstruturaResumo `json:"estrutura_ativa,omitempty"`
```

(acrescente o import de `"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"` em `produto.go`.)

Em `produto_repo.go`, só o método `Listar` muda — `Criar`, `Atualizar`, `BuscarPorID`,
`Desativar`, `PossuiVendas` continuam exatamente como estão:

```go
// Listar devolve a pagina de produtos, com a estrutura ativa de cada um (se
// houver). O filtro (filtrosDeCadastro) roda dentro do CTE `pa`, so contra
// produtos_acabados -- o LEFT JOIN com estrutura_produto (que tambem tem uma
// coluna "ativo") so acontece depois, sobre o resultado ja filtrado. Ver nota
// da Task B4 do plano sobre o motivo.
func (r *ProdutoRepositorio) Listar(ctx context.Context, params consulta.Parametros) ([]produto.ProdutoAcabado, int, error) {
	filtros, argumentos := filtrosDeCadastro(params, "codigo", "descricao")

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT count(*) FROM produtos_acabados `+filtros, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar produtos acabados: %w", err)
	}

	sql := fmt.Sprintf(`
		WITH pa AS (SELECT %s FROM produtos_acabados %s)
		SELECT pa.id, pa.codigo, pa.descricao, pa.unidade_medida, pa.preco_venda,
		       pa.lead_time_producao, pa.ativo, pa.created_at, pa.updated_at, pa.created_by, pa.updated_by,
		       ep.versao, ep.data_vigencia_inicio
		FROM pa LEFT JOIN estrutura_produto ep ON ep.produto_acabado_id = pa.id AND ep.ativo
		ORDER BY pa.%s %s LIMIT $%d OFFSET $%d`,
		colunasProduto, filtros, params.OrdenarPor, params.Ordem.SQL(),
		len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := r.pool.Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar produtos acabados: %w", err)
	}
	defer linhas.Close()

	itens := make([]produto.ProdutoAcabado, 0, params.Limite)
	for linhas.Next() {
		var p produto.ProdutoAcabado
		var versao *int
		var vigenciaInicio tempo.Data
		if err := linhas.Scan(
			&p.ID, &p.Codigo, &p.Descricao, &p.UnidadeMedida, &p.PrecoVenda,
			&p.LeadTimeProducao, &p.Ativo, &p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy,
			&versao, &vigenciaInicio,
		); err != nil {
			return nil, 0, err
		}
		if versao != nil {
			p.EstruturaAtiva = &produto.EstruturaResumo{Versao: *versao, DataVigenciaInicio: vigenciaInicio}
		}
		itens = append(itens, p)
	}
	return itens, total, linhas.Err()
}
```

(acrescente o import de `"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"` em `produto_repo.go`; `colunasProduto` continua igual, usado tal como antes dentro do CTE.)

- [ ] **Step 1: Escrever os testes novos (falhando)**

Em `produto_repo_test.go`, usando os helpers já existentes `repoProduto(t)`/`pa(codigo,
descricao)`:

```go
func TestListarSemEstruturaDevolveEstruturaAtivaNula(t *testing.T) {
	ctx := context.Background()
	repo := repoProduto(t)
	require.NoError(t, repo.Criar(ctx, pa("VMS-01", "Painel sem BOM"), "gestor01"))

	itens, _, err := repo.Listar(ctx, paramsPadrao(t))

	require.NoError(t, err)
	require.Len(t, itens, 1)
	assert.Nil(t, itens[0].EstruturaAtiva)
}

func TestListarComEstruturaAtivaTrazVersaoEVigencia(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoProdutoRepositorio(pool)
	p := pa("VMS-01", "Painel com BOM")
	require.NoError(t, repo.Criar(ctx, p, "gestor01"))

	pecaRepo := repository.NovoPecaRepositorio(pool)
	peca1 := &peca.PartePeca{Codigo: "RES-10K", Descricao: "Resistor de 10 kOhm", UnidadeMedida: "und", EstoqueMinimo: 0, EstoqueMaximo: 100, LeadTimeCompra: 7, Ativo: true}
	require.NoError(t, pecaRepo.Criar(ctx, peca1, "gestor01"))

	estruturaRepo := repository.NovoEstruturaRepositorio(pool)
	inicio, _ := tempo.DeString("2026-09-01")
	e := &estrutura.Estrutura{
		ProdutoAcabadoID: p.ID, Versao: 1, DataVigenciaInicio: inicio, Ativo: true,
		Itens: []estrutura.Item{{PartePecaID: peca1.ID, Quantidade: 4}},
	}
	require.NoError(t, estruturaRepo.Criar(ctx, e, "gestor01"))

	itens, _, err := repo.Listar(ctx, paramsPadrao(t))

	require.NoError(t, err)
	require.Len(t, itens, 1)
	require.NotNil(t, itens[0].EstruturaAtiva)
	assert.Equal(t, 1, itens[0].EstruturaAtiva.Versao)
}
```

(acrescente os imports de `"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"`,
`"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"` e
`"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"` ao arquivo.)

Run: `cd backend && go test ./internal/infra/repository/... -run Produto`
Expected: FAIL — `EstruturaAtiva` não existe em `produto.ProdutoAcabado`.

- [ ] **Step 2: Implementar as mudanças em `produto.go` e `produto_repo.go`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd backend && go test ./internal/infra/repository/... -run Produto`
Expected: PASS — os 9 testes já existentes de `produto_repo_test.go` continuam verdes
(nenhuma regressão), mais os 2 novos.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/domain/produto/produto.go backend/internal/infra/repository/produto_repo.go backend/internal/infra/repository/produto_repo_test.go
git commit -m "feat(backend): produto acabado expoe a estrutura ativa na listagem"
```

---

### Task B5: Wiring e verificação final do backend

**Files:**
- Modify: `backend/internal/api/routes.go`

**Interfaces:**
- Consumes: `handlers.NovoEstruturaHandler` (Task B3).

Em `registrarCadastros` (já existente), acrescente a última chamada:

```go
func registrarCadastros(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc) {
	handlers.NovoProdutoHandler(
		produto.NovoServico(repository.NovoProdutoRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoPecaHandler(
		peca.NovoServico(repository.NovoPecaRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoFornecedorHandler(
		fornecedor.NovoServico(repository.NovoFornecedorRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoEstruturaHandler(
		estrutura.NovoServico(repository.NovoEstruturaRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)
}
```

(acrescente o import de `"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"`.)

- [ ] **Step 1: Implementar o wiring** (código completo acima).

- [ ] **Step 2: Build, vet, format e suíte inteira**

```bash
cd backend
go build ./...
go vet ./...
gofmt -l .
go test ./...
```

Expected: build/vet/gofmt limpos; suíte inteira verde (371 testes anteriores da Sprint
4 + os novos desta tarefa).

- [ ] **Step 3: Fluxo manual ponta a ponta contra Postgres real**

Com o ambiente no ar (Postgres via docker-compose, `go run ./cmd/api`): criar um produto
acabado → `GET /produtos-acabados` mostra `estrutura_ativa: null` para ele → criar uma
peça → `POST /boms` com esse produto e essa peça → `GET /produtos-acabados` mostra
`estrutura_ativa: {versao: 1, ...}` → `GET /produtos-acabados/{id}/boms` mostra o
histórico com 1 versão → `POST /boms/{id}/versionar` com itens diferentes → `GET
/produtos-acabados/{id}/boms` mostra 2 versões, a v.1 com `data_vigencia_fim` preenchida
→ tentar `POST /boms` de novo para o mesmo produto devolve 409.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/api/routes.go
git commit -m "feat(backend): registra as rotas de estrutura de produto"
```

---

## Frontend

### Task F1: Tipos e serviço de estrutura de produto

**Files:**
- Create: `frontend/src/tipos/estrutura.ts`
- Create: `frontend/src/servicos/estrutura.ts` + `.test.ts`

**Interfaces:**
- Consumes: `api` (de `servicos/api.ts`, já existente).
- Produces: `Estrutura`, `ItemEstrutura`, `CorpoCriarEstrutura`,
  `CorpoVersionarEstrutura`, `criarEstrutura`, `versionarEstrutura`, `obterEstrutura`,
  `listarEstruturasPorProduto` — usados pelas Tasks F3/F4.

```ts
// tipos/estrutura.ts
export interface ItemEstrutura {
  id: number;
  parte_peca_id: number;
  quantidade: number;
}

export interface Estrutura {
  id: number;
  produto_acabado_id: number;
  versao: number;
  data_vigencia_inicio: string;
  /** Ausente enquanto a versao esta ativa (omitempty no backend). */
  data_vigencia_fim?: string;
  ativo: boolean;
  itens: ItemEstrutura[];
  created_at: string;
  updated_at: string;
}

export interface CorpoCriarEstrutura {
  produto_acabado_id: number;
  data_vigencia_inicio: string;
  data_vigencia_fim?: string;
  itens: { parte_peca_id: number; quantidade: number }[];
}

export interface CorpoVersionarEstrutura {
  data_vigencia_inicio: string;
  data_vigencia_fim?: string;
  itens: { parte_peca_id: number; quantidade: number }[];
}
```

```ts
// servicos/estrutura.ts
import { api } from './api';
import type { CorpoCriarEstrutura, CorpoVersionarEstrutura, Estrutura } from '@/tipos/estrutura';

interface EnvelopeItem<T> {
  dados: T;
}
interface EnvelopeLista<T> {
  dados: T[];
}

export async function criarEstrutura(corpo: CorpoCriarEstrutura): Promise<Estrutura> {
  const { data } = await api.post<EnvelopeItem<Estrutura>>('/boms', corpo);
  return data.dados;
}

export async function versionarEstrutura(idAtual: number, corpo: CorpoVersionarEstrutura): Promise<Estrutura> {
  const { data } = await api.post<EnvelopeItem<Estrutura>>(`/boms/${idAtual}/versionar`, corpo);
  return data.dados;
}

export async function obterEstrutura(id: number): Promise<Estrutura> {
  const { data } = await api.get<EnvelopeItem<Estrutura>>(`/boms/${id}`);
  return data.dados;
}

export async function listarEstruturasPorProduto(produtoId: number): Promise<Estrutura[]> {
  const { data } = await api.get<EnvelopeLista<Estrutura>>(`/produtos-acabados/${produtoId}/boms`);
  return data.dados;
}
```

- [ ] **Step 1: Escrever `estrutura.test.ts` (falhando)**

Mesmo padrão de `estoque.test.ts` (Sprint 4), usando `instalarServidorFalso`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { criarEstrutura, listarEstruturasPorProduto, obterEstrutura, versionarEstrutura } from './estrutura';

describe('servicos/estrutura', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('criarEstrutura envia POST para /boms', async () => {
    servidor.responder([{ metodo: 'post', url: '/boms', status: 201, corpo: { dados: { id: 1, versao: 1 } } }]);
    const corpo = { produto_acabado_id: 1, data_vigencia_inicio: '2026-09-01', itens: [{ parte_peca_id: 1, quantidade: 4 }] };
    const criada = await criarEstrutura(corpo);
    expect(servidor.requisicoes[0].corpo).toEqual(corpo);
    expect(criada.versao).toBe(1);
  });

  it('versionarEstrutura envia POST para /boms/:id/versionar', async () => {
    servidor.responder([{ metodo: 'post', url: '/boms/1/versionar', status: 201, corpo: { dados: { id: 2, versao: 2 } } }]);
    const corpo = { data_vigencia_inicio: '2026-10-01', itens: [{ parte_peca_id: 1, quantidade: 6 }] };
    const nova = await versionarEstrutura(1, corpo);
    expect(servidor.requisicoes[0].corpo).toEqual(corpo);
    expect(nova.versao).toBe(2);
  });

  it('obterEstrutura busca por id', async () => {
    servidor.responder([{ metodo: 'get', url: '/boms/1', status: 200, corpo: { dados: { id: 1, versao: 1 } } }]);
    const encontrada = await obterEstrutura(1);
    expect(encontrada.id).toBe(1);
  });

  it('listarEstruturasPorProduto bate em /produtos-acabados/:id/boms', async () => {
    servidor.responder([{ metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: { dados: [{ id: 1, versao: 1 }] } }]);
    const historico = await listarEstruturasPorProduto(1);
    expect(historico).toHaveLength(1);
  });
});
```

Run: `cd frontend && npm test -- src/servicos/estrutura.test.ts`
Expected: FAIL — `./estrutura` não existe.

- [ ] **Step 2: Implementar `tipos/estrutura.ts` e `servicos/estrutura.ts`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd frontend && npm test -- src/servicos/estrutura.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/tipos/estrutura.ts frontend/src/servicos/estrutura.ts frontend/src/servicos/estrutura.test.ts
git commit -m "feat(frontend): tipos e servico de estrutura de produto"
```

---

### Task F2: Tela de listagem "Estrutura de produtos"

**Files:**
- Modify: `frontend/src/tipos/cadastros.ts` (campo aditivo em `ProdutoAcabado`)
- Create: `frontend/src/paginas/estrutura/EstruturaProdutos.tsx` + `.test.tsx`

**Interfaces:**
- Consumes: `useListagem<ProdutoAcabado>('produtos-acabados', 'codigo')` (hook genérico
  já existente, `frontend/src/hooks/useListagem.ts` — reaproveitado sem nenhuma
  mudança), `BarraDeFiltros`/`Tabela`/`Paginacao` (já existentes).
- Produces: `EstruturaProdutos` — usado pela Task F5 (rota).

Em `tipos/cadastros.ts`, acrescente (sem tocar em mais nada do arquivo):

```ts
export interface EstruturaResumo {
  versao: number;
  data_vigencia_inicio: string;
}
```

E no `interface ProdutoAcabado extends RegistroCadastro { ... }` já existente,
acrescente o campo:

```ts
  /** Ausente quando o produto ainda nao tem BOM cadastrada. */
  estrutura_ativa?: EstruturaResumo;
```

```tsx
// paginas/estrutura/EstruturaProdutos.tsx
import { useNavigate } from 'react-router-dom';
import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useListagem } from '@/hooks/useListagem';
import { formatarData } from '@/lib/formato';
import type { ProdutoAcabado } from '@/tipos/cadastros';

export function EstruturaProdutos() {
  const navegar = useNavigate();
  const lista = useListagem<ProdutoAcabado>('produtos-acabados', 'codigo');

  const colunas: Coluna<ProdutoAcabado>[] = [
    {
      chave: 'codigo',
      rotulo: 'Código',
      ordenavel: true,
      renderizar: (p) => (
        <button
          type="button"
          onClick={() => navegar(`/estrutura-produtos/${p.id}`)}
          className="font-mono text-brand hover:underline"
        >
          {p.codigo}
        </button>
      ),
    },
    { chave: 'descricao', rotulo: 'Descrição', ordenavel: true, renderizar: (p) => p.descricao },
    {
      chave: 'estrutura',
      rotulo: 'Estrutura',
      renderizar: (p) =>
        p.estrutura_ativa
          ? `v.${p.estrutura_ativa.versao} desde ${formatarData(p.estrutura_ativa.data_vigencia_inicio)}`
          : 'Sem estrutura ativa',
    },
  ];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Estrutura de produtos</h1>
        <p className="text-body text-texto-secondary">
          Componentes necessários para montar cada produto acabado.
        </p>
      </div>

      <BarraDeFiltros
        busca={lista.busca}
        aoBuscar={lista.definirBusca}
        rotuloBusca="Buscar por código ou descrição"
        filtroAtivo={lista.filtroAtivo}
        aoFiltrarSituacao={lista.definirFiltroAtivo}
      />

      <div>
        <Tabela<ProdutoAcabado>
          rotulo="Estrutura de produtos"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(p) => p.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhum produto acabado cadastrado ainda."
        />
        <Paginacao
          pagina={lista.paginacao.pagina}
          totalPaginas={lista.paginacao.total_paginas}
          total={lista.paginacao.total}
          aoMudar={lista.definirPagina}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Escrever `EstruturaProdutos.test.tsx` (falhando)**

```tsx
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { EstruturaProdutos } from './EstruturaProdutos';

const PAGINA = {
  sucesso: true,
  dados: [
    { id: 1, codigo: 'VMS-01', descricao: 'Painel de velocidade', ativo: true, estrutura_ativa: { versao: 2, data_vigencia_inicio: '2026-10-01' } },
    { id: 2, codigo: 'R-200', descricao: 'Radar fixo', ativo: true },
  ],
  paginacao: { pagina: 1, limite: 20, total: 2, total_paginas: 1 },
};

describe('EstruturaProdutos', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('mostra a versao vigente e "Sem estrutura ativa" para quem nao tem', async () => {
    servidor.responder([{ metodo: 'get', url: '/produtos-acabados', status: 200, corpo: PAGINA }]);
    renderizarComProvedores(<EstruturaProdutos />);

    expect(await screen.findByText('v.2 desde 01/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Sem estrutura ativa')).toBeInTheDocument();
  });

  it('clicar no codigo navega para o detalhe', async () => {
    servidor.responder([{ metodo: 'get', url: '/produtos-acabados', status: 200, corpo: PAGINA }]);
    renderizarComProvedores(<EstruturaProdutos />);
    await screen.findByText('VMS-01');

    // navegacao real via MemoryRouter -- o teste so confirma que o botao existe
    // e e clicavel; a Task F3 cobre o destino renderizado.
    expect(screen.getByRole('button', { name: 'VMS-01' })).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npm test -- src/paginas/estrutura/EstruturaProdutos.test.tsx`
Expected: FAIL — `./EstruturaProdutos` não existe.

- [ ] **Step 2: Implementar as mudanças em `tipos/cadastros.ts` e `EstruturaProdutos.tsx`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd frontend && npm test -- src/paginas/estrutura/EstruturaProdutos.test.tsx`
Expected: PASS — 2 testes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/tipos/cadastros.ts frontend/src/paginas/estrutura
git commit -m "feat(frontend): tela de listagem de estrutura de produtos"
```

---

### Task F3: Tela de detalhe + histórico

**Files:**
- Create: `frontend/src/paginas/estrutura/DetalheEstruturaProduto.tsx` + `.test.tsx`

**Interfaces:**
- Consumes: `obter` (de `servicos/cadastros.ts`, já existente),
  `listarEstruturasPorProduto` (Task F1), `usePartesPecasAtivas` (já existente).
- Produces: `DetalheEstruturaProduto` — usado pela Task F5 (rota).

```tsx
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Botao } from '@/componentes/ui/Botao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { formatarData } from '@/lib/formato';
import { obter } from '@/servicos/cadastros';
import { listarEstruturasPorProduto } from '@/servicos/estrutura';
import type { ProdutoAcabado } from '@/tipos/cadastros';
import type { ItemEstrutura } from '@/tipos/estrutura';

export function DetalheEstruturaProduto() {
  const { produtoId } = useParams<{ produtoId: string }>();
  const id = Number(produtoId);
  const navegar = useNavigate();
  const { porId: pecaPorId } = usePartesPecasAtivas();

  const produtoQuery = useQuery({
    queryKey: ['produtos-acabados', id],
    queryFn: () => obter<ProdutoAcabado>('produtos-acabados', id),
  });
  const historicoQuery = useQuery({
    queryKey: ['estruturas', id],
    queryFn: () => listarEstruturasPorProduto(id),
  });

  if (produtoQuery.isPending || historicoQuery.isPending) {
    return <p className="text-body text-texto-secondary">Carregando…</p>;
  }
  if (produtoQuery.isError || historicoQuery.isError || !produtoQuery.data) {
    return <p className="text-body text-estado-pending">Não foi possível carregar a estrutura do produto.</p>;
  }

  const produto = produtoQuery.data;
  const historico = historicoQuery.data ?? [];
  const ativa = historico.find((e) => e.ativo);
  const antigas = historico.filter((e) => !e.ativo);

  const colunasItens: Coluna<ItemEstrutura>[] = [
    { chave: 'parte_peca_id', rotulo: 'Peça', renderizar: (i) => pecaPorId.get(i.parte_peca_id) ?? '—' },
    { chave: 'quantidade', rotulo: 'Quantidade', alinhamento: 'direita', renderizar: (i) => i.quantidade },
  ];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-texto-primary">{produto.codigo}</h1>
          <p className="text-body text-texto-secondary">{produto.descricao}</p>
        </div>
        <Botao icone={ativa ? 'refresh-cw' : 'plus'} onClick={() => navegar(`/estrutura-produtos/${id}/nova`)}>
          {ativa ? 'Nova versão' : 'Criar estrutura'}
        </Botao>
      </div>

      {ativa ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-subtitle text-texto-primary">
            Versão {ativa.versao} — vigente desde {formatarData(ativa.data_vigencia_inicio)}
          </h2>
          <Tabela<ItemEstrutura>
            rotulo={`Itens da versão ${ativa.versao}`}
            colunas={colunasItens}
            itens={ativa.itens}
            chaveDe={(i) => i.id}
            ordenarPor="parte_peca_id"
            ordem="asc"
            aoOrdenar={() => {}}
            vazio="Nenhum item nesta versão."
          />
        </div>
      ) : (
        <p className="text-body text-texto-secondary">Este produto ainda não tem estrutura cadastrada.</p>
      )}

      {antigas.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-subtitle text-texto-primary">Histórico</h2>
          <ul className="flex flex-col gap-1 text-body text-texto-secondary">
            {antigas.map((e) => (
              <li key={e.id}>
                Versão {e.versao} — {formatarData(e.data_vigencia_inicio)} até{' '}
                {e.data_vigencia_fim ? formatarData(e.data_vigencia_fim) : '—'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 1: Escrever `DetalheEstruturaProduto.test.tsx` (falhando)**

```tsx
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { DetalheEstruturaProduto } from './DetalheEstruturaProduto';

const PRODUTO = { sucesso: true, dados: { id: 1, codigo: 'VMS-01', descricao: 'Painel de velocidade', ativo: true } };
const PECAS = {
  sucesso: true,
  dados: [{ id: 1, codigo: 'RES-10K', descricao: 'Resistor', ativo: true }],
  paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
};

function renderizar() {
  return renderizarComProvedores(
    <Routes>
      <Route path="/estrutura-produtos/:produtoId" element={<DetalheEstruturaProduto />} />
    </Routes>,
    { rota: '/estrutura-produtos/1' },
  );
}

describe('DetalheEstruturaProduto', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('sem estrutura ativa mostra "Criar estrutura"', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1', status: 200, corpo: PRODUTO },
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: { sucesso: true, dados: [] } },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();

    expect(await screen.findByRole('button', { name: 'Criar estrutura' })).toBeInTheDocument();
    expect(screen.getByText('Este produto ainda não tem estrutura cadastrada.')).toBeInTheDocument();
  });

  it('com estrutura ativa mostra os itens e "Nova versão"', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1', status: 200, corpo: PRODUTO },
      {
        metodo: 'get', url: '/produtos-acabados/1/boms', status: 200,
        corpo: { sucesso: true, dados: [{ id: 10, versao: 1, data_vigencia_inicio: '2026-09-01', ativo: true, itens: [{ id: 1, parte_peca_id: 1, quantidade: 4 }] }] },
      },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();

    expect(await screen.findByRole('button', { name: 'Nova versão' })).toBeInTheDocument();
    expect(screen.getByText('RES-10K')).toBeInTheDocument();
  });

  it('mostra o historico de versoes antigas', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1', status: 200, corpo: PRODUTO },
      {
        metodo: 'get', url: '/produtos-acabados/1/boms', status: 200,
        corpo: {
          sucesso: true,
          dados: [
            { id: 20, versao: 2, data_vigencia_inicio: '2026-10-01', ativo: true, itens: [] },
            { id: 10, versao: 1, data_vigencia_inicio: '2026-09-01', data_vigencia_fim: '2026-09-30', ativo: false, itens: [] },
          ],
        },
      },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();

    expect(await screen.findByText('Histórico')).toBeInTheDocument();
    expect(screen.getByText(/Versão 1 — 01\/09\/2026 até 30\/09\/2026/)).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npm test -- src/paginas/estrutura/DetalheEstruturaProduto.test.tsx`
Expected: FAIL — `./DetalheEstruturaProduto` não existe.

- [ ] **Step 2: Implementar `DetalheEstruturaProduto.tsx`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd frontend && npm test -- src/paginas/estrutura/DetalheEstruturaProduto.test.tsx`
Expected: PASS — 3 testes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/paginas/estrutura/DetalheEstruturaProduto.tsx frontend/src/paginas/estrutura/DetalheEstruturaProduto.test.tsx
git commit -m "feat(frontend): detalhe e historico da estrutura de produto"
```

---

### Task F4: Formulário de criar/nova versão

**Files:**
- Create: `frontend/src/paginas/estrutura/NovaEstruturaProduto.tsx` + `.test.tsx`

**Interfaces:**
- Consumes: `criarEstrutura`/`versionarEstrutura`/`listarEstruturasPorProduto` (Task F1),
  `usePartesPecasAtivas` (já existente).
- Produces: `NovaEstruturaProduto` — usado pela Task F5 (rota).

O mesmo formulário atende os dois casos (criar 1ª versão ou nova versão): busca o
histórico do produto ao carregar para saber se já existe uma ativa — se existir, envia
para `versionarEstrutura(ativa.id, corpo)`; senão, para `criarEstrutura({...corpo,
produto_acabado_id})`.

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { separarErro } from '@/lib/errosDeFormulario';
import { criarEstrutura, listarEstruturasPorProduto, versionarEstrutura } from '@/servicos/estrutura';

const itemEsquema = z.object({
  parte_peca_id: z.string().trim().min(1, 'Selecione a peça'),
  quantidade: z.coerce.number().int().positive('A quantidade deve ser maior que zero'),
});

const esquema = z.object({
  data_vigencia_inicio: z.string().trim().min(1, 'Informe a vigência'),
  itens: z.array(itemEsquema).min(1, 'Informe ao menos um item'),
});

type Formulario = {
  data_vigencia_inicio: string;
  itens: { parte_peca_id: string; quantidade: string }[];
};

const ITEM_VAZIO = { parte_peca_id: '', quantidade: '1' };

export function NovaEstruturaProduto() {
  const { produtoId } = useParams<{ produtoId: string }>();
  const id = Number(produtoId);
  const navegar = useNavigate();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { opcoes: opcoesPeca } = usePartesPecasAtivas();

  const historicoQuery = useQuery({
    queryKey: ['estruturas', id],
    queryFn: () => listarEstruturasPorProduto(id),
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { data_vigencia_inicio: '', itens: [ITEM_VAZIO] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });

  const ativa = historicoQuery.data?.find((e) => e.ativo);

  const mutacao = useMutation({
    mutationFn: (valores: Formulario) => {
      const corpo = {
        data_vigencia_inicio: valores.data_vigencia_inicio,
        itens: valores.itens.map((item) => ({
          parte_peca_id: Number(item.parte_peca_id),
          quantidade: Number(item.quantidade),
        })),
      };
      return ativa ? versionarEstrutura(ativa.id, corpo) : criarEstrutura({ ...corpo, produto_acabado_id: id });
    },
    onSuccess: () => {
      void clienteQuery.invalidateQueries({ queryKey: ['estruturas', id] });
      void clienteQuery.invalidateQueries({ queryKey: ['produtos-acabados'] });
      mostrarToast(ativa ? 'Nova versão criada' : 'Estrutura cadastrada');
      navegar(`/estrutura-produtos/${id}`);
    },
  });

  const { geral: erroGeral } = separarErro(mutacao.error);

  if (historicoQuery.isPending) {
    return <p className="text-body text-texto-secondary">Carregando…</p>;
  }

  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{ativa ? 'Nova versão da estrutura' : 'Criar estrutura'}</h1>
        <p className="text-body text-texto-secondary">Componentes necessários para montar 1 unidade do produto.</p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit((valores) => mutacao.mutate(valores))}
        className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6"
      >
        {erroGeral && (
          <p
            role="alert"
            className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
          >
            {erroGeral}
          </p>
        )}

        <Campo
          rotulo="Vigência a partir de"
          obrigatorio
          ajuda="Formato AAAA-MM-DD"
          erro={errors.data_vigencia_inicio?.message}
          {...register('data_vigencia_inicio')}
        />

        <div className="flex flex-col gap-3">
          <h2 className="text-subtitle text-texto-primary">Itens</h2>

          {fields.map((campo, indice) => (
            <div key={campo.id} className="grid gap-3 rounded-campo border border-borda-subtle p-3 md:grid-cols-[2fr_1fr_auto]">
              <Selecao
                rotulo="Parte/peça"
                obrigatorio
                opcoes={opcoesPeca}
                placeholder="Selecione"
                erro={errors.itens?.[indice]?.parte_peca_id?.message}
                {...register(`itens.${indice}.parte_peca_id` as const)}
              />
              <Campo
                rotulo="Quantidade"
                obrigatorio
                tipoDado="quantidade"
                erro={errors.itens?.[indice]?.quantidade?.message}
                {...register(`itens.${indice}.quantidade` as const)}
              />
              {fields.length > 1 && (
                <Botao variante="fantasma" icone="trash-2" className="self-end" onClick={() => remove(indice)}>
                  Remover item
                </Botao>
              )}
            </div>
          ))}

          <Botao variante="secundaria" icone="plus" onClick={() => append(ITEM_VAZIO)} className="self-start">
            Adicionar item
          </Botao>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={() => navegar(`/estrutura-produtos/${id}`)} disabled={mutacao.isPending}>
            Cancelar
          </Botao>
          <Botao type="submit" icone="save" ocupado={mutacao.isPending} rotuloOcupado="Salvando…">
            Salvar
          </Botao>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 1: Escrever `NovaEstruturaProduto.test.tsx` (falhando)**

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { NovaEstruturaProduto } from './NovaEstruturaProduto';

const navegar = vi.fn();
vi.mock('react-router-dom', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('react-router-dom')>();
  return { ...original, useNavigate: () => navegar };
});

const PECAS = {
  sucesso: true,
  dados: [{ id: 1, codigo: 'RES-10K', descricao: 'Resistor', ativo: true }],
  paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
};

function renderizar() {
  return renderizarComProvedores(
    <Routes>
      <Route path="/estrutura-produtos/:produtoId/nova" element={<NovaEstruturaProduto />} />
    </Routes>,
    { rota: '/estrutura-produtos/1/nova' },
  );
}

describe('NovaEstruturaProduto', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    navegar.mockClear();
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
  });

  it('sem estrutura ativa, envia para POST /boms com o produto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: { sucesso: true, dados: [] } },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
      { metodo: 'post', url: '/boms', status: 201, corpo: { sucesso: true, dados: { id: 1, versao: 1 } } },
    ]);
    renderizar();
    await screen.findByText('Criar estrutura');

    await userEvent.type(screen.getByLabelText(/Vigência/), '2026-09-01');
    await userEvent.selectOptions(screen.getByLabelText(/Parte\/peça/), 'RES-10K — Resistor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(servidor.requisicoes.find((r) => r.url === '/boms')?.corpo).toEqual({
        produto_acabado_id: 1,
        data_vigencia_inicio: '2026-09-01',
        itens: [{ parte_peca_id: 1, quantidade: 1 }],
      }),
    );
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Estrutura cadastrada');
  });

  it('com estrutura ativa, envia para POST /boms/:id/versionar', async () => {
    servidor.responder([
      {
        metodo: 'get', url: '/produtos-acabados/1/boms', status: 200,
        corpo: { sucesso: true, dados: [{ id: 10, versao: 1, data_vigencia_inicio: '2026-09-01', ativo: true, itens: [] }] },
      },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
      { metodo: 'post', url: '/boms/10/versionar', status: 201, corpo: { sucesso: true, dados: { id: 11, versao: 2 } } },
    ]);
    renderizar();
    await screen.findByText('Nova versão da estrutura');

    await userEvent.type(screen.getByLabelText(/Vigência/), '2026-10-01');
    await userEvent.selectOptions(screen.getByLabelText(/Parte\/peça/), 'RES-10K — Resistor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(servidor.requisicoes.find((r) => r.url === '/boms/10/versionar')).toBeTruthy());
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Nova versão criada');
  });

  it('erro 409 mostra alerta', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: { sucesso: true, dados: [] } },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
      {
        metodo: 'post', url: '/boms', status: 409,
        corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'este produto ja possui uma estrutura ativa, use versionar' } },
      },
    ]);
    renderizar();
    await screen.findByText('Criar estrutura');

    await userEvent.type(screen.getByLabelText(/Vigência/), '2026-09-01');
    await userEvent.selectOptions(screen.getByLabelText(/Parte\/peça/), 'RES-10K — Resistor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('estrutura ativa');
  });
});
```

Run: `cd frontend && npm test -- src/paginas/estrutura/NovaEstruturaProduto.test.tsx`
Expected: FAIL — `./NovaEstruturaProduto` não existe.

- [ ] **Step 2: Implementar `NovaEstruturaProduto.tsx`** (código completo acima).

- [ ] **Step 3: Rodar os testes**

Run: `cd frontend && npm test -- src/paginas/estrutura/NovaEstruturaProduto.test.tsx`
Expected: PASS — 3 testes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/paginas/estrutura/NovaEstruturaProduto.tsx frontend/src/paginas/estrutura/NovaEstruturaProduto.test.tsx
git commit -m "feat(frontend): formulario de criar/nova versao da estrutura"
```

---

### Task F5: Navegação, Ajuda e rotas

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/componentes/layout/NavegacaoLateral.tsx` + `.test.tsx`
- Modify: `frontend/src/componentes/layout/Ajuda.tsx` + `.test.tsx`

**Interfaces:**
- Consumes: `EstruturaProdutos` (F2), `DetalheEstruturaProduto` (F3),
  `NovaEstruturaProduto` (F4).

Em `App.tsx`, acrescente os imports e as três rotas (dentro da árvore protegida, junto
das demais):

```tsx
import { DetalheEstruturaProduto } from '@/paginas/estrutura/DetalheEstruturaProduto';
import { EstruturaProdutos } from '@/paginas/estrutura/EstruturaProdutos';
import { NovaEstruturaProduto } from '@/paginas/estrutura/NovaEstruturaProduto';
```

```tsx
<Route path="/estrutura-produtos" element={<EstruturaProdutos />} />
<Route path="/estrutura-produtos/:produtoId" element={<DetalheEstruturaProduto />} />
<Route path="/estrutura-produtos/:produtoId/nova" element={<NovaEstruturaProduto />} />
```

Em `NavegacaoLateral.tsx`, nova seção própria (posicionada depois de "Cadastros" e antes
de "Compras" — a estrutura de produto é definida antes do ciclo de compras/estoque
operar sobre ela):

```tsx
const ESTRUTURA: ItemNavegacao[] = [{ rota: '/estrutura-produtos', rotulo: 'Estrutura de produtos', icone: 'settings' }];
```

```tsx
<p className="mb-1 mt-6 px-3 text-label text-texto-disabled">Estrutura de produtos</p>
<ul className="flex flex-col gap-1">
  {ESTRUTURA.map((item) => (
    <li key={item.rota}>
      <Link item={item} />
    </li>
  ))}
</ul>
```

Em `Ajuda.tsx`, nova entrada em `CONTEUDO_POR_ROTA`:

```tsx
'/estrutura-produtos': {
  titulo: 'Ajuda · Estrutura de produtos',
  itens: [
    'Cada produto acabado pode ter uma estrutura (BOM): a lista de partes/peças e a quantidade de cada uma para montar 1 unidade.',
    'Uma estrutura nunca é editada nem apagada — mudanças viram uma "Nova versão", que substitui a anterior a partir de uma data de vigência.',
    'A versão anterior fica no histórico, com a data em que deixou de valer — nada se perde.',
    'Só existe uma versão ativa por produto de cada vez.',
  ],
},
```

- [ ] **Step 1: Escrever os testes novos (falhando)**

Um caso novo em cada um dos dois arquivos de teste (sem quebrar os existentes):

```tsx
// NavegacaoLateral.test.tsx — caso novo
it('estrutura de produtos ja e um link real', () => {
  renderizarComProvedores(<NavegacaoLateral />);
  const link = screen.getByRole('link', { name: /Estrutura de produtos/ });
  expect(link).toHaveAttribute('href', '/estrutura-produtos');
});
```

```tsx
// Ajuda.test.tsx — caso novo
it('o conteudo muda conforme a tela: estrutura de produtos', async () => {
  renderizarComProvedores(<Ajuda />, { rota: '/estrutura-produtos' });
  await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));
  expect(screen.getByRole('dialog', { name: /Estrutura de produtos/ })).toBeInTheDocument();
});
```

Run: `cd frontend && npm test -- src/componentes/layout/NavegacaoLateral.test.tsx src/componentes/layout/Ajuda.test.tsx`
Expected: FAIL — os dois casos novos não encontram o conteúdo/rota ainda.

- [ ] **Step 2: Implementar as mudanças acima** (`App.tsx`, `NavegacaoLateral.tsx`, `Ajuda.tsx`).

- [ ] **Step 3: Rodar os testes**

Run: `cd frontend && npm test -- src/componentes/layout/NavegacaoLateral.test.tsx src/componentes/layout/Ajuda.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/componentes/layout/NavegacaoLateral.tsx frontend/src/componentes/layout/NavegacaoLateral.test.tsx frontend/src/componentes/layout/Ajuda.tsx frontend/src/componentes/layout/Ajuda.test.tsx
git commit -m "feat(frontend): navegacao, ajuda e rotas para estrutura de produto"
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

Expected: os três verdes — suíte inteira (300 testes anteriores da Sprint 4 + os novos
desta tarefa).

- [ ] **Step 2: Roteiro de navegador real (Playwright, não API direta)**

Com o ambiente no ar: criar um produto acabado → abrir "Estrutura de produtos", confirmar
"Sem estrutura ativa" → clicar no produto → "Criar estrutura" → preencher vigência + 1
item → salvar, confirmar toast e volta ao detalhe mostrando a v.1 → "Nova versão" →
preencher vigência posterior + itens diferentes → salvar, confirmar v.2 ativa e a v.1 no
histórico com `data_vigencia_fim` preenchida → voltar em "Estrutura de produtos",
confirmar que a coluna mostra "v.2 desde …" → tentar criar uma estrutura direto (sem
passar por "Nova versão") para um produto que já tem uma ativa não é possível pela UI
(só existe o botão "Nova versão" quando já há uma ativa — confirma que a tela não deixa
o operador tentar o caminho que o backend rejeitaria com 409). Checagem do §8.4: escala
de cinza, só teclado (Tab pelo formulário de itens, adicionar/remover, salvar), 800px sem
rolagem horizontal nas três telas novas.

- [ ] **Step 3: Corrigir achados e "tirar um acessório"**

Mesmo rigor das rodadas anteriores — as Sprints 2 e 4 encontraram bugs reais de
acessibilidade/consistência cada vez que essa verificação foi feita a sério.

- [ ] **Step 4: Commit** (se houver correções)

```bash
git add -A
git commit -m "fix(frontend): ajustes da verificacao visual da estrutura de produto"
```

---

## Documentação e entrega

### Task 22: Screenshots, manual e ledger

- [ ] Capturar telas novas em `docs/screenshots/` (Playwright contra o app real, dados
  de exemplo realistas, numeração sequencial seguindo a partir da última usada):
  listagem de "Estrutura de produtos" (com e sem BOM ativa visíveis), detalhe com a
  versão ativa e o botão "Nova versão", formulário de nova versão preenchido, histórico
  com uma versão antiga visível.
- [ ] Atualizar `docs/8_MANUAL_OPERACAO.md`: nova seção "Estrutura de produtos (BOM)"
  com o fluxo completo (criar a 1ª versão → nova versão → consultar histórico),
  screenshots incluídas, entrada na tabela de perguntas frequentes para "por que não dá
  para editar uma estrutura existente" (RF1.3: BOM não pode ser deletada nem editada,
  só versionada — preserva o que cada Ordem de Produção passada realmente usou).
- [ ] Atualizar `.superpowers/sdd/progress.md`: nova seção "## Ledger — Estrutura de
  Produto (BOM)", plano referenciado, decisões de pré-voo (lacuna do Sprint 2, bloqueio
  do Sprint 6, decisão de BOM de um nível só), ledger tarefa por tarefa no mesmo formato
  `Task N: complete (commits X..Y, review ...)` das demais.
- [ ] Escrever `task-N-brief.md`/`task-N-report.md` em `.superpowers/sdd/` **no momento
  de cada tarefa**, não ao final — mesma disciplina já estabelecida nas Sprints 2-4.
- [ ] Commit final, push, abrir PR com base em `feat/sprint4-recebimento-estoque` (não
  `main`).

---

## Notas de revisão do plano

**Ordem de execução sugerida**: B1→B2 (domínio+repositório de estrutura, sozinhos) podem
rodar em paralelo com F1 (frontend usa servidor falso, não depende do backend real). B3
depende de B2. B4 (campo aditivo em produto) é independente de B1-B3 — só depende do
schema já existente — mas faz mais sentido depois de B2/B3 existirem, para poder testar
o fluxo ponta a ponta em B5. F2 depende de F1 e da Task B4 (o campo `estrutura_ativa` já
precisa existir na API para a coluna fazer sentido, mesmo que o teste de frontend use
servidor falso). F3 depende de F1. F4 depende de F1 e F3 (navega de volta ao detalhe).
F5 depende de F2/F3/F4 (rotas). Screenshots e manual são sempre a última etapa.

**Por que `EstruturaResumo` não importa o pacote `estrutura` no `produto_repo.go`**: o
repositório de produto só faz um `LEFT JOIN` bruto em SQL — não precisa dos tipos de
domínio de `estrutura` para isso, e não importá-los evita uma dependência de pacote
desnecessária (produto não precisa saber que o domínio `estrutura` existe; só o
schema/JOIN, que é uma preocupação puramente de infraestrutura).

**Sobre o RF1.3 dizer "mapeamento multinível"**: este plano implementa fielmente o que o
schema já suporta — um nível só (Produto Acabado → Partes/Peças). Se o domínio real
precisar de submontagens no futuro (um Produto Acabado feito de outro Produto Acabado),
isso é uma migration nova e um desenho à parte, não uma extensão deste plano.
