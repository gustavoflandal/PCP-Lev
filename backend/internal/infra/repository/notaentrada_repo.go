package repository

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/notaentrada"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasNota = `n.id, n.pedido_compra_id, pc.numero_pc, n.fornecedor_id, f.razao_social, n.cnpj_emitente, n.modelo,
	n.serie, n.numero, n.chave_acesso, n.data_emissao, n.data_entrada, n.cfop, n.valor_produtos, n.valor_frete,
	n.valor_seguro, n.valor_desconto, n.valor_ipi, n.valor_icms_st, n.valor_total, n.status, n.versao, n.origem, n.observacoes,
	n.divergencia_aprovada_por, n.efetivada_em, n.efetivada_por, n.estornada_em, n.motivo_estorno, n.created_at`

const fromNota = ` FROM notas_fiscais_entrada n
	JOIN pedidos_compra pc ON pc.id = n.pedido_compra_id
	JOIN fornecedores f ON f.id = n.fornecedor_id `

// NotaEntradaRepositorio implementa notaentrada.Repositorio.
type NotaEntradaRepositorio struct {
	pool *pgxpool.Pool
}

// NovoNotaEntradaRepositorio cria o repositorio de notas de entrada.
func NovoNotaEntradaRepositorio(pool *pgxpool.Pool) *NotaEntradaRepositorio {
	return &NotaEntradaRepositorio{pool: pool}
}

func lerNota(l linha) (*notaentrada.Nota, error) {
	var n notaentrada.Nota
	if err := l.Scan(&n.ID, &n.PedidoCompraID, &n.NumeroPC, &n.FornecedorID, &n.FornecedorNome, &n.CNPJEmitente, &n.Modelo,
		&n.Serie, &n.Numero, &n.ChaveAcesso, &n.DataEmissao, &n.DataEntrada, &n.CFOP, &n.ValorProdutos, &n.ValorFrete,
		&n.ValorSeguro, &n.ValorDesconto, &n.ValorIPI, &n.ValorICMSST, &n.ValorTotal, &n.Status, &n.Versao, &n.Origem, &n.Observacoes,
		&n.DivergenciaAprovadaPor, &n.EfetivadaEm, &n.EfetivadaPor, &n.EstornadaEm, &n.MotivoEstorno, &n.CreatedAt); err != nil {
		return nil, err
	}
	return &n, nil
}

func erroDeNota(err error, operacao string) error {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return notaentrada.ErrNaoEncontrada
	case violouIndiceUnico(err):
		return notaentrada.ErrDuplicada
	case violouChaveEstrangeira(err):
		// FK de peca, item de PC ou certificado inexistente.
		return notaentrada.ErrCertificadoInvalido
	}
	return fmt.Errorf("%s: %w", operacao, err)
}

func nulo(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// gravarCabecalho insere ou atualiza o cabecalho (o fornecedor vem do PC).
func gravarItensNota(ctx context.Context, tx pgx.Tx, notaID int64, itens []notaentrada.Item) error {
	for _, it := range itens {
		var itemID int64
		err := tx.QueryRow(ctx, `
			INSERT INTO itens_nf_entrada (nota_id, ordem, item_pedido_compra_id, parte_peca_id, codigo_fornecedor, descricao_nf,
			  unidade_nf, quantidade_nf, valor_unitario, valor_total, fator_conversao, quantidade_recebida, bonificacao,
			  justificativa_bonificacao, certificado_arquivo_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::uuid)
			RETURNING id`, notaID, it.Ordem, it.ItemPedidoCompraID, it.PartePecaID, it.CodigoFornecedor, it.DescricaoNF,
			it.UnidadeNF, it.QuantidadeNF, it.ValorUnitario, it.ValorTotal, it.FatorConversao, it.QuantidadeRecebida,
			it.Bonificacao, it.JustificativaBonificacao, it.CertificadoArquivoID).Scan(&itemID)
		if err != nil {
			return erroDeNota(err, "gravar item da nota")
		}
		for _, l := range it.Lotes {
			if _, err := tx.Exec(ctx, `INSERT INTO itens_nf_lotes (item_nf_id, numero_lote, data_fabricacao, validade, quantidade, certificado_arquivo_id)
				VALUES ($1, $2, $3, $4, $5, $6::uuid)`, itemID, l.NumeroLote, l.DataFabricacao, l.Validade, l.Quantidade,
				l.CertificadoArquivoID); err != nil {
				return erroDeNota(err, "gravar lote do item")
			}
		}
		for _, s := range it.Series {
			if s.Numero == "" {
				continue
			}
			if _, err := tx.Exec(ctx, `INSERT INTO itens_nf_series (item_nf_id, numero, numero_lote) VALUES ($1, $2, $3)
				ON CONFLICT (item_nf_id, numero) DO NOTHING`, itemID, s.Numero, s.NumeroLote); err != nil {
				return erroDeNota(err, "gravar serie do item")
			}
		}
	}
	return nil
}

func argsCabecalho(d notaentrada.Dados) []any {
	return []any{d.PedidoCompraID, d.CNPJEmitente, d.Modelo, d.Serie, d.Numero, nulo(d.ChaveAcesso), d.DataEmissao, d.DataEntrada,
		d.CFOP, d.ValorProdutos, d.ValorFrete, d.ValorSeguro, d.ValorDesconto, d.ValorIPI, d.ValorICMSST, d.ValorTotal,
		d.Observacoes, d.Origem}
}

// Criar grava um rascunho com os itens.
func (r *NotaEntradaRepositorio) Criar(ctx context.Context, d notaentrada.Dados, autor string) (int64, error) {
	var id int64
	err := emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			INSERT INTO notas_fiscais_entrada (pedido_compra_id, fornecedor_id, cnpj_emitente, modelo, serie, numero, chave_acesso,
			  data_emissao, data_entrada, cfop, valor_produtos, valor_frete, valor_seguro, valor_desconto, valor_ipi, valor_icms_st,
			  valor_total, observacoes, origem, created_by, updated_by)
			SELECT $1, pc.fornecedor_id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19
			FROM pedidos_compra pc WHERE pc.id = $1
			RETURNING id`, append(argsCabecalho(d), autor)...).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return notaentrada.ErrPedidoObrigatorio
		}
		if err != nil {
			return erroDeNota(err, "criar nota")
		}
		return gravarItensNota(ctx, tx, id, d.Itens)
	})
	return id, err
}

