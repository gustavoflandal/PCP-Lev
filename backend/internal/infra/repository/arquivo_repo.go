package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// tabelaDaEntidade: onde conferir que o registro do anexo existe. So nomes
// fixos daqui entram no SQL.
var tabelaDaEntidade = map[string]string{
	arquivo.EntidadeProduto:       "produtos_acabados",
	arquivo.EntidadePeca:          "partes_pecas",
	arquivo.EntidadeNotaEntrada:   "notas_fiscais_entrada",
	arquivo.EntidadeLote:          "lotes",
	arquivo.EntidadeOrdemProducao: "ordens_producao",
	arquivo.EntidadeFornecedor:    "fornecedores",
	arquivo.EntidadePedidoCompra:  "pedidos_compra",
	arquivo.EntidadePedidoVenda:   "pedidos_venda",
	arquivo.EntidadeCliente:       "clientes",
}

const colunasAnexo = `an.id, an.entidade, an.entidade_id, an.tipo, an.categoria, an.titulo, an.descricao, an.versao,
	coalesce(an.documento_chave, an.id), an.vigente, an.data_emissao, an.data_validade, an.fornecedor_id,
	an.estrutura_produto_id, an.principal, an.ordem, an.created_at, an.created_by,
	ar.id::text, ar.sha256, ar.nome_original, ar.tipo_mime, ar.tamanho, ar.miniatura IS NOT NULL, ar.created_at`

const fromAnexo = ` FROM anexos an JOIN arquivos ar ON ar.id = an.arquivo_id `

// ArquivoRepositorio implementa arquivo.Repositorio.
type ArquivoRepositorio struct {
	pool *pgxpool.Pool
}

// NovoArquivoRepositorio cria o repositorio de arquivos e anexos.
func NovoArquivoRepositorio(pool *pgxpool.Pool) *ArquivoRepositorio {
	return &ArquivoRepositorio{pool: pool}
}

func lerAnexo(l linha) (*arquivo.Anexo, error) {
	var a arquivo.Anexo
	err := l.Scan(&a.ID, &a.Entidade, &a.EntidadeID, &a.Tipo, &a.Categoria, &a.Titulo, &a.Descricao, &a.Versao,
		&a.DocumentoChave, &a.Vigente, &a.DataEmissao, &a.DataValidade, &a.FornecedorID, &a.EstruturaProdutoID,
		&a.Principal, &a.Ordem, &a.CreatedAt, &a.CreatedBy,
		&a.Arquivo.ID, &a.Arquivo.SHA256, &a.Arquivo.NomeOriginal, &a.Arquivo.TipoMime, &a.Arquivo.Tamanho,
		&a.Arquivo.TemMiniatura, &a.Arquivo.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// SalvarArquivo grava (ou reaproveita, pelo SHA-256) o conteudo.
func (r *ArquivoRepositorio) SalvarArquivo(ctx context.Context, a *arquivo.Arquivo, autor string) (*arquivo.Arquivo, error) {
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, `
		INSERT INTO arquivos (sha256, nome_original, tipo_mime, tamanho, conteudo, miniatura, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (sha256) DO UPDATE SET sha256 = EXCLUDED.sha256
		RETURNING id::text, created_at, nome_original`,
		a.SHA256, a.NomeOriginal, a.TipoMime, a.Tamanho, a.Conteudo, a.Miniatura, autor).Scan(&a.ID, &a.CreatedAt, &a.NomeOriginal)
	if err != nil {
		return nil, fmt.Errorf("salvar arquivo: %w", err)
	}
	return a, nil
}

// BuscarArquivo devolve um arquivo; com os bytes so quando pedido.
func (r *ArquivoRepositorio) BuscarArquivo(ctx context.Context, id string, comConteudo bool) (*arquivo.Arquivo, error) {
	var a arquivo.Arquivo
	conteudo := "NULL::bytea, NULL::bytea"
	if comConteudo {
		conteudo = "conteudo, miniatura"
	}
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, `
		SELECT id::text, sha256, nome_original, tipo_mime, tamanho, miniatura IS NOT NULL, created_at, `+conteudo+`
		FROM arquivos WHERE id = $1::uuid`, id).Scan(&a.ID, &a.SHA256, &a.NomeOriginal, &a.TipoMime, &a.Tamanho,
		&a.TemMiniatura, &a.CreatedAt, &a.Conteudo, &a.Miniatura)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, arquivo.ErrNaoEncontrado
	}
	if err != nil {
		return nil, fmt.Errorf("buscar arquivo: %w", err)
	}
	return &a, nil
}

