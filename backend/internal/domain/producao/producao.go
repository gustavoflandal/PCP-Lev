// Package producao contem a Ordem de Producao e o que acontece com ela: a
// liberacao (reserva de material), o Kanban de quatro etapas fixas (RN3), o
// apontamento, os numeros de serie com teste e metrologia e o custo real
// (doc 0, RF5 e secao 5.1). Spec: docs/superpowers/specs/2026-10-24-producao-design.md.
package producao

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// Status da OP (CHECK chk_op_status da migration 017).
const (
	StatusAberta    = "Aberta"
	StatusLiberada  = "Liberada"
	StatusConcluida = "Concluida"
	StatusCancelada = "Cancelada"
)

// Etapas fixas do Kanban (RN3), na ordem do fluxo.
const (
	EtapaSeparacao = "Separacao"
	EtapaMontagem  = "Montagem"
	EtapaTestes    = "Testes"
	EtapaExpedicao = "Expedicao"
)

// Etapas e a sequencia obrigatoria.
var Etapas = []string{EtapaSeparacao, EtapaMontagem, EtapaTestes, EtapaExpedicao}

// StatusPermitidos e o conjunto do filtro `status` da listagem.
var StatusPermitidos = []string{StatusAberta, StatusLiberada, StatusConcluida, StatusCancelada}

// ColunasOrdenaveis restringe o `ordenar_por` da listagem.
var ColunasOrdenaveis = []string{"numero_op", "data_conclusao_prevista", "status", "etapa_atual", "created_at"}

// Status de numero de serie.
const (
	SerieEmProducao = "Em Producao"
	SerieAprovado   = "Aprovado"
	SerieReprovado  = "Reprovado"
	SerieEmEstoque  = "Em Estoque"
	SerieExpedido   = "Expedido"
	SerieCancelado  = "Cancelado"
)

// ProximaEtapa devolve a etapa seguinte; "" quando a atual e a ultima.
func ProximaEtapa(atual string) string {
	for i, e := range Etapas {
		if e == atual && i+1 < len(Etapas) {
			return Etapas[i+1]
		}
	}
	return ""
}

// EtapaDoCentro converte a etapa do centro de trabalho (SEPARACAO...) para a
// da OP (Separacao...).
func EtapaDoCentro(etapaCentro string) string {
	for _, e := range Etapas {
		if strings.EqualFold(e, etapaCentro) {
			return e
		}
	}
	return ""
}

var (
	ErrNaoEncontrada          = errors.New("ordem de producao nao encontrada")
	ErrItemNaoEncontrado      = errors.New("item de pedido de venda nao encontrado")
	ErrItemJaTemOP            = errors.New("este item ja tem uma ordem de producao")
	ErrPedidoNaoPermiteOP     = errors.New("so e possivel gerar OP de pedido Aberto ou Em Producao")
	ErrSemEstruturaAtiva      = errors.New("o produto nao tem estrutura (BOM) ativa -- cadastre antes de gerar a OP")
	ErrStatusInvalidoParaAcao = errors.New("esta acao nao e permitida na situacao atual da OP")
	ErrMaterialInsuficiente   = errors.New("nao ha material disponivel para liberar a OP")
	ErrApontamentoAberto      = errors.New("ja existe um apontamento em andamento nesta OP -- encerre-o antes")
	ErrSemApontamentoAberto   = errors.New("nao ha apontamento seu em andamento nesta OP")
	ErrCentroInvalido         = errors.New("escolha um centro de trabalho ativo da etapa atual da OP")
	ErrSemApontamentoNaEtapa  = errors.New("encerre ao menos um apontamento nesta etapa antes de avancar")
	ErrSeriesPendentes        = errors.New("todas as unidades precisam estar aprovadas no teste antes de avancar")
	ErrMetrologiaPendente     = errors.New("este produto exige metrologia -- registre-a em todas as unidades antes de avancar")
	ErrOPJaConsumiu           = errors.New("o material desta OP ja foi consumido -- ela nao pode mais ser cancelada")
	ErrSerieNaoEncontrada     = errors.New("numero de serie nao encontrado")
	ErrSerieForaDeTeste       = errors.New("o resultado de teste so e registrado com a OP na etapa Testes")
	ErrResultadoObrigatorio   = errors.New("descreva o resultado do teste (ate 500 caracteres) -- obrigatorio na reprovacao")
	ErrProdutoSemMetrologia   = errors.New("este produto nao exige metrologia")
	ErrMetrologiaInvalida     = errors.New("informe aprovacao de modelo, lacre (ate 60 caracteres), data de verificacao e validade posterior a ela")
	ErrObservacoesLongas      = errors.New("as observacoes vao ate 500 caracteres")
)

