package importacao

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/controle"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/jackc/pgx/v5"
)

// Indices das colunas, na ordem de `Abas` (modelo.go).
const (
	cliTipo = iota
	cliRazao
	cliCNPJ
	cliFantasia
	cliIE
	cliContato
	cliEmail
	cliTelefone
	cliEndereco
	cliCidade
	cliUF
	cliContrato
	cliVigIni
	cliVigFim
	cliCondicao
	cliObs
)

const (
	forRazao = iota
	forCNPJ
	forLeadTime
	forContato
	forEmail
	forTelefone
	forEndereco
	forCondicao
)

const (
	proCodigo = iota
	proDescricao
	proUnidade
	proPreco
	proLeadTime
	proMetrologia
	proComponente
	proSerie
	proLote
	proValidade
	proCritico
	proCertificado
)

const (
	pecCodigo = iota
	pecDescricao
	pecUnidade
	pecMin
	pecMax
	pecLeadTime
	pecFornecedor
	pecValidadeMin
	pecMascara
	pecSerie
	pecLote
	pecValidade
	pecCritico
	pecCertificado
)

func (im *Importador) linhaCliente(e *execucao, l Linha) {
	c := e.campos(AbaClientes, l)

	tipoTexto := c.obrigatorio(cliTipo)
	tipo, ok := tipoDeCliente(tipoTexto)
	if tipoTexto != "" && !ok {
		c.falhou(cliTipo, fmt.Sprintf("tipo %q inválido; use Órgão público, Concessionária, Integrador ou Outro", tipoTexto))
	}
	razao := c.obrigatorio(cliRazao)
	cnpj := c.cnpj(cliCNPJ, true)
	dados := cliente.Dados{
		Tipo: tipo, RazaoSocial: razao, CNPJ: cnpj,
		NomeFantasia: c.texto(cliFantasia), InscricaoEstadual: c.texto(cliIE),
		ContatoNome: c.texto(cliContato), ContatoEmail: c.texto(cliEmail), ContatoTelefone: c.texto(cliTelefone),
		Endereco: c.texto(cliEndereco), Cidade: c.texto(cliCidade), UF: c.texto(cliUF),
		NumeroContrato: c.texto(cliContrato), VigenciaInicio: c.data(cliVigIni), VigenciaFim: c.data(cliVigFim),
		CondicaoPagamento: c.texto(cliCondicao), Observacoes: c.texto(cliObs),
	}
	if c.temErr || cnpj == "" {
		return
	}
	if e.duplicadoNaPlanilha(cnpj, l, "CNPJ") {
		return
	}
	existe, err := e.existe(`SELECT EXISTS(SELECT 1 FROM clientes WHERE cnpj = $1)`, cnpj)
	if err != nil {
		e.erro(l, "CNPJ", "falha ao consultar o cadastro: "+err.Error())
		return
	}
	if existe {
		e.atual.Ignoradas++
		return
	}
	if e.salvar(l, func(ctx context.Context) error {
		_, err := im.Clientes.Criar(ctx, dados, e.autor)
		return err
	}) {
		e.atual.Importadas++
	}
}

func (im *Importador) linhaFornecedor(e *execucao, l Linha) {
	c := e.campos(AbaFornecedor, l)

	razao := c.obrigatorio(forRazao)
	cnpj := c.cnpj(forCNPJ, true)
	lead := c.inteiro(forLeadTime, true)
	dados := fornecedor.Dados{
		RazaoSocial: razao, CNPJ: cnpj, LeadTimeMedio: lead,
		ContatoNome: c.texto(forContato), ContatoEmail: c.texto(forEmail), ContatoTelefone: c.texto(forTelefone),
		Endereco: c.texto(forEndereco), CondicaoPagamento: c.texto(forCondicao),
	}
	if c.temErr || cnpj == "" {
		return
	}
	if e.duplicadoNaPlanilha(cnpj, l, "CNPJ") {
		return
	}
	existe, err := e.existe(`SELECT EXISTS(SELECT 1 FROM fornecedores WHERE cnpj = $1)`, cnpj)
	if err != nil {
		e.erro(l, "CNPJ", "falha ao consultar o cadastro: "+err.Error())
		return
	}
	if existe {
		e.atual.Ignoradas++
		return
	}
	if e.salvar(l, func(ctx context.Context) error {
		_, err := im.Fornecedores.Criar(ctx, dados, e.autor)
		return err
	}) {
		e.atual.Importadas++
	}
}

