package notaentrada

import (
	"bytes"
	"encoding/xml"
	"errors"
	"math"
	"strconv"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/documento"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// Leitura do XML da NF-e (layout 4.00: nfeProc > NFe > infNFe), 4.3.3.
// Os nomes casam pelo nome local; o namespace do portal fiscal e ignorado.

var (
	ErrXMLInvalido      = errors.New("o arquivo nao e um XML de NF-e valido (nfeProc/NFe)")
	ErrXMLSemItens      = errors.New("o XML nao tem itens (det)")
	ErrXMLModelo        = errors.New("o XML nao e de NF-e modelo 55")
	ErrEmitenteDoPedido = errors.New("o CNPJ do emitente da nota nao e o do fornecedor do pedido de compra")
	ErrXMLGrande        = errors.New("XML grande demais (ate 2 MB)")
)

type xmlNFe struct {
	InfNFe xmlInfNFe `xml:"infNFe"`
}

type xmlProc struct {
	NFe  xmlNFe `xml:"NFe"`
	Prot struct {
		Chave string `xml:"infProt>chNFe"`
	} `xml:"protNFe"`
}

type xmlInfNFe struct {
	ID  string `xml:"Id,attr"`
	Ide struct {
		Modelo string `xml:"mod"`
		Serie  string `xml:"serie"`
		Numero string `xml:"nNF"`
		DhEmi  string `xml:"dhEmi"`
		DEmi   string `xml:"dEmi"`
	} `xml:"ide"`
	Emit struct {
		CNPJ string `xml:"CNPJ"`
		Nome string `xml:"xNome"`
	} `xml:"emit"`
	Det []struct {
		Prod struct {
			Codigo    string `xml:"cProd"`
			Descricao string `xml:"xProd"`
			CFOP      string `xml:"CFOP"`
			Unidade   string `xml:"uCom"`
			Quant     string `xml:"qCom"`
			VUnit     string `xml:"vUnCom"`
			VProd     string `xml:"vProd"`
			Rastro    []struct {
				Lote string `xml:"nLote"`
				Qtd  string `xml:"qLote"`
				Fab  string `xml:"dFab"`
				Val  string `xml:"dVal"`
			} `xml:"rastro"`
		} `xml:"prod"`
	} `xml:"det"`
	Total struct {
		VProd  string `xml:"ICMSTot>vProd"`
		VFrete string `xml:"ICMSTot>vFrete"`
		VSeg   string `xml:"ICMSTot>vSeg"`
		VDesc  string `xml:"ICMSTot>vDesc"`
		VIPI   string `xml:"ICMSTot>vIPI"`
		VST    string `xml:"ICMSTot>vST"`
		VNF    string `xml:"ICMSTot>vNF"`
	} `xml:"total"`
}

// ItemXML e uma linha lida do XML, ja com o de-para (se houver).
type ItemXML struct {
	NumeroItem       int               `json:"numero_item"`
	CodigoFornecedor string            `json:"codigo_fornecedor"`
	Descricao        string            `json:"descricao"`
	Unidade          string            `json:"unidade"`
	CFOP             string            `json:"cfop"`
	Quantidade       float64           `json:"quantidade"`
	ValorUnitario    float64           `json:"valor_unitario"`
	ValorTotal       dinheiro.Dinheiro `json:"valor_total"`
	Lotes            []LoteItem        `json:"lotes"`
	// Reconhecimento pelo de-para (nil = vincular a mao; o vinculo criado e
	// memorizado para as proximas notas).
	PartePecaID    *int64  `json:"parte_peca_id,omitempty"`
	PecaCodigo     string  `json:"peca_codigo,omitempty"`
	PecaDescricao  string  `json:"peca_descricao,omitempty"`
	FatorConversao float64 `json:"fator_conversao"`
	// Sugestao do item do PC (mesma peca, com saldo).
	ItemPedidoCompraID *int64 `json:"item_pedido_compra_id,omitempty"`
	QuantidadeRecebida int    `json:"quantidade_recebida"`
}

// PreviaXML e o resultado da leitura, ainda nao gravado.
type PreviaXML struct {
	ArquivoID       string            `json:"arquivo_id"`
	PedidoCompraID  int64             `json:"pedido_compra_id"`
	CNPJEmitente    string            `json:"cnpj_emitente"`
	NomeEmitente    string            `json:"nome_emitente"`
	Modelo          string            `json:"modelo"`
	Serie           string            `json:"serie"`
	Numero          string            `json:"numero"`
	ChaveAcesso     string            `json:"chave_acesso"`
	DataEmissao     tempo.Data        `json:"data_emissao"`
	CFOP            string            `json:"cfop"`
	ValorProdutos   dinheiro.Dinheiro `json:"valor_produtos"`
	ValorFrete      dinheiro.Dinheiro `json:"valor_frete"`
	ValorSeguro     dinheiro.Dinheiro `json:"valor_seguro"`
	ValorDesconto   dinheiro.Dinheiro `json:"valor_desconto"`
	ValorIPI        dinheiro.Dinheiro `json:"valor_ipi"`
	ValorICMSST     dinheiro.Dinheiro `json:"valor_icms_st"`
	ValorTotal      dinheiro.Dinheiro `json:"valor_total"`
	Itens           []ItemXML         `json:"itens"`
	NaoReconhecidos int               `json:"nao_reconhecidos"`
}

func numero(texto string) float64 {
	v, _ := strconv.ParseFloat(strings.TrimSpace(texto), 64)
	return v
}

func valor(texto string) dinheiro.Dinheiro {
	d, err := dinheiro.DeString(strings.TrimSpace(texto))
	if err != nil {
		return dinheiro.DeCentavos(int64(math.Round(numero(texto) * 100)))
	}
	return d
}

func data(texto string) tempo.Data {
	texto = strings.TrimSpace(texto)
	if len(texto) >= 10 {
		texto = texto[:10]
	}
	d, _ := tempo.DeString(texto)
	return d
}

// LerXML interpreta o XML (nfeProc com protocolo, ou so a NFe).
func LerXML(conteudo []byte) (*PreviaXML, error) {
	var inf xmlInfNFe
	var chave string
	var proc xmlProc
	if err := xml.NewDecoder(bytes.NewReader(conteudo)).Decode(&proc); err == nil && proc.NFe.InfNFe.Ide.Numero != "" {
		inf, chave = proc.NFe.InfNFe, proc.Prot.Chave
	} else {
		var nfe xmlNFe
		if err := xml.NewDecoder(bytes.NewReader(conteudo)).Decode(&nfe); err != nil || nfe.InfNFe.Ide.Numero == "" {
			return nil, ErrXMLInvalido
		}
		inf = nfe.InfNFe
	}
	doId := strings.TrimPrefix(inf.ID, "NFe")
	if chave == "" {
		chave = doId
	} else if doId != "" && doId != chave {
		// Protocolo de outra nota colado neste XML.
		return nil, ErrXMLInvalido
	}
	if inf.Ide.Modelo != ModeloNFe {
		return nil, ErrXMLModelo
	}
	if len(inf.Det) == 0 {
		return nil, ErrXMLSemItens
	}
	emissao := inf.Ide.DhEmi
	if emissao == "" {
		emissao = inf.Ide.DEmi
	}
	p := &PreviaXML{
		CNPJEmitente: documento.ApenasDigitos(inf.Emit.CNPJ), NomeEmitente: strings.TrimSpace(inf.Emit.Nome),
		Modelo: inf.Ide.Modelo, Serie: strings.TrimSpace(inf.Ide.Serie), Numero: strings.TrimSpace(inf.Ide.Numero),
		ChaveAcesso: documento.ApenasDigitos(chave), DataEmissao: data(emissao),
		ValorProdutos: valor(inf.Total.VProd), ValorFrete: valor(inf.Total.VFrete), ValorSeguro: valor(inf.Total.VSeg),
		ValorDesconto: valor(inf.Total.VDesc), ValorIPI: valor(inf.Total.VIPI), ValorICMSST: valor(inf.Total.VST),
		ValorTotal: valor(inf.Total.VNF),
	}
	for i, d := range inf.Det {
		it := ItemXML{
			NumeroItem: i + 1, CodigoFornecedor: strings.TrimSpace(d.Prod.Codigo), Descricao: strings.TrimSpace(d.Prod.Descricao),
			Unidade: strings.TrimSpace(d.Prod.Unidade), CFOP: strings.TrimSpace(d.Prod.CFOP), Quantidade: numero(d.Prod.Quant),
			ValorUnitario: numero(d.Prod.VUnit), ValorTotal: valor(d.Prod.VProd), FatorConversao: 1, Lotes: []LoteItem{},
		}
		for _, r := range d.Prod.Rastro {
			it.Lotes = append(it.Lotes, LoteItem{NumeroLote: strings.TrimSpace(r.Lote), Quantidade: int(math.Round(numero(r.Qtd))),
				DataFabricacao: data(r.Fab), Validade: data(r.Val)})
		}
		if p.CFOP == "" {
			p.CFOP = CFOPDeEntrada(it.CFOP)
		}
		p.Itens = append(p.Itens, it)
	}
	return p, nil
}

// CFOPDeEntrada: o XML traz o CFOP de saida do emitente (5/6/7xxx); quem
// recebe lanca o espelho de entrada (1/2/3xxx), ex.: 5102 -> 1102.
func CFOPDeEntrada(cfop string) string {
	if len(cfop) != 4 {
		return cfop
	}
	switch cfop[0] {
	case '5':
		return "1" + cfop[1:]
	case '6':
		return "2" + cfop[1:]
	case '7':
		return "3" + cfop[1:]
	}
	return cfop
}