// Atualizar regrava a nota em Rascunho/Conferida (volta a Rascunho).
func (r *NotaEntradaRepositorio) Atualizar(ctx context.Context, id int64, d notaentrada.Dados, autor string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		var status string
		if err := tx.QueryRow(ctx, `SELECT status FROM notas_fiscais_entrada WHERE id = $1 FOR UPDATE`, id).Scan(&status); err != nil {
			return erroDeNota(err, "travar nota")
		}
		if status != notaentrada.StatusRascunho && status != notaentrada.StatusConferida {
			return notaentrada.ErrStatusInvalidoParaAcao
		}
		etiqueta, err := tx.Exec(ctx, `
			UPDATE notas_fiscais_entrada n SET pedido_compra_id = $1, fornecedor_id = pc.fornecedor_id, cnpj_emitente = $2,
			  modelo = $3, serie = $4, numero = $5, chave_acesso = $6, data_emissao = $7, data_entrada = $8, cfop = $9,
			  valor_produtos = $10, valor_frete = $11, valor_seguro = $12, valor_desconto = $13, valor_ipi = $14,
			  valor_icms_st = $15, valor_total = $16, observacoes = $17, origem = $18, status = 'Rascunho', updated_by = $19,
			  versao = n.versao + 1
			FROM pedidos_compra pc WHERE pc.id = $1 AND n.id = $20`, append(argsCabecalho(d), autor, id)...)
		if err != nil {
			return erroDeNota(err, "atualizar nota")
		}
		if etiqueta.RowsAffected() == 0 {
			return notaentrada.ErrPedidoObrigatorio
		}
		if _, err := tx.Exec(ctx, `DELETE FROM itens_nf_entrada WHERE nota_id = $1`, id); err != nil {
			return fmt.Errorf("regravar itens: %w", err)
		}
		return gravarItensNota(ctx, tx, id, d.Itens)
	})
}

// carregarItens le os itens (com lotes, series e o contexto do PC).
func carregarItens(ctx context.Context, q interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, notaID int64) ([]notaentrada.Item, error) {
	linhas, err := q.Query(ctx, `
		SELECT i.id, i.ordem, i.item_pedido_compra_id, coalesce(pc.numero_pc, ''), i.parte_peca_id, pp.codigo, pp.descricao,
		       pp.unidade_medida, pp.controla_numero_serie, pp.controla_lote, pp.controla_validade, pp.item_critico,
		       pp.exige_certificado, i.codigo_fornecedor, i.descricao_nf, i.unidade_nf, i.quantidade_nf::float8,
		       i.valor_unitario::float8, i.valor_total, i.fator_conversao::float8, i.quantidade_recebida, i.bonificacao,
		       i.justificativa_bonificacao, i.certificado_arquivo_id::text, i.custo_unitario_entrada::float8,
		       ipc.preco_unitario, ipc.quantidade_solicitada, ipc.quantidade_recebida
		FROM itens_nf_entrada i
		JOIN partes_pecas pp ON pp.id = i.parte_peca_id
		LEFT JOIN itens_pedido_compra ipc ON ipc.id = i.item_pedido_compra_id
		LEFT JOIN pedidos_compra pc ON pc.id = ipc.pedido_compra_id
		WHERE i.nota_id = $1 ORDER BY i.ordem, i.id`, notaID)
	if err != nil {
		return nil, fmt.Errorf("listar itens da nota: %w", err)
	}
	itens := []notaentrada.Item{}
	porID := map[int64]int{}
	for linhas.Next() {
		var it notaentrada.Item
		var preco *dinheiro.Dinheiro
		if err := linhas.Scan(&it.ID, &it.Ordem, &it.ItemPedidoCompraID, &it.NumeroPC, &it.PartePecaID, &it.PecaCodigo,
			&it.PecaDescricao, &it.PecaUnidade, &it.Controle.ControlaNumeroSerie, &it.Controle.ControlaLote,
			&it.Controle.ControlaValidade, &it.Controle.ItemCritico, &it.Controle.ExigeCertificado, &it.CodigoFornecedor,
			&it.DescricaoNF, &it.UnidadeNF, &it.QuantidadeNF, &it.ValorUnitario, &it.ValorTotal, &it.FatorConversao,
			&it.QuantidadeRecebida, &it.Bonificacao, &it.JustificativaBonificacao, &it.CertificadoArquivoID,
			&it.CustoUnitarioEntrada, &preco, &it.PCSolicitada, &it.PCRecebidaAnterior); err != nil {
			linhas.Close()
			return nil, err
		}
		it.PCPrecoUnitario = preco
		it.Lotes, it.Series = []notaentrada.LoteItem{}, []notaentrada.SerieItem{}
		porID[it.ID] = len(itens)
		itens = append(itens, it)
	}
	linhas.Close()
	if len(itens) == 0 {
		return itens, nil
	}
	ids := make([]int64, 0, len(itens))
	for id := range porID {
		ids = append(ids, id)
	}
	linhas, err = q.Query(ctx, `SELECT item_nf_id, numero_lote, data_fabricacao, validade, quantidade,
		certificado_arquivo_id::text, lote_id FROM itens_nf_lotes WHERE item_nf_id = ANY($1) ORDER BY id`, ids)
	if err != nil {
		return nil, fmt.Errorf("listar lotes: %w", err)
	}
	for linhas.Next() {
		var itemID int64
		var l notaentrada.LoteItem
		if err := linhas.Scan(&itemID, &l.NumeroLote, &l.DataFabricacao, &l.Validade, &l.Quantidade, &l.CertificadoArquivoID, &l.LoteID); err != nil {
			linhas.Close()
			return nil, err
		}
		i := porID[itemID]
		itens[i].Lotes = append(itens[i].Lotes, l)
	}
	linhas.Close()
	linhas, err = q.Query(ctx, `SELECT item_nf_id, numero, numero_lote FROM itens_nf_series WHERE item_nf_id = ANY($1) ORDER BY id`, ids)
	if err != nil {
		return nil, fmt.Errorf("listar series: %w", err)
	}
	defer linhas.Close()
	for linhas.Next() {
		var itemID int64
		var s notaentrada.SerieItem
		if err := linhas.Scan(&itemID, &s.Numero, &s.NumeroLote); err != nil {
			return nil, err
		}
		i := porID[itemID]
		itens[i].Series = append(itens[i].Series, s)
	}
	return itens, linhas.Err()
}

