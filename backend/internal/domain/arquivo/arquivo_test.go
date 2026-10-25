package arquivo_test

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func pngDe(t *testing.T, largura, altura int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, largura, altura))
	img.Set(1, 1, color.RGBA{R: 255, A: 255})
	var b bytes.Buffer
	require.NoError(t, png.Encode(&b, img))
	return b.Bytes()
}

func TestPrepararDetectaPeloConteudoNaoPelaExtensao(t *testing.T) {
	a, err := arquivo.Preparar("foto.pdf", pngDe(t, 800, 400))
	require.NoError(t, err)
	assert.Equal(t, arquivo.MimePNG, a.TipoMime, "a extensao mente; o conteudo e PNG")
	assert.True(t, a.TemMiniatura)
	assert.Len(t, a.SHA256, 64)

	_, err = arquivo.Preparar("planilha.pdf", []byte("MZ\x90\x00 executavel disfarcado"))
	assert.ErrorIs(t, err, arquivo.ErrTipoNaoAceito)

	pdf, err := arquivo.Preparar("manual.pdf", []byte("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"))
	require.NoError(t, err)
	assert.Equal(t, arquivo.MimePDF, pdf.TipoMime)
	assert.False(t, pdf.TemMiniatura)

	xml, err := arquivo.Preparar("nota.xml", []byte(`<?xml version="1.0"?><nfeProc></nfeProc>`))
	require.NoError(t, err)
	assert.Equal(t, arquivo.MimeXML, xml.TipoMime)
}

func TestPrepararSanitizaONomeERespeitaLimites(t *testing.T) {
	a, err := arquivo.Preparar(`..\..\C:\temp\"lacre".png`, pngDe(t, 10, 10))
	require.NoError(t, err)
	assert.Equal(t, "lacre.png", a.NomeOriginal)

	grande := append([]byte("%PDF-1.4\n"), make([]byte, arquivo.LimiteImagem)...)
	_, err = arquivo.Preparar("ok.pdf", grande)
	assert.NoError(t, err, "PDF vai ate 25 MB")
	imagemGrande := append(pngDe(t, 10, 10), make([]byte, arquivo.LimiteImagem)...)
	_, err = arquivo.Preparar("grande.png", imagemGrande)
	assert.ErrorIs(t, err, arquivo.ErrGrandeDemais)
}

func TestURLAssinadaExpiraENaoAceitaAdulteracao(t *testing.T) {
	a := arquivo.NovoAssinador("segredo-de-teste-com-mais-de-32-caracteres")
	url, _ := a.URL("abc", true)
	assert.Contains(t, url, "/api/v1/arquivos/abc/conteudo?exp=")

	var exp, sig string
	for _, parte := range bytes.Split([]byte(url[bytes.IndexByte([]byte(url), '?')+1:]), []byte("&")) {
		kv := bytes.SplitN(parte, []byte("="), 2)
		switch string(kv[0]) {
		case "exp":
			exp = string(kv[1])
		case "sig":
			sig = string(kv[1])
		}
	}
	assert.NoError(t, a.Conferir("abc", exp, sig, true))
	assert.ErrorIs(t, a.Conferir("abc", exp, sig, false), arquivo.ErrAssinatura, "miniatura x original")
	assert.ErrorIs(t, a.Conferir("outro", exp, sig, true), arquivo.ErrAssinatura)
	assert.ErrorIs(t, a.Conferir("abc", "1", sig, true), arquivo.ErrAssinatura, "expirada")
}
