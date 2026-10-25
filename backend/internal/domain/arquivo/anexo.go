package arquivo

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// Entidades que recebem anexos (mesmo CHECK da migration 018).
const (
	EntidadeProduto       = "produto_acabado"
	EntidadePeca          = "parte_peca"
	EntidadeNotaEntrada   = "nota_entrada"
	EntidadeLote          = "lote"
	EntidadeOrdemProducao = "ordem_producao"
	EntidadeFornecedor    = "fornecedor"
	EntidadePedidoCompra  = "pedido_compra"
	EntidadePedidoVenda   = "pedido_venda"
	EntidadeCliente       = "cliente"
)

// Tipos de anexo.
const (
	TipoFoto      = "FOTO"
	TipoDocumento = "DOCUMENTO"
	TipoAnexo     = "ANEXO"
)

// GaleriaMaxima: fotos alem da principal por produto (4.1.2).
const GaleriaMaxima = 10

// CategoriasDocumentoProduto sao as categorias obrigatorias de documento
// tecnico de produto/peca (4.1.2).
var CategoriasDocumentoProduto = []string{
	"Datasheet", "Desenho Mecânico", "Esquema Elétrico", "Manual de Montagem",
	"Certificado de Conformidade", "Laudo de Ensaio", "Instrução de Trabalho", "Ficha de Segurança",
}

// CategoriasNotaEntrada: anexos da nota de entrada (4.3.3 e 4.3.6).
var CategoriasNotaEntrada = []string{
	"XML da NF-e", "DANFE", "Certificado de Conformidade", "Foto da mercadoria", "Foto do lacre", "Foto de avaria", "Outro",
}

// CategoriasLote: anexos do lote (certificado por lote, 4.3.5).
var CategoriasLote = []string{"Certificado de Conformidade", "Laudo de Ensaio", "Outro"}

// Categorias dos registros operacionais (Fase 3.1): lista fechada e
// obrigatoria; nesses registros so ha anexos do tipo ANEXO.
var (
	CategoriasOrdemProducao = []string{"Laudo de Teste", "Relatório de Inspeção", "Foto da Produção", "Desenho/Esquema", "Outro"}
	CategoriasFornecedor    = []string{"Contrato", "Certificado de Qualidade", "Documentos Cadastrais", "Tabela de Preços", "Outro"}
	CategoriasPedidoCompra  = []string{"Proposta/Cotação", "Pedido Assinado", "Comunicação", "Outro"}
	CategoriasPedidoVenda   = []string{"Contrato/Edital", "Pedido do Cliente", "Termo de Aceite", "Ordem de Serviço", "Outro"}
	CategoriasCliente       = []string{"Contrato", "Documentos Cadastrais", "Termo de Aceite", "Outro"}
)

// CategoriasLaudo: anexos da OP que entram na ficha as-built da unidade.
var CategoriasLaudo = []string{"Laudo de Teste", "Relatório de Inspeção"}

var (
	ErrEntidadeInvalida      = errors.New("entidade de anexo invalida")
	ErrEntidadeInexistente   = errors.New("o registro ao qual o anexo seria vinculado nao existe")
	ErrTipoAnexoInvalido     = errors.New("tipo de anexo invalido")
	ErrFotoPrecisaSerImagem  = errors.New("foto precisa ser JPG, PNG ou WebP")
	ErrDocumentoPrecisaPDF   = errors.New("documento tecnico precisa ser PDF")
	ErrCategoriaInvalida     = errors.New("escolha a categoria do documento")
	ErrGaleriaCheia          = errors.New("a galeria ja tem 10 fotos -- remova uma antes")
	ErrCamposLongos          = errors.New("titulo ate 150, descricao ate 500, versao ate 20 e categoria ate 40 caracteres")
	ErrValidadeAntesEmissao  = errors.New("a validade nao pode ser anterior a emissao")
	ErrVersaoDeOutroRegistro = errors.New("a versao anterior pertence a outro registro ou tipo")
	ErrAnexoNaoEncontrado    = errors.New("anexo nao encontrado")
	ErrFotoObrigatoria       = errors.New("item critico precisa de foto principal -- envie outra antes de remover esta")
	ErrNotaImutavel          = errors.New("a nota fiscal ja foi efetivada ou encerrada: os anexos dela nao podem ser removidos")
	ErrRegistroEncerrado     = errors.New("o registro esta encerrado: os anexos dele ficam como registro e nao podem ser removidos")
	ErrIDArquivo             = errors.New("identificador de arquivo invalido")
)

