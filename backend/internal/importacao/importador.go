package importacao

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/documento"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/jackc/pgx/v5"
	"github.com/xuri/excelize/v2"
)

// Criadores sao as portas de cada cadastro: os mesmos servicos de dominio que
// as telas usam, de modo que a planilha obedece exatamente as mesmas regras.
type (
	CriadorCliente interface {
		Criar(ctx context.Context, d cliente.Dados, autor string) (*cliente.Cliente, error)
	}
	CriadorFornecedor interface {
		Criar(ctx context.Context, d fornecedor.Dados, autor string) (*fornecedor.Fornecedor, error)
	}
	CriadorProduto interface {
		Criar(ctx context.Context, d produto.Dados, autor string) (*produto.ProdutoAcabado, error)
	}
	CriadorPeca interface {
		Criar(ctx context.Context, d peca.Dados, autor string) (*peca.PartePeca, error)
	}
)

// Importador grava as planilhas.
type Importador struct {
	Clientes     CriadorCliente
	Fornecedores CriadorFornecedor
	Produtos     CriadorProduto
	Pecas        CriadorPeca
}

// contexto de uma execucao: acumula erros e o resumo.
type execucao struct {
	ctx     context.Context
	tx      pgx.Tx
	autor   string
	erros   []Erro
	resumo  []ResumoAba
	atual   *ResumoAba
	nomeAba string
	// repetidos guarda, por aba, os identificadores ja lidos (CNPJ/codigo).
	repetidos vistosPorAba
}

// Executar valida e importa a planilha numa unica transacao. `exec` e o
// executor da requisicao (conexao fixada pela auditoria ou o pool). Havendo
// qualquer erro, a transacao e desfeita e nada fica gravado.
func (im *Importador) Executar(ctx context.Context, exec db.Executor, planilha Planilha, errosLeitura []Erro, autor string) (Resultado, error) {
	if len(errosLeitura) > 0 {
		return Resultado{Resumo: []ResumoAba{}, Erros: errosLeitura}, nil
	}

	tx, err := exec.Begin(ctx)
	if err != nil {
		return Resultado{}, fmt.Errorf("abrir transacao de importacao: %w", err)
	}
	concluida := false
	defer func() {
		if !concluida {
			if err := tx.Rollback(ctx); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
				slog.Warn("falha ao desfazer importacao", "erro", err)
			}
		}
	}()

	e := &execucao{ctx: ctx, tx: tx, autor: autor, erros: []Erro{}, resumo: []ResumoAba{}}

	etapas := []struct {
		aba string
		fn  func(*execucao, Linha) // processa uma linha
	}{
		{AbaClientes, im.linhaCliente},
		{AbaFornecedor, im.linhaFornecedor},
		{AbaProdutos, im.linhaProduto},
		{AbaPecas, im.linhaPeca},
	}
	for _, etapa := range etapas {
		linhas := planilha[etapa.aba]
		if len(linhas) == 0 {
			continue
		}
		e.nomeAba = etapa.aba
		e.atual = &ResumoAba{Aba: etapa.aba, Lidas: len(linhas)}
		for _, l := range linhas {
			etapa.fn(e, l)
		}
		e.resumo = append(e.resumo, *e.atual)
	}
	if len(e.erros) > 0 {
		for i := range e.resumo {
			e.resumo[i].Importadas = 0
		}
		return Resultado{Importado: false, Resumo: e.resumo, Erros: e.erros}, nil
	}
	if err := tx.Commit(ctx); err != nil {
		return Resultado{}, fmt.Errorf("confirmar importacao: %w", err)
	}
	concluida = true
	return Resultado{Importado: true, Resumo: e.resumo, Erros: []Erro{}}, nil
}

func (e *execucao) erro(l Linha, coluna, mensagem string) {
	e.erros = append(e.erros, Erro{Aba: e.nomeAba, Linha: l.Numero, Coluna: coluna, Mensagem: mensagem})
}

// salvar roda `gravar` dentro de um savepoint: se o servico falhar, so aquela
// linha e desfeita e a conferencia segue com as demais, para devolver todos
// os erros de uma vez.
func (e *execucao) salvar(l Linha, gravar func(ctx context.Context) error) bool {
	sp, err := e.tx.Begin(e.ctx)
	if err != nil {
		e.erro(l, "", "falha interna ao preparar a linha: "+err.Error())
		return false
	}
	if err := gravar(db.ComExecutor(e.ctx, sp)); err != nil {
		_ = sp.Rollback(e.ctx)
		e.erro(l, "", mensagemDeDominio(err))
		return false
	}
	if err := sp.Commit(e.ctx); err != nil {
		e.erro(l, "", "falha interna ao gravar a linha: "+err.Error())
		return false
	}
	return true
}

// existe consulta, dentro da transacao, se o registro ja existe (inclusive os
// criados antes, na mesma planilha).
func (e *execucao) existe(consulta string, arg any) (bool, error) {
	var existe bool
	err := e.tx.QueryRow(e.ctx, consulta, arg).Scan(&existe)
	return existe, err
}

func mensagemDeDominio(err error) string {
	return strings.TrimSpace(err.Error())
}

// leitor de colunas de uma linha, que acumula os erros de conversao.
type campos struct {
	e      *execucao
	aba    Aba
	linha  Linha
	temErr bool
}

