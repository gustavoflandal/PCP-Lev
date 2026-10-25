package fornecedor_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func dadosValidos() fornecedor.Dados {
	return fornecedor.Dados{
		RazaoSocial:       "Componentes Eletronicos LTDA",
		CNPJ:              "11222333000181",
		ContatoNome:       "Joao Silva",
		ContatoEmail:      "joao@componentes.com.br",
		ContatoTelefone:   "(11) 99999-9999",
		Endereco:          "Rua das Pecas, 100, Sao Paulo - SP",
		LeadTimeMedio:     7,
		CondicaoPagamento: "30 dias",
	}
}

func TestDadosValidosPassamNaValidacao(t *testing.T) {
	require.NoError(t, dadosValidos().Validar())
}

func TestCNPJEhGuardadoSoComDigitos(t *testing.T) {
	dados := dadosValidos()
	dados.CNPJ = "11.222.333/0001-81"

	dados.Normalizar()

	assert.Equal(t, "11222333000181", dados.CNPJ)
}

func TestTelefoneEhGuardadoSoComDigitos(t *testing.T) {
	dados := dadosValidos()

	dados.Normalizar()

	assert.Equal(t, "11999999999", dados.ContatoTelefone)
}

func TestEmailEhGuardadoEmMinusculas(t *testing.T) {
	dados := dadosValidos()
	dados.ContatoEmail = "  Joao@Componentes.com.BR "

	dados.Normalizar()

	assert.Equal(t, "joao@componentes.com.br", dados.ContatoEmail)
}

func TestRazaoSocialEhObrigatoria(t *testing.T) {
	dados := dadosValidos()
	dados.RazaoSocial = "   "

	require.ErrorIs(t, dados.Validar(), fornecedor.ErrRazaoSocialObrigatoria)
}

func TestCNPJInvalidoEhRejeitado(t *testing.T) {
	dados := dadosValidos()
	dados.CNPJ = "11222333000182"

	require.ErrorIs(t, dados.Validar(), fornecedor.ErrCNPJInvalido)
}

func TestCNPJFormatadoEhAceitoAposNormalizar(t *testing.T) {
	dados := dadosValidos()
	dados.CNPJ = "11.222.333/0001-81"
	dados.Normalizar()

	require.NoError(t, dados.Validar())
}

func TestEmailInvalidoEhRejeitado(t *testing.T) {
	dados := dadosValidos()
	dados.ContatoEmail = "joao-arroba-componentes"

	require.ErrorIs(t, dados.Validar(), fornecedor.ErrEmailInvalido)
}

func TestEmailVazioEhAceito(t *testing.T) {
	dados := dadosValidos()
	dados.ContatoEmail = ""

	require.NoError(t, dados.Validar())
}

func TestTelefoneComMenosDeDezDigitosEhRejeitado(t *testing.T) {
	dados := dadosValidos()
	dados.ContatoTelefone = "119999"
	dados.Normalizar()

	require.ErrorIs(t, dados.Validar(), fornecedor.ErrTelefoneInvalido)
}

func TestTelefoneFixoDeDezDigitosEhAceito(t *testing.T) {
	dados := dadosValidos()
	dados.ContatoTelefone = "(11) 3333-4444"
	dados.Normalizar()

	require.NoError(t, dados.Validar())
}

func TestTelefoneVazioEhAceito(t *testing.T) {
	dados := dadosValidos()
	dados.ContatoTelefone = ""

	require.NoError(t, dados.Validar())
}

func TestLeadTimeMedioPrecisaSerPositivo(t *testing.T) {
	dados := dadosValidos()
	dados.LeadTimeMedio = 0

	require.ErrorIs(t, dados.Validar(), fornecedor.ErrLeadTimeInvalido)
}

func TestCNPJFormatadoAparecePronoParaExibicao(t *testing.T) {
	f := fornecedor.Fornecedor{CNPJ: "11222333000181"}

	assert.Equal(t, "11.222.333/0001-81", f.CNPJFormatado())
}