// BuscarPorID devolve a nota com os itens.
func (r *NotaEntradaRepositorio) BuscarPorID(ctx context.Context, id int64) (*notaentrada.Nota, error) {
	conexao := db.DoContexto(ctx, r.pool)
	n, err := lerNota(conexao.QueryRow(ctx, `SELECT `+colunasNota+fromNota+`WHERE n.id = $1`, id))
	if err != nil {
		return nil, erroDeNota(err, "buscar nota")
	}
	if n.Itens, err = carregarItens(ctx, conexao, id); err != nil {
		return nil, err
	}
	return n, nil
}

// Listar devolve uma pagina de notas (sem itens).
func (r *NotaEntradaRepositorio) Listar(ctx context.Context, params consulta.Parametros, pedidoCompraID int64) ([]notaentrada.Nota, int, error) {
	condicoes, args := []string{"TRUE"}, []any{}
	if params.FiltroStatus != nil {
		args = append(args, *params.FiltroStatus)
		condicoes = append(condicoes, fmt.Sprintf("n.status = $%d", len(args)))
	}
	if pedidoCompraID > 0 {
		args = append(args, pedidoCompraID)
		condicoes = append(condicoes, fmt.Sprintf("n.pedido_compra_id = $%d", len(args)))
	}
	if params.Busca != "" {
		args = append(args, "%"+params.Busca+"%")
		condicoes = append(condicoes, fmt.Sprintf("(n.numero ILIKE $%[1]d OR n.chave_acesso ILIKE $%[1]d OR f.razao_social ILIKE $%[1]d OR pc.numero_pc ILIKE $%[1]d)", len(args)))
	}
	where := " WHERE " + strings.Join(condicoes, " AND ")
	conexao := db.DoContexto(ctx, r.pool)
	var total int
	if err := conexao.QueryRow(ctx, `SELECT count(*)`+fromNota+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar notas: %w", err)
	}
	sql := fmt.Sprintf("SELECT %s %s %s ORDER BY n.%s %s, n.id DESC LIMIT $%d OFFSET $%d", colunasNota, fromNota, where,
		params.OrdenarPor, params.Ordem.SQL(), len(args)+1, len(args)+2)
	linhas, err := conexao.Query(ctx, sql, append(args, params.Limite, params.Offset())...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar notas: %w", err)
	}
	defer linhas.Close()
	lista := []notaentrada.Nota{}
	for linhas.Next() {
		n, err := lerNota(linhas)
		if err != nil {
			return nil, 0, err
		}
		lista = append(lista, *n)
	}
	return lista, total, linhas.Err()
}