// Falta descreve uma peca sem saldo disponivel para liberar a OP.
type Falta struct {
	PartePecaID int64  `json:"parte_peca_id"`
	Codigo      string `json:"codigo"`
	Descricao   string `json:"descricao"`
	Necessaria  int    `json:"necessaria"`
	Disponivel  int    `json:"disponivel"`
}

// ErroDeFalta carrega a lista do que falta (resposta 409 com detalhes).
type ErroDeFalta struct{ Faltas []Falta }

func (e *ErroDeFalta) Error() string { return ErrMaterialInsuficiente.Error() }
func (e *ErroDeFalta) Unwrap() error { return ErrMaterialInsuficiente }

// OrdemProducao e a OP como aparece em listas e no Kanban.
type OrdemProducao struct {
	ID                int64  `json:"id"`
	NumeroOP          string `json:"numero_op"`
	PedidoVendaID     int64  `json:"pedido_venda_id"`
	NumeroPedido      string `json:"numero_pedido"`
	ClienteNome       string `json:"cliente_nome"`
	ItemPedidoVendaID int64  `json:"item_pedido_venda_id"`
	ProdutoAcabadoID  int64  `json:"produto_acabado_id"`
	ProdutoCodigo     string `json:"produto_codigo"`
	ProdutoDescricao  string `json:"produto_descricao"`
	ExigeMetrologia   bool   `json:"exige_metrologia"`
	// ProdutoFotoURL: miniatura do produto (apontamento de montagem, Kanban).
	ProdutoFotoURL        string     `json:"produto_foto_url,omitempty"`
	Quantidade            int        `json:"quantidade"`
	EstruturaID           int64      `json:"estrutura_produto_id"`
	EstruturaVersao       int        `json:"estrutura_versao"`
	DataConclusaoPrevista tempo.Data `json:"data_conclusao_prevista"`
	DataConclusaoReal     tempo.Data `json:"data_conclusao_real,omitzero"`
	DataLiberacao         *time.Time `json:"data_liberacao,omitempty"`
	EtapaAtual            string     `json:"etapa_atual"`
	Status                string     `json:"status"`
	Observacoes           string     `json:"observacoes"`
	// ApontamentoAberto: quem esta trabalhando nela agora (Kanban).
	ApontamentoAberto *Apontamento `json:"apontamento_aberto,omitempty"`
	CreatedAt         time.Time    `json:"created_at"`
}

// Reserva e o material reservado/consumido pela OP.
type Reserva struct {
	PartePecaID          int64    `json:"parte_peca_id"`
	Codigo               string   `json:"codigo"`
	Descricao            string   `json:"descricao"`
	QuantidadeReservada  int      `json:"quantidade_reservada"`
	QuantidadeConsumida  int      `json:"quantidade_consumida"`
	Status               string   `json:"status"`
	CustoUnitarioOrcado  float64  `json:"custo_unitario_orcado,omitempty"`
	CustoUnitarioConsumo *float64 `json:"custo_unitario_consumo,omitempty"`
	// FotoURL: miniatura da peca na lista de separacao (4.1.2).
	FotoURL string `json:"foto_url,omitempty"`
}

// Apontamento e um periodo de trabalho numa etapa.
type Apontamento struct {
	ID              int64      `json:"id"`
	Etapa           string     `json:"etapa"`
	CentroID        *int64     `json:"centro_trabalho_id,omitempty"`
	CentroCodigo    string     `json:"centro_codigo"`
	CentroNome      string     `json:"centro_nome"`
	OperadorID      *int64     `json:"operador_id,omitempty"`
	OperadorNome    string     `json:"operador_nome"`
	Inicio          time.Time  `json:"inicio"`
	Fim             *time.Time `json:"fim,omitempty"`
	DuracaoMinutos  *int       `json:"duracao_minutos,omitempty"`
	CustoHoraCentro *float64   `json:"-"`
	Observacoes     string     `json:"observacoes"`
}

