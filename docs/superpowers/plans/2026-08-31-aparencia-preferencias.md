# Aparência e Preferências — Fase 4.1

**Goal:** Fechar a fatia de menor esforço da Fase 4 (`0_SUMARIO_EXECUTIVO.md` §4.6.1):
Tema (claro/escuro/automático), Alto Contraste, Densidade de Layout e Tamanho de Fonte,
persistidos por usuário no backend, aplicados via CSS custom properties sem *flash* de
tema incorreto no carregamento.

**Escopo confirmado com o usuário:**
- **Dentro**: Tema, Alto Contraste, Densidade, Tamanho de Fonte. Persistência no backend
  (coluna em `usuarios`), com cache local (`localStorage`) só para aplicar antes do
  primeiro paint.
- **Fora** (mesma pergunta, decisão do usuário): Cor de Destaque (a marca do design
  system é fixa — uma paleta dinâmica é uma decisão de produto à parte), Modo
  Quiosque/TV (não há Kanban ainda — Fase 3), preparação de i18n (sem um segundo idioma
  real, não traz valor agora).

**Architecture:**
- Backend: 4 colunas novas em `usuarios` (migration 009), sem pacote de domínio novo —
  `usuario.Usuario` ganha os campos, validados por `Dados.Validar()` num tipo
  `usuario.Preferencias` mínimo. Endpoint dedicado `PUT /auth/preferencias` (mesmo grupo
  de `POST /auth/trocar-senha`: operação sobre a própria conta via claims do JWT, não um
  cadastro de terceiros). `GET /auth/eu` passa a consultar o banco (hoje só ecoa claims
  do JWT) para devolver as preferências atualizadas sem exigir novo login.
- Frontend: como todo token de cor já é uma CSS custom property (`tailwind.config.js`
  lê de `var(--...)`, nunca hex solto), tema e alto-contraste são só redefinições dessas
  variáveis sob seletores de atributo (`[data-tema="escuro"]`,
  `[data-alto-contraste="true"]`) — nenhum componente muda. Densidade e tamanho de fonte
  exigem tocar `tailwind.config.js`: a escala de espaçamento/fonte hoje é `px` fixo (não
  escala com o `font-size` da raiz); convertida para `rem` para permitir
  `html[data-fonte="grande"] { font-size: 112.5%; }` escalar tudo proporcionalmente sem
  reescrever nenhum componente. `min-h-linha`/`min-h-linha-confortavel` (só 2 arquivos,
  `Tabela.tsx` e `NavegacaoLateral.tsx`) viram uma única variável `--altura-linha`
  trocada por densidade.
- Aplicação sem flash: um script síncrono em `index.html` (antes do bundle React
  carregar) lê `localStorage` e aplica os atributos `data-tema`/`data-alto-contraste`/
  `data-densidade`/`data-fonte` no `<html>` imediatamente. O React só reconcilia com o
  valor autoritativo (backend) depois de montar, e re-grava o cache local quando muda.

**Tech Stack:** sem dependência nova em nenhum dos dois lados. TDD, testes contra
Postgres real via `testsupport.BancoMigrado`. Toda execução (build/test/lint) via
Docker.

## Decisões de pré-voo

- **`PUT /auth/preferencias`, não um cadastro de "Usuários"**: não existe uma tela de
  gestão de usuários ainda (fora de escopo desta fase) — a única operação existente
  sobre a própria conta é `POST /auth/trocar-senha`, no mesmo `AuthHandler`. Preferências
  seguem o mesmo padrão: sempre a própria conta, nunca um `:id` de terceiro.
- **`GET /auth/eu` muda de comportamento** (hoje só ecoa claims do JWT — não é chamado
  por nenhuma tela do frontend hoje, greenfield seguro): passa a consultar
  `usuario.Repositorio.BuscarPorID`, devolvendo o `usuario.Usuario` completo (igual ao
  que já vem em `POST /auth/login`). Sem isso, mudar uma preferência só refletiria depois
  de um novo login.
- **Preferências não entram no JWT nem em `sessionStorage`** (onde já vive a sessão,
  deliberadamente mínima: só credencial + identidade). Vivem em `localStorage` (cache
  para aplicar sem flash, sobrevive ao fechar a aba) e no banco (fonte de verdade).
