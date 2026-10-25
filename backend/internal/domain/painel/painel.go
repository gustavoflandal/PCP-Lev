// Package painel reune os indicadores dos paineis (dashboards) por setor.
// Os numeros chegam prontos do banco -- o frontend so desenha.
// Ref: docs/superpowers/specs/2026-10-24-paineis-dashboards-design.md.
package painel

import (
	"context"
	"slices"
)

// PeriodosValidos sao os periodos (em dias) oferecidos na tela; outro valor
// cai no padrao.
var PeriodosValidos = []int{30, 90, 180, 365}

// PeriodoPadrao e o periodo quando nenhum (ou um invalido) e pedido.
const PeriodoPadrao = 90

// Ponto e um valor rotulado de grafico (uma barra, um mes, uma fatia).
type Ponto struct {
	Rotulo string  `json:"rotulo"`
	Valor  float64 `json:"valor"`
}

// Inicio e o Painel inicial: cada bloco so vem para quem ve o modulo dele.
type Inicio struct {
	Producao *InicioProducao `json:"producao,omitempty"`
	Compras  *InicioCompras  `json:"compras,omitempty"`
	Estoque  *InicioEstoque  `json:"estoque,omitempty"`
	Notas    *InicioNotas    `json:"notas,omitempty"`
	Vendas   *InicioVendas   `json:"vendas,omitempty"`
}

type InicioProducao struct {
	OPsEmAtraso       int     `json:"ops_em_atraso"`
	MetrologiaAVencer int     `json:"metrologia_a_vencer_30"`
	OPsPorEtapa       []Ponto `json:"ops_por_etapa"`
}

type InicioCompras struct {
	AReceber int `json:"pcs_a_receber"`
	EmAtraso int `json:"pcs_em_atraso"`
}

type InicioEstoque struct {
	ItensCriticos  int `json:"itens_criticos"`
	LotesAVencer30 int `json:"lotes_a_vencer_30"`
}

// InicioNotas: notas lancadas que ainda nao deram entrada no estoque
// (rascunho ou conferida).
type InicioNotas struct {
	Pendentes int `json:"pendentes"`
}

type InicioVendas struct {
	EmProducao    int `json:"em_producao"`
	ProntosEnvio  int `json:"prontos_para_envio"`
	EntreguesHoje int `json:"entregues_hoje"`
}

// Compras e o painel de Compras.
type Compras struct {
	EmAberto              int      `json:"em_aberto"`
	ValorEmAberto         float64  `json:"valor_em_aberto"`
	EmAtraso              int      `json:"em_atraso"`
	LeadTimeMedioDias     *float64 `json:"lead_time_medio_dias"`
	RecebidoNoPrazoPct    *float64 `json:"recebido_no_prazo_pct"`
	PorSituacao           []Ponto  `json:"por_situacao"`
	CompradoPorMes        []Ponto  `json:"comprado_por_mes"`
	AtrasosPorFornecedor  []Ponto  `json:"atrasos_por_fornecedor"`
	LeadTimePorFornecedor []Ponto  `json:"lead_time_por_fornecedor"`
}

// Estoque e o painel de Recebimento e estoque. Valores de custo so vem com
// a permissao de custos (nil caso contrario).
type Estoque struct {
	ValorEmEstoque     *float64 `json:"valor_em_estoque"`
	ItensCriticos      int      `json:"itens_criticos"`
	NotasPendentes     int      `json:"notas_pendentes"`
	LotesVencidos      int      `json:"lotes_vencidos"`
	LotesAVencer30     int      `json:"lotes_a_vencer_30"`
	EntradasPorMes     []Ponto  `json:"entradas_por_mes"`
	NotasPorSituacao   []Ponto  `json:"notas_por_situacao"`
	LotesPorVencimento []Ponto  `json:"lotes_por_vencimento"`
	TopValorEmEstoque  []Ponto  `json:"top_valor_em_estoque,omitempty"`
}

