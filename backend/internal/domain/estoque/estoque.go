// Package estoque controla o saldo de Partes/Pecas e o historico de
// movimentacoes (RF2). Reserva por OP e o status BLOQUEADO ficam para o
// Sprint 6 -- o campo QuantidadeReservada e a constante StatusBloqueado
// existem para espelhar o schema (CHECK chk_saldo_status), mas nenhum
// codigo desta sprint os escreve.
package estoque

import (
	"errors"
	"strings"
	"time"
)

// Status possiveis do saldo (CHECK chk_saldo_status da migration 002).
const (
	StatusOK        = "OK"
	StatusCritico   = "CRITICO"
	StatusBloqueado = "BLOQUEADO"
)

// Tipo de movimentacao (CHECK chk_mov_tipo). Saida fica para o Sprint 6,
// junto da baixa de estoque por abertura de OP.
const (
	TipoEntrada = "Entrada"
	TipoAjuste  = "Ajuste"
)

// Motivo da movimentacao (RF2.3). Devolucao/OP ficam para sprints futuras.
const (
	MotivoCompra = "Compra"
	MotivoAjuste = "Ajuste"
)

var (
	ErrPartePecaObrigatoria        = errors.New("informe a parte/peca")
	ErrPartePecaInexistente        = errors.New("a parte/peca informada nao existe")
	ErrQuantidadeAjusteObrigatoria = errors.New("informe a quantidade do ajuste (diferente de zero)")
	ErrMotivoAjusteObrigatorio     = errors.New("informe o motivo do ajuste")
	ErrSaldoInsuficienteParaAjuste = errors.New("o ajuste deixaria o saldo negativo")
	ErrNaoEncontrado               = errors.New("saldo de estoque nao encontrado")
	ErrMovimentacaoNaoEncontrada   = errors.New("movimentacao nao encontrada")
)

// Saldo e a posicao de estoque de uma Parte/Peca.
type Saldo struct {
	ID                  int64     `json:"id"`
	PartePecaID         int64     `json:"parte_peca_id"`
	Codigo              string    `json:"codigo"`
	Descricao           string    `json:"descricao"`
	QuantidadeAtual     int       `json:"quantidade_atual"`
	QuantidadeReservada int       `json:"quantidade_reservada"`
	Disponivel          int       `json:"disponivel"`
	EstoqueMinimo       int       `json:"estoque_minimo"`
	LocalizacaoArmazem  string    `json:"localizacao_armazem,omitempty"`
	Status              string    `json:"status"`
	UpdatedAt           time.Time `json:"updated_at"`
	UpdatedBy           *string   `json:"updated_by,omitempty"`
}

// Movimentacao e um lancamento de entrada/ajuste no historico (RF2.3).
type Movimentacao struct {
	ID               int64     `json:"id"`
	PartePecaID      int64     `json:"parte_peca_id"`
	Codigo           string    `json:"codigo_pp"`
	Tipo             string    `json:"tipo"`
	Quantidade       int       `json:"quantidade"`
	Motivo           string    `json:"motivo"`
	ReferenciaNumero *string   `json:"referencia_numero,omitempty"`
	Observacoes      string    `json:"observacoes,omitempty"`
	Usuario          *string   `json:"usuario,omitempty"`
	DataHora         time.Time `json:"data_hora"`
}

// AjusteDados sao os campos informados no ajuste manual (RF2.1).
type AjusteDados struct {
	PartePecaID int64
	// Quantidade e o delta a aplicar: positivo (entrada) ou negativo
	// (saida), nunca zero.
	Quantidade  int
	Motivo      string
	Observacoes string
}

// Normalizar limpa espacos do motivo e das observacoes.
func (d *AjusteDados) Normalizar() {
	d.Motivo = strings.TrimSpace(d.Motivo)
	d.Observacoes = strings.TrimSpace(d.Observacoes)
}

// Validar aplica as regras de forma do ajuste (nao a de saldo suficiente --
// essa depende do saldo atual, verificada pelo repositorio dentro da
// transacao, para nao correr risco de condicao de corrida).
func (d AjusteDados) Validar() error {
	if d.PartePecaID <= 0 {
		return ErrPartePecaObrigatoria
	}
	if d.Quantidade == 0 {
		return ErrQuantidadeAjusteObrigatoria
	}
	if strings.TrimSpace(d.Motivo) == "" {
		return ErrMotivoAjusteObrigatorio
	}
	return nil
}

// SituacaoDoSaldo classifica o saldo informado contra o minimo (RN5) --
// mesma regra de fronteira inclusiva de peca.PartePeca.SituacaoDoSaldo:
// saldo igual ao minimo ja e critico.
func SituacaoDoSaldo(saldo, minimo int) string {
	if saldo <= minimo {
		return StatusCritico
	}
	return StatusOK
}