// BuscarMiniatura devolve so a miniatura.
func (r *ArquivoRepositorio) BuscarMiniatura(ctx context.Context, id string) ([]byte, error) {
	var mini []byte
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, `SELECT miniatura FROM arquivos WHERE id = $1::uuid`, id).Scan(&mini)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && mini == nil) {
		return nil, arquivo.ErrNaoEncontrado
	}
	if err != nil {
		return nil, fmt.Errorf("buscar miniatura: %w", err)
	}
	return mini, nil
}

// UsosDoArquivo devolve as entidades que usam o arquivo e quem o enviou.
func (r *ArquivoRepositorio) UsosDoArquivo(ctx context.Context, id string) ([]string, string, error) {
	var enviadoPor string
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, `SELECT coalesce(created_by, '') FROM arquivos WHERE id = $1::uuid`, id).Scan(&enviadoPor)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", arquivo.ErrNaoEncontrado
	}
	if err != nil {
		return nil, "", fmt.Errorf("buscar arquivo: %w", err)
	}
	// Certificados ainda nao efetivados vivem nos itens/lotes da nota.
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT DISTINCT entidade FROM anexos WHERE arquivo_id = $1::uuid
		UNION SELECT 'nota_entrada' FROM itens_nf_entrada WHERE certificado_arquivo_id = $1::uuid
		UNION SELECT 'nota_entrada' FROM itens_nf_lotes WHERE certificado_arquivo_id = $1::uuid`, id)
	if err != nil {
		return nil, "", fmt.Errorf("usos do arquivo: %w", err)
	}
	entidades, err := pgx.CollectRows(linhas, pgx.RowTo[string])
	return entidades, enviadoPor, err
}

// ListarAnexos devolve os anexos de uma entidade: fotos (principal primeiro),
// depois documentos agrupados por versao (vigente primeiro).
func (r *ArquivoRepositorio) ListarAnexos(ctx context.Context, entidade string, entidadeID int64) ([]arquivo.Anexo, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `SELECT `+colunasAnexo+fromAnexo+`
		WHERE an.entidade = $1 AND an.entidade_id = $2
		ORDER BY an.tipo DESC, an.principal DESC, an.categoria, coalesce(an.documento_chave, an.id), an.vigente DESC,
		         an.ordem, an.id DESC`, entidade, entidadeID)
	if err != nil {
		return nil, fmt.Errorf("listar anexos: %w", err)
	}
	defer linhas.Close()
	lista := []arquivo.Anexo{}
	for linhas.Next() {
		a, err := lerAnexo(linhas)
		if err != nil {
			return nil, err
		}
		lista = append(lista, *a)
	}
	return lista, linhas.Err()
}

// BuscarAnexo devolve um anexo.
func (r *ArquivoRepositorio) BuscarAnexo(ctx context.Context, id int64) (*arquivo.Anexo, error) {
	a, err := lerAnexo(db.DoContexto(ctx, r.pool).QueryRow(ctx, `SELECT `+colunasAnexo+fromAnexo+`WHERE an.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, arquivo.ErrAnexoNaoEncontrado
	}
	if err != nil {
		return nil, fmt.Errorf("buscar anexo: %w", err)
	}
	return a, nil
}

// travarEntidade confere que o registro existe e serializa as escritas de
// anexo dele (galeria cheia e foto principal sao regras sobre o conjunto).
func travarEntidade(ctx context.Context, tx pgx.Tx, entidade string, id int64) error {
	tabela, ok := tabelaDaEntidade[entidade]
	if !ok {
		return arquivo.ErrEntidadeInvalida
	}
	var existe bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM `+tabela+` WHERE id = $1)`, id).Scan(&existe); err != nil {
		return fmt.Errorf("conferir registro do anexo: %w", err)
	}
	if !existe {
		return arquivo.ErrEntidadeInexistente
	}
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(3, hashtext($1))`, fmt.Sprintf("%s:%d", entidade, id))
	return err
}