// Metrologia e a verificacao metrologica de uma unidade (radares, Inmetro).
type Metrologia struct {
	NumeroAprovacaoModelo string     `json:"numero_aprovacao_modelo"`
	DataVerificacao       tempo.Data `json:"data_verificacao"`
	NumeroLacre           string     `json:"numero_lacre"`
	Validade              tempo.Data `json:"validade"`
	Observacoes           string     `json:"observacoes"`
}

// Serie e uma unidade produzida.
type Serie struct {
	ID             int64       `json:"id"`
	Numero         string      `json:"numero"`
	Status         string      `json:"status"`
	ResultadoTeste string      `json:"resultado_teste"`
	TestadoPor     string      `json:"testado_por,omitempty"`
	TestadoEm      *time.Time  `json:"testado_em,omitempty"`
	ExpedidoEm     *time.Time  `json:"expedido_em,omitempty"`
	Metrologia     *Metrologia `json:"metrologia,omitempty"`
}

// Transicao e uma linha do historico do Kanban.
type Transicao struct {
	EtapaAnterior *string   `json:"etapa_anterior,omitempty"`
	EtapaNova     string    `json:"etapa_nova"`
	DataHora      time.Time `json:"data_hora"`
	Usuario       string    `json:"usuario"`
}

// Custo compara o orcado (BOM x CMP na liberacao) com o realizado.
type Custo struct {
	MaterialOrcado    float64 `json:"material_orcado"`
	MaterialRealizado float64 `json:"material_realizado"`
	MaoDeObra         float64 `json:"mao_de_obra"`
	HorasApontadas    float64 `json:"horas_apontadas"`
	TotalRealizado    float64 `json:"total_realizado"`
	CustoUnitario     float64 `json:"custo_unitario"`
	// Incompleto: peca sem custo (nunca comprada) ou centro sem custo/hora.
	Incompleto bool     `json:"incompleto"`
	Avisos     []string `json:"avisos"`
}

// Detalhe e a OP com tudo o que aconteceu nela.
type Detalhe struct {
	OrdemProducao
	Reservas     []Reserva     `json:"reservas"`
	Apontamentos []Apontamento `json:"apontamentos"`
	Series       []Serie       `json:"series"`
	Historico    []Transicao   `json:"historico"`
	Custo        *Custo        `json:"custo,omitempty"`
}

// ComponenteBOM e uma linha da BOM congelada na OP.
type ComponenteBOM struct {
	Codigo     string `json:"codigo"`
	Descricao  string `json:"descricao"`
	Quantidade int    `json:"quantidade_por_unidade"`
}

// FichaAsBuilt e a rastreabilidade de uma unidade (doc 0, 5.1.A).
type FichaAsBuilt struct {
	Serie        Serie           `json:"serie"`
	OP           OrdemProducao   `json:"ordem_producao"`
	DataPedido   tempo.Data      `json:"data_pedido"`
	Componentes  []ComponenteBOM `json:"componentes"`
	Apontamentos []Apontamento   `json:"apontamentos"`
	Historico    []Transicao     `json:"historico"`
	// Rastro de componentes (v1.2, 4.3.7): series instaladas nesta unidade e
	// lotes consumidos pela OP, com a nota e o fornecedor de origem.
	SeriesComponentes []SerieComponente `json:"series_componentes"`
	LotesConsumidos   []LoteConsumido   `json:"lotes_consumidos"`
	// Laudos e relatorios de inspecao anexados a OP (Fase 3.1).
	Documentos []DocumentoOP `json:"documentos"`
}

// DocumentoOP e um laudo/relatorio anexado a OP da unidade; a URL do
// arquivo vem de /arquivos/:id/url (confere a permissao).
type DocumentoOP struct {
	AnexoID     int64      `json:"anexo_id"`
	Categoria   string     `json:"categoria"`
	Titulo      string     `json:"titulo"`
	ArquivoID   string     `json:"arquivo_id"`
	NomeArquivo string     `json:"nome_arquivo"`
	DataEmissao tempo.Data `json:"data_emissao,omitzero"`
	CreatedAt   time.Time  `json:"created_at"`
}

