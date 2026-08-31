# Parâmetros Regionais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar configuráveis (pelo Administrador, para o sistema inteiro) o Formato de
Data e o Formato de Hora usados em toda tela do frontend, fechando a sub-entrega 2 da
Fase 4 (§4.6.4 do doc 0).

**Architecture:** Configuração singleton no Postgres (mesmo padrão de `configuracao_empresa`),
lida por qualquer usuário autenticado e editada só por Administrador. No frontend, uma
store Zustand (`useConfiguracaoRegional`) guarda o valor atual e é lida de forma
não-reativa (`.getState()`) pelas funções de formatação já centralizadas
(`lib/formato.ts`), evitando reescrever os 12 arquivos que já as chamam.

**Tech Stack:** Go 1.25 + Echo v4 + pgx/v5 (backend); React 18 + TypeScript + TanStack
Query + Zustand (frontend). Mesma stack do resto do sistema, sem dependência nova.

## Global Constraints

- Referência: `docs/superpowers/specs/2026-08-31-parametros-regionais-design.md` (spec
  aprovada) e `docs/0_SUMARIO_EXECUTIVO.md` §4.6.4.
- Fora de escopo (não implementar): Fuso Horário, Moeda, Casas decimais, Separador
  decimal/milhar, Primeiro dia da semana, Unidades de Medida — ver spec §2 para o
  motivo de cada um.
- `GET /configuracoes/regional` exige autenticação (qualquer perfil); `PUT` restrito a
  `usuario.PerfilAdmin`.
- Configuração é do sistema (singleton), não por usuário.
- `formatarData`/`formatarDataHora` continuam funções simples (não hooks), lidas via
  `.getState()` — mesmo padrão de `tokenAtual()` em `store/autenticacao.ts`.
- Toda suíte (backend `go build/vet/test`, frontend `npm run lint`/`tsc -b`/`npm run
  build`/`npm test`) roda via Docker, nunca toolchain local — ver
  `docs/superpowers/plans/2026-08-31-auditoria.md` para os comandos exatos já usados
  nesta mesma branch de trabalho, ou o `README`/`.superpowers/sdd/progress.md` para o
  padrão geral do projeto.
- Commits pequenos e frequentes, um por task, seguindo o estilo dos commits já
  existentes no repositório.

---

## Backend

### Task B1: Migration e domínio `regional`

**Files:**
- Create: `backend/internal/infra/db/migrations/011_criar_configuracao_regional.sql`
- Create: `backend/internal/domain/regional/regional.go`
- Test: `backend/internal/domain/regional/regional_test.go`

**Interfaces:**
- Produces: `regional.FormatoData` (`"DD/MM/AAAA"`, `"DD-MM-AAAA"`, `"AAAA-MM-DD"`),
  `regional.FormatoHora` (`"24H"`, `"12H"`), `regional.Regional{FormatoData,
  FormatoHora, UpdatedAt time.Time, UpdatedBy *string}`, `regional.Dados{FormatoData,
  FormatoHora}`, `regional.Dados.Validar() error`, `regional.ErrFormatoDataInvalido`,
  `regional.ErrFormatoHoraInvalido` — usados por Task B2.

- [ ] **Passo 1: migration**

```sql
-- 011_criar_configuracao_regional.sql
-- Parametros regionais e de formatacao (Fase 4, doc 0 secao 4.6.4). Singleton,
-- mesmo padrao de configuracao_empresa (010): PK fixa + CHECK garantem uma
-- unica linha. Diferente de empresa, a linha ja nasce com os defaults
-- funcionais (DD/MM/AAAA, 24H) -- nao ha "primeira configuracao pelo admin"
-- aqui, o sistema ja funciona sem nenhuma acao.
CREATE TABLE configuracao_regional (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  formato_data VARCHAR(10) NOT NULL DEFAULT 'DD/MM/AAAA'
    CHECK (formato_data IN ('DD/MM/AAAA', 'DD-MM-AAAA', 'AAAA-MM-DD')),
  formato_hora VARCHAR(3) NOT NULL DEFAULT '24H'
    CHECK (formato_hora IN ('24H', '12H')),

  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50)
);

INSERT INTO configuracao_regional (id) VALUES (1);
```

- [ ] **Passo 2: domínio**

```go
// Package regional contem os parametros regionais e de formatacao (doc 0,
// secao 4.6.4). E um singleton: uma unica linha no banco, nunca uma lista --
// Buscar/Atualizar em vez de Listar/Criar/Excluir. Mesmo molde de
// internal/domain/empresa.
package regional

import (
	"errors"
	"slices"
	"time"
)

// FormatoData e o conjunto fechado de formatos de exibicao de data.
type FormatoData string

const (
	FormatoDataBR    FormatoData = "DD/MM/AAAA"
	FormatoDataTraco FormatoData = "DD-MM-AAAA"
	FormatoDataISO   FormatoData = "AAAA-MM-DD"
)

var formatosDataValidos = []FormatoData{FormatoDataBR, FormatoDataTraco, FormatoDataISO}

// FormatoHora e o conjunto fechado de formatos de exibicao de hora.
type FormatoHora string

const (
	FormatoHora24 FormatoHora = "24H"
	FormatoHora12 FormatoHora = "12H"
)

var formatosHoraValidos = []FormatoHora{FormatoHora24, FormatoHora12}

var (
	ErrFormatoDataInvalido = errors.New("formato de data invalido")
	ErrFormatoHoraInvalido = errors.New("formato de hora invalido")
)

// Regional e a configuracao singleton lida por GET /configuracoes/regional.
type Regional struct {
	FormatoData FormatoData `json:"formato_data"`
	FormatoHora FormatoHora `json:"formato_hora"`
	UpdatedAt   time.Time   `json:"updated_at"`
	UpdatedBy   *string     `json:"updated_by,omitempty"`
}

// Dados sao os campos informados no PUT -- sempre a configuracao inteira
// sendo salva de novo, mesmo padrao de empresa.Dados.
type Dados struct {
	FormatoData FormatoData
	FormatoHora FormatoHora
}

// Validar confere o conjunto fechado de cada campo -- um valor fora da lista
// quebraria o CHECK constraint da migration 011 com um 500 generico em vez
// de um 400 explicando o motivo (mesmo padrao de usuario.Preferencias.Validar).
func (d Dados) Validar() error {
	if !slices.Contains(formatosDataValidos, d.FormatoData) {
		return ErrFormatoDataInvalido
	}
	if !slices.Contains(formatosHoraValidos, d.FormatoHora) {
		return ErrFormatoHoraInvalido
	}
	return nil
}
```

- [ ] **Passo 3: teste do domínio**