// CriarAnexo grava o vinculo (galeria, principal e versao na mesma transacao).
func (r *ArquivoRepositorio) CriarAnexo(ctx context.Context, d arquivo.DadosAnexo, autor string) (int64, error) {
	var id int64
	err := emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		if err := travarEntidade(ctx, tx, d.Entidade, d.EntidadeID); err != nil {
			return err
		}
		var chave *int64
		if d.SubstituiAnexoID != nil {
			var entidade, tipo string
			var entidadeID, chaveAnterior int64
			err := tx.QueryRow(ctx, `SELECT entidade, entidade_id, tipo, coalesce(documento_chave, id) FROM anexos WHERE id = $1`,
				*d.SubstituiAnexoID).Scan(&entidade, &entidadeID, &tipo, &chaveAnterior)
			if errors.Is(err, pgx.ErrNoRows) {
				return arquivo.ErrAnexoNaoEncontrado
			}
			if err != nil {
				return fmt.Errorf("ler versao anterior: %w", err)
			}
			if entidade != d.Entidade || entidadeID != d.EntidadeID || tipo != d.Tipo {
				return arquivo.ErrVersaoDeOutroRegistro
			}
			chave = &chaveAnterior
			if _, err := tx.Exec(ctx, `UPDATE anexos SET vigente = FALSE, updated_by = $2 WHERE coalesce(documento_chave, id) = $1`,
				chaveAnterior, autor); err != nil {
				return fmt.Errorf("arquivar versao anterior: %w", err)
			}
		}
		if d.Tipo == arquivo.TipoFoto {
			var galeria, principais int
			if err := tx.QueryRow(ctx, `SELECT count(*) FILTER (WHERE NOT principal), count(*) FILTER (WHERE principal)
				FROM anexos WHERE entidade = $1 AND entidade_id = $2 AND tipo = 'FOTO'`,
				d.Entidade, d.EntidadeID).Scan(&galeria, &principais); err != nil {
				return fmt.Errorf("contar galeria: %w", err)
			}
			// Nova foto na galeria, ou nova principal que rebaixa a antiga para
			// a galeria: em ambos os casos a galeria ganha uma.
			if (!d.Principal || principais > 0) && galeria >= arquivo.GaleriaMaxima {
				return arquivo.ErrGaleriaCheia
			}
			if d.Principal {
				if _, err := tx.Exec(ctx, `UPDATE anexos SET principal = FALSE WHERE entidade = $1 AND entidade_id = $2 AND principal`,
					d.Entidade, d.EntidadeID); err != nil {
					return fmt.Errorf("trocar foto principal: %w", err)
				}
			}
		}
		err := tx.QueryRow(ctx, `
			INSERT INTO anexos (entidade, entidade_id, arquivo_id, tipo, categoria, titulo, descricao, versao, documento_chave,
			  data_emissao, data_validade, fornecedor_id, estrutura_produto_id, principal, created_by, updated_by,
			  ordem)
			VALUES ($1::varchar, $2::bigint, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::varchar, $15::varchar,
			  (SELECT coalesce(max(ordem), 0) + 1 FROM anexos WHERE entidade = $1::varchar AND entidade_id = $2::bigint))
			RETURNING id`,
			d.Entidade, d.EntidadeID, d.ArquivoID, d.Tipo, d.Categoria, d.Titulo, d.Descricao, d.Versao, chave,
			d.DataEmissao, d.DataValidade, d.FornecedorID, d.EstruturaProdutoID, d.Principal, autor).Scan(&id)
		if violouChaveEstrangeira(err) {
			return arquivo.ErrEntidadeInexistente
		}
		if err != nil {
			return fmt.Errorf("criar anexo: %w", err)
		}
		return nil
	})
	return id, err
}

