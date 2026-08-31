package empresa_test

import (
	"bytes"
	"context"
	"image"
	"image/png"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/empresa"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func servicoComBanco(t *testing.T) *empresa.Servico {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return empresa.NovoServico(repository.NovoEmpresaRepositorio(pool))
}

func TestServicoAtualizarNormalizaEGrava(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)

	atualizada, err := servico.Atualizar(ctx, empresa.Dados{
		RazaoSocial: "  Industria de Paineis VMS Ltda  ",
		CNPJ:        "11.222.333/0001-81",
		UF:          " sp ",
	}, "admin")

	require.NoError(t, err)
	assert.Equal(t, "Industria de Paineis VMS Ltda", atualizada.RazaoSocial)
	assert.Equal(t, "11222333000181", atualizada.CNPJ)
	assert.Equal(t, "SP", atualizada.UF)
}

func TestServicoAtualizarRejeitaRazaoSocialVazia(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)

	_, err := servico.Atualizar(ctx, empresa.Dados{}, "admin")

	assert.ErrorIs(t, err, empresa.ErrRazaoSocialObrigatoria)
}

func pngValidoServico(t *testing.T, lado int) []byte {
	t.Helper()
	img := image.NewGray(image.Rect(0, 0, lado, lado))
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	return buf.Bytes()
}

func TestServicoAtualizarLogoClaroGravaEBuscaDevolveOsMesmosBytes(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)
	dadosPng := pngValidoServico(t, 64)

	require.NoError(t, servico.AtualizarLogoClaro(ctx, dadosPng, "image/png", "admin"))

	dados, tipo, err := servico.BuscarLogoClaro(ctx)
	require.NoError(t, err)
	assert.Equal(t, dadosPng, dados)
	assert.Equal(t, "image/png", tipo)
}

func TestServicoAtualizarLogoClaroComImagemPequenaDemaisNaoGrava(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)

	err := servico.AtualizarLogoClaro(ctx, pngValidoServico(t, 8), "image/png", "admin")

	assert.ErrorIs(t, err, empresa.ErrImagemPequenaDemais)

	dados, _, buscaErr := servico.BuscarLogoClaro(ctx)
	require.NoError(t, buscaErr)
	assert.Nil(t, dados, "upload invalido nao pode deixar bytes parciais gravados")
}

func TestServicoAtualizarLogoClaroComDadosVaziosRemove(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)
	require.NoError(t, servico.AtualizarLogoClaro(ctx, pngValidoServico(t, 64), "image/png", "admin"))

	require.NoError(t, servico.AtualizarLogoClaro(ctx, nil, "", "admin"))

	dados, tipo, err := servico.BuscarLogoClaro(ctx)
	require.NoError(t, err)
	assert.Nil(t, dados)
	assert.Equal(t, "", tipo)
}

func TestServicoAtualizarFaviconRejeitaSVG(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)
	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`)

	err := servico.AtualizarFavicon(ctx, svg, "image/svg+xml", "admin")

	assert.ErrorIs(t, err, empresa.ErrImagemFormatoInvalido)
}