func (e *execucao) campos(aba string, l Linha) *campos {
	for _, a := range Abas {
		if a.Nome == aba {
			return &campos{e: e, aba: a, linha: l}
		}
	}
	panic("aba desconhecida: " + aba)
}

func (c *campos) texto(i int) string { return c.linha.Valores[i] }

func (c *campos) falhou(i int, mensagem string) {
	c.temErr = true
	c.e.erro(c.linha, c.aba.Colunas[i].Titulo, mensagem)
}

func (c *campos) obrigatorio(i int) string {
	v := c.texto(i)
	if v == "" {
		c.falhou(i, "campo obrigatório não preenchido")
	}
	return v
}

func (c *campos) inteiro(i int, obrigatorio bool) int {
	v := c.texto(i)
	if v == "" {
		if obrigatorio {
			c.falhou(i, "campo obrigatório não preenchido")
		}
		return 0
	}
	v = strings.TrimSuffix(strings.TrimSuffix(v, ".0"), ",0")
	n, err := strconv.Atoi(v)
	if err != nil {
		c.falhou(i, fmt.Sprintf("%q não é um número inteiro", c.texto(i)))
		return 0
	}
	return n
}

func (c *campos) simNao(i int) bool {
	v := semAcento(strings.ToLower(c.texto(i)))
	switch v {
	case "", "nao", "n", "false", "0", "no":
		return false
	case "sim", "s", "true", "1", "x", "yes", "si":
		return true
	}
	c.falhou(i, fmt.Sprintf("%q não é Sim nem Não", c.texto(i)))
	return false
}

func (c *campos) dinheiro(i int) dinheiro.Dinheiro {
	v := c.obrigatorio(i)
	if v == "" {
		return 0
	}
	// Aceita 1.234,56 (pt-BR) e 1234.56.
	if strings.Contains(v, ",") {
		v = strings.ReplaceAll(strings.ReplaceAll(v, ".", ""), ",", ".")
	}
	d, err := dinheiro.DeString(v)
	if err != nil {
		c.falhou(i, fmt.Sprintf("%q não é um valor monetário válido (use até 2 casas decimais)", c.texto(i)))
		return 0
	}
	return d
}

func (c *campos) data(i int) tempo.Data {
	v := c.texto(i)
	if v == "" {
		return tempo.Data{}
	}
	for _, camada := range []string{"2006-01-02", "02/01/2006", "2/1/2006", "02-01-2006"} {
		if t, err := time.Parse(camada, v); err == nil {
			return tempo.Data{Time: t}
		}
	}
	// Celula de data do Excel lida em formato bruto: numero de serie.
	if serial, err := strconv.ParseFloat(strings.ReplaceAll(v, ",", "."), 64); err == nil && serial > 1 && serial < 2958466 {
		if t, err := excelize.ExcelDateToTime(math.Floor(serial), false); err == nil {
			return tempo.Data{Time: time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)}
		}
	}
	c.falhou(i, fmt.Sprintf("data %q inválida; use AAAA-MM-DD ou DD/MM/AAAA", v))
	return tempo.Data{}
}

// cnpj devolve so os digitos, repondo zeros a esquerda perdidos pelo Excel.
func (c *campos) cnpj(i int, obrigatorio bool) string {
	v := c.texto(i)
	if v == "" {
		if obrigatorio {
			c.falhou(i, "campo obrigatório não preenchido")
		}
		return ""
	}
	d := documento.ApenasDigitos(strings.TrimSuffix(v, ".0"))
	for len(d) < 14 && len(d) >= 12 {
		d = "0" + d
	}
	return d
}

func semAcento(s string) string {
	return strings.NewReplacer(
		"á", "a", "à", "a", "â", "a", "ã", "a", "é", "e", "ê", "e", "í", "i",
		"ó", "o", "ô", "o", "õ", "o", "ú", "u", "ç", "c", "_", " ",
	).Replace(s)
}

func tipoDeCliente(v string) (string, bool) {
	switch semAcento(strings.ToLower(strings.TrimSpace(v))) {
	case "orgao publico":
		return cliente.TipoOrgaoPublico, true
	case "concessionaria":
		return cliente.TipoConcessionaria, true
	case "integrador":
		return cliente.TipoIntegrador, true
	case "outro":
		return cliente.TipoOutro, true
	}
	return "", false
}

// duplicadoNaPlanilha registra o identificador e acusa repeticao.
func (e *execucao) duplicadoNaPlanilha(chave string, l Linha, coluna string) bool {
	vistos := e.vistos(e.nomeAba)
	if anterior, ok := vistos[chave]; ok {
		e.erro(l, coluna, fmt.Sprintf("repetido na planilha (já informado na linha %d)", anterior))
		return true
	}
	vistos[chave] = l.Numero
	return false
}

// Os mapas de repeticao ficam no proprio Importador por execucao.
type vistosPorAba map[string]map[string]int

func (e *execucao) vistos(chaveAba string) map[string]int {
	if e.repetidos == nil {
		e.repetidos = vistosPorAba{}
	}
	if e.repetidos[chaveAba] == nil {
		e.repetidos[chaveAba] = map[string]int{}
	}
	return e.repetidos[chaveAba]
}
