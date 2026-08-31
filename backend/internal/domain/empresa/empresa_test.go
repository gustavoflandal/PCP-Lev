package empresa_test

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/empresa"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func dadosValidos() empresa.Dados {
	return empresa.Dados{
		RazaoSocial: "Industria de Paineis VMS Ltda",
		CNPJ:        "11222333000181",
		UF:          "SP",
		Email:       "contato@paineisvms.com.br",
	}
}

func TestValidarAceitaDadosCompletos(t *testing.T) {
	assert.NoError(t, dadosValidos().Validar())
}

func TestValidarExigeRazaoSocial(t *testing.T) {
	dados := dadosValidos()
	dados.RazaoSocial = "   "

	assert.ErrorIs(t, dados.Validar(), empresa.ErrRazaoSocialObrigatoria)
}

func TestValidarAceitaCNPJVazio(t *testing.T) {
	dados := dadosValidos()
	dados.CNPJ = ""

	assert.NoError(t, dados.Validar())
}

func TestValidarRejeitaCNPJComDigitoVerificadorErrado(t *testing.T) {
	dados := dadosValidos()
	dados.CNPJ = "11222333000182"

	assert.ErrorIs(t, dados.Validar(), empresa.ErrCNPJInvalido)
}

func TestValidarAceitaCNPJFormatado(t *testing.T) {
	dados := dadosValidos()
	dados.CNPJ = "11.222.333/0001-81"

	assert.NoError(t, dados.Validar())
}

func TestValidarAceitaUFVazia(t *testing.T) {
	dados := dadosValidos()
	dados.UF = ""

	assert.NoError(t, dados.Validar())
}

func TestValidarRejeitaUFForaDeDuasLetras(t *testing.T) {
	dados := dadosValidos()
	dados.UF = "SAO"

	assert.ErrorIs(t, dados.Validar(), empresa.ErrUFInvalida)
}

func TestValidarRejeitaEmailInvalido(t *testing.T) {
	dados := dadosValidos()
	dados.Email = "nao-e-email"

	assert.ErrorIs(t, dados.Validar(), empresa.ErrEmailInvalido)
}

func TestNormalizarLimpaDocumentoEEndereco(t *testing.T) {
	dados := empresa.Dados{
		RazaoSocial: "  Industria de Paineis VMS Ltda  ",
		CNPJ:        "11.222.333/0001-81",
		CEP:         "01310-100",
		UF:          " sp ",
		Email:       " Contato@PaineisVMS.com.br ",
	}

	dados.Normalizar()

	assert.Equal(t, "Industria de Paineis VMS Ltda", dados.RazaoSocial)
	assert.Equal(t, "11222333000181", dados.CNPJ)
	assert.Equal(t, "01310100", dados.CEP)
	assert.Equal(t, "SP", dados.UF)
	assert.Equal(t, "contato@paineisvms.com.br", dados.Email)
}

func pngValido(t *testing.T, largura, altura int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, largura, altura))
	img.Set(0, 0, color.RGBA{R: 10, G: 20, B: 30, A: 255})

	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	return buf.Bytes()
}

func TestValidarImagemAceitaPNGDentroDoLimite(t *testing.T) {
	tipo, err := empresa.ValidarImagem(pngValido(t, 64, 64), "image/png", false)

	require.NoError(t, err)
	assert.Equal(t, "image/png", tipo)
}

func TestValidarImagemRejeitaPNGAbaixoDaDimensaoMinima(t *testing.T) {
	_, err := empresa.ValidarImagem(pngValido(t, 10, 10), "image/png", false)

	assert.ErrorIs(t, err, empresa.ErrImagemPequenaDemais)
}

func TestValidarImagemAceitaSVGComTagRaiz(t *testing.T) {
	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>`)

	tipo, err := empresa.ValidarImagem(svg, "image/svg+xml", false)

	require.NoError(t, err)
	assert.Equal(t, "image/svg+xml", tipo)
}

func TestValidarImagemRejeitaSVGSemTagRaiz(t *testing.T) {
	_, err := empresa.ValidarImagem([]byte("nao e um svg de verdade"), "image/svg+xml", false)

	assert.ErrorIs(t, err, empresa.ErrImagemFormatoInvalido)
}

func TestValidarImagemRejeitaSVGParaFavicon(t *testing.T) {
	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`)

	_, err := empresa.ValidarImagem(svg, "image/svg+xml", true)

	assert.ErrorIs(t, err, empresa.ErrImagemFormatoInvalido)
}

func TestValidarImagemAceitaFaviconPNGPequeno(t *testing.T) {
	tipo, err := empresa.ValidarImagem(pngValido(t, 16, 16), "image/png", true)

	require.NoError(t, err)
	assert.Equal(t, "image/png", tipo)
}

func TestValidarImagemRejeitaFaviconAbaixoDaDimensaoMinima(t *testing.T) {
	_, err := empresa.ValidarImagem(pngValido(t, 8, 8), "image/png", true)

	assert.ErrorIs(t, err, empresa.ErrImagemPequenaDemais)
}

func TestValidarImagemRejeitaAcimaDoLimiteDeTamanho(t *testing.T) {
	grande := make([]byte, empresa.TamanhoMaximoFaviconBytes+1)

	_, err := empresa.ValidarImagem(grande, "image/png", true)

	assert.ErrorIs(t, err, empresa.ErrImagemMuitoGrande)
}

func TestValidarImagemRejeitaVazio(t *testing.T) {
	_, err := empresa.ValidarImagem(nil, "image/png", false)

	assert.ErrorIs(t, err, empresa.ErrImagemFormatoInvalido)
}

func TestValidarImagemRejeitaFormatoDesconhecido(t *testing.T) {
	_, err := empresa.ValidarImagem([]byte("nao e uma imagem"), "image/gif", false)

	assert.ErrorIs(t, err, empresa.ErrImagemFormatoInvalido)
}