```go
package regional_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/stretchr/testify/assert"
)

func TestValidarAceitaACombinacaoPadrao(t *testing.T) {
	d := regional.Dados{FormatoData: regional.FormatoDataBR, FormatoHora: regional.FormatoHora24}
	assert.NoError(t, d.Validar())
}

func TestValidarAceitaTodasAsCombinacoes(t *testing.T) {
	formatosData := []regional.FormatoData{regional.FormatoDataBR, regional.FormatoDataTraco, regional.FormatoDataISO}
	formatosHora := []regional.FormatoHora{regional.FormatoHora24, regional.FormatoHora12}
	for _, fd := range formatosData {
		for _, fh := range formatosHora {
			d := regional.Dados{FormatoData: fd, FormatoHora: fh}
			assert.NoError(t, d.Validar(), "formato_data=%s formato_hora=%s", fd, fh)
		}
	}
}

func TestValidarRejeitaFormatoDataForaDoConjunto(t *testing.T) {
	d := regional.Dados{FormatoData: "MM/DD/AAAA", FormatoHora: regional.FormatoHora24}
	assert.ErrorIs(t, d.Validar(), regional.ErrFormatoDataInvalido)
}

func TestValidarRejeitaFormatoHoraForaDoConjunto(t *testing.T) {
	d := regional.Dados{FormatoData: regional.FormatoDataBR, FormatoHora: "36H"}
	assert.ErrorIs(t, d.Validar(), regional.ErrFormatoHoraInvalido)
}
```

- [ ] **Passo 4: rodar a suíte do backend via Docker (comando no Global Constraints)**
  e confirmar que a migration 011 aplica sem erro e os 4 testes novos passam.

- [ ] **Passo 5: commit**

```bash
git add backend/internal/infra/db/migrations/011_criar_configuracao_regional.sql \
        backend/internal/domain/regional/
git commit -m "feat(backend): dominio de parametros regionais"
```

---

### Task B2: Repositório e Serviço

**Files:**
- Create: `backend/internal/domain/regional/servico.go`
- Test: `backend/internal/domain/regional/servico_test.go`
- Create: `backend/internal/infra/repository/regional_repo.go`
- Test: `backend/internal/infra/repository/regional_repo_test.go`

**Interfaces:**
- Consumes: `regional.Regional`, `regional.Dados`, `regional.Dados.Validar()` (Task B1).
- Produces: `regional.NovoServico(repo Repositorio) *Servico`,
  `(*Servico).Buscar(ctx) (Regional, error)`,
  `(*Servico).Atualizar(ctx, Dados, atualizadoPor string) (Regional, error)`;
  `repository.NovoRegionalRepositorio(pool *pgxpool.Pool) *RegionalRepositorio` — usados
  por Task B3.

- [ ] **Passo 1: `Servico`**

```go
package regional

import "context"

// Repositorio e a porta de persistencia do singleton de configuracao.
type Repositorio interface {
	Buscar(ctx context.Context) (Regional, error)
	Atualizar(ctx context.Context, dados Dados, atualizadoPor string) (Regional, error)
}

// Servico reune os casos de uso de parametros regionais.
type Servico struct{ repo Repositorio }

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

// Buscar devolve a configuracao atual.
func (s *Servico) Buscar(ctx context.Context) (Regional, error) {
	return s.repo.Buscar(ctx)
}

// Atualizar valida e grava os dois campos.
func (s *Servico) Atualizar(ctx context.Context, dados Dados, atualizadoPor string) (Regional, error) {
	if err := dados.Validar(); err != nil {
		return Regional{}, err
	}
	return s.repo.Atualizar(ctx, dados, atualizadoPor)
}
```

- [ ] **Passo 2: teste do serviço**

```go
package regional_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func servicoComBanco(t *testing.T) *regional.Servico {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return regional.NovoServico(repository.NovoRegionalRepositorio(pool))
}

func TestServicoBuscarDevolveOsDefaults(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)

	cfg, err := servico.Buscar(ctx)

	require.NoError(t, err)
	assert.Equal(t, regional.FormatoDataBR, cfg.FormatoData)
	assert.Equal(t, regional.FormatoHora24, cfg.FormatoHora)
}

func TestServicoAtualizarGravaComValoresValidos(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)

	atualizada, err := servico.Atualizar(ctx, regional.Dados{
		FormatoData: regional.FormatoDataTraco,
		FormatoHora: regional.FormatoHora12,
	}, "admin")

	require.NoError(t, err)
	assert.Equal(t, regional.FormatoDataTraco, atualizada.FormatoData)
	assert.Equal(t, regional.FormatoHora12, atualizada.FormatoHora)
}

func TestServicoAtualizarRejeitaFormatoDataInvalido(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)

	_, err := servico.Atualizar(ctx, regional.Dados{
		FormatoData: "invalido", FormatoHora: regional.FormatoHora24,
	}, "admin")

	assert.ErrorIs(t, err, regional.ErrFormatoDataInvalido)
}
```

- [ ] **Passo 3: repositório**

```go
package repository

import (
	"context"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasRegional = `formato_data, formato_hora, updated_at, updated_by`

// RegionalRepositorio implementa a persistencia do singleton de parametros
// regionais. Nao ha Criar/Excluir: a linha id=1 e semeada pela migration 011
// e so sofre UPDATE dai em diante.
type RegionalRepositorio struct {
	pool *pgxpool.Pool
}

// NovoRegionalRepositorio cria o repositorio de parametros regionais.
func NovoRegionalRepositorio(pool *pgxpool.Pool) *RegionalRepositorio {
	return &RegionalRepositorio{pool: pool}
}

// Buscar devolve a configuracao atual. Nunca ha "nao encontrado": a
// migration 011 garante a linha id=1 desde a subida da aplicacao.
func (r *RegionalRepositorio) Buscar(ctx context.Context) (regional.Regional, error) {
	return r.buscarUm(ctx, `SELECT `+colunasRegional+` FROM configuracao_regional WHERE id = 1`)
}

func (r *RegionalRepositorio) buscarUm(ctx context.Context, sql string, args ...any) (regional.Regional, error) {
	var cfg regional.Regional
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql, args...).Scan(
		&cfg.FormatoData, &cfg.FormatoHora, &cfg.UpdatedAt, &cfg.UpdatedBy,
	)
	if err != nil {
		return regional.Regional{}, fmt.Errorf("buscar configuracao regional: %w", err)
	}
	return cfg, nil
}

// Atualizar grava os dois campos e devolve a linha resultante.
func (r *RegionalRepositorio) Atualizar(ctx context.Context, dados regional.Dados, atualizadoPor string) (regional.Regional, error) {
	sql := `UPDATE configuracao_regional SET
			formato_data = $1, formato_hora = $2, updated_at = now(), updated_by = $3
		WHERE id = 1
		RETURNING ` + colunasRegional

	return r.buscarUm(ctx, sql, dados.FormatoData, dados.FormatoHora, atualizadoPor)
}
```

- [ ] **Passo 4: teste do repositório**