// Anexo e um arquivo vinculado a uma entidade.
type Anexo struct {
	ID                 int64      `json:"id"`
	Entidade           string     `json:"entidade"`
	EntidadeID         int64      `json:"entidade_id"`
	Tipo               string     `json:"tipo"`
	Categoria          string     `json:"categoria"`
	Titulo             string     `json:"titulo"`
	Descricao          string     `json:"descricao"`
	Versao             string     `json:"versao"`
	DocumentoChave     int64      `json:"documento_chave"`
	Vigente            bool       `json:"vigente"`
	DataEmissao        tempo.Data `json:"data_emissao,omitzero"`
	DataValidade       tempo.Data `json:"data_validade,omitzero"`
	FornecedorID       *int64     `json:"fornecedor_id,omitempty"`
	EstruturaProdutoID *int64     `json:"estrutura_produto_id,omitempty"`
	Principal          bool       `json:"principal"`
	Ordem              int        `json:"ordem"`
	Arquivo            Arquivo    `json:"arquivo"`
	CreatedAt          time.Time  `json:"created_at"`
	CreatedBy          *string    `json:"created_by,omitempty"`
	// URL e Miniatura sao preenchidas pelo handler (assinadas, vida curta).
	URL          string `json:"url,omitempty"`
	MiniaturaURL string `json:"miniatura_url,omitempty"`
}

// DadosAnexo sao os campos informados ao anexar.
type DadosAnexo struct {
	Entidade           string
	EntidadeID         int64
	ArquivoID          string
	Tipo               string
	Categoria          string
	Titulo             string
	Descricao          string
	Versao             string
	DataEmissao        tempo.Data
	DataValidade       tempo.Data
	FornecedorID       *int64
	EstruturaProdutoID *int64
	Principal          bool
	// ManterPrincipal: na edicao, o campo nao veio -- preserva o atual.
	ManterPrincipal bool
	// SubstituiAnexoID: envio de nova versao de um documento (preserva as
	// anteriores; so a nova fica vigente).
	SubstituiAnexoID *int64
}

// EntidadesValidas e o conjunto fechado.
var EntidadesValidas = []string{
	EntidadeProduto, EntidadePeca, EntidadeNotaEntrada, EntidadeLote, EntidadeOrdemProducao,
	EntidadeFornecedor, EntidadePedidoCompra, EntidadePedidoVenda, EntidadeCliente,
}

func categoriasDe(entidade string) []string {
	switch entidade {
	case EntidadeProduto, EntidadePeca:
		return CategoriasDocumentoProduto
	case EntidadeNotaEntrada:
		return CategoriasNotaEntrada
	case EntidadeLote:
		return CategoriasLote
	case EntidadeOrdemProducao:
		return CategoriasOrdemProducao
	case EntidadeFornecedor:
		return CategoriasFornecedor
	case EntidadePedidoCompra:
		return CategoriasPedidoCompra
	case EntidadePedidoVenda:
		return CategoriasPedidoVenda
	case EntidadeCliente:
		return CategoriasCliente
	}
	return nil
}

// registroOperacional: entidades da Fase 3.1 (so ANEXO, categoria obrigatoria).
func registroOperacional(entidade string) bool {
	switch entidade {
	case EntidadeOrdemProducao, EntidadeFornecedor, EntidadePedidoCompra, EntidadePedidoVenda, EntidadeCliente:
		return true
	}
	return false
}

// Normalizar limpa espacos.
func (d *DadosAnexo) Normalizar() {
	d.Tipo = strings.ToUpper(strings.TrimSpace(d.Tipo))
	d.Categoria = strings.TrimSpace(d.Categoria)
	d.Titulo = strings.TrimSpace(d.Titulo)
	d.Descricao = strings.TrimSpace(d.Descricao)
	d.Versao = strings.TrimSpace(d.Versao)
}

// Validar confere forma e a combinacao tipo x conteudo x entidade.
func (d DadosAnexo) Validar(tipoMime string) error {
	if !slices.Contains(EntidadesValidas, d.Entidade) || d.EntidadeID <= 0 {
		return ErrEntidadeInvalida
	}
	switch {
	case utf8.RuneCountInString(d.Titulo) > 150, utf8.RuneCountInString(d.Descricao) > 500,
		utf8.RuneCountInString(d.Versao) > 20, utf8.RuneCountInString(d.Categoria) > 40:
		return ErrCamposLongos
	case !d.DataEmissao.IsZero() && !d.DataValidade.IsZero() && d.DataEmissao.After(d.DataValidade):
		return ErrValidadeAntesEmissao
	}
	produto := d.Entidade == EntidadeProduto || d.Entidade == EntidadePeca
	if registroOperacional(d.Entidade) {
		if d.Tipo != TipoAnexo {
			return ErrTipoAnexoInvalido
		}
		if !slices.Contains(categoriasDe(d.Entidade), d.Categoria) {
			return ErrCategoriaInvalida
		}
		return nil
	}
	switch d.Tipo {
	case TipoFoto:
		if !EhImagem(tipoMime) {
			return ErrFotoPrecisaSerImagem
		}
	case TipoDocumento:
		if produto && tipoMime != MimePDF {
			return ErrDocumentoPrecisaPDF
		}
		if lista := categoriasDe(d.Entidade); lista != nil && !slices.Contains(lista, d.Categoria) {
			return ErrCategoriaInvalida
		}
	case TipoAnexo:
		if lista := categoriasDe(d.Entidade); lista != nil && d.Categoria != "" && !slices.Contains(lista, d.Categoria) {
			return ErrCategoriaInvalida
		}
	default:
		return ErrTipoAnexoInvalido
	}
	return nil
}

