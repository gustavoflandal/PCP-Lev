// Package necessidadecompra cruza estoque minimo e saldo atual das
// partes/pecas para sugerir o que precisa ser comprado (RF3.2). Consulta
// pura, sem escrita: nao ha Dados/Validar/sentinelas de erro aqui -- o
// calculo mora na query do repositorio (Task B2).
//
// Formula (sem o termo "OPs Pendentes" da RF3.2 completa, que so entra na
// Fase 3 -- ainda nao existe Ordem de Producao):
//
//	Necessidade = EstoqueMinimo - SaldoAtual
package necessidadecompra

// Item e uma peca ativa cujo saldo esta abaixo do estoque minimo, com a
// quantidade sugerida para repor.
type Item struct {
	PartePecaID          int64   `json:"parte_peca_id"`
	Codigo               string  `json:"codigo"`
	Descricao            string  `json:"descricao"`
	SaldoAtual           int     `json:"saldo_atual"`
	EstoqueMinimo        int     `json:"estoque_minimo"`
	Necessidade          int     `json:"necessidade"`
	FornecedorPadraoID   *int64  `json:"fornecedor_padrao_id,omitempty"`
	FornecedorPadraoNome *string `json:"fornecedor_padrao_nome,omitempty"`
}
