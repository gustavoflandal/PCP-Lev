// Package importacao gera o gabarito Excel e importa planilhas que preenchem
// os cadastros (clientes, fornecedores, produtos acabados e partes/pecas).
//
// A importacao e "tudo ou nada": a planilha inteira e conferida dentro de uma
// unica transacao, reaproveitando as regras dos servicos de dominio; havendo
// qualquer erro (campo invalido, referencia inexistente, duplicidade na
// propria planilha), nada e gravado e todos os erros sao devolvidos com aba,
// linha e coluna.
package importacao

import "strings"

// Nomes das abas do gabarito, na ordem em que sao importadas (quem e
// referenciado vem antes de quem referencia: fornecedores antes das pecas).
const (
	AbaClientes   = "Clientes"
	AbaFornecedor = "Fornecedores"
	AbaProdutos   = "Produtos acabados"
	AbaPecas      = "Partes e peças"

	abaInstrucoes = "Instruções"
)

// MaxLinhasPorAba limita o tamanho da planilha aceita.
const MaxLinhasPorAba = 5000

// Coluna descreve uma coluna do gabarito.
type Coluna struct {
	Titulo      string
	Obrigatoria bool
	// Exemplo e a dica de preenchimento mostrada nas instrucoes.
	Dica string
	// Opcoes, quando preenchido, vira lista suspensa na planilha.
	Opcoes []string
}

// Aba descreve uma aba do gabarito.
type Aba struct {
	Nome    string
	Colunas []Coluna
}

var opcoesSimNao = []string{"Sim", "Não"}

var opcoesTipoCliente = []string{"Órgão público", "Concessionária", "Integrador", "Outro"}

var opcoesUF = []string{
	"AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB",
	"PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
}

