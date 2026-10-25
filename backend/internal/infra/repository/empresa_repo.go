package repository

import (
	"context"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/empresa"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasEmpresa = `razao_social, nome_fantasia, cnpj, inscricao_estadual,
	inscricao_municipal, cnae, cep, logradouro, numero, complemento, bairro,
	cidade, uf, telefone, email, site, rodape_padrao, condicoes_gerais_compra,
	responsavel_tecnico, (logo_claro IS NOT NULL), (logo_escuro IS NOT NULL),
	(favicon IS NOT NULL), updated_at, updated_by`

// EmpresaRepositorio implementa a persistencia do singleton de configuracao
// da empresa (doc 0, secao 4.6.2). Nao ha Criar/Excluir: a linha id=1 e
// semeada pela migration 010 e so sofre UPDATE dai em diante.
type EmpresaRepositorio struct {
	pool *pgxpool.Pool
}

// NovoEmpresaRepositorio cria o repositorio de dados da empresa.
func NovoEmpresaRepositorio(pool *pgxpool.Pool) *EmpresaRepositorio {
	return &EmpresaRepositorio{pool: pool}
}

// Buscar devolve a configuracao atual. Nunca ha "nao encontrado": a
// migration 010 garante a linha id=1 desde a subida da aplicacao.
func (r *EmpresaRepositorio) Buscar(ctx context.Context) (empresa.Empresa, error) {
	return r.buscarUm(ctx, `SELECT `+colunasEmpresa+` FROM configuracao_empresa WHERE id = 1`)
}

func (r *EmpresaRepositorio) buscarUm(ctx context.Context, sql string, args ...any) (empresa.Empresa, error) {
	var e empresa.Empresa
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql, args...).Scan(
		&e.RazaoSocial, &e.NomeFantasia, &e.CNPJ, &e.InscricaoEstadual,
		&e.InscricaoMunicipal, &e.CNAE, &e.CEP, &e.Logradouro, &e.Numero,
		&e.Complemento, &e.Bairro, &e.Cidade, &e.UF, &e.Telefone, &e.Email,
		&e.Site, &e.RodapePadrao, &e.CondicoesGeraisCompra, &e.ResponsavelTecnico,
		&e.TemLogoClaro, &e.TemLogoEscuro, &e.TemFavicon, &e.UpdatedAt, &e.UpdatedBy,
	)
	if err != nil {
		return empresa.Empresa{}, fmt.Errorf("buscar dados da empresa: %w", err)
	}
	return e, nil
}

// Atualizar grava os campos de texto da empresa e devolve a linha resultante.
func (r *EmpresaRepositorio) Atualizar(ctx context.Context, dados empresa.Dados, atualizadoPor string) (empresa.Empresa, error) {
	sql := `UPDATE configuracao_empresa SET
			razao_social = $1, nome_fantasia = $2, cnpj = $3, inscricao_estadual = $4,
			inscricao_municipal = $5, cnae = $6, cep = $7, logradouro = $8, numero = $9,
			complemento = $10, bairro = $11, cidade = $12, uf = $13, telefone = $14,
			email = $15, site = $16, rodape_padrao = $17, condicoes_gerais_compra = $18,
			responsavel_tecnico = $19, updated_at = now(), updated_by = $20
		WHERE id = 1
		RETURNING ` + colunasEmpresa

	return r.buscarUm(ctx, sql,
		dados.RazaoSocial, dados.NomeFantasia, dados.CNPJ, dados.InscricaoEstadual,
		dados.InscricaoMunicipal, dados.CNAE, dados.CEP, dados.Logradouro, dados.Numero,
		dados.Complemento, dados.Bairro, dados.Cidade, dados.UF, dados.Telefone,
		dados.Email, dados.Site, dados.RodapePadrao, dados.CondicoesGeraisCompra,
		dados.ResponsavelTecnico, atualizadoPor,
	)
}

// BuscarLogoClaro devolve os bytes e o content-type do logo claro, ou (nil,
// "", nil) quando nenhum foi configurado -- o handler traduz isso em 404.
func (r *EmpresaRepositorio) BuscarLogoClaro(ctx context.Context) ([]byte, string, error) {
	return r.buscarImagem(ctx, `SELECT logo_claro, logo_claro_tipo FROM configuracao_empresa WHERE id = 1`)
}

// BuscarLogoEscuro devolve os bytes e o content-type do logo escuro.
func (r *EmpresaRepositorio) BuscarLogoEscuro(ctx context.Context) ([]byte, string, error) {
	return r.buscarImagem(ctx, `SELECT logo_escuro, logo_escuro_tipo FROM configuracao_empresa WHERE id = 1`)
}

// BuscarFavicon devolve os bytes e o content-type do favicon.
func (r *EmpresaRepositorio) BuscarFavicon(ctx context.Context) ([]byte, string, error) {
	return r.buscarImagem(ctx, `SELECT favicon, favicon_tipo FROM configuracao_empresa WHERE id = 1`)
}

func (r *EmpresaRepositorio) buscarImagem(ctx context.Context, sql string) ([]byte, string, error) {
	var dados []byte
	var tipo *string
	if err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql).Scan(&dados, &tipo); err != nil {
		return nil, "", fmt.Errorf("buscar imagem da empresa: %w", err)
	}
	if tipo == nil {
		return nil, "", nil
	}
	return dados, *tipo, nil
}

// AtualizarLogoClaro grava (ou remove, com dados=nil) o logo claro.
func (r *EmpresaRepositorio) AtualizarLogoClaro(ctx context.Context, dados []byte, tipo, atualizadoPor string) error {
	return r.atualizarImagem(ctx,
		`UPDATE configuracao_empresa SET logo_claro = $1, logo_claro_tipo = $2, updated_at = now(), updated_by = $3 WHERE id = 1`,
		dados, tipo, atualizadoPor)
}

// AtualizarLogoEscuro grava (ou remove) o logo escuro.
func (r *EmpresaRepositorio) AtualizarLogoEscuro(ctx context.Context, dados []byte, tipo, atualizadoPor string) error {
	return r.atualizarImagem(ctx,
		`UPDATE configuracao_empresa SET logo_escuro = $1, logo_escuro_tipo = $2, updated_at = now(), updated_by = $3 WHERE id = 1`,
		dados, tipo, atualizadoPor)
}

// AtualizarFavicon grava (ou remove) o favicon.
func (r *EmpresaRepositorio) AtualizarFavicon(ctx context.Context, dados []byte, tipo, atualizadoPor string) error {
	return r.atualizarImagem(ctx,
		`UPDATE configuracao_empresa SET favicon = $1, favicon_tipo = $2, updated_at = now(), updated_by = $3 WHERE id = 1`,
		dados, tipo, atualizadoPor)
}

// atualizarImagem tambem grava updated_at/updated_by -- a URL da imagem nao
// muda quando o conteudo muda (sem parametro de versao), entao o frontend
// usa esse carimbo para invalidar o preview em cache apos o upload.
func (r *EmpresaRepositorio) atualizarImagem(ctx context.Context, sql string, dados []byte, tipo, atualizadoPor string) error {
	// dados=nil grava NULL na coluna bytea -- remove a imagem, como
	// pgx.QueryRow/Exec com []byte(nil) grava normalmente.
	var tipoColuna *string
	if len(dados) > 0 {
		tipoColuna = &tipo
	}
	if _, err := db.DoContexto(ctx, r.pool).Exec(ctx, sql, dados, tipoColuna, atualizadoPor); err != nil {
		return fmt.Errorf("atualizar imagem da empresa: %w", err)
	}
	return nil
}
