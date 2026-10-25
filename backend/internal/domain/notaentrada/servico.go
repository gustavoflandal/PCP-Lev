package notaentrada

import (
	"context"
	"errors"
	"math"
	"strings"
	"unicode/utf8"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// ErroDePendencias carrega as pendencias (resposta 409 com detalhes).
type ErroDePendencias struct {
	Base       error
	Pendencias []Pendencia
}

func (e *ErroDePendencias) Error() string { return e.Base.Error() }
func (e *ErroDePendencias) Unwrap() error { return e.Base }

// DePara e o vinculo item x fornecedor (4.1 e 4.3.3).
type DePara struct {
	ID                  int64   `json:"id"`
	FornecedorID        int64   `json:"fornecedor_id"`
	PartePecaID         int64   `json:"parte_peca_id"`
	PecaCodigo          string  `json:"peca_codigo"`
	PecaDescricao       string  `json:"peca_descricao"`
	CodigoFornecedor    string  `json:"codigo_fornecedor"`
	DescricaoFornecedor string  `json:"descricao_fornecedor"`
	UnidadeFornecedor   string  `json:"unidade_fornecedor"`
	FatorConversao      float64 `json:"fator_conversao"`
}

var (
	ErrDeParaInvalido  = errors.New("informe peca, codigo do fornecedor (ate 60) e fator de conversao maior que zero")
	ErrDeParaDuplicado = errors.New("este codigo do fornecedor ja esta vinculado a uma peca")
	ErrDeParaNaoExiste = errors.New("vinculo de-para nao encontrado")
)

// Repositorio e a porta de persistencia.
type Repositorio interface {
	Criar(ctx context.Context, d Dados, autor string) (int64, error)
	// Atualizar regrava cabecalho e itens de uma nota em Rascunho/Conferida
	// (volta a Rascunho).
	Atualizar(ctx context.Context, id int64, d Dados, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*Nota, error)
	Listar(ctx context.Context, params consulta.Parametros, pedidoCompraID int64) ([]Nota, int, error)
	// Contexto le o que a conferencia precisa (PC, pecas, series, parametros).
	Contexto(ctx context.Context, n *Nota) (Contexto, error)
	MudarStatus(ctx context.Context, id int64, de []string, para, autor string) error
	// Conferir marca Conferida so se a versao ainda for a conferida.
	MarcarConferida(ctx context.Context, id int64, versao int, autor string) error
	// Efetivar grava tudo numa transacao: estoque, lotes, series, CMP, PC.
	Efetivar(ctx context.Context, id int64, versao int, custos map[int]float64, aprovadoPor *string, toleranciaQtd int64, autor string) error
	Estornar(ctx context.Context, id int64, motivo, autor string) error

	// PreviaContexto: CNPJ e id do fornecedor do PC, de-para dele e itens do PC.
	PreviaContexto(ctx context.Context, pedidoCompraID int64) (cnpj string, fornecedorID int64, depara []DePara, itensPC []ItemPC, err error)
	ListarDePara(ctx context.Context, fornecedorID int64) ([]DePara, error)
	SalvarDePara(ctx context.Context, d DePara, autor string) (*DePara, error)
	RemoverDePara(ctx context.Context, id int64) error
}

// Servico reune os casos de uso do recebimento fiscal.
type Servico struct {
	repo Repositorio
	hoje func() tempo.Data
}

// NovoServico monta o servico.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo, hoje: tempo.Hoje}
}

// Criar grava um rascunho.
func (s *Servico) Criar(ctx context.Context, d Dados, autor string) (*Nota, error) {
	d.Normalizar()
	if err := d.ValidarForma(); err != nil {
		return nil, err
	}
	id, err := s.repo.Criar(ctx, d, autor)
	if err != nil {
		return nil, err
	}
	return s.repo.BuscarPorID(ctx, id)
}

// Atualizar regrava o rascunho (uma nota conferida que muda volta a rascunho).
func (s *Servico) Atualizar(ctx context.Context, id int64, d Dados, autor string) (*Nota, error) {
	d.Normalizar()
	if err := d.ValidarForma(); err != nil {
		return nil, err
	}
	if err := s.repo.Atualizar(ctx, id, d, autor); err != nil {
		return nil, err
	}
	return s.repo.BuscarPorID(ctx, id)
}

// BuscarPorID devolve uma nota com os itens.
func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*Nota, error) {
	return s.repo.BuscarPorID(ctx, id)
}

// Listar devolve uma pagina de notas (filtro por PC opcional).
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros, pedidoCompraID int64) ([]Nota, int, error) {
	return s.repo.Listar(ctx, params, pedidoCompraID)
}

// Pendencias confere a nota sem mudar nada (para a tela de conferencia).
func (s *Servico) Pendencias(ctx context.Context, id int64) ([]Pendencia, error) {
	n, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	c, err := s.repo.Contexto(ctx, n)
	if err != nil {
		return nil, err
	}
	c.Hoje = s.hoje()
	return Conferir(*n, c), nil
}

// Conferir passa a nota a Conferida se nao houver bloqueio.
func (s *Servico) Conferir(ctx context.Context, id int64, autor string) ([]Pendencia, error) {
	n, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	c, err := s.repo.Contexto(ctx, n)
	if err != nil {
		return nil, err
	}
	c.Hoje = s.hoje()
	p := Conferir(*n, c)
	if TemNivel(p, NivelBloqueio) {
		return p, &ErroDePendencias{Base: ErrPendencias, Pendencias: p}
	}
	return p, s.repo.MarcarConferida(ctx, id, n.Versao, autor)
}