```go
package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegionalBuscarDevolveOsDefaultsSemeadosPelaMigration(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoRegionalRepositorio(testsupport.BancoMigrado(t))

	cfg, err := repo.Buscar(ctx)

	require.NoError(t, err)
	assert.Equal(t, regional.FormatoDataBR, cfg.FormatoData)
	assert.Equal(t, regional.FormatoHora24, cfg.FormatoHora)
	assert.Nil(t, cfg.UpdatedBy)
}

func TestRegionalAtualizarGravaEDevolveALinhaAtual(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoRegionalRepositorio(testsupport.BancoMigrado(t))

	atualizada, err := repo.Atualizar(ctx, regional.Dados{
		FormatoData: regional.FormatoDataISO,
		FormatoHora: regional.FormatoHora12,
	}, "admin")

	require.NoError(t, err)
	assert.Equal(t, regional.FormatoDataISO, atualizada.FormatoData)
	require.NotNil(t, atualizada.UpdatedBy)
	assert.Equal(t, "admin", *atualizada.UpdatedBy)

	relida, err := repo.Buscar(ctx)
	require.NoError(t, err)
	assert.Equal(t, regional.FormatoDataISO, relida.FormatoData)
	assert.Equal(t, regional.FormatoHora12, relida.FormatoHora)
}
```

- [ ] **Passo 5: rodar a suíte do backend via Docker, confirmar os 5 testes novos**

- [ ] **Passo 6: commit**

```bash
git add backend/internal/domain/regional/servico.go backend/internal/domain/regional/servico_test.go \
        backend/internal/infra/repository/regional_repo.go backend/internal/infra/repository/regional_repo_test.go
git commit -m "feat(backend): repositorio e servico de parametros regionais"
```

---

### Task B3: Handler HTTP e rotas

**Files:**
- Create: `backend/internal/api/handlers/regional.go`
- Test: `backend/internal/api/handlers/regional_test.go`
- Modify: `backend/internal/api/routes.go`

**Interfaces:**
- Consumes: `regional.Servico`, `regional.NovoServico`, `repository.NovoRegionalRepositorio`
  (Task B2); `middleware.ExigirPerfil`, `middleware.ClaimsDoContexto`, `usuario.PerfilAdmin`,
  `httpx.OK/Erro/NaoAutorizado`, `mapaDeErros` (já existentes, mesmo padrão de
  `handlers/empresa.go`).
- Produces: `GET /api/v1/configuracoes/regional`, `PUT /api/v1/configuracoes/regional` —
  consumidos pelo frontend a partir da Task F1.

- [ ] **Passo 1: handler**

```go
package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

var errosRegional = mapaDeErros{
	{regional.ErrFormatoDataInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{regional.ErrFormatoHoraInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// RegionalHandler atende /configuracoes/regional (doc 0, secao 4.6.4).
type RegionalHandler struct {
	servico *regional.Servico
}

// NovoRegionalHandler cria o handler de parametros regionais.
func NovoRegionalHandler(servico *regional.Servico) *RegionalHandler {
	return &RegionalHandler{servico: servico}
}

// Registrar publica as rotas do modulo. Diferente de Dados da Empresa, a
// leitura EXIGE autenticacao (qualquer perfil) -- nada antes do login usa
// formato de data/hora, ao contrario do nome/logo da empresa. Escrita
// restrita a Administrador.
func (h *RegionalHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	admin := middleware.ExigirPerfil(usuario.PerfilAdmin)

	rotas := grupo.Group("/configuracoes/regional", autenticacao)
	rotas.GET("", h.Buscar)
	rotas.PUT("", h.Atualizar, admin)
}

// Buscar devolve a configuracao atual (qualquer usuario autenticado).
func (h *RegionalHandler) Buscar(c echo.Context) error {
	cfg, err := h.servico.Buscar(c.Request().Context())
	if err != nil {
		return errosRegional.responder(c, err)
	}
	return httpx.OK(c, cfg)
}

type dadosRegionalRequest struct {
	FormatoData regional.FormatoData `json:"formato_data"`
	FormatoHora regional.FormatoHora `json:"formato_hora"`
}

// Atualizar grava os dois campos (Administrador).
func (h *RegionalHandler) Atualizar(c echo.Context) error {
	claims := middleware.ClaimsDoContexto(c)
	if claims == nil {
		return httpx.NaoAutorizado(c, "Token de acesso ausente")
	}

	var req dadosRegionalRequest
	if err := c.Bind(&req); err != nil {
		return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoRequisicaoInvalida, "Corpo da requisicao invalido")
	}

	atualizada, err := h.servico.Atualizar(c.Request().Context(), regional.Dados{
		FormatoData: req.FormatoData,
		FormatoHora: req.FormatoHora,
	}, claims.Username)
	if err != nil {
		return errosRegional.responder(c, err)
	}
	return httpx.OK(c, atualizada)
}
```

- [ ] **Passo 2: registrar em `routes.go`**

Adicionar o import `"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"`
ao bloco de imports existente (ordem alfabética, junto dos demais `domain/*`), e alterar
`registrarConfiguracoes`:

```go
func registrarConfiguracoes(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc) {
	handlers.NovoEmpresaHandler(
		empresa.NovoServico(repository.NovoEmpresaRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoAuditoriaHandler(
		auditoria.NovoServico(repository.NovoAuditoriaRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoRegionalHandler(
		regional.NovoServico(repository.NovoRegionalRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)
}
```

- [ ] **Passo 3: teste do handler**

