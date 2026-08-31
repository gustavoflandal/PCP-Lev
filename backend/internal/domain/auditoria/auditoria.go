// Package auditoria consulta a trilha de auditoria gravada pelos triggers
// da migration 007 (fn_registrar_auditoria). E so leitura -- a gravacao e
// automatica, disparada por INSERT/UPDATE/DELETE nas tabelas de decisao de
// negocio, nunca pela aplicacao.
package auditoria

import (
	"encoding/json"
	"errors"
	"slices"
	"time"
)

// TabelasAuditadas e a lista fechada de tabelas cobertas pelos triggers
// (migration 007) -- usada para validar o filtro `tabela` do mesmo jeito
// que um valor livre travaria a listagem inteira num nome de coluna que
// nao existe.
var TabelasAuditadas = []string{
	"usuarios", "fornecedores", "produtos_acabados", "partes_pecas",
	"estrutura_produto", "itens_estrutura_produto",
	"cotacoes", "pedidos_compra", "pedidos_venda",
	"ordens_producao", "reserva_estoque",
}

// OperacoesValidas espelha o CHECK da coluna `operacao` na migration 007.
var OperacoesValidas = []string{"INSERT", "UPDATE", "DELETE"}

var (
	ErrTabelaInvalida   = errors.New("tabela nao faz parte da trilha de auditoria")
	ErrOperacaoInvalida = errors.New("operacao deve ser INSERT, UPDATE ou DELETE")
	ErrPeriodoInvalido  = errors.New("data_inicio nao pode ser depois de data_fim")
)

// limitePadrao e o unico valor de paginacao que o dominio conhece --
// o limite maximo aceito e responsabilidade do handler, que interpreta a
// query string (mesmo padrao de platform/consulta).
const limitePadrao = 50

// Registro e uma linha da trilha. UsuarioID/UsuarioNome/EnderecoIP podem vir
// vazios em linhas gravadas antes da correcao do pinning de conexao (ver
// ledger da Fase 4, sub-entrega Auditoria) ou em acoes sem sessao associada.
type Registro struct {
	ID           int64           `json:"id"`
	Tabela       string          `json:"tabela"`
	Operacao     string          `json:"operacao"`
	RegistroID   *int64          `json:"registro_id,omitempty"`
	DadosAntigos json.RawMessage `json:"dados_antigos,omitempty"`
	DadosNovos   json.RawMessage `json:"dados_novos,omitempty"`
	UsuarioID    *int64          `json:"usuario_id,omitempty"`
	UsuarioNome  *string         `json:"usuario_nome,omitempty"`
	DataHora     time.Time       `json:"data_hora"`
	EnderecoIP   *string         `json:"endereco_ip,omitempty"`
}

// Filtros reune paginacao e os filtros de consulta (doc 0, secao 4.6.9:
// "consulta com filtros por periodo, usuario, modulo e tipo de acao").
type Filtros struct {
	Pagina     int
	Limite     int
	DataInicio *time.Time
	DataFim    *time.Time
	UsuarioID  *int64
	Tabela     string
	Operacao   string
}

// Offset converte a pagina em deslocamento para o SQL.
func (f Filtros) Offset() int {
	return (f.Pagina - 1) * f.Limite
}

// NovosFiltros aplica os padroes de paginacao (pagina 1, limite 50) --
// usado pelo handler antes de sobrescrever com o que veio na query string.
func NovosFiltros() Filtros {
	return Filtros{Pagina: 1, Limite: limitePadrao}
}

// Validar confere o conjunto fechado de tabela/operacao e a consistencia do
// periodo. Pagina/Limite sao conferidos pelo handler ao interpretar a query
// string (mesmo padrao do platform/consulta), nao aqui.
func (f Filtros) Validar() error {
	if f.Tabela != "" && !slices.Contains(TabelasAuditadas, f.Tabela) {
		return ErrTabelaInvalida
	}
	if f.Operacao != "" && !slices.Contains(OperacoesValidas, f.Operacao) {
		return ErrOperacaoInvalida
	}
	if f.DataInicio != nil && f.DataFim != nil && f.DataInicio.After(*f.DataFim) {
		return ErrPeriodoInvalido
	}
	return nil
}