// Contexto le o que a conferencia precisa.
func (r *NotaEntradaRepositorio) Contexto(ctx context.Context, n *notaentrada.Nota) (notaentrada.Contexto, error) {
	conexao := db.DoContexto(ctx, r.pool)
	c := notaentrada.Contexto{ItensPC: map[int64]notaentrada.ItemPC{}, Pecas: map[int64]notaentrada.Peca{}, SeriesExistentes: map[string]bool{},
		FatorDePara: map[string]float64{}}
	if err := conexao.QueryRow(ctx, `SELECT f.cnpj, pc.status, pc.fornecedor_id FROM pedidos_compra pc
		JOIN fornecedores f ON f.id = pc.fornecedor_id WHERE pc.id = $1`, n.PedidoCompraID).Scan(&c.CNPJFornecedor, &c.StatusPCPrincipal, &c.FornecedorPC); err != nil {
		return c, fmt.Errorf("ler pedido da nota: %w", err)
	}
	depara, err := r.ListarDePara(ctx, c.FornecedorPC)
	if err != nil {
		return c, err
	}
	for _, d := range depara {
		c.FatorDePara[d.CodigoFornecedor] = d.FatorConversao
	}
	if err := conexao.QueryRow(ctx, `SELECT tolerancia_excesso_recebimento_pct, tolerancia_preco_pct, divergencia_preco_acao
		FROM configuracao_negocio WHERE id = 1`).Scan(&c.ToleranciaQtdPct, &c.ToleranciaPrecoPct, &c.AcaoDivergencia); err != nil {
		return c, fmt.Errorf("ler parametros: %w", err)
	}
	var itensPC, pecas []int64
	var seriesPeca []int64
	var seriesNumero []string
	for _, it := range n.Itens {
		if it.ItemPedidoCompraID != nil {
			itensPC = append(itensPC, *it.ItemPedidoCompraID)
		}
		pecas = append(pecas, it.PartePecaID)
		for _, s := range it.Series {
			seriesPeca = append(seriesPeca, it.PartePecaID)
			seriesNumero = append(seriesNumero, s.Numero)
		}
	}
	linhas, err := conexao.Query(ctx, `SELECT ipc.id, pc.id, pc.numero_pc, pc.status, pc.fornecedor_id, ipc.parte_peca_id,
		ipc.quantidade_solicitada, ipc.quantidade_recebida, ipc.preco_unitario
		FROM itens_pedido_compra ipc JOIN pedidos_compra pc ON pc.id = ipc.pedido_compra_id WHERE ipc.id = ANY($1)`, itensPC)
	if err != nil {
		return c, fmt.Errorf("ler itens de PC: %w", err)
	}
	for linhas.Next() {
		var p notaentrada.ItemPC
		if err := linhas.Scan(&p.ID, &p.PedidoCompraID, &p.NumeroPC, &p.StatusPC, &p.FornecedorID, &p.PartePecaID,
			&p.Solicitada, &p.Recebida, &p.PrecoUnitario); err != nil {
			linhas.Close()
			return c, err
		}
		c.ItensPC[p.ID] = p
	}
	linhas.Close()
	linhas, err = conexao.Query(ctx, `SELECT id, codigo, controla_numero_serie, controla_lote, controla_validade, item_critico,
		exige_certificado, validade_minima_dias, mascara_serie FROM partes_pecas WHERE id = ANY($1) AND ativo`, pecas)
	if err != nil {
		return c, fmt.Errorf("ler pecas: %w", err)
	}
	for linhas.Next() {
		var p notaentrada.Peca
		if err := linhas.Scan(&p.ID, &p.Codigo, &p.Controle.ControlaNumeroSerie, &p.Controle.ControlaLote, &p.Controle.ControlaValidade,
			&p.Controle.ItemCritico, &p.Controle.ExigeCertificado, &p.ValidadeMinimaDias, &p.MascaraSerie); err != nil {
			linhas.Close()
			return c, err
		}
		c.Pecas[p.ID] = p
	}
	linhas.Close()
	if len(seriesNumero) > 0 {
		linhas, err = conexao.Query(ctx, `SELECT s.parte_peca_id, s.numero FROM series_componente s
			JOIN unnest($1::bigint[], $2::text[]) AS x(peca, numero) ON x.peca = s.parte_peca_id AND x.numero = s.numero`,
			seriesPeca, seriesNumero)
		if err != nil {
			return c, fmt.Errorf("conferir series existentes: %w", err)
		}
		defer linhas.Close()
		for linhas.Next() {
			var peca int64
			var numero string
			if err := linhas.Scan(&peca, &numero); err != nil {
				return c, err
			}
			c.SeriesExistentes[fmt.Sprintf("%d|%s", peca, numero)] = true
		}
	}
	return c, nil
}