```go
package handlers_test

import (
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiRegional(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoRegionalHandler(regional.NovoServico(repository.NovoRegionalRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	return api
}

func TestBuscarRegionalSemTokenResponde401(t *testing.T) {
	api := apiRegional(t)

	rec := api.semToken(http.MethodGet, "/api/v1/configuracoes/regional")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestBuscarRegionalComoOperadorResponde200(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodGet, "/api/v1/configuracoes/regional", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "DD/MM/AAAA", dados(t, rec)["formato_data"])
}

func TestAtualizarRegionalSemTokenResponde401(t *testing.T) {
	api := apiRegional(t)

	rec := api.semToken(http.MethodPut, "/api/v1/configuracoes/regional")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAtualizarRegionalComoGestorResponde403(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/regional",
		`{"formato_data": "AAAA-MM-DD", "formato_hora": "12H"}`, usuario.PerfilGestor)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestAtualizarRegionalComoOperadorResponde403(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/regional",
		`{"formato_data": "AAAA-MM-DD", "formato_hora": "12H"}`, usuario.PerfilOperador)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestAtualizarRegionalComFormatoDataInvalidoResponde400(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/regional",
		`{"formato_data": "MM/DD/AAAA", "formato_hora": "24H"}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAtualizarRegionalComFormatoHoraInvalidoResponde400(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/regional",
		`{"formato_data": "DD/MM/AAAA", "formato_hora": "36H"}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAtualizarRegionalValidoReflecteNoGetSeguinte(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/regional",
		`{"formato_data": "AAAA-MM-DD", "formato_hora": "12H"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = api.chamar(http.MethodGet, "/api/v1/configuracoes/regional", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	corpo := dados(t, rec)
	assert.Equal(t, "AAAA-MM-DD", corpo["formato_data"])
	assert.Equal(t, "12H", corpo["formato_hora"])
}
```

- [ ] **Passo 4: rodar a suíte completa do backend via Docker** — confirmar os 7 testes
  novos deste handler e que nenhum teste existente (`TestRotasDosCadastrosEstaoRegistradas`
  e demais) quebrou com a rota nova.

- [ ] **Passo 5: commit**

```bash
git add backend/internal/api/handlers/regional.go backend/internal/api/handlers/regional_test.go \
        backend/internal/api/routes.go
git commit -m "feat(backend): endpoints de parametros regionais"
```

Backend completo depois desta task (B1-B3).

---

## Frontend

### Task F1: Tipos e serviço

**Files:**
- Create: `frontend/src/tipos/regional.ts`
- Create: `frontend/src/servicos/regional.ts`
- Test: `frontend/src/servicos/regional.test.ts`

**Interfaces:**
- Produces: `FormatoData`, `FormatoHora`, `ConfiguracaoRegional`,
  `CorpoAtualizarRegional` (tipos); `chaveConfiguracaoRegional`,
  `buscarConfiguracaoRegional()`, `atualizarConfiguracaoRegional(corpo)` — usados por
  Task F2, F5, F6.

- [ ] **Passo 1: tipos**

```ts
export type FormatoData = 'DD/MM/AAAA' | 'DD-MM-AAAA' | 'AAAA-MM-DD';
export type FormatoHora = '24H' | '12H';

export interface ConfiguracaoRegional {
  formato_data: FormatoData;
  formato_hora: FormatoHora;
  updated_at: string;
  updated_by?: string;
}

/** Corpo de PUT /configuracoes/regional — sempre a configuração inteira de novo. */
export type CorpoAtualizarRegional = Pick<ConfiguracaoRegional, 'formato_data' | 'formato_hora'>;
```

- [ ] **Passo 2: serviço**

```ts
import { api } from './api';
import type { ConfiguracaoRegional, CorpoAtualizarRegional } from '@/tipos/regional';

interface EnvelopeItem<T> {
  dados: T;
}

/** Chave compartilhada — a tela de edição e o carregador global usam a
 * mesma, para invalidar/reconciliar o cache com uma única fonte. */
export const chaveConfiguracaoRegional = ['configuracoes', 'regional'] as const;

export async function buscarConfiguracaoRegional(): Promise<ConfiguracaoRegional> {
  const { data } = await api.get<EnvelopeItem<ConfiguracaoRegional>>('/configuracoes/regional');
  return data.dados;
}

export async function atualizarConfiguracaoRegional(corpo: CorpoAtualizarRegional): Promise<ConfiguracaoRegional> {
  const { data } = await api.put<EnvelopeItem<ConfiguracaoRegional>>('/configuracoes/regional', corpo);
  return data.dados;
}
```

- [ ] **Passo 3: teste do serviço**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { atualizarConfiguracaoRegional, buscarConfiguracaoRegional } from './regional';

const configuracaoFalsa = { formato_data: 'DD/MM/AAAA', formato_hora: '24H', updated_at: '2026-08-31T10:00:00-03:00' };

describe('servicos/regional', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('buscarConfiguracaoRegional busca GET /configuracoes/regional', async () => {
    servidor.responder([{ metodo: 'get', url: '/configuracoes/regional', status: 200, corpo: { dados: configuracaoFalsa } }]);

    const encontrada = await buscarConfiguracaoRegional();

    expect(encontrada.formato_data).toBe('DD/MM/AAAA');
  });

  it('atualizarConfiguracaoRegional envia PUT com o corpo informado', async () => {
    servidor.responder([{ metodo: 'put', url: '/configuracoes/regional', status: 200, corpo: { dados: configuracaoFalsa } }]);
    const corpo = { formato_data: 'AAAA-MM-DD', formato_hora: '12H' } as const;

    await atualizarConfiguracaoRegional(corpo);

    expect(servidor.requisicoes[0].corpo).toEqual(corpo);
  });
});
```

- [ ] **Passo 4: rodar `npm test`/`lint`/`tsc` via Docker, confirmar os 2 testes novos**

- [ ] **Passo 5: commit**

```bash
git add frontend/src/tipos/regional.ts frontend/src/servicos/regional.ts frontend/src/servicos/regional.test.ts
git commit -m "feat(frontend): tipos e servico de parametros regionais"
```

---

### Task F2: Store Zustand

**Files:**
- Create: `frontend/src/store/configuracaoRegional.ts`
- Test: `frontend/src/store/configuracaoRegional.test.ts`

**Interfaces:**
- Produces: `useConfiguracaoRegional` (hook Zustand), `configuracaoRegionalAtual(): {
  formato_data: FormatoData; formato_hora: FormatoHora }` (leitura fora do React) —
  usado por Task F3 (`lib/formato.ts`), F5 (carregador) e F6 (tela).

- [ ] **Passo 1: store**

```ts
import { create } from 'zustand';
import type { FormatoData, FormatoHora } from '@/tipos/regional';

export interface ConfiguracaoRegionalAplicada {
  formato_data: FormatoData;
  formato_hora: FormatoHora;
}

/** Mesmos defaults da migration 011 -- o que a tela mostra antes do GET
 * /configuracoes/regional responder (ou se a requisicao falhar) e
 * exatamente o que o backend usaria de qualquer forma. */
export const CONFIGURACAO_REGIONAL_PADRAO: ConfiguracaoRegionalAplicada = {
  formato_data: 'DD/MM/AAAA',
  formato_hora: '24H',
};

interface EstadoConfiguracaoRegional {
  configuracao: ConfiguracaoRegionalAplicada;
  aplicar: (configuracao: ConfiguracaoRegionalAplicada) => void;
}

// Store simples, sem cache em localStorage (diferente de usePreferencias):
// o valor so e lido dentro de renders React (formatarData/formatarDataHora),
// nunca antes do React montar, entao nao ha "flash" de formato errado a
// evitar -- o default acima ja e o mesmo que o backend usaria.
export const useConfiguracaoRegional = create<EstadoConfiguracaoRegional>((set) => ({
  configuracao: CONFIGURACAO_REGIONAL_PADRAO,
  aplicar: (configuracao) => set({ configuracao }),
}));

/** Le a configuracao fora do React -- mesmo padrao de tokenAtual() em
 * store/autenticacao.ts. formatarData/formatarDataHora (lib/formato.ts) sao
 * funcoes simples chamadas dentro de renderizadores de coluna/celula, nao
 * hooks, entao nao podem assinar a store via useConfiguracaoRegional(...). */
export function configuracaoRegionalAtual(): ConfiguracaoRegionalAplicada {
  return useConfiguracaoRegional.getState().configuracao;
}
```

- [ ] **Passo 2: teste da store**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIGURACAO_REGIONAL_PADRAO, configuracaoRegionalAtual, useConfiguracaoRegional } from './configuracaoRegional';

describe('store/configuracaoRegional', () => {
  beforeEach(() => {
    useConfiguracaoRegional.setState({ configuracao: CONFIGURACAO_REGIONAL_PADRAO });
  });

  it('comeca com os defaults da migration', () => {
    expect(configuracaoRegionalAtual()).toEqual(CONFIGURACAO_REGIONAL_PADRAO);
  });

  it('aplicar atualiza o que configuracaoRegionalAtual devolve, fora do React', () => {
    useConfiguracaoRegional.getState().aplicar({ formato_data: 'AAAA-MM-DD', formato_hora: '12H' });

    expect(configuracaoRegionalAtual()).toEqual({ formato_data: 'AAAA-MM-DD', formato_hora: '12H' });
  });
});
```

- [ ] **Passo 3: rodar `npm test`/`lint`/`tsc` via Docker**

- [ ] **Passo 4: commit**

```bash
git add frontend/src/store/configuracaoRegional.ts frontend/src/store/configuracaoRegional.test.ts
git commit -m "feat(frontend): store de parametros regionais"
```

---

### Task F3: `lib/formato.ts` — funções parametrizadas e wiring

**Files:**
- Modify: `frontend/src/lib/formato.ts`
- Modify: `frontend/src/lib/formato.test.ts`

**Interfaces:**
- Consumes: `configuracaoRegionalAtual()` (Task F2), `FormatoData`, `FormatoHora`
  (`@/tipos/regional`).
- Produces: `formatarDataComFormato(data: string, formato: FormatoData): string` e
  `formatarHoraComFormato(hora: number, minuto: number, formato: FormatoHora): string`
  (funções puras, exportadas — usadas pela pré-visualização da Task F6);
  `formatarData(data: string | undefined): string` (assinatura inalterada, agora lê a
  store); `formatarDataHora(iso: string): string` (nova — substitui a cópia local de
  `Auditoria.tsx` na Task F4).

- [ ] **Passo 1: adicionar as funções puras e as duas que leem a store**

Substituir a função `formatarData` existente:

```ts
// REMOVER este bloco:
export function formatarData(data: string | undefined): string {
  if (!data) {
    return '—';
  }
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}
```

por: 

```ts
import { configuracaoRegionalAtual } from '@/store/configuracaoRegional';
import type { FormatoData, FormatoHora } from '@/tipos/regional';

// ... (formatarCNPJ, formatarMoeda, formatarDias continuam iguais, acima)

/** Núcleo puro de formatação de data — sem depender da store, para a
 * pré-visualização da tela de Parâmetros Regionais poder mostrar o efeito
 * de uma opção ainda não salva. */
export function formatarDataComFormato(dataAAAAMMDD: string, formato: FormatoData): string {
  const [ano, mes, dia] = dataAAAAMMDD.split('-');
  switch (formato) {
    case 'DD-MM-AAAA':
      return `${dia}-${mes}-${ano}`;
    case 'AAAA-MM-DD':
      return `${ano}-${mes}-${dia}`;
    case 'DD/MM/AAAA':
    default:
      return `${dia}/${mes}/${ano}`;
  }
}

/** Núcleo puro de formatação de hora — mesmo motivo do anterior. */
export function formatarHoraComFormato(hora: number, minuto: number, formato: FormatoHora): string {
  const minutoTexto = String(minuto).padStart(2, '0');
  if (formato === '12H') {
    const periodo = hora >= 12 ? 'PM' : 'AM';
    const hora12 = hora % 12 === 0 ? 12 : hora % 12;
    return `${String(hora12).padStart(2, '0')}:${minutoTexto} ${periodo}`;
  }
  return `${String(hora).padStart(2, '0')}:${minutoTexto}`;
}

/**
 * Converte a data do contrato da API (AAAA-MM-DD, ou um timestamp com essa
 * data na frente) para o formato de exibição configurado (Parâmetros
 * Regionais). Ausente vira travessão — o mesmo convite vazio usado no resto
 * do sistema, nunca string vazia.
 */
export function formatarData(data: string | undefined): string {
  if (!data) {
    return '—';
  }
  return formatarDataComFormato(data.slice(0, 10), configuracaoRegionalAtual().formato_data);
}

/**
 * Converte um timestamp ISO 8601 completo (com hora) para "<data> <hora>" no
 * formato configurado. `new Date(iso)` já resolve para o fuso do navegador —
 * o backend manda o offset correto (ver auditoria_repo.go, `normalizarRegistro`).
 */
export function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  const { formato_data: formatoData, formato_hora: formatoHora } = configuracaoRegionalAtual();

  const dataFormatada = formatarDataComFormato(`${ano}-${mes}-${dia}`, formatoData);
  const horaFormatada = formatarHoraComFormato(data.getHours(), data.getMinutes(), formatoHora);
  return `${dataFormatada} ${horaFormatada}`;
}
```

- [ ] **Passo 2: testes**

Adicionar ao final de `formato.test.ts` (mantendo os `describe` existentes intactos —
a mudança em `formatarData` é aditiva, com os defaults da store o resultado é idêntico
ao de antes, então os 3 testes já existentes de `formatarData` continuam passando sem
alteração):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIGURACAO_REGIONAL_PADRAO, useConfiguracaoRegional } from '@/store/configuracaoRegional';
import {
  formatarCNPJ, formatarData, formatarDataComFormato, formatarDataHora,
  formatarDias, formatarHoraComFormato, formatarMoeda,
} from './formato';

// ... describes existentes (formatarCNPJ, formatarMoeda, formatarDias, formatarData) ...

describe('formatarDataComFormato', () => {
  it('DD/MM/AAAA', () => {
    expect(formatarDataComFormato('2026-08-31', 'DD/MM/AAAA')).toBe('31/08/2026');
  });

  it('DD-MM-AAAA', () => {
    expect(formatarDataComFormato('2026-08-31', 'DD-MM-AAAA')).toBe('31-08-2026');
  });

  it('AAAA-MM-DD', () => {
    expect(formatarDataComFormato('2026-08-31', 'AAAA-MM-DD')).toBe('2026-08-31');
  });
});

describe('formatarHoraComFormato', () => {
  it('24H mantém duas casas', () => {
    expect(formatarHoraComFormato(9, 5, '24H')).toBe('09:05');
    expect(formatarHoraComFormato(23, 59, '24H')).toBe('23:59');
  });

  it('12H com AM/PM', () => {
    expect(formatarHoraComFormato(0, 0, '12H')).toBe('12:00 AM');
    expect(formatarHoraComFormato(13, 30, '12H')).toBe('01:30 PM');
    expect(formatarHoraComFormato(12, 0, '12H')).toBe('12:00 PM');
  });
});

describe('formatarData respeitando a configuração', () => {
  beforeEach(() => {
    useConfiguracaoRegional.setState({ configuracao: CONFIGURACAO_REGIONAL_PADRAO });
  });

  it('usa AAAA-MM-DD quando configurado', () => {
    useConfiguracaoRegional.getState().aplicar({ formato_data: 'AAAA-MM-DD', formato_hora: '24H' });
    expect(formatarData('2026-08-31')).toBe('2026-08-31');
  });
});

describe('formatarDataHora', () => {
  beforeEach(() => {
    useConfiguracaoRegional.setState({ configuracao: CONFIGURACAO_REGIONAL_PADRAO });
  });

  it('combina data e hora no formato padrão', () => {
    // O ambiente de teste roda em UTC (vitest/jsdom) -- o mesmo valor que o
    // getHours()/getDate() locais devolvem.
    expect(formatarDataHora('2026-08-31T14:05:00-00:00')).toBe('31/08/2026 14:05');
  });

  it('respeita o formato de hora 12H configurado', () => {
    useConfiguracaoRegional.getState().aplicar({ formato_data: 'DD/MM/AAAA', formato_hora: '12H' });
    expect(formatarDataHora('2026-08-31T14:05:00-00:00')).toBe('31/08/2026 02:05 PM');
  });
});
```