// AtualizarAnexo altera os metadados (e a foto principal).
func (r *ArquivoRepositorio) AtualizarAnexo(ctx context.Context, id int64, d arquivo.DadosAnexo, autor string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		if err := travarEntidade(ctx, tx, d.Entidade, d.EntidadeID); err != nil {
			return err
		}
		if d.Principal {
			if _, err := tx.Exec(ctx, `UPDATE anexos SET principal = FALSE WHERE entidade = $1 AND entidade_id = $2 AND principal AND id <> $3`,
				d.Entidade, d.EntidadeID, id); err != nil {
				return fmt.Errorf("trocar foto principal: %w", err)
			}
		} else if err := conferirFotoObrigatoria(ctx, tx, d.Entidade, d.EntidadeID, id); err != nil {
			return err
		}
		etiqueta, err := tx.Exec(ctx, `
			UPDATE anexos SET categoria = $2, titulo = $3, descricao = $4, versao = $5, data_emissao = $6,
			  data_validade = $7, fornecedor_id = $8, estrutura_produto_id = $9, principal = $10, updated_by = $11
			WHERE id = $1`, id, d.Categoria, d.Titulo, d.Descricao, d.Versao, d.DataEmissao, d.DataValidade,
			d.FornecedorID, d.EstruturaProdutoID, d.Principal, autor)
		if err != nil {
			return fmt.Errorf("atualizar anexo: %w", err)
		}
		if etiqueta.RowsAffected() == 0 {
			return arquivo.ErrAnexoNaoEncontrado
		}
		return nil
	})
}

// conferirFotoObrigatoria: item critico nao fica sem foto principal (a foto
// `id` deixa de ser principal ou sai).
func conferirFotoObrigatoria(ctx context.Context, tx pgx.Tx, entidade string, entidadeID, id int64) error {
	if entidade != arquivo.EntidadeProduto && entidade != arquivo.EntidadePeca {
		return nil
	}
	var critico, eraPrincipal bool
	if err := tx.QueryRow(ctx, `SELECT item_critico FROM `+tabelaDaEntidade[entidade]+` WHERE id = $1`, entidadeID).Scan(&critico); err != nil {
		return fmt.Errorf("conferir item critico: %w", err)
	}
	if !critico {
		return nil
	}
	if err := tx.QueryRow(ctx, `SELECT principal FROM anexos WHERE id = $1`, id).Scan(&eraPrincipal); err != nil {
		return fmt.Errorf("ler anexo: %w", err)
	}
	if eraPrincipal {
		return arquivo.ErrFotoObrigatoria
	}
	return nil
}

// RemoverAnexo desvincula o anexo. A foto principal de item critico nao sai;
// removida a versao vigente, a mais recente restante volta a ser vigente.
func (r *ArquivoRepositorio) RemoverAnexo(ctx context.Context, id int64) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		var entidade string
		var entidadeID, chave int64
		var principal, vigente bool
		err := tx.QueryRow(ctx, `SELECT entidade, entidade_id, coalesce(documento_chave, id), principal, vigente FROM anexos WHERE id = $1`, id).
			Scan(&entidade, &entidadeID, &chave, &principal, &vigente)
		if errors.Is(err, pgx.ErrNoRows) {
			return arquivo.ErrAnexoNaoEncontrado
		}
		if err != nil {
			return fmt.Errorf("ler anexo: %w", err)
		}
		if err := travarEntidade(ctx, tx, entidade, entidadeID); err != nil {
			return err
		}
		if principal {
			if err := conferirFotoObrigatoria(ctx, tx, entidade, entidadeID, id); err != nil {
				return err
			}
		}
		if encerrado, err := registroEncerrado(ctx, tx, entidade, entidadeID); err != nil {
			return err
		} else if encerrado {
			return arquivo.ErrRegistroEncerrado
		}
		if entidade == arquivo.EntidadeNotaEntrada {
			var status string
			if err := tx.QueryRow(ctx, `SELECT status FROM notas_fiscais_entrada WHERE id = $1`, entidadeID).Scan(&status); err != nil {
				return fmt.Errorf("ler nota: %w", err)
			}
			if status != "Rascunho" && status != "Conferida" {
				return arquivo.ErrNotaImutavel
			}
		}
		if _, err := tx.Exec(ctx, `DELETE FROM anexos WHERE id = $1`, id); err != nil {
			return fmt.Errorf("remover anexo: %w", err)
		}
		if vigente {
			if _, err := tx.Exec(ctx, `UPDATE anexos SET vigente = TRUE WHERE id = (
				SELECT id FROM anexos WHERE coalesce(documento_chave, id) = $1 ORDER BY id DESC LIMIT 1)`, chave); err != nil {
				return fmt.Errorf("restaurar versao vigente: %w", err)
			}
		}
		return nil
	})
}