// VencimentoDocumento e um documento vigente vencido ou a vencer.
type VencimentoDocumento struct {
	AnexoID        int64      `json:"anexo_id"`
	Entidade       string     `json:"entidade"`
	EntidadeID     int64      `json:"entidade_id"`
	EntidadeCodigo string     `json:"entidade_codigo"`
	Categoria      string     `json:"categoria"`
	Titulo         string     `json:"titulo"`
	DataValidade   tempo.Data `json:"data_validade"`
	Vencido        bool       `json:"vencido"`
}

// Repositorio e a porta de persistencia de arquivos e anexos.
type Repositorio interface {
	// SalvarArquivo grava o conteudo ou, se o SHA-256 ja existe, devolve o
	// arquivo existente (deduplicacao).
	SalvarArquivo(ctx context.Context, a *Arquivo, autor string) (*Arquivo, error)
	BuscarArquivo(ctx context.Context, id string, comConteudo bool) (*Arquivo, error)
	BuscarMiniatura(ctx context.Context, id string) ([]byte, error)
	// UsosDoArquivo devolve as entidades que usam o arquivo e quem o enviou.
	UsosDoArquivo(ctx context.Context, id string) (entidades []string, enviadoPor string, err error)
	ListarAnexos(ctx context.Context, entidade string, entidadeID int64) ([]Anexo, error)
	BuscarAnexo(ctx context.Context, id int64) (*Anexo, error)
	// CriarAnexo grava o vinculo aplicando galeria, principal e versao na
	// mesma transacao.
	CriarAnexo(ctx context.Context, d DadosAnexo, autor string) (int64, error)
	AtualizarAnexo(ctx context.Context, id int64, d DadosAnexo, autor string) error
	RemoverAnexo(ctx context.Context, id int64) error
	VencimentosDocumentos(ctx context.Context, dias int, entidades []string) ([]VencimentoDocumento, error)
	// FotosPrincipais devolve o arquivo da foto principal de cada entidade.
	FotosPrincipais(ctx context.Context, entidade string, ids []int64) (map[int64]string, error)
}

// Servico reune os casos de uso.
type Servico struct {
	repo      Repositorio
	assinador *Assinador
}

// NovoServico monta o servico.
func NovoServico(repo Repositorio, assinador *Assinador) *Servico {
	return &Servico{repo: repo, assinador: assinador}
}

// Assinador expoe o assinador (handlers de outros modulos assinam miniaturas).
func (s *Servico) Assinador() *Assinador { return s.assinador }

// Enviar valida e guarda um arquivo.
func (s *Servico) Enviar(ctx context.Context, nome string, conteudo []byte, autor string) (*Arquivo, error) {
	a, err := Preparar(nome, conteudo)
	if err != nil {
		return nil, err
	}
	salvo, err := s.repo.SalvarArquivo(ctx, a, autor)
	if err != nil {
		return nil, err
	}
	// Conteudo repetido devolve o registro existente: o nome e a data do
	// envio de outra pessoa nao voltam para quem enviou agora.
	salvo.NomeOriginal = a.NomeOriginal
	return salvo, nil
}

// BuscarArquivo devolve um arquivo (com os bytes, se pedido).
func (s *Servico) BuscarArquivo(ctx context.Context, id string, comConteudo bool) (*Arquivo, error) {
	if !IDValido(id) {
		return nil, ErrNaoEncontrado
	}
	return s.repo.BuscarArquivo(ctx, id, comConteudo)
}

// BuscarMiniatura devolve so os bytes da miniatura (listas: ~10 KB, nao o
// original inteiro).
func (s *Servico) BuscarMiniatura(ctx context.Context, id string) ([]byte, error) {
	if !IDValido(id) {
		return nil, ErrNaoEncontrado
	}
	return s.repo.BuscarMiniatura(ctx, id)
}

// UsosDoArquivo informa quem usa o arquivo (para a autorizacao da URL).
func (s *Servico) UsosDoArquivo(ctx context.Context, id string) ([]string, string, error) {
	if !IDValido(id) {
		return nil, "", ErrNaoEncontrado
	}
	return s.repo.UsosDoArquivo(ctx, id)
}