- [ ] **Passo 3: rodar `npm test`/`lint`/`tsc` via Docker via Docker** — confirmar que
  os testes novos passam e nenhum teste existente de `formato.test.ts` regrediu.

- [ ] **Passo 4: commit**

```bash
git add frontend/src/lib/formato.ts frontend/src/lib/formato.test.ts
git commit -m "feat(frontend): formatarData/formatarDataHora respeitam parametros regionais"
```

---

### Task F4: Unificar `Auditoria.tsx` com o helper compartilhado

**Files:**
- Modify: `frontend/src/paginas/configuracoes/Auditoria.tsx`

**Interfaces:**
- Consumes: `formatarDataHora` de `@/lib/formato` (Task F3).

- [ ] **Passo 1: remover a cópia local e importar a compartilhada**

Em `Auditoria.tsx`, remover a função local inteira (comentário + corpo, ~11 linhas):

```ts
/** A API manda o ISO 8601 com o offset em que o evento foi gravado
 * (`...-03:00`); o navegador converte para o fuso local ao ler a string,
 * entao so falta escolher o formato pt-BR. */
function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()} ${hora}:${minuto}`;
}
```

e adicionar `formatarDataHora` ao import já existente de `@/lib/formato`. Se o arquivo
ainda não importa nada de `@/lib/formato`, adicionar a linha:

```ts
import { formatarDataHora } from '@/lib/formato';
```

O restante do arquivo (chamadas a `formatarDataHora(r.data_hora)` na coluna
`data_hora` e em `registroEmDetalhe.data_hora`) não muda — mesma assinatura.

- [ ] **Passo 2: rodar `npm test` (via Docker) do arquivo `Auditoria.test.tsx`
  isoladamente e confirmar que os testes existentes continuam passando sem alteração**

```bash
# dentro do container node, no diretorio frontend
npm test -- --run Auditoria.test.tsx
```

Expected: todos os testes de `Auditoria.test.tsx` continuam PASS (o arquivo não
verifica a string exata de data/hora renderizada, só os campos do diff — ver
`docs/superpowers/specs/2026-08-31-parametros-regionais-design.md` §7 para o motivo
desta checagem ter sido incluída deliberadamente no plano).

- [ ] **Passo 3: rodar a suíte completa do frontend via Docker**

- [ ] **Passo 4: commit**

```bash
git add frontend/src/paginas/configuracoes/Auditoria.tsx
git commit -m "refactor(frontend): auditoria usa o formatarDataHora compartilhado"
```

---

### Task F5: Carregador global da configuração

**Files:**
- Create: `frontend/src/componentes/layout/CarregarConfiguracaoRegional.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `chaveConfiguracaoRegional`, `buscarConfiguracaoRegional` (Task F1),
  `useConfiguracaoRegional` (Task F2), `useAutenticacao` (já existente).
