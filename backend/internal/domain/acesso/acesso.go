// Package acesso contem perfis e permissoes (RBAC, doc 0 secao 4.7.3). O
// catalogo de permissoes e fixo e mora aqui; a migration 014 o espelha no
// banco (um teste garante que os dois batem). A matriz perfil x permissao e
// dado: o Administrador a edita pela tela, sem mudar codigo.
package acesso

import (
	"errors"
	"regexp"
	"strings"
)

// Codigos das permissoes. Usar estas constantes (e nao strings soltas) nos
// handlers faz o compilador pegar um nome errado.
const (
	FornecedoresVisualizar = "fornecedores.visualizar"
	FornecedoresIncluir    = "fornecedores.incluir"
	FornecedoresEditar     = "fornecedores.editar"
	FornecedoresInativar   = "fornecedores.inativar"

	ClientesVisualizar = "clientes.visualizar"
	ClientesIncluir    = "clientes.incluir"
	ClientesEditar     = "clientes.editar"
	ClientesInativar   = "clientes.inativar"

	PecasVisualizar = "partes_pecas.visualizar"
	PecasIncluir    = "partes_pecas.incluir"
	PecasEditar     = "partes_pecas.editar"
	PecasInativar   = "partes_pecas.inativar"

	ProdutosVisualizar = "produtos.visualizar"
	ProdutosIncluir    = "produtos.incluir"
	ProdutosEditar     = "produtos.editar"
	ProdutosInativar   = "produtos.inativar"

	EstruturaVisualizar = "estrutura.visualizar"
	EstruturaIncluir    = "estrutura.incluir"

	CentrosVisualizar = "centros_trabalho.visualizar"
	CentrosIncluir    = "centros_trabalho.incluir"
	CentrosEditar     = "centros_trabalho.editar"
	CentrosInativar   = "centros_trabalho.inativar"

	CotacoesVisualizar = "cotacoes.visualizar"
	CotacoesIncluir    = "cotacoes.incluir"
	CotacoesEditar     = "cotacoes.editar"
	CotacoesCancelar   = "cotacoes.cancelar"
	CotacoesConverter  = "cotacoes.converter"

	PedidosVisualizar        = "pedidos_compra.visualizar"
	PedidosIncluir           = "pedidos_compra.incluir"
	PedidosEditar            = "pedidos_compra.editar"
	PedidosEmitir            = "pedidos_compra.emitir"
	PedidosEmitirAcimaAlcada = "pedidos_compra.emitir_acima_alcada"
	PedidosCancelar          = "pedidos_compra.cancelar"
	PedidosReceber           = "pedidos_compra.receber"
	PedidosExportar          = "pedidos_compra.exportar"
	PedidosEncerrar          = "pedidos_compra.encerrar"

	NotasVisualizar         = "notas_entrada.visualizar"
	NotasLancar             = "notas_entrada.lancar"
	NotasEfetivar           = "notas_entrada.efetivar"
	NotasEstornar           = "notas_entrada.estornar"
	NotasAprovarDivergencia = "notas_entrada.aprovar_divergencia"

	EstoqueVisualizar = "estoque.visualizar"
	EstoqueAjustar    = "estoque.ajustar"
	EstoqueExportar   = "estoque.exportar"

	NecessidadeVisualizar = "necessidade_compra.visualizar"

	PedidosVendaVisualizar = "pedidos_venda.visualizar"
	PedidosVendaIncluir    = "pedidos_venda.incluir"
	PedidosVendaEditar     = "pedidos_venda.editar"
	PedidosVendaCancelar   = "pedidos_venda.cancelar"
	PedidosVendaEntregar   = "pedidos_venda.entregar"

	ProducaoVisualizar = "producao.visualizar"
	ProducaoGerarOP    = "producao.gerar_op"
	ProducaoLiberar    = "producao.liberar"
	ProducaoApontar    = "producao.apontar"
	ProducaoAvancar    = "producao.avancar"
	ProducaoCancelar   = "producao.cancelar"
	ProducaoTestar     = "producao.testar"
	ProducaoMetrologia = "producao.metrologia"
	ProducaoCustos     = "producao.custos"

	PaineisCompras   = "paineis.compras"
	PaineisEstoque   = "paineis.estoque"
	PaineisProducao  = "paineis.producao"
	PaineisVendas    = "paineis.vendas"
	PaineisQualidade = "paineis.qualidade"

	ConfigEmpresa           = "configuracoes.empresa"
	ConfigRegional          = "configuracoes.regional"
	ConfigNegocio           = "configuracoes.negocio"
	ConfigIntegracoes       = "configuracoes.integracoes"
	ConfigBanco             = "configuracoes.banco"
	ConfigAuditoria         = "configuracoes.auditoria"
	ConfigAuditoriaExportar = "configuracoes.auditoria_exportar"
	ConfigPerfis            = "configuracoes.perfis"
	ConfigUsuarios          = "configuracoes.usuarios"
)