// Abas e o modelo do gabarito.
var Abas = []Aba{
	{Nome: AbaClientes, Colunas: []Coluna{
		{Titulo: "Tipo", Obrigatoria: true, Dica: "Órgão público, Concessionária, Integrador ou Outro", Opcoes: opcoesTipoCliente},
		{Titulo: "Razão social", Obrigatoria: true, Dica: "Até 255 caracteres"},
		{Titulo: "CNPJ", Obrigatoria: true, Dica: "Com ou sem pontuação; identifica o cliente (não pode repetir)"},
		{Titulo: "Nome fantasia", Dica: "Até 255 caracteres"},
		{Titulo: "Inscrição estadual", Dica: "Até 30 caracteres"},
		{Titulo: "Contato", Dica: "Nome do contato (até 100 caracteres)"},
		{Titulo: "E-mail do contato"},
		{Titulo: "Telefone do contato", Dica: "Com DDD, 10 ou 11 dígitos"},
		{Titulo: "Endereço"},
		{Titulo: "Cidade"},
		{Titulo: "UF", Opcoes: opcoesUF},
		{Titulo: "Número do contrato"},
		{Titulo: "Vigência do contrato (início)", Dica: "Data no formato AAAA-MM-DD ou DD/MM/AAAA"},
		{Titulo: "Vigência do contrato (fim)", Dica: "Data; não pode ser anterior ao início"},
		{Titulo: "Condição de pagamento"},
		{Titulo: "Observações"},
	}},
	{Nome: AbaFornecedor, Colunas: []Coluna{
		{Titulo: "Razão social", Obrigatoria: true},
		{Titulo: "CNPJ", Obrigatoria: true, Dica: "Com ou sem pontuação; identifica o fornecedor (não pode repetir)"},
		{Titulo: "Lead time médio (dias)", Obrigatoria: true, Dica: "Número inteiro maior que zero"},
		{Titulo: "Contato"},
		{Titulo: "E-mail do contato"},
		{Titulo: "Telefone do contato", Dica: "Com DDD"},
		{Titulo: "Endereço"},
		{Titulo: "Condição de pagamento"},
	}},
	{Nome: AbaProdutos, Colunas: []Coluna{
		{Titulo: "Código", Obrigatoria: true, Dica: "Identifica o produto (não pode repetir); gravado em maiúsculas"},
		{Titulo: "Descrição", Obrigatoria: true, Dica: "Mínimo de 5 caracteres"},
		{Titulo: "Unidade", Obrigatoria: true, Dica: "Ex.: UN, KG, M"},
		{Titulo: "Preço de venda", Obrigatoria: true, Dica: "Maior que zero, até 2 casas decimais (ex.: 1500,00)"},
		{Titulo: "Lead time de produção (dias)", Obrigatoria: true, Dica: "Número inteiro maior que zero"},
		{Titulo: "Exige metrologia", Dica: "Sim ou Não (padrão: Não)", Opcoes: opcoesSimNao},
		{Titulo: "Pode ser componente", Dica: "Sim ou Não (padrão: Não)", Opcoes: opcoesSimNao},
		{Titulo: "Controla número de série", Opcoes: opcoesSimNao},
		{Titulo: "Controla lote", Opcoes: opcoesSimNao},
		{Titulo: "Controla validade", Dica: "Só com 'Controla lote' = Sim", Opcoes: opcoesSimNao},
		{Titulo: "Item crítico", Opcoes: opcoesSimNao},
		{Titulo: "Exige certificado", Opcoes: opcoesSimNao},
	}},
	{Nome: AbaPecas, Colunas: []Coluna{
		{Titulo: "Código", Obrigatoria: true, Dica: "Identifica a peça (não pode repetir); gravado em maiúsculas"},
		{Titulo: "Descrição", Obrigatoria: true, Dica: "Mínimo de 5 caracteres"},
		{Titulo: "Unidade", Obrigatoria: true},
		{Titulo: "Estoque mínimo", Obrigatoria: true, Dica: "Inteiro, zero ou mais"},
		{Titulo: "Estoque máximo", Obrigatoria: true, Dica: "Inteiro, maior que o mínimo"},
		{Titulo: "Lead time de compra (dias)", Obrigatoria: true, Dica: "Inteiro maior que zero"},
		{Titulo: "CNPJ do fornecedor padrão", Dica: "Deve existir no sistema ou na aba Fornecedores desta planilha"},
		{Titulo: "Validade mínima (dias)", Dica: "0 a 3650"},
		{Titulo: "Máscara do número de série", Dica: "Expressão regular (opcional)"},
		{Titulo: "Controla número de série", Opcoes: opcoesSimNao},
		{Titulo: "Controla lote", Opcoes: opcoesSimNao},
		{Titulo: "Controla validade", Dica: "Só com 'Controla lote' = Sim", Opcoes: opcoesSimNao},
		{Titulo: "Item crítico", Opcoes: opcoesSimNao},
		{Titulo: "Exige certificado", Opcoes: opcoesSimNao},
	}},
}

// tituloCelula e o texto do cabecalho no gabarito: obrigatorias levam " *".
func (c Coluna) tituloCelula() string {
	if c.Obrigatoria {
		return c.Titulo + " *"
	}
	return c.Titulo
}

// normalizarTitulo compara cabecalhos sem diferenciar caixa, espacos e o "*".
func normalizarTitulo(texto string) string {
	texto = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(texto), "*"))
	return strings.ToLower(strings.Join(strings.Fields(texto), " "))
}

// Erro e uma inconsistencia encontrada na planilha.
type Erro struct {
	Aba      string `json:"aba"`
	Linha    int    `json:"linha"`
	Coluna   string `json:"coluna,omitempty"`
	Mensagem string `json:"mensagem"`
}

// ResumoAba conta o que aconteceu com as linhas de uma aba.
type ResumoAba struct {
	Aba        string `json:"aba"`
	Lidas      int    `json:"lidas"`
	Importadas int    `json:"importadas"`
	// Ignoradas: o registro ja existia no sistema e foi mantido como estava.
	Ignoradas int `json:"ignoradas"`
}

// Resultado e a resposta da importacao.
type Resultado struct {
	// Importado e true so quando nao houve erro e tudo foi gravado.
	Importado bool        `json:"importado"`
	Resumo    []ResumoAba `json:"resumo"`
	Erros     []Erro      `json:"erros"`
}