- **Alto Contraste é independente do Tema**: dois eixos ortogonais (claro/escuro ×
  contraste normal/alto), não uma quarta opção de tema.
- **Conversão px→rem no `tailwind.config.js`**: mecânica, sem mudança visual em
  `tamanho_fonte = 'padrao'` (100% = comportamento idêntico ao de hoje, `px` e `rem`
  coincidem na raiz de 16px). Só as escalas `fontSize`, `spacing` e `minHeight` mudam de
  unidade — `borderRadius`/`boxShadow` continuam em `px` (não devem escalar com fonte).
- Branch: `feat/aparencia-preferencias`, empilhada sobre `feat/necessidade-compra-relatorios`
  (PR ainda aberto).

---

## Backend

### Task B1: Migration + `usuario.Usuario` ganha as preferências

**Files:** `backend/internal/infra/db/migrations/009_criar_preferencias_usuario.sql`,
`backend/internal/domain/usuario/usuario.go` (+ teste)

```sql
ALTER TABLE usuarios
  ADD COLUMN tema VARCHAR(20) NOT NULL DEFAULT 'automatico',
  ADD COLUMN alto_contraste BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN densidade VARCHAR(20) NOT NULL DEFAULT 'confortavel',
  ADD COLUMN tamanho_fonte VARCHAR(20) NOT NULL DEFAULT 'padrao',
  ADD CONSTRAINT chk_usuario_tema CHECK (tema IN ('claro', 'escuro', 'automatico')),
  ADD CONSTRAINT chk_usuario_densidade CHECK (densidade IN ('compacta', 'confortavel')),
  ADD CONSTRAINT chk_usuario_tamanho_fonte CHECK (tamanho_fonte IN ('padrao', 'grande', 'extra-grande'));
```

Em `usuario.go`, novo tipo `Preferencias` (campos soltos em `Usuario`, não aninhados —
mais simples de fazer `SELECT`/`UPDATE` direto, e o JSON de `Usuario` já é o contrato de
`/auth/login`/`/auth/eu`):

```go
const (
	TemaClaro      = "claro"
	TemaEscuro     = "escuro"
	TemaAutomatico = "automatico"

	DensidadeCompacta    = "compacta"
	DensidadeConfortavel = "confortavel"

	FontePadrao       = "padrao"
	FonteGrande       = "grande"
	FonteExtraGrande  = "extra-grande"
)

var ErrPreferenciaInvalida = errors.New("preferencia de aparencia invalida")

// Preferencias sao os campos informados em PUT /auth/preferencias.
type Preferencias struct {
	Tema          string
	AltoContraste bool
	Densidade     string
	TamanhoFonte  string
}

func (p Preferencias) Validar() error {
	temasValidos := []string{TemaClaro, TemaEscuro, TemaAutomatico}
	densidadesValidas := []string{DensidadeCompacta, DensidadeConfortavel}
	fontesValidas := []string{FontePadrao, FonteGrande, FonteExtraGrande}
	if !slices.Contains(temasValidos, p.Tema) ||
		!slices.Contains(densidadesValidas, p.Densidade) ||
		!slices.Contains(fontesValidas, p.TamanhoFonte) {
		return ErrPreferenciaInvalida
	}
	return nil
}
```

E em `Usuario`, os 4 campos soltos:

```go
	Tema          string `json:"tema"`
	AltoContraste bool   `json:"alto_contraste"`
	Densidade     string `json:"densidade"`
	TamanhoFonte  string `json:"tamanho_fonte"`
```

- [ ] Teste: `Preferencias.Validar()` aceita a combinação padrão e rejeita cada campo
  fora do conjunto permitido (4 casos: tema/densidade/fonte inválidos + happy path).
- [ ] Commit: `feat(backend): migration e validacao de preferencias de aparencia`

### Task B2: `Repositorio.AtualizarPreferencias` + `BuscarPorID` já existe

**Files:** `backend/internal/domain/usuario/repositorio.go`,
`backend/internal/infra/repository/usuario_repo.go` (+ teste)