// registroEncerrado: OP concluida/cancelada, PC concluido/cancelado e PV
// entregue/cancelado guardam os anexos como registro (Fase 3.1).
func registroEncerrado(ctx context.Context, tx pgx.Tx, entidade string, id int64) (bool, error) {
	var sql string
	switch entidade {
	case arquivo.EntidadeOrdemProducao:
		sql = `SELECT status IN ('Concluida', 'Cancelada') FROM ordens_producao WHERE id = $1`
	case arquivo.EntidadePedidoCompra:
		sql = `SELECT status IN ('Concluido', 'Cancelado') FROM pedidos_compra WHERE id = $1`
	case arquivo.EntidadePedidoVenda:
		sql = `SELECT status IN ('Entregue', 'Cancelado') FROM pedidos_venda WHERE id = $1`
	default:
		return false, nil
	}
	var encerrado bool
	if err := tx.QueryRow(ctx, sql, id).Scan(&encerrado); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return false, fmt.Errorf("ler situacao do registro: %w", err)
	}
	return encerrado, nil
}

// VencimentosDocumentos lista documentos vigentes vencidos ou a vencer.
func (r *ArquivoRepositorio) VencimentosDocumentos(ctx context.Context, dias int, entidades []string) ([]arquivo.VencimentoDocumento, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT an.id, an.entidade, an.entidade_id,
		       coalesce(pa.codigo, pp.codigo, f.razao_social, cl.razao_social, ''), an.categoria, an.titulo, an.data_validade,
		       an.data_validade < CURRENT_DATE
		FROM anexos an
		LEFT JOIN produtos_acabados pa ON an.entidade = 'produto_acabado' AND pa.id = an.entidade_id
		LEFT JOIN partes_pecas pp ON an.entidade = 'parte_peca' AND pp.id = an.entidade_id
		LEFT JOIN fornecedores f ON an.entidade = 'fornecedor' AND f.id = an.entidade_id
		LEFT JOIN clientes cl ON an.entidade = 'cliente' AND cl.id = an.entidade_id
		WHERE an.entidade = ANY($2)
		  AND an.vigente AND an.data_validade IS NOT NULL AND an.data_validade <= CURRENT_DATE + $1::int
		ORDER BY an.data_validade, an.id`, dias, entidades)
	if err != nil {
		return nil, fmt.Errorf("listar vencimentos de documentos: %w", err)
	}
	defer linhas.Close()
	lista := []arquivo.VencimentoDocumento{}
	for linhas.Next() {
		var v arquivo.VencimentoDocumento
		if err := linhas.Scan(&v.AnexoID, &v.Entidade, &v.EntidadeID, &v.EntidadeCodigo, &v.Categoria, &v.Titulo,
			&v.DataValidade, &v.Vencido); err != nil {
			return nil, err
		}
		lista = append(lista, v)
	}
	return lista, linhas.Err()
}

// FotosPrincipais devolve o arquivo da foto principal de cada entidade.
func (r *ArquivoRepositorio) FotosPrincipais(ctx context.Context, entidade string, ids []int64) (map[int64]string, error) {
	fotos := map[int64]string{}
	if len(ids) == 0 {
		return fotos, nil
	}
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `SELECT an.entidade_id, an.arquivo_id::text FROM anexos an
		JOIN arquivos ar ON ar.id = an.arquivo_id
		WHERE an.entidade = $1 AND an.entidade_id = ANY($2) AND an.principal AND ar.miniatura IS NOT NULL`, entidade, ids)
	if err != nil {
		return nil, fmt.Errorf("fotos principais: %w", err)
	}
	defer linhas.Close()
	for linhas.Next() {
		var id int64
		var arquivoID string
		if err := linhas.Scan(&id, &arquivoID); err != nil {
			return nil, err
		}
		fotos[id] = arquivoID
	}
	return fotos, linhas.Err()
}