// AssinarAnexos preenche URL e miniatura assinadas.
func (s *Servico) AssinarAnexos(anexos []Anexo) {
	for i := range anexos {
		anexos[i].URL, _ = s.assinador.URL(anexos[i].Arquivo.ID, false)
		if anexos[i].Arquivo.TemMiniatura {
			anexos[i].MiniaturaURL, _ = s.assinador.URL(anexos[i].Arquivo.ID, true)
		}
	}
}

// Listar devolve os anexos de uma entidade, com URLs assinadas.
func (s *Servico) Listar(ctx context.Context, entidade string, entidadeID int64) ([]Anexo, error) {
	if !slices.Contains(EntidadesValidas, entidade) {
		return nil, ErrEntidadeInvalida
	}
	lista, err := s.repo.ListarAnexos(ctx, entidade, entidadeID)
	if err == nil {
		s.AssinarAnexos(lista)
	}
	return lista, err
}

// BuscarAnexo devolve um anexo (para conferir permissao antes de alterar).
func (s *Servico) BuscarAnexo(ctx context.Context, id int64) (*Anexo, error) {
	return s.repo.BuscarAnexo(ctx, id)
}

// Anexar vincula um arquivo ja enviado a uma entidade.
func (s *Servico) Anexar(ctx context.Context, d DadosAnexo, autor string) (*Anexo, error) {
	d.Normalizar()
	if !IDValido(d.ArquivoID) {
		return nil, ErrIDArquivo
	}
	a, err := s.repo.BuscarArquivo(ctx, d.ArquivoID, false)
	if err != nil {
		return nil, err
	}
	if err := d.Validar(a.TipoMime); err != nil {
		return nil, err
	}
	if d.Tipo != TipoFoto {
		d.Principal = false
	}
	id, err := s.repo.CriarAnexo(ctx, d, autor)
	if err != nil {
		return nil, err
	}
	return s.anexoAssinado(ctx, id)
}

// Atualizar altera metadados (titulo, descricao, validade, principal...).
func (s *Servico) Atualizar(ctx context.Context, id int64, d DadosAnexo, autor string) (*Anexo, error) {
	atual, err := s.repo.BuscarAnexo(ctx, id)
	if err != nil {
		return nil, err
	}
	d.Normalizar()
	d.Entidade, d.EntidadeID, d.Tipo, d.ArquivoID = atual.Entidade, atual.EntidadeID, atual.Tipo, atual.Arquivo.ID
	if d.ManterPrincipal {
		d.Principal = atual.Principal
	}
	if d.Tipo == TipoDocumento && d.Categoria == "" {
		d.Categoria = atual.Categoria
	}
	if err := d.Validar(atual.Arquivo.TipoMime); err != nil {
		return nil, err
	}
	if d.Tipo != TipoFoto {
		d.Principal = false
	}
	if err := s.repo.AtualizarAnexo(ctx, id, d, autor); err != nil {
		return nil, err
	}
	return s.anexoAssinado(ctx, id)
}

// Remover desvincula o anexo (o arquivo fica: pode ser usado em outro lugar).
func (s *Servico) Remover(ctx context.Context, id int64) error {
	return s.repo.RemoverAnexo(ctx, id)
}

func (s *Servico) anexoAssinado(ctx context.Context, id int64) (*Anexo, error) {
	a, err := s.repo.BuscarAnexo(ctx, id)
	if err != nil {
		return nil, err
	}
	lista := []Anexo{*a}
	s.AssinarAnexos(lista)
	return &lista[0], nil
}

// VencimentosDocumentos lista documentos vigentes vencidos ou a vencer das
// entidades informadas (as que quem consulta pode ver).
func (s *Servico) VencimentosDocumentos(ctx context.Context, dias int, entidades []string) ([]VencimentoDocumento, error) {
	if dias <= 0 || dias > 365 {
		dias = 30
	}
	if len(entidades) == 0 {
		return []VencimentoDocumento{}, nil
	}
	return s.repo.VencimentosDocumentos(ctx, dias, entidades)
}

// MiniaturasPrincipais devolve a URL assinada da miniatura da foto principal
// de cada entidade (para listas: separacao, estoque, recebimento).
func (s *Servico) MiniaturasPrincipais(ctx context.Context, entidade string, ids []int64) (map[int64]string, error) {
	fotos, err := s.repo.FotosPrincipais(ctx, entidade, ids)
	if err != nil {
		return nil, err
	}
	urls := make(map[int64]string, len(fotos))
	for id, arquivoID := range fotos {
		urls[id], _ = s.assinador.URL(arquivoID, true)
	}
	return urls, nil
}