- Produces: componente `CarregarConfiguracaoRegional`, montado em `App.tsx`.

- [ ] **Passo 1: componente**

```tsx
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { chaveConfiguracaoRegional, buscarConfiguracaoRegional } from '@/servicos/regional';
import { useAutenticacao } from '@/store/autenticacao';
import { useConfiguracaoRegional } from '@/store/configuracaoRegional';

/**
 * Sem UI própria — mantém a store de parâmetros regionais sincronizada com o
 * backend. Montado uma vez em App.tsx, fora das rotas (mesmo padrão de
 * AplicarBrandingEmpresa). Diferente da marca da empresa, esta configuração
 * exige sessão (`enabled: autenticado`) — não há tela pré-login que a use.
 */
export function CarregarConfiguracaoRegional() {
  const autenticado = useAutenticacao((estado) => estado.autenticado);
  const { data } = useQuery({
    queryKey: chaveConfiguracaoRegional,
    queryFn: buscarConfiguracaoRegional,
    enabled: autenticado,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data) {
      useConfiguracaoRegional.getState().aplicar({
        formato_data: data.formato_data,
        formato_hora: data.formato_hora,
      });
    }
  }, [data]);

  return null;
}
```

- [ ] **Passo 2: montar em `App.tsx`**

Adicionar o import `import { CarregarConfiguracaoRegional } from '@/componentes/layout/CarregarConfiguracaoRegional';`
(ordem alfabética, junto dos demais imports de `@/componentes/layout`), e montar ao
lado de `<AplicarBrandingEmpresa />`:

```tsx
return (
  <QueryClientProvider client={queryClient}>
    <AplicarBrandingEmpresa />
    <CarregarConfiguracaoRegional />
    <Routes>
      {/* ... rotas existentes, sem alteração ... */}
    </Routes>
  </QueryClientProvider>
);
```

- [ ] **Passo 3: teste**

Não é necessário um arquivo de teste dedicado — `App.test.tsx` já renderiza `<App />`
inteiro; confirme que a suíte completa do frontend passa sem alteração (o componente é
`enabled: false` sem sessão, então não dispara nenhuma requisição nova nos testes
existentes que não fazem login).

- [ ] **Passo 4: rodar a suíte completa do frontend via Docker**

- [ ] **Passo 5: commit**

```bash
git add frontend/src/componentes/layout/CarregarConfiguracaoRegional.tsx frontend/src/App.tsx
git commit -m "feat(frontend): carrega parametros regionais no boot do app"
```

---

### Task F6: Tela de Parâmetros Regionais

**Files:**
- Create: `frontend/src/paginas/configuracoes/ParametrosRegionais.tsx`
- Test: `frontend/src/paginas/configuracoes/ParametrosRegionais.test.tsx`

**Interfaces:**
- Consumes: `chaveConfiguracaoRegional`, `buscarConfiguracaoRegional`,
  `atualizarConfiguracaoRegional` (Task F1); `useConfiguracaoRegional` (Task F2);
  `formatarDataComFormato`, `formatarHoraComFormato` (Task F3); `useAutenticacao`,
  `useToasts`, `Selecao`, `Botao`, `separarErro` (já existentes).
