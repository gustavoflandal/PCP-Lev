// Package notaentrada e o recebimento fiscal (doc 0, 4.3): toda entrada de
// insumo comprado nasce de uma nota fiscal vinculada a pedido de compra, com
// lote, validade e numero de serie capturados na digitacao. RN-001: nada
// entra no estoque sem documento de origem.
// Spec: docs/superpowers/specs/2026-10-24-v12-recebimento-fiscal-design.md.
package notaentrada

import (
	"errors"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/controle"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/documento"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// Situacoes (CHECK da migration 019).
const (
	StatusRascunho  = "Rascunho"
	StatusConferida = "Conferida"
	StatusEfetivada = "Efetivada"
	StatusCancelada = "Cancelada"
	StatusEstornada = "Estornada"
)

// StatusPermitidos e o filtro `status` da listagem.
var StatusPermitidos = []string{StatusRascunho, StatusConferida, StatusEfetivada, StatusCancelada, StatusEstornada}

// ColunasOrdenaveis restringe o `ordenar_por` da listagem.
var ColunasOrdenaveis = []string{"data_entrada", "data_emissao", "numero", "valor_total", "status", "created_at"}

// Modelos aceitos.
const (
	ModeloNFe = "55"
	Modelo1   = "01"
)

// cfopsBase sao os CFOPs de entrada aceitos (final); valem com 1, 2 ou 3 na
// frente (operacao estadual, interestadual, exterior).
var cfopsBase = []string{"101", "102", "111", "116", "120", "122", "124", "126", "401", "403", "407", "556", "910", "949"}

// CFOPAceito diz se o CFOP e de entrada aceito.
func CFOPAceito(cfop string) bool {
	return len(cfop) == 4 && strings.ContainsRune("123", rune(cfop[0])) && slices.Contains(cfopsBase, cfop[1:])
}

// ChaveAcessoValida confere 44 digitos e o digito verificador (modulo 11).
func ChaveAcessoValida(chave string) bool {
	if len(chave) != 44 || strings.Trim(chave, "0123456789") != "" {
		return false
	}
	soma, peso := 0, 2
	for i := 42; i >= 0; i-- {
		soma += int(chave[i]-'0') * peso
		peso++
		if peso > 9 {
			peso = 2
		}
	}
	dv := 11 - soma%11
	if dv >= 10 {
		dv = 0
	}
	return int(chave[43]-'0') == dv
}

var soDigitos = regexp.MustCompile(`^[0-9]+$`)

var padraoUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func uuidValido(id string) bool { return padraoUUID.MatchString(id) }

// ChaveConfereCabecalho: a chave de 44 digitos carrega CNPJ (7-20), modelo
// (21-22), serie (23-25) e numero (26-34) -- precisam ser os da nota.
func ChaveConfereCabecalho(chave, cnpj, modelo, serie, numero string) bool {
	if len(chave) != 44 {
		return false
	}
	return chave[6:20] == cnpj && chave[20:22] == modelo &&
		chave[22:25] == zerosAEsquerda(serie, 3) && chave[25:34] == zerosAEsquerda(numero, 9)
}

func zerosAEsquerda(s string, n int) string {
	if len(s) >= n {
		return s
	}
	return strings.Repeat("0", n-len(s)) + s
}

var (
	ErrNaoEncontrada          = errors.New("nota fiscal nao encontrada")
	ErrPedidoObrigatorio      = errors.New("informe o pedido de compra")
	ErrPedidoNaoRecebe        = errors.New("o pedido de compra nao esta aguardando entrega nem recebido parcial")
	ErrModeloInvalido         = errors.New("modelo deve ser 55 (NF-e) ou 01")
	ErrSerieNumero            = errors.New("informe serie (ate 3 digitos) e numero (ate 9 digitos)")
	ErrChaveInvalida          = errors.New("chave de acesso invalida: 44 digitos com digito verificador correto (obrigatoria na NF-e)")
	ErrDatasInvalidas         = errors.New("informe emissao e entrada; a entrada nao pode ser anterior a emissao nem futura")
	ErrCFOPInvalido           = errors.New("CFOP fora da lista de entradas aceitas")
	ErrCNPJEmitente           = errors.New("o CNPJ do emitente nao e o do fornecedor do pedido de compra")
	ErrValoresNegativos       = errors.New("os valores da nota nao podem ser negativos")
	ErrSemItens               = errors.New("a nota precisa de ao menos um item")
	ErrItemInvalido           = errors.New("cada item precisa de peca, quantidade da nota maior que zero e fator de conversao maior que zero")
	ErrObservacoesLongas      = errors.New("observacoes ate 1000 caracteres")
	ErrDuplicada              = errors.New("esta nota ja foi lancada")
	ErrStatusInvalidoParaAcao = errors.New("esta acao nao e permitida na situacao atual da nota")
	ErrPendencias             = errors.New("a nota tem pendencias -- corrija antes de conferir/efetivar")
	ErrDivergenciaSemAprovar  = errors.New("ha divergencia de preco acima da tolerancia: precisa de quem aprove divergencias")
	ErrMotivoObrigatorio      = errors.New("informe o motivo (de 10 a 255 caracteres)")
	ErrEstornoBloqueado       = errors.New("o material desta nota ja foi reservado, consumido ou movimentado -- corrija por ajuste de inventario justificado")
	ErrAlteradaNoMeio         = errors.New("a nota foi alterada por outra pessoa enquanto voce conferia -- abra de novo e confira")
	ErrCertificadoInvalido    = errors.New("certificado anexado invalido -- envie o arquivo de novo")
)

// Pendencia e um problema encontrado na conferencia (4.3.4).
type Pendencia struct {
	ItemOrdem *int   `json:"item_ordem,omitempty"`
	Tipo      string `json:"tipo"`
	Nivel     string `json:"nivel"` // BLOQUEIO, APROVACAO ou AVISO
	Mensagem  string `json:"mensagem"`
}

// Niveis de pendencia.
const (
	NivelBloqueio  = "BLOQUEIO"
	NivelAprovacao = "APROVACAO"
	NivelAviso     = "AVISO"
)

// LoteItem e uma subdivisao da linha da nota por lote (4.3.5).
type LoteItem struct {
	NumeroLote           string     `json:"numero_lote"`
	DataFabricacao       tempo.Data `json:"data_fabricacao,omitzero"`
	Validade             tempo.Data `json:"validade,omitzero"`
	Quantidade           int        `json:"quantidade"`
	CertificadoArquivoID *string    `json:"certificado_arquivo_id,omitempty"`
	LoteID               *int64     `json:"lote_id,omitempty"`
}

// SerieItem e um numero de serie informado (com o lote, se a peca tem lote).
type SerieItem struct {
	Numero     string `json:"numero"`
	NumeroLote string `json:"numero_lote,omitempty"`
}

// Item e uma linha da nota.
type Item struct {
	ID                       int64             `json:"id"`
	Ordem                    int               `json:"ordem"`
	ItemPedidoCompraID       *int64            `json:"item_pedido_compra_id,omitempty"`
	NumeroPC                 string            `json:"numero_pc,omitempty"`
	PartePecaID              int64             `json:"parte_peca_id"`
	PecaCodigo               string            `json:"peca_codigo"`
	PecaDescricao            string            `json:"peca_descricao"`
	PecaUnidade              string            `json:"peca_unidade"`
	Controle                 controle.Flags    `json:"controle"`
	CodigoFornecedor         string            `json:"codigo_fornecedor"`
	DescricaoNF              string            `json:"descricao_nf"`
	UnidadeNF                string            `json:"unidade_nf"`
	QuantidadeNF             float64           `json:"quantidade_nf"`
	ValorUnitario            float64           `json:"valor_unitario"`
	ValorTotal               dinheiro.Dinheiro `json:"valor_total"`
	FatorConversao           float64           `json:"fator_conversao"`
	QuantidadeRecebida       int               `json:"quantidade_recebida"`
	Bonificacao              bool              `json:"bonificacao"`
	JustificativaBonificacao string            `json:"justificativa_bonificacao"`
	CertificadoArquivoID     *string           `json:"certificado_arquivo_id,omitempty"`
	CustoUnitarioEntrada     *float64          `json:"custo_unitario_entrada,omitempty"`
	Lotes                    []LoteItem        `json:"lotes"`
	Series                   []SerieItem       `json:"series"`
	// Contexto do PC (para a conferencia na tela).
	PCPrecoUnitario    *dinheiro.Dinheiro `json:"pc_preco_unitario,omitempty"`
	PCSolicitada       *int               `json:"pc_quantidade_solicitada,omitempty"`
	PCRecebidaAnterior *int               `json:"pc_quantidade_recebida,omitempty"`
	FotoURL            string             `json:"foto_url,omitempty"`
}

// Nota e a nota fiscal de entrada.
type Nota struct {
	ID                     int64             `json:"id"`
	PedidoCompraID         int64             `json:"pedido_compra_id"`
	NumeroPC               string            `json:"numero_pc"`
	FornecedorID           int64             `json:"fornecedor_id"`
	FornecedorNome         string            `json:"fornecedor_nome"`
	CNPJEmitente           string            `json:"cnpj_emitente"`
	Modelo                 string            `json:"modelo"`
	Serie                  string            `json:"serie"`
	Numero                 string            `json:"numero"`
	ChaveAcesso            *string           `json:"chave_acesso,omitempty"`
	DataEmissao            tempo.Data        `json:"data_emissao"`
	DataEntrada            tempo.Data        `json:"data_entrada"`
	CFOP                   string            `json:"cfop"`
	ValorProdutos          dinheiro.Dinheiro `json:"valor_produtos"`
	ValorFrete             dinheiro.Dinheiro `json:"valor_frete"`
	ValorSeguro            dinheiro.Dinheiro `json:"valor_seguro"`
	ValorDesconto          dinheiro.Dinheiro `json:"valor_desconto"`
	ValorIPI               dinheiro.Dinheiro `json:"valor_ipi"`
	ValorICMSST            dinheiro.Dinheiro `json:"valor_icms_st"`
	ValorTotal             dinheiro.Dinheiro `json:"valor_total"`
	Status                 string            `json:"status"`
	Versao                 int               `json:"versao"`
	Origem                 string            `json:"origem"`
	Observacoes            string            `json:"observacoes"`
	DivergenciaAprovadaPor *string           `json:"divergencia_aprovada_por,omitempty"`
	EfetivadaEm            *time.Time        `json:"efetivada_em,omitempty"`
	EfetivadaPor           *string           `json:"efetivada_por,omitempty"`
	EstornadaEm            *time.Time        `json:"estornada_em,omitempty"`
	MotivoEstorno          *string           `json:"motivo_estorno,omitempty"`
	Itens                  []Item            `json:"itens,omitempty"`
	CreatedAt              time.Time         `json:"created_at"`
}

// Dados sao o cabecalho e os itens informados (rascunho inteiro, a cada salvar).
type Dados struct {
	PedidoCompraID int64
	CNPJEmitente   string
	Modelo         string
	Serie          string
	Numero         string
	ChaveAcesso    string
	DataEmissao    tempo.Data
	DataEntrada    tempo.Data
	CFOP           string
	ValorProdutos  dinheiro.Dinheiro
	ValorFrete     dinheiro.Dinheiro
	ValorSeguro    dinheiro.Dinheiro
	ValorDesconto  dinheiro.Dinheiro
	ValorIPI       dinheiro.Dinheiro
	ValorICMSST    dinheiro.Dinheiro
	ValorTotal     dinheiro.Dinheiro
	Observacoes    string
	Origem         string
	Itens          []Item
}

// Normalizar limpa espacos e deixa documentos so com digitos.
func (d *Dados) Normalizar() {
	d.CNPJEmitente = documento.ApenasDigitos(d.CNPJEmitente)
	d.Modelo = strings.TrimSpace(d.Modelo)
	d.Serie = strings.TrimLeft(strings.TrimSpace(d.Serie), "0")
	if d.Serie == "" {
		d.Serie = "0"
	}
	d.Numero = strings.TrimLeft(strings.TrimSpace(d.Numero), "0")
	d.ChaveAcesso = documento.ApenasDigitos(d.ChaveAcesso)
	d.CFOP = documento.ApenasDigitos(d.CFOP)
	d.Observacoes = strings.TrimSpace(d.Observacoes)
	if d.Origem != "XML" {
		d.Origem = "MANUAL"
	}
	for i := range d.Itens {
		it := &d.Itens[i]
		it.Ordem = i + 1
		it.CodigoFornecedor = strings.TrimSpace(it.CodigoFornecedor)
		it.DescricaoNF = strings.TrimSpace(it.DescricaoNF)
		it.UnidadeNF = strings.TrimSpace(it.UnidadeNF)
		it.JustificativaBonificacao = strings.TrimSpace(it.JustificativaBonificacao)
		if it.FatorConversao == 0 {
			it.FatorConversao = 1
		}
		if it.Bonificacao {
			// O valor fica como na nota (entra na soma dos produtos); o custo
			// de bonificacao e zero no rateio.
			it.ItemPedidoCompraID = nil
		}
		for j := range it.Lotes {
			it.Lotes[j].NumeroLote = strings.TrimSpace(it.Lotes[j].NumeroLote)
		}
		for j := range it.Series {
			it.Series[j].Numero = strings.TrimSpace(it.Series[j].Numero)
			it.Series[j].NumeroLote = strings.TrimSpace(it.Series[j].NumeroLote)
		}
	}
}

// ValidarForma confere o minimo para salvar um rascunho (a conferencia
// completa fica em Conferir). Um rascunho pode estar incompleto -- notas
// extensas sao digitadas aos poucos (4.3.6) --, mas nao invalido.
func (d Dados) ValidarForma() error {
	switch {
	case d.PedidoCompraID <= 0:
		return ErrPedidoObrigatorio
	case d.Modelo != ModeloNFe && d.Modelo != Modelo1:
		return ErrModeloInvalido
	case !soDigitos.MatchString(d.Serie) || len(d.Serie) > 3 || !soDigitos.MatchString(d.Numero) || len(d.Numero) > 9:
		return ErrSerieNumero
	case utf8.RuneCountInString(d.Observacoes) > 1000:
		return ErrObservacoesLongas
	case d.ValorProdutos < 0 || d.ValorFrete < 0 || d.ValorSeguro < 0 || d.ValorDesconto < 0 || d.ValorIPI < 0 ||
		d.ValorICMSST < 0 || d.ValorTotal < 0:
		return ErrValoresNegativos
	case d.ChaveAcesso != "" && !ChaveAcessoValida(d.ChaveAcesso):
		return ErrChaveInvalida
	}
	for _, it := range d.Itens {
		if it.PartePecaID <= 0 || it.QuantidadeNF <= 0 || it.FatorConversao <= 0 || it.QuantidadeRecebida < 0 ||
			it.ValorUnitario < 0 || it.ValorTotal < 0 {
			return ErrItemInvalido
		}
		if it.CertificadoArquivoID != nil && !uuidValido(*it.CertificadoArquivoID) {
			return ErrCertificadoInvalido
		}
		for _, l := range it.Lotes {
			if l.CertificadoArquivoID != nil && !uuidValido(*l.CertificadoArquivoID) {
				return ErrCertificadoInvalido
			}
		}
	}
	return nil
}

// ItemPC e o item de pedido de compra que a linha da nota atende.
type ItemPC struct {
	ID             int64
	PedidoCompraID int64
	NumeroPC       string
	StatusPC       string
	FornecedorID   int64
	PartePecaID    int64
	Solicitada     int
	Recebida       int
	PrecoUnitario  dinheiro.Dinheiro
}

// Peca sao as regras de controle da peca no recebimento.
type Peca struct {
	ID                 int64
	Codigo             string
	Controle           controle.Flags
	ValidadeMinimaDias int
	MascaraSerie       string
}

// Contexto reune o que a conferencia precisa saber alem da propria nota.
type Contexto struct {
	CNPJFornecedor    string
	StatusPCPrincipal string
	FornecedorPC      int64
	ItensPC           map[int64]ItemPC
	Pecas             map[int64]Peca
	// SeriesExistentes: "pecaID|numero" ja cadastrados (todo o historico).
	SeriesExistentes map[string]bool
	// FatorDePara: fator cadastrado no de-para do fornecedor, por codigo.
	FatorDePara        map[string]float64
	ToleranciaQtdPct   dinheiro.Dinheiro
	ToleranciaPrecoPct dinheiro.Dinheiro
	AcaoDivergencia    string // BLOQUEAR ou APROVAR
	Hoje               tempo.Data
	// RecebidoNestaNota soma, por item de PC, o que esta nota recebe (varias
	// linhas podem apontar o mesmo item de PC).
}

// statusQueRecebem sao as situacoes de PC que aceitam nota (4.3.3).
var statusQueRecebem = []string{"Aguardando Entrega", "Recebido Parcial"}

// Conferir aplica todas as regras do 4.3.3 a 4.3.5 e devolve as pendencias.
// BLOQUEIO impede efetivar; APROVACAO exige quem aprove divergencia; AVISO so
// informa (ex.: quantidade fisica diferente da nota -- pendencia com o
// fornecedor, o estoque anda pelo que foi contado).
func Conferir(n Nota, ctx Contexto) []Pendencia {
	var p []Pendencia
	bloq := func(item *int, tipo, msg string, args ...any) {
		p = append(p, Pendencia{ItemOrdem: item, Tipo: tipo, Nivel: NivelBloqueio, Mensagem: fmt.Sprintf(msg, args...)})
	}
	if !slices.Contains(statusQueRecebem, ctx.StatusPCPrincipal) {
		bloq(nil, "PEDIDO", "%s", ErrPedidoNaoRecebe.Error())
	}
	if n.CNPJEmitente != ctx.CNPJFornecedor {
		bloq(nil, "EMITENTE", "%s", ErrCNPJEmitente.Error())
	}
	if n.Modelo == ModeloNFe && (n.ChaveAcesso == nil || !ChaveAcessoValida(*n.ChaveAcesso)) {
		bloq(nil, "CHAVE", "%s", ErrChaveInvalida.Error())
	} else if n.ChaveAcesso != nil && !ChaveConfereCabecalho(*n.ChaveAcesso, n.CNPJEmitente, n.Modelo, n.Serie, n.Numero) {
		bloq(nil, "CHAVE", "a chave de acesso nao corresponde ao CNPJ, modelo, serie e numero informados")
	}
	somaItens := int64(0)
	for _, it := range n.Itens {
		somaItens += it.ValorTotal.Centavos()
	}
	if n.ValorProdutos > 0 && abs64(somaItens-n.ValorProdutos.Centavos()) > 5 {
		bloq(nil, "VALORES", "a soma dos itens (R$ %.2f) difere do total de produtos da nota (R$ %.2f)",
			float64(somaItens)/100, float64(n.ValorProdutos.Centavos())/100)
	}
	if n.DataEmissao.IsZero() || n.DataEntrada.IsZero() || n.DataEmissao.After(n.DataEntrada) || n.DataEntrada.After(ctx.Hoje) {
		bloq(nil, "DATAS", "%s", ErrDatasInvalidas.Error())
	}
	if !CFOPAceito(n.CFOP) {
		bloq(nil, "CFOP", "%s", ErrCFOPInvalido.Error())
	}
	if len(n.Itens) == 0 {
		bloq(nil, "ITENS", "%s", ErrSemItens.Error())
	}

	recebidoPorItemPC := map[int64]int{}
	seriesNaNota := map[string]bool{}
	for _, it := range n.Itens {
		ordem := it.Ordem
		o := &ordem
		peca, okPeca := ctx.Pecas[it.PartePecaID]
		if !okPeca {
			bloq(o, "PECA", "peca inexistente ou inativa")
			continue
		}
		if it.Bonificacao {
			if utf8.RuneCountInString(it.JustificativaBonificacao) < 10 {
				bloq(o, "BONIFICACAO", "bonificacao exige justificativa (ao menos 10 caracteres)")
			}
		} else {
			pc, ok := ctx.ItensPC[derefID(it.ItemPedidoCompraID)]
			switch {
			case !ok:
				bloq(o, "ITEM_PC", "o item nao pertence a um pedido de compra deste fornecedor (marque como bonificacao, se for o caso)")
			case pc.FornecedorID != ctx.FornecedorPC:
				bloq(o, "ITEM_PC", "o item de pedido de compra e de outro fornecedor")
			case !slices.Contains(statusQueRecebem, pc.StatusPC):
				bloq(o, "ITEM_PC", "o pedido de compra %s nao esta recebendo", pc.NumeroPC)
			case pc.PartePecaID != it.PartePecaID:
				bloq(o, "ITEM_PC", "a peca da linha nao e a do item do pedido de compra")
			default:
				recebidoPorItemPC[pc.ID] += it.QuantidadeRecebida
				// O total da linha precisa bater com quantidade x unitario: e o
				// total que vai para o custo, entao e dele que sai o preco.
				if it.ValorUnitario > 0 && math.Abs(float64(it.ValorTotal.Centavos())/100-it.QuantidadeNF*it.ValorUnitario) > 0.05 {
					bloq(o, "VALORES", "valor total do item (R$ %.2f) nao confere com quantidade x unitario (R$ %.2f)",
						float64(it.ValorTotal.Centavos())/100, it.QuantidadeNF*it.ValorUnitario)
				}
				if fator, ok := ctx.FatorDePara[it.CodigoFornecedor]; ok && it.CodigoFornecedor != "" && math.Abs(fator-it.FatorConversao) > 1e-6 {
					nivel := NivelBloqueio
					if ctx.AcaoDivergencia == "APROVAR" {
						nivel = NivelAprovacao
					}
					p = append(p, Pendencia{ItemOrdem: o, Tipo: "FATOR", Nivel: nivel, Mensagem: fmt.Sprintf(
						"fator de conversao %.4g difere do cadastrado no de-para (%.4g)", it.FatorConversao, fator)})
				}
				// Divergencia de preco: custo da nota por unidade de consumo x PC.
				precoNF := float64(it.ValorTotal.Centavos()) / 100 / (it.QuantidadeNF * it.FatorConversao)
				precoPC := float64(pc.PrecoUnitario.Centavos()) / 100
				if precoPC > 0 {
					desvio := math.Abs(precoNF-precoPC) / precoPC * 100
					tolerancia := float64(ctx.ToleranciaPrecoPct.Centavos()) / 100
					if desvio > tolerancia+1e-9 {
						nivel := NivelBloqueio
						if ctx.AcaoDivergencia == "APROVAR" {
							nivel = NivelAprovacao
						}
						p = append(p, Pendencia{ItemOrdem: o, Tipo: "PRECO", Nivel: nivel, Mensagem: fmt.Sprintf(
							"preco unitario R$ %.4f diverge %.1f%% do pedido (R$ %.2f), acima da tolerancia de %.1f%%",
							precoNF, desvio, precoPC, tolerancia)})
					}
				}
			}
		}
		// Quantidade fisica x nota: registra e segue (pendencia com o fornecedor).
		esperada := it.QuantidadeNF * it.FatorConversao
		if math.Abs(esperada-float64(it.QuantidadeRecebida)) > 1e-6 {
			p = append(p, Pendencia{ItemOrdem: o, Tipo: "QUANTIDADE", Nivel: NivelAviso, Mensagem: fmt.Sprintf(
				"recebido %d, nota declara %.4g (x %.4g) -- a diferenca fica pendente com o fornecedor", it.QuantidadeRecebida, it.QuantidadeNF, it.FatorConversao)})
		}
		if it.QuantidadeRecebida == 0 {
			continue
		}
		// Lote e validade.
		if peca.Controle.ControlaLote {
			soma := 0
			for _, l := range it.Lotes {
				soma += l.Quantidade
				if l.NumeroLote == "" || l.Quantidade <= 0 {
					bloq(o, "LOTE", "cada lote precisa de numero e quantidade")
				}
				if !l.DataFabricacao.IsZero() && !l.Validade.IsZero() && l.DataFabricacao.After(l.Validade) {
					bloq(o, "LOTE", "lote %s com fabricacao depois da validade", l.NumeroLote)
				}
				if peca.Controle.ControlaValidade {
					if l.Validade.IsZero() {
						bloq(o, "VALIDADE", "lote %s sem validade", l.NumeroLote)
					} else if dias := int(l.Validade.Time.Sub(ctx.Hoje.Time).Hours() / 24); dias < peca.ValidadeMinimaDias {
						bloq(o, "VALIDADE", "lote %s com %d dia(s) de validade -- o minimo do item e %d", l.NumeroLote, dias, peca.ValidadeMinimaDias)
					}
				}
				if peca.Controle.ExigeCertificado && l.CertificadoArquivoID == nil {
					bloq(o, "CERTIFICADO", "lote %s sem certificado de conformidade anexado", l.NumeroLote)
				}
			}
			if soma != it.QuantidadeRecebida {
				bloq(o, "LOTE", "a soma dos lotes (%d) precisa ser igual a quantidade recebida (%d)", soma, it.QuantidadeRecebida)
			}
		} else if peca.Controle.ExigeCertificado && it.CertificadoArquivoID == nil {
			bloq(o, "CERTIFICADO", "item exige certificado de conformidade anexado")
		}
		// Numero de serie: um por unidade, unico por peca em todo o historico.
		if peca.Controle.ControlaNumeroSerie {
			if len(it.Series) != it.QuantidadeRecebida {
				bloq(o, "SERIE", "series informadas: %d de %d", len(it.Series), it.QuantidadeRecebida)
			}
			lotesDaLinha := map[string]bool{}
			for _, l := range it.Lotes {
				lotesDaLinha[l.NumeroLote] = true
			}
			for _, s := range it.Series {
				chave := fmt.Sprintf("%d|%s", it.PartePecaID, s.Numero)
				switch {
				case s.Numero == "":
					bloq(o, "SERIE", "numero de serie vazio")
				case seriesNaNota[chave]:
					bloq(o, "SERIE", "serie %s repetida nesta nota", s.Numero)
				case ctx.SeriesExistentes[chave]:
					bloq(o, "SERIE", "serie %s ja existe para esta peca", s.Numero)
				case !controle.SerieConfere(peca.MascaraSerie, s.Numero):
					bloq(o, "SERIE", "serie %s fora do formato cadastrado", s.Numero)
				case peca.Controle.ControlaLote && !lotesDaLinha[s.NumeroLote]:
					bloq(o, "SERIE", "serie %s sem lote valido desta linha", s.Numero)
				}
				seriesNaNota[chave] = true
			}
		}
	}
	// Saldo do PC: acumulado recebido nao passa do solicitado + tolerancia.
	for id, recebido := range recebidoPorItemPC {
		pc := ctx.ItensPC[id]
		limite := pc.Solicitada + int(int64(pc.Solicitada)*ctx.ToleranciaQtdPct.Centavos()/100_00)
		if pc.Recebida+recebido > limite {
			bloq(nil, "SALDO_PC", "item do pedido %s: recebido %d + %d passa do limite de %d", pc.NumeroPC, pc.Recebida, recebido, limite)
		}
	}
	return p
}

func abs64(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}

func derefID(id *int64) int64 {
	if id == nil {
		return 0
	}
	return *id
}

// TemNivel diz se ha pendencia do nivel.
func TemNivel(p []Pendencia, nivel string) bool {
	return slices.ContainsFunc(p, func(x Pendencia) bool { return x.Nivel == nivel })
}

// RatearCustos calcula o custo unitario de entrada (por unidade de consumo)
// de cada item: valor do item + frete, seguro, IPI e ICMS-ST rateados pelo
// valor, menos o desconto rateado (4.3.6). Bonificacao entra com custo zero.
func RatearCustos(n Nota) map[int]float64 {
	base := 0.0
	for _, it := range n.Itens {
		// Linha sem recebimento nao leva frete/impostos (sairia do custo).
		if !it.Bonificacao && it.QuantidadeRecebida > 0 {
			base += float64(it.ValorTotal.Centavos())
		}
	}
	extras := float64(n.ValorFrete.Centavos()+n.ValorSeguro.Centavos()+n.ValorIPI.Centavos()+n.ValorICMSST.Centavos()-
		n.ValorDesconto.Centavos()) / 100
	custos := map[int]float64{}
	for _, it := range n.Itens {
		if it.QuantidadeRecebida == 0 {
			continue
		}
		if it.Bonificacao || base == 0 {
			custos[it.Ordem] = 0
			continue
		}
		valor := float64(it.ValorTotal.Centavos()) / 100
		total := valor + extras*float64(it.ValorTotal.Centavos())/base
		custos[it.Ordem] = math.Max(0, math.Round(total/float64(it.QuantidadeRecebida)*10000)/10000)
	}
	return custos
}
