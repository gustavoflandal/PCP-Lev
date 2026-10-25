package handlers_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// apiUsuarios registra /usuarios e uma rota operacional (/fornecedores) para
// conferir o efeito imediato das mudancas no acesso de quem foi alterado.
func apiUsuarios(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)
	grupo := api.echo.Group("/api/v1")
	handlers.NovoUsuarioHandler(usuario.NovoServicoGestao(repository.NovoUsuarioRepositorio(pool), api.acessos), api.acessos).
		Registrar(grupo, api.autenticacao())
	handlers.NovoFornecedorHandler(fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool))).
		Registrar(grupo, api.autenticacao())
	return api
}

func criarUsuario(t *testing.T, api *apiProtegida, login, perfil string) int64 {
	t.Helper()
	rec := api.chamar(http.MethodPost, "/api/v1/usuarios", fmt.Sprintf(
		`{"username":%q,"nome":"Pessoa %s","email":"%s@exemplo.com","perfil":%q,"setor":"Montagem","senha_temporaria":"temporaria1"}`,
		login, login, login, perfil), usuario.PerfilAdmin)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return int64(dados(t, rec)["id"].(float64))
}

func TestUsuariosSoComPermissao(t *testing.T) {
	api := apiUsuarios(t)

	assert.Equal(t, http.StatusUnauthorized, api.semToken(http.MethodGet, "/api/v1/usuarios").Code)
	assert.Equal(t, http.StatusForbidden, api.chamar(http.MethodGet, "/api/v1/usuarios", "", perfilConsulta).Code)
	assert.Equal(t, http.StatusOK, api.chamar(http.MethodGet, "/api/v1/usuarios", "", usuario.PerfilAdmin).Code)
}

func TestUsuariosOpcoesSemPermissaoDePerfis(t *testing.T) {
	api := apiUsuarios(t)
	_, err := api.pool.Exec(t.Context(), `
		INSERT INTO perfis (codigo, nome, sistema) VALUES ('RH', 'Recursos humanos', FALSE);
		INSERT INTO perfil_permissoes (perfil_codigo, permissao_codigo) VALUES ('RH', 'configuracoes.usuarios')`)
	require.NoError(t, err)

	rec := api.chamar(http.MethodGet, "/api/v1/usuarios/opcoes", "", usuario.Perfil("RH"))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.NotEmpty(t, dados(t, rec)["perfis"])
	assert.NotEmpty(t, dados(t, rec)["permissoes"])
}