- Produces: componente `ParametrosRegionais`, usado pela rota da Task F7.

- [ ] **Passo 1: componente**

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Botao } from '@/componentes/ui/Botao';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarDataComFormato, formatarHoraComFormato } from '@/lib/formato';
import { atualizarConfiguracaoRegional, buscarConfiguracaoRegional, chaveConfiguracaoRegional } from '@/servicos/regional';
import { useAutenticacao } from '@/store/autenticacao';
import { useConfiguracaoRegional } from '@/store/configuracaoRegional';
import type { FormatoData, FormatoHora } from '@/tipos/regional';

const OPCOES_FORMATO_DATA: { valor: FormatoData; rotulo: string }[] = [
  { valor: 'DD/MM/AAAA', rotulo: 'DD/MM/AAAA (31/08/2026)' },
  { valor: 'DD-MM-AAAA', rotulo: 'DD-MM-AAAA (31-08-2026)' },
  { valor: 'AAAA-MM-DD', rotulo: 'AAAA-MM-DD (2026-08-31)' },
];

const OPCOES_FORMATO_HORA: { valor: FormatoHora; rotulo: string }[] = [
  { valor: '24H', rotulo: '24 horas (14:30)' },
  { valor: '12H', rotulo: '12 horas (02:30 PM)' },
];

// Data/hora de exemplo fixas para a pré-visualização -- não dependem do
// relógio do navegador, para o texto de exemplo ser sempre o mesmo.
const EXEMPLO_DATA = '2026-08-31';
const EXEMPLO_HORA = 14;
const EXEMPLO_MINUTO = 30;

export function ParametrosRegionais() {
  const perfil = useAutenticacao((estado) => estado.usuario?.perfil);
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const queryClient = useQueryClient();

  const consulta = useQuery({
    queryKey: chaveConfiguracaoRegional,
    queryFn: buscarConfiguracaoRegional,
  });

  const [formatoData, definirFormatoData] = useState<FormatoData>('DD/MM/AAAA');
  const [formatoHora, definirFormatoHora] = useState<FormatoHora>('24H');

  useEffect(() => {
    if (consulta.data) {
      definirFormatoData(consulta.data.formato_data);
      definirFormatoHora(consulta.data.formato_hora);
    }
  }, [consulta.data]);

  const mutacao = useMutation({
    mutationFn: atualizarConfiguracaoRegional,
    onSuccess: (atualizada) => {
      queryClient.setQueryData(chaveConfiguracaoRegional, atualizada);
      useConfiguracaoRegional.getState().aplicar({
        formato_data: atualizada.formato_data,
        formato_hora: atualizada.formato_hora,
      });
      mostrarToast('Parâmetros regionais salvos');
    },
    onError: (erro) => {
      mostrarToast(separarErro(erro).geral ?? 'Não foi possível salvar os parâmetros regionais.', 'pending');
    },
  });

  if (perfil !== 'ADMIN') {
    return (
      <div className="mx-auto flex max-w-[600px] flex-col gap-4">
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          Acesso restrito a administradores.
        </p>
      </div>
    );
  }

  const preview = `${formatarDataComFormato(EXEMPLO_DATA, formatoData)} ${formatarHoraComFormato(EXEMPLO_HORA, EXEMPLO_MINUTO, formatoHora)}`;

  return (
    <form
      className="mx-auto flex max-w-[600px] flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        mutacao.mutate({ formato_data: formatoData, formato_hora: formatoHora });
      }}
    >
      <div>
        <h1 className="text-title text-texto-primary">Parâmetros regionais</h1>
        <p className="text-body text-texto-secondary">
          Formato de data e hora usados em todo o sistema — a mudança vale para todos os usuários.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
        <Selecao
          rotulo="Formato de data"
          opcoes={OPCOES_FORMATO_DATA}
          value={formatoData}
          onChange={(evento) => definirFormatoData(evento.target.value as FormatoData)}
        />

        <Selecao
          rotulo="Formato de hora"
          opcoes={OPCOES_FORMATO_HORA}
          value={formatoHora}
          onChange={(evento) => definirFormatoHora(evento.target.value as FormatoHora)}
        />

        <p className="text-label text-texto-secondary">Assim: {preview}</p>

        <Botao type="submit" ocupado={mutacao.isPending} rotuloOcupado="Salvando…">
          Salvar
        </Botao>
      </div>
    </form>
  );
}
```

- [ ] **Passo 2: teste**

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { ParametrosRegionais } from './ParametrosRegionais';

const respostaLoginAdmin = {
  access_token: 'token-abc', token_type: 'Bearer', expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN' as const,
    tema: 'automatico' as const, alto_contraste: false, densidade: 'compacta' as const, tamanho_fonte: 'padrao' as const,
  },
};

const configuracaoPadrao = { formato_data: 'DD/MM/AAAA', formato_hora: '24H', updated_at: '2026-08-31T10:00:00-03:00' };

describe('ParametrosRegionais', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    useToasts.setState({ itens: [] });
  });

  it('acesso restrito a administradores mostra a mensagem em vez do formulario', () => {
    useAutenticacao.getState().entrar({ ...respostaLoginAdmin, usuario: { ...respostaLoginAdmin.usuario, perfil: 'GESTOR' } });
    servidor.responder([{ metodo: 'get', url: '/configuracoes/regional', status: 200, corpo: { dados: configuracaoPadrao } }]);

    renderizarComProvedores(<ParametrosRegionais />);

    expect(screen.getByRole('alert')).toHaveTextContent(/acesso restrito/i);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('a previa muda ao trocar a selecao, antes de salvar', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/regional', status: 200, corpo: { dados: configuracaoPadrao } }]);

    renderizarComProvedores(<ParametrosRegionais />);
    await screen.findByText('Assim: 31/08/2026 14:30');

    await userEvent.selectOptions(screen.getByLabelText('Formato de data'), 'AAAA-MM-DD');

    expect(screen.getByText('Assim: 2026-08-31 14:30')).toBeInTheDocument();
  });

  it('salvar envia o corpo certo e aplica a store imediatamente', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/regional', status: 200, corpo: { dados: configuracaoPadrao } },
      { metodo: 'put', url: '/configuracoes/regional', status: 200, corpo: { dados: { ...configuracaoPadrao, formato_data: 'AAAA-MM-DD' } } },
    ]);

    renderizarComProvedores(<ParametrosRegionais />);
    await screen.findByText('Assim: 31/08/2026 14:30');
    await userEvent.selectOptions(screen.getByLabelText('Formato de data'), 'AAAA-MM-DD');

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(servidor.requisicoes.at(-1)?.corpo).toEqual({ formato_data: 'AAAA-MM-DD', formato_hora: '24H' });
    });
    expect(await screen.findByText('Parâmetros regionais salvos')).toBeInTheDocument();
  });
});
```

- [ ] **Passo 3: rodar a suíte completa do frontend via Docker**

