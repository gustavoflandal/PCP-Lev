package auth_test

import (
	"context"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// servicoComBanco monta o caso de uso sobre o repositorio real e o banco de
// testes ja migrado.
func servicoComBanco(t *testing.T) *auth.ServicoAutenticacao {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return auth.NovoServicoAutenticacao(
		repository.NovoUsuarioRepositorio(pool),
		auth.NovoServicoToken(segredoTeste, time.Hour),
	)
}

func TestAutenticarComCredenciaisValidasDevolveTokenEUsuario(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)

	resultado, err := servico.Autenticar(ctx, "admin", "Admin@123")

	require.NoError(t, err)
	assert.NotEmpty(t, resultado.AccessToken)
	assert.Equal(t, "Bearer", resultado.TipoToken)
	assert.Equal(t, 3600, resultado.ExpiraEm)
	assert.Equal(t, "admin", resultado.Usuario.Username)
	assert.Empty(t, resultado.Usuario.SenhaHash, "o hash nunca sai do dominio")
}

func TestAutenticarRegistraOUltimoLogin(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoUsuarioRepositorio(pool)
	servico := auth.NovoServicoAutenticacao(repo, auth.NovoServicoToken(segredoTeste, time.Hour))

	_, err := servico.Autenticar(ctx, "admin", "Admin@123")
	require.NoError(t, err)

	u, err := repo.BuscarPorUsername(ctx, "admin")
	require.NoError(t, err)
	assert.NotNil(t, u.UltimoLogin)
}

func TestAutenticarRejeitaSenhaErrada(t *testing.T) {
	ctx := context.Background()

	_, err := servicoComBanco(t).Autenticar(ctx, "admin", "senha_errada")

	require.ErrorIs(t, err, usuario.ErrCredenciaisInvalidas)
}

func TestAutenticarNaoRevelaQueOUsuarioNaoExiste(t *testing.T) {
	ctx := context.Background()

	_, err := servicoComBanco(t).Autenticar(ctx, "fantasma", "qualquer_senha")

	// Mesmo erro da senha errada: distinguir permitiria enumerar usuarios.
	require.ErrorIs(t, err, usuario.ErrCredenciaisInvalidas)
}

func TestAutenticarRecusaUsuarioInativo(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)
	_, err := pool.Exec(ctx, `UPDATE usuarios SET ativo = false WHERE username = 'admin'`)
	require.NoError(t, err)

	servico := auth.NovoServicoAutenticacao(
		repository.NovoUsuarioRepositorio(pool),
		auth.NovoServicoToken(segredoTeste, time.Hour),
	)

	_, err = servico.Autenticar(ctx, "admin", "Admin@123")

	require.ErrorIs(t, err, usuario.ErrUsuarioInativo)
}

func TestAutenticarIgnoraEspacosEmVoltaDoUsername(t *testing.T) {
	ctx := context.Background()

	resultado, err := servicoComBanco(t).Autenticar(ctx, "  admin  ", "Admin@123")

	require.NoError(t, err)
	assert.Equal(t, "admin", resultado.Usuario.Username)
}

func TestAutenticarRejeitaCredenciaisVazias(t *testing.T) {
	ctx := context.Background()

	_, err := servicoComBanco(t).Autenticar(ctx, "", "")

	require.ErrorIs(t, err, usuario.ErrCredenciaisInvalidas)
}