// MudarStatus troca a situacao se a atual estiver em `de`.
func (r *NotaEntradaRepositorio) MudarStatus(ctx context.Context, id int64, de []string, para, autor string) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx, `UPDATE notas_fiscais_entrada SET status = $3, updated_by = $4,
		versao = versao + 1 WHERE id = $1 AND status = ANY($2)`, id, de, para, autor)
	if err != nil {
		return erroDeNota(err, "mudar situacao da nota")
	}
	if etiqueta.RowsAffected() == 0 {
		var existe bool
		_ = db.DoContexto(ctx, r.pool).QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM notas_fiscais_entrada WHERE id = $1)`, id).Scan(&existe)
		if !existe {
			return notaentrada.ErrNaoEncontrada
		}
		return notaentrada.ErrStatusInvalidoParaAcao
	}
	return nil
}

// MarcarConferida passa a Conferida so se a versao for a conferida.
func (r *NotaEntradaRepositorio) MarcarConferida(ctx context.Context, id int64, versao int, autor string) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx, `UPDATE notas_fiscais_entrada SET status = 'Conferida', updated_by = $3,
		versao = versao + 1 WHERE id = $1 AND status = 'Rascunho' AND versao = $2`, id, versao, autor)
	if err != nil {
		return erroDeNota(err, "conferir nota")
	}
	if etiqueta.RowsAffected() == 0 {
		var status string
		var atual int
		if err := db.DoContexto(ctx, r.pool).QueryRow(ctx, `SELECT status, versao FROM notas_fiscais_entrada WHERE id = $1`, id).Scan(&status, &atual); err != nil {
			return erroDeNota(err, "ler nota")
		}
		if atual != versao {
			return notaentrada.ErrAlteradaNoMeio
		}
		return notaentrada.ErrStatusInvalidoParaAcao
	}
	return nil
}

// travarItensPC trava os itens de PC (por id, sempre na mesma ordem).
func travarItensPC(ctx context.Context, tx pgx.Tx, ids []int64) (map[int64][3]int64, error) {
	slices.Sort(ids)
	linhas, err := tx.Query(ctx, `SELECT id, pedido_compra_id, quantidade_solicitada, quantidade_recebida
		FROM itens_pedido_compra WHERE id = ANY($1) ORDER BY id FOR UPDATE`, ids)
	if err != nil {
		return nil, fmt.Errorf("travar itens de PC: %w", err)
	}
	defer linhas.Close()
	m := map[int64][3]int64{}
	for linhas.Next() {
		var id, pc, sol, rec int64
		if err := linhas.Scan(&id, &pc, &sol, &rec); err != nil {
			return nil, err
		}
		m[id] = [3]int64{pc, sol, rec}
	}
	return m, linhas.Err()
}

// recalcularStatusPC: tudo recebido -> Concluido; algo recebido -> Recebido
// Parcial; nada -> Aguardando Entrega. PC encerrado manualmente nao muda.
func recalcularStatusPC(ctx context.Context, tx pgx.Tx, pcs []int64, autor string) error {
	_, err := tx.Exec(ctx, `
		UPDATE pedidos_compra pc SET
		  status = CASE
		    WHEN NOT EXISTS (SELECT 1 FROM itens_pedido_compra i WHERE i.pedido_compra_id = pc.id AND i.quantidade_recebida < i.quantidade_solicitada) THEN 'Concluido'
		    WHEN EXISTS (SELECT 1 FROM itens_pedido_compra i WHERE i.pedido_compra_id = pc.id AND i.quantidade_recebida > 0) THEN 'Recebido Parcial'
		    ELSE 'Aguardando Entrega' END,
		  data_entrega_real = CASE
		    WHEN NOT EXISTS (SELECT 1 FROM itens_pedido_compra i WHERE i.pedido_compra_id = pc.id AND i.quantidade_recebida < i.quantidade_solicitada)
		    THEN coalesce(pc.data_entrega_real, CURRENT_DATE) ELSE NULL END,
		  updated_by = $2
		WHERE pc.id = ANY($1) AND pc.motivo_encerramento IS NULL AND pc.status IN ('Aguardando Entrega', 'Recebido Parcial', 'Concluido')`,
		pcs, autor)
	if err != nil {
		return fmt.Errorf("atualizar situacao do PC: %w", err)
	}
	return nil
}

// Efetivar da a entrada no estoque numa transacao: saldo e CMP, lotes,
// series, movimentos com documento de origem, saldo e situacao do PC.
func (r *NotaEntradaRepositorio) Efetivar(ctx context.Context, id int64, versao int, custos map[int]float64, aprovadoPor *string, toleranciaQtd int64, autor string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		var status, numero, serie string
		var fornecedorID int64
		var versaoAtual int
		if err := tx.QueryRow(ctx, `SELECT status, numero, serie, fornecedor_id, versao FROM notas_fiscais_entrada WHERE id = $1 FOR UPDATE`, id).
			Scan(&status, &numero, &serie, &fornecedorID, &versaoAtual); err != nil {
			return erroDeNota(err, "travar nota")
		}
		if status != notaentrada.StatusConferida {
			return notaentrada.ErrStatusInvalidoParaAcao
		}
		// A conferencia (pendencias, custos, aprovacao) foi feita sobre esta
		// versao; editada no meio, recusa.
		if versaoAtual != versao {
			return notaentrada.ErrAlteradaNoMeio
		}
		itens, err := carregarItens(ctx, tx, id)
		if err != nil {
			return err
		}
		referencia := fmt.Sprintf("NF %s/%s", numero, serie)

		// 1) Itens de PC: reconfere o saldo com as linhas travadas.
		var idsPC []int64
		somaPorItemPC := map[int64]int64{}
		for _, it := range itens {
			if it.ItemPedidoCompraID != nil && !it.Bonificacao {
				if _, ok := somaPorItemPC[*it.ItemPedidoCompraID]; !ok {
					idsPC = append(idsPC, *it.ItemPedidoCompraID)
				}
				somaPorItemPC[*it.ItemPedidoCompraID] += int64(it.QuantidadeRecebida)
			}
		}
		if len(idsPC) > 0 {
			var foraDeRecebimento bool
			if err := tx.QueryRow(ctx, `
				WITH travados AS (
				  SELECT pc.status, pc.motivo_encerramento FROM pedidos_compra pc
				  WHERE pc.id IN (SELECT DISTINCT pedido_compra_id FROM itens_pedido_compra WHERE id = ANY($1))
				  ORDER BY pc.id FOR UPDATE)
				SELECT EXISTS (SELECT 1 FROM travados WHERE status NOT IN ('Aguardando Entrega', 'Recebido Parcial') OR motivo_encerramento IS NOT NULL)`,
				idsPC).Scan(&foraDeRecebimento); err != nil {
				return fmt.Errorf("travar pedidos de compra: %w", err)
			}
			if foraDeRecebimento {
				return &notaentrada.ErroDePendencias{Base: notaentrada.ErrPendencias, Pendencias: []notaentrada.Pendencia{{
					Tipo: "PEDIDO", Nivel: notaentrada.NivelBloqueio, Mensagem: "um pedido de compra da nota foi encerrado ou cancelado"}}}
			}
		}
		travados, err := travarItensPC(ctx, tx, idsPC)
		if err != nil {
			return err
		}
		var pcs []int64
		for idPC, soma := range somaPorItemPC {
			t := travados[idPC]
			limite := t[1] + t[1]*toleranciaQtd/100_00
			if t[2]+soma > limite {
				return &notaentrada.ErroDePendencias{Base: notaentrada.ErrPendencias, Pendencias: []notaentrada.Pendencia{{
					Tipo: "SALDO_PC", Nivel: notaentrada.NivelBloqueio, Mensagem: "o saldo do pedido mudou -- confira de novo"}}}
			}
			if _, err := tx.Exec(ctx, `UPDATE itens_pedido_compra SET quantidade_recebida = quantidade_recebida + $2 WHERE id = $1`, idPC, soma); err != nil {
				return fmt.Errorf("atualizar saldo do PC: %w", err)
			}
			if !slices.Contains(pcs, t[0]) {
				pcs = append(pcs, t[0])
			}
		}

		// 2) Estoque: saldo e CMP por peca (travado na ordem por id).
		var pecas []int64
		for _, it := range itens {
			if it.QuantidadeRecebida > 0 && !slices.Contains(pecas, it.PartePecaID) {
				pecas = append(pecas, it.PartePecaID)
			}
		}
		saldos, err := travarSaldos(ctx, tx, pecas)
		if err != nil {
			return err
		}
		for _, it := range itens {
			if it.QuantidadeRecebida == 0 {
				continue
			}
			custo := custos[it.Ordem]
			s := saldos[it.PartePecaID]
			if s == nil {
				return fmt.Errorf("peca %s sem registro de saldo", it.PecaCodigo)
			}
			novo := s.atual + it.QuantidadeRecebida
			if s.custo == 0 || s.atual <= 0 {
				s.custo = custo
			} else {
				s.custo = (float64(s.atual)*s.custo + float64(it.QuantidadeRecebida)*custo) / float64(novo)
			}
			s.atual = novo
			if _, err := tx.Exec(ctx, `UPDATE saldo_estoque SET quantidade_atual = $2, status = $3, custo_medio = round($4::numeric, 4),
				updated_by = $5 WHERE parte_peca_id = $1`, it.PartePecaID, s.atual, estoque.SituacaoDoSaldo(s.atual, s.minimo), s.custo, autor); err != nil {
				return fmt.Errorf("atualizar saldo: %w", err)
			}
			if _, err := tx.Exec(ctx, `UPDATE itens_nf_entrada SET custo_unitario_entrada = $2 WHERE id = $1`, it.ID, custo); err != nil {
				return fmt.Errorf("gravar custo de entrada: %w", err)
			}

			// 3) Lotes (saldo segregado) e um movimento por lote; sem lote, um movimento.
			lotePorNumero := map[string]int64{}
			if it.Controle.ControlaLote && len(it.Lotes) > 0 {
				for _, l := range it.Lotes {
					var validadeExistente *tempoData
					if err := tx.QueryRow(ctx, `SELECT validade FROM lotes WHERE parte_peca_id = $1 AND coalesce(fornecedor_id, 0) = $2 AND numero_lote = $3`,
						it.PartePecaID, fornecedorID, l.NumeroLote).Scan(&validadeExistente); err == nil && validadeExistente != nil &&
						!l.Validade.IsZero() && !validadeExistente.Time.Equal(l.Validade.Time) {
						return &notaentrada.ErroDePendencias{Base: notaentrada.ErrPendencias, Pendencias: []notaentrada.Pendencia{{
							Tipo: "LOTE", Nivel: notaentrada.NivelBloqueio,
							Mensagem: "o lote " + l.NumeroLote + " ja existe com outra validade -- confira com o fornecedor"}}}
					}
					var loteID int64
					if err := tx.QueryRow(ctx, `
						INSERT INTO lotes (parte_peca_id, fornecedor_id, numero_lote, data_fabricacao, validade, quantidade_atual)
						VALUES ($1, $2, $3, $4, $5, $6)
						ON CONFLICT (parte_peca_id, coalesce(fornecedor_id, 0), numero_lote) DO UPDATE
						  SET quantidade_atual = lotes.quantidade_atual + EXCLUDED.quantidade_atual,
						      validade = coalesce(lotes.validade, EXCLUDED.validade),
						      data_fabricacao = coalesce(lotes.data_fabricacao, EXCLUDED.data_fabricacao)
						RETURNING id`, it.PartePecaID, fornecedorID, l.NumeroLote, l.DataFabricacao, l.Validade, l.Quantidade).Scan(&loteID); err != nil {
						return fmt.Errorf("gravar lote: %w", err)
					}
					lotePorNumero[l.NumeroLote] = loteID
					if _, err := tx.Exec(ctx, `UPDATE itens_nf_lotes SET lote_id = $3 WHERE item_nf_id = $1 AND numero_lote = $2`,
						it.ID, l.NumeroLote, loteID); err != nil {
						return fmt.Errorf("vincular lote: %w", err)
					}
					if l.CertificadoArquivoID != nil {
						if _, err := tx.Exec(ctx, `INSERT INTO anexos (entidade, entidade_id, arquivo_id, tipo, categoria, titulo, created_by, updated_by)
							SELECT 'lote', $1, $2::uuid, 'DOCUMENTO', 'Certificado de Conformidade', $3, $4, $4
							WHERE NOT EXISTS (SELECT 1 FROM anexos WHERE entidade = 'lote' AND entidade_id = $1 AND arquivo_id = $2::uuid)`,
							loteID, *l.CertificadoArquivoID, "Certificado do lote "+l.NumeroLote, autor); err != nil {
							return fmt.Errorf("anexar certificado do lote: %w", err)
						}
					}
					if err := registrarMovimento(ctx, tx, it.PartePecaID, l.Quantidade, estoque.MotivoCompra, referencia, autor, custo, id, &loteID); err != nil {
						return err
					}
				}
			} else if err := registrarMovimento(ctx, tx, it.PartePecaID, it.QuantidadeRecebida, estoque.MotivoCompra, referencia, autor, custo, id, nil); err != nil {
				return err
			}

			// 4) Series de componente.
			for _, sr := range seriesSeControla(it) {
				var loteID *int64
				if l, ok := lotePorNumero[sr.NumeroLote]; ok {
					loteID = &l
				}
				if _, err := tx.Exec(ctx, `INSERT INTO series_componente (parte_peca_id, numero, lote_id, item_nf_id)
					VALUES ($1, $2, $3, $4)`, it.PartePecaID, sr.Numero, loteID, it.ID); err != nil {
					if violouIndiceUnico(err) {
						return &notaentrada.ErroDePendencias{Base: notaentrada.ErrPendencias, Pendencias: []notaentrada.Pendencia{{
							Tipo: "SERIE", Nivel: notaentrada.NivelBloqueio, Mensagem: "serie " + sr.Numero + " ja existe para a peca " + it.PecaCodigo}}}
					}
					return fmt.Errorf("gravar serie: %w", err)
				}
			}
		}

		if err := recalcularStatusPC(ctx, tx, pcs, autor); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE notas_fiscais_entrada SET status = 'Efetivada', efetivada_em = CURRENT_TIMESTAMP,
			efetivada_por = $2, divergencia_aprovada_por = $3, updated_by = $2 WHERE id = $1`, id, autor, aprovadoPor)
		return err
	})
}