// Efetivar da a entrada no estoque. Divergencia de preco em modo APROVAR
// exige podeAprovar; quem aprovou fica registrado.
func (s *Servico) Efetivar(ctx context.Context, id int64, podeAprovar bool, autor string) error {
	n, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if n.Status != StatusConferida {
		return ErrStatusInvalidoParaAcao
	}
	c, err := s.repo.Contexto(ctx, n)
	if err != nil {
		return err
	}
	c.Hoje = s.hoje()
	p := Conferir(*n, c)
	if TemNivel(p, NivelBloqueio) {
		return &ErroDePendencias{Base: ErrPendencias, Pendencias: p}
	}
	var aprovadoPor *string
	if TemNivel(p, NivelAprovacao) {
		if !podeAprovar {
			return &ErroDePendencias{Base: ErrDivergenciaSemAprovar, Pendencias: p}
		}
		aprovadoPor = &autor
	}
	return s.repo.Efetivar(ctx, id, n.Versao, RatearCustos(*n), aprovadoPor, c.ToleranciaQtdPct.Centavos(), autor)
}

// Cancelar descarta uma nota ainda nao efetivada.
func (s *Servico) Cancelar(ctx context.Context, id int64, autor string) error {
	return s.repo.MudarStatus(ctx, id, []string{StatusRascunho, StatusConferida}, StatusCancelada, autor)
}

// Estornar desfaz uma nota efetivada cujo material ainda esta intacto.
func (s *Servico) Estornar(ctx context.Context, id int64, motivo, autor string) error {
	motivo = strings.TrimSpace(motivo)
	if n := utf8.RuneCountInString(motivo); n < 10 || n > 255 {
		return ErrMotivoObrigatorio
	}
	return s.repo.Estornar(ctx, id, motivo, autor)
}

// ListarDePara devolve os vinculos de um fornecedor.
func (s *Servico) ListarDePara(ctx context.Context, fornecedorID int64) ([]DePara, error) {
	return s.repo.ListarDePara(ctx, fornecedorID)
}

// SalvarDePara cria ou atualiza (pelo codigo do fornecedor) um vinculo.
func (s *Servico) SalvarDePara(ctx context.Context, d DePara, autor string) (*DePara, error) {
	d.CodigoFornecedor = strings.TrimSpace(d.CodigoFornecedor)
	d.DescricaoFornecedor = strings.TrimSpace(d.DescricaoFornecedor)
	d.UnidadeFornecedor = strings.TrimSpace(d.UnidadeFornecedor)
	if d.FatorConversao == 0 {
		d.FatorConversao = 1
	}
	if d.FornecedorID <= 0 || d.PartePecaID <= 0 || d.CodigoFornecedor == "" || utf8.RuneCountInString(d.CodigoFornecedor) > 60 ||
		d.FatorConversao <= 0 || utf8.RuneCountInString(d.DescricaoFornecedor) > 255 || utf8.RuneCountInString(d.UnidadeFornecedor) > 10 {
		return nil, ErrDeParaInvalido
	}
	return s.repo.SalvarDePara(ctx, d, autor)
}

// RemoverDePara apaga um vinculo.
func (s *Servico) RemoverDePara(ctx context.Context, id int64) error {
	return s.repo.RemoverDePara(ctx, id)
}

// Previa le o XML da NF-e contra o pedido de compra: confere o emitente,
// reconhece os itens pelo de-para (convertendo unidade e lotes pelo fator) e
// sugere o item do PC. Nada e gravado -- a tela completa o que faltar.
func (s *Servico) Previa(ctx context.Context, pedidoCompraID int64, conteudo []byte) (*PreviaXML, error) {
	p, err := LerXML(conteudo)
	if err != nil {
		return nil, err
	}
	cnpj, _, depara, itensPC, err := s.repo.PreviaContexto(ctx, pedidoCompraID)
	if err != nil {
		return nil, err
	}
	if len(conteudo) > 2<<20 {
		return nil, ErrXMLGrande
	}
	if p.CNPJEmitente != cnpj {
		return nil, ErrEmitenteDoPedido
	}
	p.PedidoCompraID = pedidoCompraID
	porCodigo := map[string]DePara{}
	for _, d := range depara {
		porCodigo[d.CodigoFornecedor] = d
	}
	usados := map[int64]int{}
	for i := range p.Itens {
		it := &p.Itens[i]
		d, ok := porCodigo[it.CodigoFornecedor]
		if !ok {
			p.NaoReconhecidos++
			continue
		}
		peca := d.PartePecaID
		it.PartePecaID, it.PecaCodigo, it.PecaDescricao, it.FatorConversao = &peca, d.PecaCodigo, d.PecaDescricao, d.FatorConversao
		it.QuantidadeRecebida = int(math.Round(it.Quantidade * d.FatorConversao))
		for j := range it.Lotes {
			it.Lotes[j].Quantidade = int(math.Round(float64(it.Lotes[j].Quantidade) * d.FatorConversao))
		}
		for _, pc := range itensPC {
			if pc.PartePecaID == peca && pc.Solicitada-pc.Recebida-usados[pc.ID] > 0 {
				id := pc.ID
				it.ItemPedidoCompraID = &id
				usados[pc.ID] += it.QuantidadeRecebida
				break
			}
		}
	}
	return p, nil
}