- [ ] **Passo 4: commit**

```bash
git add frontend/src/paginas/configuracoes/ParametrosRegionais.tsx frontend/src/paginas/configuracoes/ParametrosRegionais.test.tsx
git commit -m "feat(frontend): tela de parametros regionais"
```

---

### Task F7: Rota, navegação lateral e ajuda

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/componentes/layout/NavegacaoLateral.tsx`
- Modify: `frontend/src/componentes/layout/NavegacaoLateral.test.tsx`
- Modify: `frontend/src/componentes/layout/Ajuda.tsx`
- Modify: `frontend/src/componentes/layout/Ajuda.test.tsx`
- Modify: `frontend/src/componentes/ui/icones.ts`

**Interfaces:**
- Consumes: `ParametrosRegionais` (Task F6).

- [ ] **Passo 1: ícone novo**

Em `icones.ts`, adicionar `Clock` ao import de `lucide-react` (ordem alfabética junto
dos demais) e a entrada `clock: Clock,` no objeto `icones` (ordem alfabética).

- [ ] **Passo 2: rota em `App.tsx`**

Adicionar o import `import { ParametrosRegionais } from '@/paginas/configuracoes/ParametrosRegionais';`
(ordem alfabética junto de `DadosEmpresa`/`Auditoria`), e a rota, junto das demais de
`/configuracoes/*`:

```tsx
<Route path="/configuracoes/empresa" element={<DadosEmpresaPagina />} />
<Route path="/configuracoes/auditoria" element={<Auditoria />} />
<Route path="/configuracoes/regional" element={<ParametrosRegionais />} />
```

- [ ] **Passo 3: item na navegação lateral**

Em `NavegacaoLateral.tsx`, adicionar ao array `CONFIGURACOES` (depois de Auditoria):

```ts
const CONFIGURACOES: ItemNavegacao[] = [
  { rota: '/configuracoes/empresa', rotulo: 'Dados da empresa', icone: 'building' },
  { rota: '/configuracoes/auditoria', rotulo: 'Auditoria', icone: 'history' },
  { rota: '/configuracoes/regional', rotulo: 'Parâmetros regionais', icone: 'clock' },
];
```

- [ ] **Passo 4: teste da navegação**

Adicionar ao final do `describe('NavegacaoLateral', ...)`:

```ts
it('Administrador ve o link de Parametros regionais', () => {
  useAutenticacao.getState().entrar(respostaLogin('ADMIN'));

  renderizarEm('/');

  expect(screen.getByRole('link', { name: 'Parâmetros regionais' })).toHaveAttribute(
    'href',
    '/configuracoes/regional',
  );
});

it('quem nao e Administrador nao ve o link de Parametros regionais', () => {
  useAutenticacao.getState().entrar(respostaLogin('GESTOR'));

  renderizarEm('/');

  expect(screen.queryByRole('link', { name: 'Parâmetros regionais' })).not.toBeInTheDocument();
});
```

- [ ] **Passo 5: conteúdo de ajuda**

Em `Ajuda.tsx`, adicionar ao objeto `CONTEUDO_POR_ROTA` (depois da entrada
`/configuracoes/auditoria`):

```ts
'/configuracoes/regional': {
  titulo: 'Ajuda · Parâmetros regionais',
  itens: [
    'Formato de data e hora valem para o sistema inteiro — a mudança aparece para todos os usuários, não só para quem editou.',
    'A pré-visualização mostra o efeito da escolha antes de salvar.',
    'Só o Administrador acessa e edita esta tela.',
  ],
},
```

- [ ] **Passo 6: teste da ajuda**

Adicionar ao `describe('Ajuda', ...)` existente:

```tsx
it('o conteudo muda conforme a tela: parametros regionais', async () => {
  renderizar('/configuracoes/regional');

  await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

  expect(screen.getByRole('dialog', { name: /Parâmetros regionais/ })).toBeInTheDocument();
});
```

- [ ] **Passo 7: rodar a suíte completa do frontend via Docker (lint, tsc, build,
  testes) — confirmar 330+/330+ (contagem exata depende do total acumulado até aqui)**

- [ ] **Passo 8: commit**

```bash
git add frontend/src/App.tsx frontend/src/componentes/layout/NavegacaoLateral.tsx \
        frontend/src/componentes/layout/NavegacaoLateral.test.tsx \
        frontend/src/componentes/layout/Ajuda.tsx frontend/src/componentes/layout/Ajuda.test.tsx \
        frontend/src/componentes/ui/icones.ts
git commit -m "feat(frontend): navegacao e ajuda para parametros regionais"
```

Frontend completo depois desta task (F1-F7).

---

### Task F8: Verificação final

- [ ] Suíte completa via Docker: backend (`go build/vet/test ./...`) e frontend
  (`npm run lint`, `npx tsc -b`, `npm run build`, `npm test -- --run`) — todos verdes.
- [ ] Agente `code-reviewer` (background) sobre o diff completo do branch — atenção
  especial a: `GET /configuracoes/regional` exigir mesmo autenticação (não deve ficar
  público por engano, como Dados da Empresa); `formatarData`/`formatarDataHora` não
  quebrarem quando a store ainda não carregou (valor default sensato antes do primeiro
  `GET` responder); a store não-reativa (`.getState()`) não deixar uma tela já
  montada exibindo um formato desatualizado de forma que prejudique um caso de uso
  real (ver risco documentado na spec §7).
- [ ] Roteiro Playwright real (mesmo padrão das sub-entregas anteriores, ambiente
  Docker): login como Admin, abrir Parâmetros Regionais, trocar para `AAAA-MM-DD` e
  `12H`, salvar, confirmar que uma tela com data (ex. Cotações ou Fornecedores) e a
  Auditoria (data+hora) refletem a escolha sem F5; logar como não-admin e confirmar
  acesso restrito (link some da navegação, URL direta mostra a mensagem); reverter
  para os defaults ao final.
- [ ] Screenshots em `docs/screenshots/` (numeração sequencial a partir da última
  usada) — lista de Parâmetros Regionais com os dois campos e a prévia, e uma tela
  qualquer (ex. Cotações) mostrando o formato alterado.
- [ ] `docs/8_MANUAL_OPERACAO.md` ganha a seção 15 "Parâmetros regionais" (a próxima
  livre — Auditoria ocupou a 14), renumerando Ajuda contextual (15→16) e Perguntas
  frequentes (16→17), com os links cruzados internos ajustados (mesmo cuidado já
  registrado no ledger da Auditoria).
- [ ] `.superpowers/sdd/progress.md` atualizado a cada task concluída (não só no
  fechamento) — mesma disciplina já corrigida nas sub-entregas anteriores.
- [ ] Aplicar os achados da revisão de código, se houver, com teste de regressão para
  cada um.
- [ ] Commit final, push, link de PR (ou merge direto, conforme a escolha do usuário
  no fechamento — ver `superpowers:finishing-a-development-branch`).