// registrarMovimento grava a linha do kardex com o documento de origem.
func registrarMovimento(ctx context.Context, tx pgx.Tx, peca int64, quantidade int, motivo, referencia, autor string, custo float64, notaID int64, loteID *int64) error {
	tipo := estoque.TipoEntrada
	if quantidade < 0 {
		tipo = estoque.TipoSaida
	}
	_, err := tx.Exec(ctx, `INSERT INTO movimentacao_estoque (parte_peca_id, tipo, quantidade, motivo, referencia_numero, usuario_id,
		custo_unitario, documento_tipo, documento_id, lote_id)
		VALUES ($1, $2, $3, $4, $5, (SELECT id FROM usuarios WHERE username = $6), round($7::numeric, 4), 'NOTA_ENTRADA', $8, $9)`,
		peca, tipo, quantidade, motivo, referencia, autor, custo, notaID, loteID)
	if err != nil {
		return fmt.Errorf("registrar movimento: %w", err)
	}
	return nil
}

// Estornar desfaz a nota se o material ainda esta intacto (disponivel, lote
// nao consumido, series em estoque).
func (r *NotaEntradaRepositorio) Estornar(ctx context.Context, id int64, motivo, autor string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		var status, numero, serie string
		if err := tx.QueryRow(ctx, `SELECT status, numero, serie FROM notas_fiscais_entrada WHERE id = $1 FOR UPDATE`, id).
			Scan(&status, &numero, &serie); err != nil {
			return erroDeNota(err, "travar nota")
		}
		if status != notaentrada.StatusEfetivada {
			return notaentrada.ErrStatusInvalidoParaAcao
		}
		itens, err := carregarItens(ctx, tx, id)
		if err != nil {
			return err
		}
		referencia := fmt.Sprintf("Estorno NF %s/%s", numero, serie)
		var idsPC []int64
		somaPorItemPC := map[int64]int64{}
		var pecas []int64
		for _, it := range itens {
			if it.ItemPedidoCompraID != nil && !it.Bonificacao {
				if _, ok := somaPorItemPC[*it.ItemPedidoCompraID]; !ok {
					idsPC = append(idsPC, *it.ItemPedidoCompraID)
				}
				somaPorItemPC[*it.ItemPedidoCompraID] += int64(it.QuantidadeRecebida)
			}
			if it.QuantidadeRecebida > 0 && !slices.Contains(pecas, it.PartePecaID) {
				pecas = append(pecas, it.PartePecaID)
			}
		}
		travados, err := travarItensPC(ctx, tx, idsPC)
		if err != nil {
			return err
		}
		saldos, err := travarSaldos(ctx, tx, pecas)
		if err != nil {
			return err
		}
		// Series desta nota precisam estar todas em estoque.
		var foraDeEstoque bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM series_componente s JOIN itens_nf_entrada i ON i.id = s.item_nf_id
			WHERE i.nota_id = $1 AND s.status <> 'Em Estoque')`, id).Scan(&foraDeEstoque); err != nil {
			return fmt.Errorf("conferir series: %w", err)
		}
		if foraDeEstoque {
			return notaentrada.ErrEstornoBloqueado
		}
		for _, it := range itens {
			if it.QuantidadeRecebida == 0 {
				continue
			}
			s := saldos[it.PartePecaID]
			if s == nil || s.atual-s.reservada < it.QuantidadeRecebida {
				return notaentrada.ErrEstornoBloqueado
			}
			custo := 0.0
			if it.CustoUnitarioEntrada != nil {
				custo = *it.CustoUnitarioEntrada
			}
			novo := s.atual - it.QuantidadeRecebida
			if novo > 0 {
				s.custo = max(0, (float64(s.atual)*s.custo-float64(it.QuantidadeRecebida)*custo)/float64(novo))
			}
			s.atual = novo
			if _, err := tx.Exec(ctx, `UPDATE saldo_estoque SET quantidade_atual = $2, status = $3, custo_medio = round($4::numeric, 4),
				updated_by = $5 WHERE parte_peca_id = $1`, it.PartePecaID, s.atual, estoque.SituacaoDoSaldo(s.atual, s.minimo), s.custo, autor); err != nil {
				return fmt.Errorf("estornar saldo: %w", err)
			}
			if len(it.Lotes) > 0 && it.Controle.ControlaLote {
				for _, l := range it.Lotes {
					if l.LoteID == nil {
						continue
					}
					etiqueta, err := tx.Exec(ctx, `UPDATE lotes SET quantidade_atual = quantidade_atual - $2
						WHERE id = $1 AND quantidade_atual - quantidade_reservada >= $2`, *l.LoteID, l.Quantidade)
					if err != nil {
						return fmt.Errorf("estornar lote: %w", err)
					}
					if etiqueta.RowsAffected() == 0 {
						return notaentrada.ErrEstornoBloqueado
					}
					if err := registrarMovimento(ctx, tx, it.PartePecaID, -l.Quantidade, "Estorno", referencia, autor, custo, id, l.LoteID); err != nil {
						return err
					}
				}
			} else if err := registrarMovimento(ctx, tx, it.PartePecaID, -it.QuantidadeRecebida, "Estorno", referencia, autor, custo, id, nil); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `DELETE FROM series_componente WHERE item_nf_id IN (SELECT id FROM itens_nf_entrada WHERE nota_id = $1)`, id); err != nil {
			return fmt.Errorf("estornar series: %w", err)
		}
		var pcs []int64
		for idPC, soma := range somaPorItemPC {
			if _, err := tx.Exec(ctx, `UPDATE itens_pedido_compra SET quantidade_recebida = quantidade_recebida - $2 WHERE id = $1`, idPC, soma); err != nil {
				return fmt.Errorf("estornar saldo do PC: %w", err)
			}
			if pc := travados[idPC][0]; !slices.Contains(pcs, pc) {
				pcs = append(pcs, pc)
			}
		}
		if err := recalcularStatusPC(ctx, tx, pcs, autor); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE notas_fiscais_entrada SET status = 'Estornada', estornada_em = CURRENT_TIMESTAMP,
			estornada_por = $2, motivo_estorno = $3, updated_by = $2 WHERE id = $1`, id, autor, motivo)
		return err
	})
}