// Catalogo e a lista completa, na ordem de exibicao da matriz.
var Catalogo = []string{
	FornecedoresVisualizar, FornecedoresIncluir, FornecedoresEditar, FornecedoresInativar,
	ClientesVisualizar, ClientesIncluir, ClientesEditar, ClientesInativar,
	PecasVisualizar, PecasIncluir, PecasEditar, PecasInativar,
	ProdutosVisualizar, ProdutosIncluir, ProdutosEditar, ProdutosInativar,
	EstruturaVisualizar, EstruturaIncluir,
	CentrosVisualizar, CentrosIncluir, CentrosEditar, CentrosInativar,
	CotacoesVisualizar, CotacoesIncluir, CotacoesEditar, CotacoesCancelar, CotacoesConverter,
	PedidosVisualizar, PedidosIncluir, PedidosEditar, PedidosEmitir, PedidosEmitirAcimaAlcada,
	PedidosCancelar, PedidosReceber, PedidosExportar, PedidosEncerrar,
	NotasVisualizar, NotasLancar, NotasEfetivar, NotasEstornar, NotasAprovarDivergencia,
	EstoqueVisualizar, EstoqueAjustar, EstoqueExportar,
	PedidosVendaVisualizar, PedidosVendaIncluir, PedidosVendaEditar, PedidosVendaCancelar, PedidosVendaEntregar,
	NecessidadeVisualizar,
	ProducaoVisualizar, ProducaoGerarOP, ProducaoLiberar, ProducaoApontar, ProducaoAvancar, ProducaoCancelar,
	ProducaoTestar, ProducaoMetrologia, ProducaoCustos,
	PaineisCompras, PaineisEstoque, PaineisProducao, PaineisVendas, PaineisQualidade,
	ConfigEmpresa, ConfigRegional, ConfigNegocio, ConfigIntegracoes, ConfigBanco,
	ConfigAuditoria, ConfigAuditoriaExportar, ConfigPerfis, ConfigUsuarios,
}

// PerfilAdmin tem todas as permissoes por regra, inclusive as que entrarem
// no catalogo no futuro -- e nao pode ser editado, para ninguem trancar o
// sistema para fora.
const PerfilAdmin = "ADMIN"

var (
	ErrPerfilNaoEncontrado   = errors.New("perfil nao encontrado")
	ErrAdminImutavel         = errors.New("o perfil Administrador tem todas as permissoes e nao pode ser alterado")
	ErrPerfilDoSistema       = errors.New("perfis do sistema nao podem ser excluidos -- ajuste as permissoes dele")
	ErrPerfilEmUso           = errors.New("o perfil tem usuarios -- mude o perfil deles antes de excluir")
	ErrCodigoInvalido        = errors.New("o codigo do perfil deve ter de 2 a 30 caracteres: letras maiusculas, numeros e _, comecando por letra")
	ErrCodigoDuplicado       = errors.New("ja existe um perfil com este codigo")
	ErrNomeObrigatorio       = errors.New("informe o nome do perfil (ate 80 caracteres)")
	ErrPermissaoDesconhecida = errors.New("permissao fora do catalogo")
	ErrDescricaoLonga        = errors.New("a descricao do perfil vai ate 255 caracteres")
	ErrProprioPerfil         = errors.New("ninguem edita o proprio perfil -- peca a outro administrador")
	ErrConcederSemTer        = errors.New("so e possivel conceder permissoes que o seu proprio perfil tem")
)