`BuscarPorID` já existe (usado por `TrocarSenha`) — só precisa devolver os 4 campos
novos no `SELECT` (ajustar `colunasUsuario` se o repo usa uma constante assim; senão
ajustar cada `SELECT`/`Scan` que monta `usuario.Usuario`). Novo método:

```go
// Repositorio ganha:
AtualizarPreferencias(ctx context.Context, id int64, p Preferencias) error
```

```go
func (r *UsuarioRepositorio) AtualizarPreferencias(ctx context.Context, id int64, p usuario.Preferencias) error {
	etiqueta, err := r.pool.Exec(ctx,
		`UPDATE usuarios SET tema = $2, alto_contraste = $3, densidade = $4, tamanho_fonte = $5 WHERE id = $1`,
		id, p.Tema, p.AltoContraste, p.Densidade, p.TamanhoFonte)
	if err != nil {
		return fmt.Errorf("atualizar preferencias: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return usuario.ErrNaoEncontrado
	}
	return nil
}
```

- [ ] Teste (`testsupport.BancoMigrado`): `AtualizarPreferencias` grava e `BuscarPorID`
  devolve os novos valores; usuário inexistente devolve `ErrNaoEncontrado`; `BuscarPorID`
  de um usuário recém-criado (sem preferências definidas) devolve os defaults da
  migration (`automatico`/`false`/`confortavel`/`padrao`).
- [ ] Commit: `feat(backend): repositorio grava e le preferencias de aparencia`

### Task B3: `ServicoAutenticacao.AtualizarPreferencias` + `Eu` consulta o banco

**Files:** `backend/internal/domain/auth/autenticacao.go`,
`backend/internal/api/handlers/auth.go` (+ testes)

```go
// autenticacao.go
func (s *ServicoAutenticacao) AtualizarPreferencias(ctx context.Context, usuarioID int64, p usuario.Preferencias) (*usuario.Usuario, error) {
	if err := p.Validar(); err != nil {
		return nil, err
	}
	if err := s.repo.AtualizarPreferencias(ctx, usuarioID, p); err != nil {
		return nil, err
	}
	u, err := s.repo.BuscarPorID(ctx, usuarioID)
	if err != nil {
		return nil, err
	}
	u.SenhaHash = ""
	return u, nil
}
```

Handler:

```go
type preferenciasRequest struct {
	Tema          string `json:"tema" validate:"required"`
	AltoContraste bool   `json:"alto_contraste"`
	Densidade     string `json:"densidade" validate:"required"`
	TamanhoFonte  string `json:"tamanho_fonte" validate:"required"`
}

func (h *AuthHandler) AtualizarPreferencias(c echo.Context) error {
	claims := middleware.ClaimsDoContexto(c)
	if claims == nil {
		return httpx.NaoAutorizado(c, "Token de acesso ausente")
	}
	var req preferenciasRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}

	atualizado, err := h.servico.AtualizarPreferencias(c.Request().Context(), claims.UsuarioID, usuario.Preferencias{
		Tema: req.Tema, AltoContraste: req.AltoContraste, Densidade: req.Densidade, TamanhoFonte: req.TamanhoFonte,
	})
	if err != nil {
		if errors.Is(err, usuario.ErrPreferenciaInvalida) {
			return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoErroValidacao, err.Error())
		}
		return httpx.ErroInterno(c)
	}
	return httpx.OK(c, atualizado)
}
```

E `Eu` reescrito para consultar o banco (troca o `map[string]any` manual pelo
`usuario.Usuario` de verdade):

```go
func (h *AuthHandler) Eu(c echo.Context) error {
	claims := middleware.ClaimsDoContexto(c)
	if claims == nil {
		return httpx.NaoAutorizado(c, "Token de acesso ausente")
	}
	u, err := h.servico.BuscarUsuarioAtual(c.Request().Context(), claims.UsuarioID)
	if err != nil {
		return httpx.NaoAutorizado(c, "Usuario nao encontrado")
	}
	return httpx.OK(c, u)
}
```

(`BuscarUsuarioAtual` é um passthrough fino em `ServicoAutenticacao` para
`repo.BuscarPorID` + zerar `SenhaHash` — mesmo padrão de `AtualizarPreferencias`.)