func TestUsuariosCriarListarEditar(t *testing.T) {
	api := apiUsuarios(t)
	id := criarUsuario(t, api, "maria.souza", "COMPRADOR")

	rec := api.chamar(http.MethodGet, "/api/v1/usuarios?busca=souza&status=ATIVO&perfil=COMPRADOR", "", usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code)
	itens := lista(t, rec)
	require.Len(t, itens, 1)
	item := itens[0].(map[string]any)
	assert.Equal(t, true, item["deve_trocar_senha"])
	assert.NotContains(t, rec.Body.String(), "senha_hash")

	rec = api.chamar(http.MethodPut, fmt.Sprintf("/api/v1/usuarios/%d", id),
		`{"nome":"Maria Souza","email":"maria@exemplo.com","perfil":"ALMOXARIFE","matricula":"M-0042","data_admissao":"2026-01-05"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "ALMOXARIFE", dados(t, rec)["perfil"])
	assert.Equal(t, "maria.souza", dados(t, rec)["username"], "login nao muda")

	// Login, e-mail e matricula sao unicos.
	rec = api.chamar(http.MethodPost, "/api/v1/usuarios",
		`{"username":"MARIA.SOUZA","nome":"Outra","email":"x@exemplo.com","perfil":"CONSULTA","senha_temporaria":"temporaria1"}`, usuario.PerfilAdmin)
	assert.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())

	rec = api.chamar(http.MethodPost, "/api/v1/usuarios",
		`{"username":"novo","nome":"Novo","email":"novo@exemplo.com","perfil":"INEXISTENTE","senha_temporaria":"temporaria1"}`, usuario.PerfilAdmin)
	assert.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
}

func TestUsuariosTrocaObrigatoriaBloqueiaAteTrocar(t *testing.T) {
	api := apiUsuarios(t)
	id := criarUsuario(t, api, "pedro.lima", "COMPRADOR")

	rec := api.chamarComo(id, http.MethodGet, "/api/v1/fornecedores", "")
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Equal(t, "TROCA_DE_SENHA_OBRIGATORIA", codigoErro(t, rec))
}

func TestUsuariosSituacaoTemEfeitoImediato(t *testing.T) {
	api := apiUsuarios(t)
	id := criarUsuario(t, api, "ana.reis", "COMPRADOR")
	_, err := api.pool.Exec(t.Context(), `UPDATE usuarios SET deve_trocar_senha = FALSE WHERE id = $1`, id)
	require.NoError(t, err)
	api.acessos.Invalidar()
	require.Equal(t, http.StatusOK, api.chamarComo(id, http.MethodGet, "/api/v1/fornecedores", "").Code)

	rec := api.chamar(http.MethodPost, fmt.Sprintf("/api/v1/usuarios/%d/situacao", id), `{"situacao":"BLOQUEADO"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.chamarComo(id, http.MethodGet, "/api/v1/fornecedores", "").Code,
		"o bloqueio vale na hora, sem esperar o token expirar")

	rec = api.chamar(http.MethodPost, fmt.Sprintf("/api/v1/usuarios/%d/situacao", id),
		`{"situacao":"INATIVO","data_desligamento":"2026-10-01"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "2026-10-01", dados(t, rec)["data_desligamento"])

	rec = api.chamar(http.MethodPost, fmt.Sprintf("/api/v1/usuarios/%d/situacao", id), `{"situacao":"ATIVO"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Nil(t, dados(t, rec)["data_desligamento"], "reativar limpa o desligamento")
	// O bloqueio subiu a versao da sessao: reativar nao ressuscita o token
	// antigo (um roubado, por exemplo) -- a pessoa entra de novo.
	rec = api.chamarComo(id, http.MethodGet, "/api/v1/fornecedores", "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), middleware.CodigoSessaoEncerrada)
}

func TestUsuariosPermissaoIndividualTemEfeitoImediato(t *testing.T) {
	api := apiUsuarios(t)
	id := criarUsuario(t, api, "lucas.dias", "CONSULTA")
	_, err := api.pool.Exec(t.Context(), `UPDATE usuarios SET deve_trocar_senha = FALSE WHERE id = $1`, id)
	require.NoError(t, err)
	api.acessos.Invalidar()
	criar := `{"razao_social":"Fornecedor Individual","cnpj":"11.222.333/0001-81","lead_time_medio":5}`
	require.Equal(t, http.StatusForbidden, api.chamarComo(id, http.MethodPost, "/api/v1/fornecedores", criar).Code)

	rec := api.chamar(http.MethodPut, fmt.Sprintf("/api/v1/usuarios/%d/permissoes/fornecedores.incluir", id),
		`{"concedida":true,"justificativa":"cobre o comprador nas ferias"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Contains(t, dados(t, rec)["efetivas"], "fornecedores.incluir")
	assert.Len(t, dados(t, rec)["individuais"], 1)
	assert.Equal(t, http.StatusCreated, api.chamarComo(id, http.MethodPost, "/api/v1/fornecedores", criar).Code)

	rec = api.chamar(http.MethodPut, fmt.Sprintf("/api/v1/usuarios/%d/permissoes/fornecedores.incluir", id),
		`{"concedida":true,"justificativa":"curta"}`, usuario.PerfilAdmin)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	rec = api.chamar(http.MethodDelete, fmt.Sprintf("/api/v1/usuarios/%d/permissoes/fornecedores.incluir", id), "", usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.NotContains(t, dados(t, rec)["efetivas"], "fornecedores.incluir")
}

func TestUsuariosRegrasContraEscalada(t *testing.T) {
	api := apiUsuarios(t)
	adminID := api.usuarioDe(usuario.PerfilAdmin)

	// Ninguem altera a si mesmo.
	rec := api.chamar(http.MethodPost, fmt.Sprintf("/api/v1/usuarios/%d/situacao", adminID), `{"situacao":"BLOQUEADO"}`, usuario.PerfilAdmin)
	assert.Equal(t, http.StatusForbidden, rec.Code)

	// Um perfil personalizado com configuracoes.usuarios (sem ser ADMIN) nao
	// cria ADMIN nem mexe em ADMIN.
	_, err := api.pool.Exec(t.Context(), `
		INSERT INTO perfis (codigo, nome, sistema) VALUES ('RH', 'Recursos humanos', FALSE);
		INSERT INTO perfil_permissoes (perfil_codigo, permissao_codigo) VALUES ('RH', 'configuracoes.usuarios')`)
	require.NoError(t, err)
	api.acessos.Invalidar()
	rh := usuario.Perfil("RH")

	rec = api.chamar(http.MethodPost, "/api/v1/usuarios",
		`{"username":"golpe","nome":"Golpe","email":"golpe@exemplo.com","perfil":"ADMIN","senha_temporaria":"temporaria1"}`, rh)
	assert.Equal(t, http.StatusForbidden, rec.Code)
	rec = api.chamar(http.MethodPost, "/api/v1/usuarios",
		`{"username":"golpe","nome":"Golpe","email":"golpe@exemplo.com","perfil":"COMPRADOR","senha_temporaria":"temporaria1"}`, rh)
	assert.Equal(t, http.StatusForbidden, rec.Code, "o COMPRADOR tem permissoes que o RH nao tem")
	rec = api.chamar(http.MethodPost, fmt.Sprintf("/api/v1/usuarios/%d/redefinir-senha", adminID), `{"senha_temporaria":"temporaria1"}`, rh)
	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestUsuariosDoisAdminsSeInativandoAoMesmoTempoNaoDeixamOSistemaSemAdmin(t *testing.T) {
	api := apiUsuarios(t)
	_, err := api.pool.Exec(t.Context(), `UPDATE usuarios SET situacao = 'INATIVO' WHERE perfil = 'ADMIN'`)
	require.NoError(t, err)
	var a, b int64
	require.NoError(t, api.pool.QueryRow(t.Context(), `
		INSERT INTO usuarios (username, nome, email, senha_hash, perfil) VALUES
		  ('adm.a', 'Adm A', 'a@exemplo.local', 'x', 'ADMIN') RETURNING id`).Scan(&a))
	require.NoError(t, api.pool.QueryRow(t.Context(), `
		INSERT INTO usuarios (username, nome, email, senha_hash, perfil) VALUES
		  ('adm.b', 'Adm B', 'b@exemplo.local', 'x', 'ADMIN') RETURNING id`).Scan(&b))
	api.acessos.Invalidar()

	codigos := make(chan int, 2)
	inativar := func(quem, alvo int64) {
		codigos <- api.chamarComo(quem, http.MethodPost, fmt.Sprintf("/api/v1/usuarios/%d/situacao", alvo), `{"situacao":"INATIVO"}`).Code
	}
	go inativar(a, b)
	go inativar(b, a)
	resultados := []int{<-codigos, <-codigos}

	var ativos int
	require.NoError(t, api.pool.QueryRow(t.Context(),
		`SELECT count(*) FROM usuarios WHERE perfil = 'ADMIN' AND situacao = 'ATIVO'`).Scan(&ativos))
	assert.Equal(t, 1, ativos, "sobra exatamente um Administrador ativo")
	assert.ElementsMatch(t, []int{http.StatusOK, http.StatusConflict}, resultados)
}

func TestUsuariosEdicaoSobreEstadoAntigoResponde409(t *testing.T) {
	api := apiUsuarios(t)
	id := criarUsuario(t, api, "carla.melo", "CONSULTA")
	// O servico leu o usuario como COMPRADOR; alguem mudou o perfil antes da
	// escrita (aqui, o estado esperado ja nao bate com o banco).
	repo := repository.NovoUsuarioRepositorio(api.pool)
	_, err := repo.AlterarSituacao(t.Context(), id, usuario.Estado{Perfil: "COMPRADOR", Situacao: usuario.SituacaoAtivo},
		usuario.SituacaoBloqueado, tempo.Data{}, "x")
	assert.ErrorIs(t, err, usuario.ErrAlteradoPorOutro)
}