// SerieComponente e a serie de um componente instalada na unidade.
type SerieComponente struct {
	PecaCodigo     string     `json:"peca_codigo"`
	PecaDescricao  string     `json:"peca_descricao"`
	Numero         string     `json:"numero"`
	NumeroLote     string     `json:"numero_lote,omitempty"`
	Nota           string     `json:"nota,omitempty"`
	NotaID         *int64     `json:"nota_id,omitempty"`
	FornecedorNome string     `json:"fornecedor_nome,omitempty"`
	DataEntrada    tempo.Data `json:"data_entrada,omitzero"`
}

// LoteConsumido e um lote de componente consumido pela OP da unidade.
type LoteConsumido struct {
	LoteID         int64      `json:"lote_id"`
	PecaCodigo     string     `json:"peca_codigo"`
	NumeroLote     string     `json:"numero_lote"`
	Validade       tempo.Data `json:"validade,omitzero"`
	Quantidade     int        `json:"quantidade"`
	FornecedorNome string     `json:"fornecedor_nome"`
	Notas          string     `json:"notas"`
}

// VencimentoMetrologia e uma unidade com verificacao vencida ou a vencer.
type VencimentoMetrologia struct {
	SerieID          int64      `json:"serie_id"`
	Numero           string     `json:"numero"`
	ProdutoCodigo    string     `json:"produto_codigo"`
	ProdutoDescricao string     `json:"produto_descricao"`
	ClienteNome      string     `json:"cliente_nome"`
	NumeroLacre      string     `json:"numero_lacre"`
	Validade         tempo.Data `json:"validade"`
	Vencida          bool       `json:"vencida"`
}

// Repositorio e a porta de persistencia. As operacoes de estado rodam em
// transacao, com as linhas travadas, e conferem o estado de novo la dentro.
type Repositorio interface {
	GerarOP(ctx context.Context, itemPedidoVendaID int64, autor string) (int64, error)
	Listar(ctx context.Context, params consulta.Parametros, etapa string) ([]OrdemProducao, int, error)
	Kanban(ctx context.Context) ([]OrdemProducao, error)
	BuscarDetalhe(ctx context.Context, id int64) (*Detalhe, error)
	Liberar(ctx context.Context, id int64, autor string) error
	Cancelar(ctx context.Context, id int64, autor string) error
	IniciarApontamento(ctx context.Context, opID, centroID, operadorID int64, observacoes string) error
	EncerrarApontamento(ctx context.Context, opID, operadorID int64, deOutros bool, observacoes string) error
	Avancar(ctx context.Context, id, usuarioID int64, autor string) error
	RegistrarTeste(ctx context.Context, serieID int64, aprovado bool, resultado string, usuarioID int64) error
	RegistrarMetrologia(ctx context.Context, serieID int64, m Metrologia, autor string) error
	FichaAsBuilt(ctx context.Context, numero string) (*FichaAsBuilt, error)
	VencimentosMetrologia(ctx context.Context, dias int) ([]VencimentoMetrologia, error)
}

// Servico reune os casos de uso da producao. A maior parte das regras de
// estado vive no repositorio, dentro da transacao, porque depende de linhas
// travadas (saldo, OP); aqui ficam as de forma.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo}
}

// GerarOP cria a OP de um item de pedido de venda.
func (s *Servico) GerarOP(ctx context.Context, itemID int64, autor string) (*Detalhe, error) {
	id, err := s.repo.GerarOP(ctx, itemID, autor)
	if err != nil {
		return nil, err
	}
	return s.repo.BuscarDetalhe(ctx, id)
}

// Listar devolve uma pagina de OPs.
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros, etapa string) ([]OrdemProducao, int, error) {
	return s.repo.Listar(ctx, params, etapa)
}

// Kanban devolve as OPs liberadas (o quadro agrupa por etapa).
func (s *Servico) Kanban(ctx context.Context) ([]OrdemProducao, error) {
	return s.repo.Kanban(ctx)
}