Rota nova em `Registrar`: `protegida.PUT("/auth/preferencias", handler.AtualizarPreferencias)`
(mesmo grupo protegido de `trocar-senha`).

- [ ] Teste: `PUT /auth/preferencias` com corpo válido responde 200 com os campos
  atualizados; tema/densidade/fonte fora do conjunto permitido responde 400; sem token
  responde 401; `GET /auth/eu` reflete uma preferência salva sem precisar de novo login.
- [ ] Commit: `feat(backend): endpoint de preferencias de aparencia e Eu consulta o banco`

### Task B4: Verificação final do backend

- [ ] `go build/vet/gofmt/test ./...` limpo (via Docker).
- [ ] Fluxo manual via curl: login → `GET /auth/eu` mostra os defaults → `PUT
  /auth/preferencias` com `{tema: "escuro", alto_contraste: true, densidade: "compacta",
  tamanho_fonte: "grande"}` → `GET /auth/eu` reflete os 4 campos sem novo login.
- [ ] Commit: `feat(backend): wiring final das preferencias de aparencia`

---

## Frontend

### Task F1: Tokens — dark mode, alto contraste, densidade e fonte em rem

**Files:** `frontend/src/estilos/tokens.css`, `frontend/tailwind.config.js`

`tokens.css` ganha os blocos de override (mesma lista de variáveis, valores diferentes):

```css
:root[data-tema='escuro'] {
  --surface-base: #0b0f14;
  --surface-raised: #151b23;
  --surface-sunken: #1c232c;
  --border-subtle: #2a323d;
  --border-strong: #4b5563;
  --text-primary: #f3f4f6;
  --text-secondary: #b0b8c1;
  --text-disabled: #6b7280;
  --brand: #4a9eef;
  --brand-hover: #6ab0f2;
  --brand-subtle: #16324d;
  --focus-ring: #4a9eef;
  --state-done: #3fbd77;
  --state-done-bg: #103322;
  --state-pending: #f2685c;
  --state-pending-bg: #3a1512;
  --state-warning: #f0a04b;
  --state-warning-bg: #3a2510;
  --state-blocked: #a78bfa;
  --state-blocked-bg: #241a3a;
  --state-neutral: #b0b8c1;
  --state-neutral-bg: #232a33;
}

:root[data-alto-contraste='true'] {
  --text-primary: #000000;
  --text-secondary: #1f2937;
  --border-strong: #000000;
  --focus-ring: #000000;
}
:root[data-tema='escuro'][data-alto-contraste='true'] {
  --text-primary: #ffffff;
  --text-secondary: #e5e7eb;
  --border-strong: #ffffff;
  --focus-ring: #ffffff;
  --surface-base: #000000;
  --surface-raised: #000000;
}

:root[data-densidade='compacta'] {
  --altura-linha: 40px;
}
:root:not([data-densidade='compacta']) {
  --altura-linha: 48px;
}

:root[data-fonte='grande'] { font-size: 112.5%; }
:root[data-fonte='extra-grande'] { font-size: 125%; }
```

`tailwind.config.js`: `fontSize`, `spacing` e `minHeight.toque` convertidos de `px` para
`rem` (`px / 16`), preservando os mesmos valores visuais em 100%. `minHeight.linha`
e `linha-confortavel` são substituídos por uma única entrada `linha: 'var(--altura-linha)'`
(remove `linha-confortavel` — os dois usos existentes, `Tabela.tsx` e
`NavegacaoLateral.tsx`, já usam só `min-h-linha`, confirmado antes de implementar; se
algum lugar usar `linha-confortavel` a busca global vai pegar antes do commit).

- [ ] Verificar manualmente (sem teste automatizado — é CSS puro) que `data-tema=escuro`
  e `data-alto-contraste=true` mudam as cores visualmente sem editar nenhum componente.
- [ ] Commit: `feat(frontend): tokens de tema escuro, alto contraste, densidade e fonte`

### Task F2: Aplicar os atributos sem flash + hook de preferências

**Files:** `frontend/index.html`, `frontend/src/store/preferencias.ts` (+ teste),
`frontend/src/main.tsx`

Script síncrono em `index.html`, antes do `<script type="module" src="/src/main.tsx">`:

