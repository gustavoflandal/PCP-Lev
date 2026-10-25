package httpx_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type requisicaoProduto struct {
	Codigo    string  `json:"codigo" validate:"required,max=50"`
	Descricao string  `json:"descricao" validate:"required,min=5"`
	Preco     float64 `json:"preco_venda" validate:"required,gt=0"`
	Email     string  `json:"contato_email" validate:"omitempty,email"`
	LeadTime  int     `json:"lead_time_producao" validate:"required,min=1"`
}

func valida(t *testing.T) requisicaoProduto {
	t.Helper()
	return requisicaoProduto{Codigo: "VMS-01", Descricao: "Painel VMS", Preco: 5000, LeadTime: 10}
}

func TestValidarAceitaRequisicaoCompleta(t *testing.T) {
	assert.Nil(t, httpx.Validar(valida(t)))
}

func TestValidarApontaCampoObrigatorioPeloNomeJSON(t *testing.T) {
	req := valida(t)
	req.Codigo = ""

	problemas := httpx.Validar(req)

	require.Len(t, problemas, 1)
	assert.Equal(t, "codigo", problemas[0].Campo, "o campo e reportado com o nome do JSON")
	assert.Contains(t, problemas[0].Mensagem, "obrigat")
}

func TestValidarAcumulaTodosOsProblemas(t *testing.T) {
	problemas := httpx.Validar(requisicaoProduto{})

	assert.Len(t, problemas, 4, "codigo, descricao, preco_venda e lead_time_producao")
}

func TestValidarDescreveTamanhoMinimo(t *testing.T) {
	req := valida(t)
	req.Descricao = "abc"

	problemas := httpx.Validar(req)

	require.Len(t, problemas, 1)
	assert.Equal(t, "descricao", problemas[0].Campo)
	assert.Contains(t, problemas[0].Mensagem, "5")
}

func TestValidarDescreveEmailInvalido(t *testing.T) {
	req := valida(t)
	req.Email = "nao-e-email"

	problemas := httpx.Validar(req)

	require.Len(t, problemas, 1)
	assert.Equal(t, "contato_email", problemas[0].Campo)
}

func TestValidarIgnoraCampoOpcionalVazio(t *testing.T) {
	req := valida(t)
	req.Email = ""

	assert.Nil(t, httpx.Validar(req))
}