// BuscarDetalhe devolve a OP; sem verCustos, o custo nao sai.
func (s *Servico) BuscarDetalhe(ctx context.Context, id int64, verCustos bool) (*Detalhe, error) {
	d, err := s.repo.BuscarDetalhe(ctx, id)
	if err == nil && !verCustos {
		d.Custo = nil
		for i := range d.Reservas {
			d.Reservas[i].CustoUnitarioOrcado = 0
			d.Reservas[i].CustoUnitarioConsumo = nil
		}
	}
	return d, err
}

// Liberar reserva o material (tudo ou nada) e poe a OP no Kanban.
func (s *Servico) Liberar(ctx context.Context, id int64, autor string) error {
	return s.repo.Liberar(ctx, id, autor)
}

// Cancelar cancela a OP e devolve a reserva (antes do consumo).
func (s *Servico) Cancelar(ctx context.Context, id int64, autor string) error {
	return s.repo.Cancelar(ctx, id, autor)
}

// IniciarApontamento abre um periodo de trabalho do operador da sessao.
func (s *Servico) IniciarApontamento(ctx context.Context, opID, centroID, operadorID int64, observacoes string) error {
	observacoes = strings.TrimSpace(observacoes)
	if utf8.RuneCountInString(observacoes) > 500 {
		return ErrObservacoesLongas
	}
	if centroID <= 0 {
		return ErrCentroInvalido
	}
	return s.repo.IniciarApontamento(ctx, opID, centroID, operadorID, observacoes)
}

// EncerrarApontamento fecha o periodo em andamento do operador (ou de
// qualquer um, com deOutros).
func (s *Servico) EncerrarApontamento(ctx context.Context, opID, operadorID int64, deOutros bool, observacoes string) error {
	observacoes = strings.TrimSpace(observacoes)
	if utf8.RuneCountInString(observacoes) > 500 {
		return ErrObservacoesLongas
	}
	return s.repo.EncerrarApontamento(ctx, opID, operadorID, deOutros, observacoes)
}

// Avancar leva a OP para a proxima etapa (ou conclui, na Expedicao).
func (s *Servico) Avancar(ctx context.Context, id, usuarioID int64, autor string) error {
	return s.repo.Avancar(ctx, id, usuarioID, autor)
}

// RegistrarTeste grava aprovado/reprovado de uma unidade.
func (s *Servico) RegistrarTeste(ctx context.Context, serieID int64, aprovado bool, resultado string, usuarioID int64) error {
	resultado = strings.TrimSpace(resultado)
	if utf8.RuneCountInString(resultado) > 500 || (!aprovado && resultado == "") {
		return ErrResultadoObrigatorio
	}
	return s.repo.RegistrarTeste(ctx, serieID, aprovado, resultado, usuarioID)
}

// RegistrarMetrologia grava (ou substitui) a metrologia de uma unidade.
func (s *Servico) RegistrarMetrologia(ctx context.Context, serieID int64, m Metrologia, autor string) error {
	m.NumeroAprovacaoModelo = strings.TrimSpace(m.NumeroAprovacaoModelo)
	m.NumeroLacre = strings.TrimSpace(m.NumeroLacre)
	m.Observacoes = strings.TrimSpace(m.Observacoes)
	switch {
	case m.NumeroAprovacaoModelo == "" || utf8.RuneCountInString(m.NumeroAprovacaoModelo) > 60,
		m.NumeroLacre == "" || utf8.RuneCountInString(m.NumeroLacre) > 60,
		m.DataVerificacao.IsZero() || m.Validade.IsZero() || !m.Validade.After(m.DataVerificacao):
		return ErrMetrologiaInvalida
	case utf8.RuneCountInString(m.Observacoes) > 500:
		return ErrObservacoesLongas
	}
	return s.repo.RegistrarMetrologia(ctx, serieID, m, autor)
}

// FichaAsBuilt devolve a rastreabilidade de uma unidade pelo numero de serie.
func (s *Servico) FichaAsBuilt(ctx context.Context, numero string) (*FichaAsBuilt, error) {
	return s.repo.FichaAsBuilt(ctx, strings.TrimSpace(numero))
}

// VencimentosMetrologia lista verificacoes vencidas ou que vencem em ate `dias`.
func (s *Servico) VencimentosMetrologia(ctx context.Context, dias int) ([]VencimentoMetrologia, error) {
	if dias <= 0 || dias > 365 {
		dias = 30
	}
	return s.repo.VencimentosMetrologia(ctx, dias)
}