// Producao e o painel de Producao.
type Producao struct {
	Abertas             int      `json:"abertas"`
	Liberadas           int      `json:"liberadas"`
	ConcluidasPeriodo   int      `json:"concluidas_periodo"`
	EmAtraso            int      `json:"em_atraso"`
	LeadTimeMedioDias   *float64 `json:"lead_time_medio_dias"`
	HorasApontadas      float64  `json:"horas_apontadas"`
	PorEtapa            []Ponto  `json:"por_etapa"`
	ConcluidasPorSemana []Ponto  `json:"concluidas_por_semana"`
	HorasPorCentro      []Ponto  `json:"horas_por_centro"`
	AtrasoPorProduto    []Ponto  `json:"atraso_por_produto"`
}

// Vendas e o painel de Vendas e expedicao.
type Vendas struct {
	Carteira           float64  `json:"carteira"`
	EmAtraso           int      `json:"em_atraso"`
	EntreguePeriodo    float64  `json:"entregue_periodo"`
	OTDPct             *float64 `json:"otd_pct"`
	PorSituacao        []Ponto  `json:"por_situacao"`
	EntreguePorMes     []Ponto  `json:"entregue_por_mes"`
	OTDPorMes          []Ponto  `json:"otd_por_mes"`
	PrincipaisClientes []Ponto  `json:"principais_clientes"`
}

// Qualidade e o painel de Qualidade.
type Qualidade struct {
	Testadas              int      `json:"testadas"`
	Aprovadas             int      `json:"aprovadas"`
	Reprovadas            int      `json:"reprovadas"`
	TaxaAprovacaoPct      *float64 `json:"taxa_aprovacao_pct"`
	MetrologiaVencida     int      `json:"metrologia_vencida"`
	MetrologiaAVencer30   int      `json:"metrologia_a_vencer_30"`
	AprovacaoPorSemana    []Ponto  `json:"aprovacao_por_semana"`
	ReprovacoesPorProduto []Ponto  `json:"reprovacoes_por_produto"`
	MetrologiaPorFaixa    []Ponto  `json:"metrologia_por_faixa"`
}

// BlocosDoInicio diz quais blocos do Painel inicial o usuario pode ver.
type BlocosDoInicio struct {
	Producao, Compras, Estoque, Notas, Vendas bool
}

// Repositorio e a porta de leitura dos indicadores.
type Repositorio interface {
	Inicio(ctx context.Context, blocos BlocosDoInicio) (*Inicio, error)
	Compras(ctx context.Context, dias int) (*Compras, error)
	Estoque(ctx context.Context, dias int, comCustos bool) (*Estoque, error)
	Producao(ctx context.Context, dias int) (*Producao, error)
	Vendas(ctx context.Context, dias int) (*Vendas, error)
	Qualidade(ctx context.Context, dias int) (*Qualidade, error)
}

// Servico normaliza o periodo e delega ao repositorio.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico.
func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

// Periodo devolve o periodo pedido, ou o padrao se nao for um dos validos.
func Periodo(dias int) int {
	if slices.Contains(PeriodosValidos, dias) {
		return dias
	}
	return PeriodoPadrao
}

func (s *Servico) Inicio(ctx context.Context, b BlocosDoInicio) (*Inicio, error) {
	return s.repo.Inicio(ctx, b)
}

func (s *Servico) Compras(ctx context.Context, dias int) (*Compras, error) {
	return s.repo.Compras(ctx, Periodo(dias))
}

func (s *Servico) Estoque(ctx context.Context, dias int, comCustos bool) (*Estoque, error) {
	return s.repo.Estoque(ctx, Periodo(dias), comCustos)
}

func (s *Servico) Producao(ctx context.Context, dias int) (*Producao, error) {
	return s.repo.Producao(ctx, Periodo(dias))
}

func (s *Servico) Vendas(ctx context.Context, dias int) (*Vendas, error) {
	return s.repo.Vendas(ctx, Periodo(dias))
}

func (s *Servico) Qualidade(ctx context.Context, dias int) (*Qualidade, error) {
	return s.repo.Qualidade(ctx, Periodo(dias))
}