var padraoCodigo = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,29}$`)

// Acesso e o que um usuario pode fazer AGORA -- resolvido do banco a cada
// requisicao (com cache), nao do token: trocar o perfil, inativar, bloquear
// ou mexer nas permissoes individuais vale na requisicao seguinte.
type Acesso struct {
	UsuarioID       int64
	Perfil          string
	Ativo           bool
	DeveTrocarSenha bool
	VersaoSessao    int
	Permissoes      map[string]bool
}

// DadosDeAcesso e o que o repositorio le para montar o Acesso.
type DadosDeAcesso struct {
	Perfil          string
	Situacao        string
	DeveTrocarSenha bool
	VersaoSessao    int
	Concedidas      []string
	Retiradas       []string
}

// ErrUsuarioNaoEncontrado: token de um usuario que nao existe mais.
var ErrUsuarioNaoEncontrado = errors.New("usuario nao encontrado")

// ErrPerfilAcimaDoEditor: so edita um perfil quem tem todas as permissoes dele.
var ErrPerfilAcimaDoEditor = errors.New("voce so pode editar um perfil cujas permissoes voce tambem tem")

// Permissao e um item do catalogo como a tela exibe.
type Permissao struct {
	Codigo    string `json:"codigo"`
	Modulo    string `json:"modulo"`
	Acao      string `json:"acao"`
	Descricao string `json:"descricao"`
	Sensivel  bool   `json:"sensivel"`
}

// Perfil e um perfil de acesso com as suas permissoes.
type Perfil struct {
	Codigo     string   `json:"codigo"`
	Nome       string   `json:"nome"`
	Descricao  string   `json:"descricao"`
	Sistema    bool     `json:"sistema"`
	Permissoes []string `json:"permissoes"`
	Usuarios   int      `json:"usuarios"`
}

// Dados sao os campos editaveis de um perfil.
type Dados struct {
	Nome       string
	Descricao  string
	Permissoes []string
}

// Editor e quem esta editando perfis: o perfil dele e as permissoes que tem.
// Sem estas regras, configuracoes.perfis seria o mesmo que ser ADMIN -- quem
// a tivesse se daria qualquer permissao editando o proprio perfil.
type Editor struct {
	Perfil     string
	Permissoes map[string]bool
}

// Normalizar limpa espacos e remove permissoes repetidas. Lista nula vira
// vazia: "nenhuma permissao" e diferente de "nao informado" so na API.
func (d *Dados) Normalizar() {
	if d.Permissoes == nil {
		d.Permissoes = []string{}
	}
	d.Nome = strings.TrimSpace(d.Nome)
	d.Descricao = strings.TrimSpace(d.Descricao)
	vistas := make(map[string]bool, len(d.Permissoes))
	unicas := d.Permissoes[:0]
	for _, p := range d.Permissoes {
		if !vistas[p] {
			vistas[p] = true
			unicas = append(unicas, p)
		}
	}
	d.Permissoes = unicas
}

// Validar confere nome e que toda permissao existe no catalogo.
func (d Dados) Validar() error {
	if d.Nome == "" || len([]rune(d.Nome)) > 80 {
		return ErrNomeObrigatorio
	}
	if len([]rune(d.Descricao)) > 255 {
		return ErrDescricaoLonga
	}
	for _, p := range d.Permissoes {
		if !noCatalogo(p) {
			return ErrPermissaoDesconhecida
		}
	}
	return nil
}

// ValidarCodigo confere o formato do codigo de um perfil novo.
func ValidarCodigo(codigo string) error {
	if !padraoCodigo.MatchString(codigo) {
		return ErrCodigoInvalido
	}
	return nil
}

func noCatalogo(codigo string) bool {
	for _, c := range Catalogo {
		if c == codigo {
			return true
		}
	}
	return false
}