// ListarDePara devolve os vinculos de um fornecedor.
func (r *NotaEntradaRepositorio) ListarDePara(ctx context.Context, fornecedorID int64) ([]notaentrada.DePara, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `SELECT d.id, d.fornecedor_id, d.parte_peca_id, pp.codigo, pp.descricao,
		d.codigo_fornecedor, d.descricao_fornecedor, d.unidade_fornecedor, d.fator_conversao::float8
		FROM fornecedor_itens d JOIN partes_pecas pp ON pp.id = d.parte_peca_id
		WHERE d.fornecedor_id = $1 ORDER BY d.codigo_fornecedor`, fornecedorID)
	if err != nil {
		return nil, fmt.Errorf("listar de-para: %w", err)
	}
	defer linhas.Close()
	lista := []notaentrada.DePara{}
	for linhas.Next() {
		var d notaentrada.DePara
		if err := linhas.Scan(&d.ID, &d.FornecedorID, &d.PartePecaID, &d.PecaCodigo, &d.PecaDescricao, &d.CodigoFornecedor,
			&d.DescricaoFornecedor, &d.UnidadeFornecedor, &d.FatorConversao); err != nil {
			return nil, err
		}
		lista = append(lista, d)
	}
	return lista, linhas.Err()
}

// SalvarDePara cria ou atualiza pelo codigo do fornecedor.
func (r *NotaEntradaRepositorio) SalvarDePara(ctx context.Context, d notaentrada.DePara, autor string) (*notaentrada.DePara, error) {
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, `
		INSERT INTO fornecedor_itens (fornecedor_id, parte_peca_id, codigo_fornecedor, descricao_fornecedor, unidade_fornecedor,
		  fator_conversao, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
		ON CONFLICT (fornecedor_id, codigo_fornecedor) DO UPDATE SET parte_peca_id = EXCLUDED.parte_peca_id,
		  descricao_fornecedor = EXCLUDED.descricao_fornecedor, unidade_fornecedor = EXCLUDED.unidade_fornecedor,
		  fator_conversao = EXCLUDED.fator_conversao, updated_by = EXCLUDED.updated_by
		RETURNING id`, d.FornecedorID, d.PartePecaID, d.CodigoFornecedor, d.DescricaoFornecedor, d.UnidadeFornecedor,
		d.FatorConversao, autor).Scan(&d.ID)
	if violouChaveEstrangeira(err) {
		return nil, notaentrada.ErrDeParaInvalido
	}
	if err != nil {
		return nil, fmt.Errorf("salvar de-para: %w", err)
	}
	_ = db.DoContexto(ctx, r.pool).QueryRow(ctx, `SELECT codigo, descricao FROM partes_pecas WHERE id = $1`, d.PartePecaID).
		Scan(&d.PecaCodigo, &d.PecaDescricao)
	return &d, nil
}