func (im *Importador) linhaProduto(e *execucao, l Linha) {
	c := e.campos(AbaProdutos, l)

	codigo := c.obrigatorio(proCodigo)
	dados := produto.Dados{
		Codigo: codigo, Descricao: c.obrigatorio(proDescricao), UnidadeMedida: c.obrigatorio(proUnidade),
		PrecoVenda: c.dinheiro(proPreco), LeadTimeProducao: c.inteiro(proLeadTime, true),
		ExigeMetrologia: c.simNao(proMetrologia), PodeSerComponente: c.simNao(proComponente),
		Controle: controle.Flags{
			ControlaNumeroSerie: c.simNao(proSerie), ControlaLote: c.simNao(proLote),
			ControlaValidade: c.simNao(proValidade), ItemCritico: c.simNao(proCritico),
			ExigeCertificado: c.simNao(proCertificado),
		},
	}
	if c.temErr || codigo == "" {
		return
	}
	chave := normalizarCodigo(codigo)
	if e.duplicadoNaPlanilha(chave, l, "Código") {
		return
	}
	existe, err := e.existe(`SELECT EXISTS(SELECT 1 FROM produtos_acabados WHERE codigo = $1)`, chave)
	if err != nil {
		e.erro(l, "Código", "falha ao consultar o cadastro: "+err.Error())
		return
	}
	if existe {
		e.atual.Ignoradas++
		return
	}
	if e.salvar(l, func(ctx context.Context) error {
		// O repositorio ja cria o espelho em partes/pecas quando o produto
		// pode ser componente.
		_, err := im.Produtos.Criar(ctx, dados, e.autor)
		return err
	}) {
		e.atual.Importadas++
	}
}

func (im *Importador) linhaPeca(e *execucao, l Linha) {
	c := e.campos(AbaPecas, l)

	codigo := c.obrigatorio(pecCodigo)
	dados := peca.Dados{
		Codigo: codigo, Descricao: c.obrigatorio(pecDescricao), UnidadeMedida: c.obrigatorio(pecUnidade),
		EstoqueMinimo: c.inteiro(pecMin, true), EstoqueMaximo: c.inteiro(pecMax, true),
		LeadTimeCompra: c.inteiro(pecLeadTime, true), ValidadeMinimaDias: c.inteiro(pecValidadeMin, false),
		MascaraSerie: c.texto(pecMascara),
		Controle: controle.Flags{
			ControlaNumeroSerie: c.simNao(pecSerie), ControlaLote: c.simNao(pecLote),
			ControlaValidade: c.simNao(pecValidade), ItemCritico: c.simNao(pecCritico),
			ExigeCertificado: c.simNao(pecCertificado),
		},
	}
	cnpjForn := c.cnpj(pecFornecedor, false)
	if cnpjForn != "" {
		var id int64
		err := e.tx.QueryRow(e.ctx, `SELECT id FROM fornecedores WHERE cnpj = $1`, cnpjForn).Scan(&id)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			c.falhou(pecFornecedor, fmt.Sprintf("fornecedor com CNPJ %s não existe no sistema nem na aba Fornecedores", c.texto(pecFornecedor)))
		case err != nil:
			c.falhou(pecFornecedor, "falha ao consultar o fornecedor: "+err.Error())
		default:
			dados.FornecedorPadraoID = &id
		}
	}
	if c.temErr || codigo == "" {
		return
	}
	chave := normalizarCodigo(codigo)
	if e.duplicadoNaPlanilha(chave, l, "Código") {
		return
	}
	existe, err := e.existe(`SELECT EXISTS(SELECT 1 FROM partes_pecas WHERE codigo = $1)`, chave)
	if err != nil {
		e.erro(l, "Código", "falha ao consultar o cadastro: "+err.Error())
		return
	}
	if existe {
		e.atual.Ignoradas++
		return
	}
	if e.salvar(l, func(ctx context.Context) error {
		_, err := im.Pecas.Criar(ctx, dados, e.autor)
		return err
	}) {
		e.atual.Importadas++
	}
}

// normalizarCodigo iguala o codigo ao que o dominio grava (maiusculas, sem espacos).
func normalizarCodigo(codigo string) string {
	return strings.ToUpper(strings.TrimSpace(codigo))
}
