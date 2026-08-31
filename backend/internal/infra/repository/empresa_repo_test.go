package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/empresa"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuscarDevolveALinhaSemeadaPelaMigration(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoEmpresaRepositorio(testsupport.BancoMigrado(t))

	e, err := repo.Buscar(ctx)

	require.NoError(t, err)
	assert.Equal(t, "", e.RazaoSocial, "sem configuracao ainda, a razao social comeca vazia")
	// uf e VARCHAR, nao CHAR -- um bpchar sairia como "  " (preenchido com
	// espacos) em vez de "", um valor "truthy" indevido no frontend.
	assert.Equal(t, "", e.UF)
	assert.False(t, e.TemLogoClaro)
	assert.False(t, e.TemLogoEscuro)
	assert.False(t, e.TemFavicon)
}

func TestAtualizarGravaOsCamposEDevolveALinhaAtual(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoEmpresaRepositorio(testsupport.BancoMigrado(t))

	dados := empresa.Dados{
		RazaoSocial: "Industria de Paineis VMS Ltda",
		CNPJ:        "11222333000181",
		Cidade:      "Sao Jose dos Campos",
		UF:          "SP",
	}

	atualizada, err := repo.Atualizar(ctx, dados, "admin")

	require.NoError(t, err)
	assert.Equal(t, "Industria de Paineis VMS Ltda", atualizada.RazaoSocial)
	assert.Equal(t, "11222333000181", atualizada.CNPJ)
	assert.Equal(t, "Sao Jose dos Campos", atualizada.Cidade)
	require.NotNil(t, atualizada.UpdatedBy)
	assert.Equal(t, "admin", *atualizada.UpdatedBy)

	relida, err := repo.Buscar(ctx)
	require.NoError(t, err)
	assert.Equal(t, "Industria de Paineis VMS Ltda", relida.RazaoSocial)
}

func TestAtualizarSubstituiOsCamposAnteriores(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoEmpresaRepositorio(testsupport.BancoMigrado(t))

	_, err := repo.Atualizar(ctx, empresa.Dados{RazaoSocial: "Nome Antigo", CNAE: "2740-6/01"}, "admin")
	require.NoError(t, err)

	// Sempre a empresa inteira sendo salva de novo: um campo omitido no
	// segundo PUT precisa mesmo voltar a vazio, nao herdar do primeiro.
	atualizada, err := repo.Atualizar(ctx, empresa.Dados{RazaoSocial: "Nome Novo"}, "admin")

	require.NoError(t, err)
	assert.Equal(t, "Nome Novo", atualizada.RazaoSocial)
	assert.Equal(t, "", atualizada.CNAE)
}

func TestLogoClaroComecaAusenteEPodeSerGravadoERemovido(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoEmpresaRepositorio(testsupport.BancoMigrado(t))

	dados, tipo, err := repo.BuscarLogoClaro(ctx)
	require.NoError(t, err)
	assert.Nil(t, dados)
	assert.Equal(t, "", tipo)

	require.NoError(t, repo.AtualizarLogoClaro(ctx, []byte{0x89, 0x50, 0x4e, 0x47}, "image/png", "admin"))

	dados, tipo, err = repo.BuscarLogoClaro(ctx)
	require.NoError(t, err)
	assert.Equal(t, []byte{0x89, 0x50, 0x4e, 0x47}, dados)
	assert.Equal(t, "image/png", tipo)

	require.NoError(t, repo.AtualizarLogoClaro(ctx, nil, "", "admin"))

	dados, tipo, err = repo.BuscarLogoClaro(ctx)
	require.NoError(t, err)
	assert.Nil(t, dados)
	assert.Equal(t, "", tipo)
}

func TestLogoEscuroEFaviconSaoIndependentesDoLogoClaro(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoEmpresaRepositorio(testsupport.BancoMigrado(t))

	require.NoError(t, repo.AtualizarLogoEscuro(ctx, []byte("svg-escuro"), "image/svg+xml", "admin"))
	require.NoError(t, repo.AtualizarFavicon(ctx, []byte("favicon-bytes"), "image/png", "admin"))

	e, err := repo.Buscar(ctx)
	require.NoError(t, err)
	assert.False(t, e.TemLogoClaro)
	assert.True(t, e.TemLogoEscuro)
	assert.True(t, e.TemFavicon)
	// updated_by tambem e gravado numa mudanca de imagem, nao so de texto --
	// e o carimbo que o frontend usa para invalidar o preview em cache, ja
	// que a URL da imagem nao muda quando o conteudo muda.
	require.NotNil(t, e.UpdatedBy)
	assert.Equal(t, "admin", *e.UpdatedBy)

	dadosEscuro, tipoEscuro, err := repo.BuscarLogoEscuro(ctx)
	require.NoError(t, err)
	assert.Equal(t, []byte("svg-escuro"), dadosEscuro)
	assert.Equal(t, "image/svg+xml", tipoEscuro)

	dadosFavicon, tipoFavicon, err := repo.BuscarFavicon(ctx)
	require.NoError(t, err)
	assert.Equal(t, []byte("favicon-bytes"), dadosFavicon)
	assert.Equal(t, "image/png", tipoFavicon)
}
