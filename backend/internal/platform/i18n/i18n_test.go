package i18n

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalizarEDeAcceptLanguage(t *testing.T) {
	assert.Equal(t, Espanhol, Normalizar("es"))
	assert.Equal(t, Espanhol, Normalizar("es-AR"))
	assert.Equal(t, Espanhol, Normalizar("ES_mx"))
	assert.Equal(t, PortuguesBR, Normalizar("pt-BR"))
	assert.Equal(t, PortuguesBR, Normalizar("en-US"))
	assert.Equal(t, PortuguesBR, Normalizar(""))
	assert.Equal(t, Espanhol, DeAcceptLanguage("es-AR,es;q=0.9,pt;q=0.8"))
	assert.Equal(t, PortuguesBR, DeAcceptLanguage("pt-BR,pt;q=0.9,es;q=0.8"))
}

func TestTraduzirExatoEModelo(t *testing.T) {
	assert.Equal(t, "Campo obligatorio", Traduzir(Espanhol, "Campo obrigatorio"))
	assert.Equal(t, "Debe tener como mínimo 10 caracteres", Traduzir(Espanhol, "Deve ter no minimo 10 caracteres"))
	assert.Equal(t, "Campo obrigatorio", Traduzir(PortuguesBR, "Campo obrigatorio"))
}

func TestTraduzirSemTraducaoDevolveOriginal(t *testing.T) {
	assert.Equal(t, "mensagem sem traducao", Traduzir(Espanhol, "mensagem sem traducao"))
}