```html
<script>
  (function () {
    try {
      var p = JSON.parse(localStorage.getItem('pcp.preferencias') || '{}');
      var el = document.documentElement;
      var tema = p.tema === 'claro' || p.tema === 'escuro' ? p.tema
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
      el.setAttribute('data-tema', tema);
      if (p.alto_contraste) el.setAttribute('data-alto-contraste', 'true');
      el.setAttribute('data-densidade', p.densidade === 'compacta' ? 'compacta' : 'confortavel');
      el.setAttribute('data-fonte', p.tamanho_fonte || 'padrao');
    } catch (e) {}
  })();
</script>
```

Store Zustand `usePreferencias` (mesmo padrão de `useToasts`/`useAutenticacao`):
`aplicar(preferencias)` grava no `localStorage` (chave `pcp.preferencias`) e seta os
atributos no `<html>` (mesma lógica do script acima, reaproveitada — extrair a resolução
de tema automático para uma função pura testável). Chamado:
- ao concluir login (`entrar` em `useAutenticacao` já recebe `usuario` com as
  preferências — a tela de login despacha `usePreferencias.getState().aplicar(usuario)`);
- ao salvar uma alteração na tela de preferências (Task F3).

- [ ] Teste: `resolverTema('automatico', true)` (prefere-se escuro) devolve `'escuro'`;
  `aplicar()` grava no localStorage e seta os atributos certos no `document.documentElement`.
- [ ] Commit: `feat(frontend): aplicacao de preferencias sem flash de tema`

### Task F3: Tela de Preferências

**Files:** `frontend/src/paginas/Preferencias.tsx` + teste, `frontend/src/servicos/auth.ts`
(ou onde hoje mora `trocarSenha`, adicionar `atualizarPreferencias`)

Formulário simples (sem `react-hook-form` — 4 controles independentes, sem
validação cruzada): grupo de rádio para Tema (Claro/Escuro/Automático), toggle para Alto
Contraste, grupo de rádio para Densidade (Compacta/Confortável), grupo de rádio para
Tamanho de Fonte (Padrão/Grande/Extra Grande). Cada mudança aplica **imediatamente**
(via `usePreferencias.aplicar`, otimista) e dispara a mutação de salvar no backend; erro
reverte para o valor anterior com um toast.

- [ ] Teste: mudar o tema aplica o atributo imediatamente e envia o corpo certo para
  `PUT /auth/preferencias`; erro da API reverte a seleção visual e mostra toast.
- [ ] Commit: `feat(frontend): tela de preferencias de aparencia`

### Task F4: Navegação e Ajuda

**Files:** `App.tsx`, `Cabecalho.tsx` (link para Preferências), `Ajuda.tsx` (+ testes)

Rota `/preferencias`; acesso por um botão **Preferências** no cabeçalho (mesma fileira
flat de `Ajuda`/`Sair`, sem inventar um menu suspenso que não existe em nenhum outro
lugar do sistema) — não pela navegação lateral, por ser uma configuração pessoal, não um
módulo de negócio.

- [ ] Commit: `feat(frontend): rota e acesso a preferencias pelo cabecalho`

### Task F5: Verificação final do frontend

- [ ] `npm test`/`lint`/`tsc`/`build` limpos (via Docker).
- [ ] Roteiro Playwright real: login → tema escuro aplicado imediatamente e sobrevive a
  um F5 (recarrega antes do React montar, sem flash visível no vídeo/trace) → alto
  contraste → densidade compacta encolhe as linhas da tabela → fonte grande aumenta o
  texto proporcionalmente sem quebrar layout em 1280px/800px.
- [ ] Commit (se houver ajustes).

---

## Documentação e entrega

### Task 24: Screenshots, manual e ledger

- [ ] Screenshots da tela de Preferências (tema claro e escuro lado a lado, se possível
  em duas capturas) em `docs/screenshots/`.
- [ ] Nova seção no `docs/8_MANUAL_OPERACAO.md`.
- [ ] `.superpowers/sdd/progress.md`: novo ledger "Fase 4.1 (Aparência e Preferências)".
- [ ] Commit final, push, abrir PR com base em `feat/necessidade-compra-relatorios`.