// RemoverDePara apaga um vinculo.
func (r *NotaEntradaRepositorio) RemoverDePara(ctx context.Context, id int64) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx, `DELETE FROM fornecedor_itens WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("remover de-para: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return notaentrada.ErrDeParaNaoExiste
	}
	return nil
}

// PreviaContexto le o fornecedor do PC, o de-para dele e os itens do PC.
func (r *NotaEntradaRepositorio) PreviaContexto(ctx context.Context, pedidoCompraID int64) (string, int64, []notaentrada.DePara, []notaentrada.ItemPC, error) {
	var cnpj string
	var fornecedorID int64
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, `SELECT f.cnpj, f.id FROM pedidos_compra pc JOIN fornecedores f ON f.id = pc.fornecedor_id
		WHERE pc.id = $1`, pedidoCompraID).Scan(&cnpj, &fornecedorID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", 0, nil, nil, notaentrada.ErrPedidoObrigatorio
	}
	if err != nil {
		return "", 0, nil, nil, fmt.Errorf("ler pedido: %w", err)
	}
	depara, err := r.ListarDePara(ctx, fornecedorID)
	if err != nil {
		return "", 0, nil, nil, err
	}
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `SELECT id, parte_peca_id, quantidade_solicitada, quantidade_recebida
		FROM itens_pedido_compra WHERE pedido_compra_id = $1 ORDER BY id`, pedidoCompraID)
	if err != nil {
		return "", 0, nil, nil, fmt.Errorf("ler itens do pedido: %w", err)
	}
	defer linhas.Close()
	var itens []notaentrada.ItemPC
	for linhas.Next() {
		var it notaentrada.ItemPC
		if err := linhas.Scan(&it.ID, &it.PartePecaID, &it.Solicitada, &it.Recebida); err != nil {
			return "", 0, nil, nil, err
		}
		itens = append(itens, it)
	}
	return cnpj, fornecedorID, depara, itens, linhas.Err()
}

type tempoData = tempo.Data

// seriesSeControla: so peca que controla serie grava series (dados de uma
// peca sem a flag sao ignorados).
func seriesSeControla(it notaentrada.Item) []notaentrada.SerieItem {
	if !it.Controle.ControlaNumeroSerie {
		return nil
	}
	return it.Series
}
