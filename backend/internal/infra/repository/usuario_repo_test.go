package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuscarPorUsernameRetornaUsuarioSemeadoPelaMigration(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoUsuarioRepositorio(testsupport.BancoMigrado(t))

	u, err := repo.BuscarPorUsername(ctx, "admin")

	require.NoError(t, err)
	assert.Equal(t, "admin", u.Username)
	assert.Equal(t, usuario.PerfilAdmin, u.Perfil)
	assert.True(t, u.Ativo)
	assert.True(t, u.SenhaConfere("Admin@123"), "a senha de bootstrap do doc 008 deve conferir")
}

func TestBuscarPorUsernameIgnoraCaixa(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoUsuarioRepositorio(testsupport.BancoMigrado(t))

	u, err := repo.BuscarPorUsername(ctx, "ADMIN")

	require.NoError(t, err)
	assert.Equal(t, "admin", u.Username)
}

func TestBuscarPorUsernameRetornaNaoEncontrado(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoUsuarioRepositorio(testsupport.BancoMigrado(t))

	_, err := repo.BuscarPorUsername(ctx, "inexistente")

	require.ErrorIs(t, err, usuario.ErrNaoEncontrado)
}

func TestBuscarPorIDRetornaUsuario(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoUsuarioRepositorio(testsupport.BancoMigrado(t))
	admin, err := repo.BuscarPorUsername(ctx, "admin")
	require.NoError(t, err)

	u, err := repo.BuscarPorID(ctx, admin.ID)

	require.NoError(t, err)
	assert.Equal(t, admin.ID, u.ID)
}

func TestBuscarPorIDRetornaNaoEncontrado(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoUsuarioRepositorio(testsupport.BancoMigrado(t))

	_, err := repo.BuscarPorID(ctx, 999999)

	require.ErrorIs(t, err, usuario.ErrNaoEncontrado)
}

func TestRegistrarLoginGravaOUltimoAcesso(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoUsuarioRepositorio(testsupport.BancoMigrado(t))
	admin, err := repo.BuscarPorUsername(ctx, "admin")
	require.NoError(t, err)
	require.Nil(t, admin.UltimoLogin, "usuario recem-semeado nunca acessou")

	require.NoError(t, repo.RegistrarLogin(ctx, admin.ID))

	atualizado, err := repo.BuscarPorID(ctx, admin.ID)
	require.NoError(t, err)
	require.NotNil(t, atualizado.UltimoLogin)
	assert.WithinDuration(t, atualizado.CreatedAt, *atualizado.UltimoLogin, 60_000_000_000)
}

func TestAtualizarSenhaGravaONovoHash(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoUsuarioRepositorio(testsupport.BancoMigrado(t))
	admin, err := repo.BuscarPorUsername(ctx, "admin")
	require.NoError(t, err)

	novoHash, err := usuario.GerarHashSenha("NovaSenha@2026")
	require.NoError(t, err)
	require.NoError(t, repo.AtualizarSenha(ctx, admin.ID, novoHash, "admin"))

	atualizado, err := repo.BuscarPorID(ctx, admin.ID)
	require.NoError(t, err)
	assert.True(t, atualizado.SenhaConfere("NovaSenha@2026"))
	assert.False(t, atualizado.SenhaConfere("Admin@123"), "a senha antiga deixa de valer")
}

func TestAtualizarSenhaDeUsuarioInexistente(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoUsuarioRepositorio(testsupport.BancoMigrado(t))

	err := repo.AtualizarSenha(ctx, 999999, "hash-qualquer", "admin")

	require.ErrorIs(t, err, usuario.ErrNaoEncontrado)
}
