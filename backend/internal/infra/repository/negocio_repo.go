package repository

import (
	"context"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/negocio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasNegocio = `metodo_custeio, tolerancia_excesso_recebimento_pct, lead_time_padrao_dias,
	limite_emissao_gestor, cotacoes_minimas, valor_exige_cotacoes, updated_at, updated_by,
	tolerancia_preco_pct, divergencia_preco_acao`

// NegocioRepositorio implementa a persistencia do singleton de parametros de
// negocio. Nao ha Criar/Excluir: a linha id=1 e semeada pela migration 012.
type NegocioRepositorio struct {
	pool *pgxpool.Pool
}

// NovoNegocioRepositorio cria o repositorio de parametros de negocio.
func NovoNegocioRepositorio(pool *pgxpool.Pool) *NegocioRepositorio {
	return &NegocioRepositorio{pool: pool}
}

// Buscar devolve a configuracao atual.
func (r *NegocioRepositorio) Buscar(ctx context.Context) (negocio.Configuracao, error) {
	return r.buscarUm(ctx, `SELECT `+colunasNegocio+` FROM configuracao_negocio WHERE id = 1`)
}

func (r *NegocioRepositorio) buscarUm(ctx context.Context, sql string, args ...any) (negocio.Configuracao, error) {
	var cfg negocio.Configuracao
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql, args...).Scan(
		&cfg.MetodoCusteio, &cfg.ToleranciaExcessoRecebimentoPct, &cfg.LeadTimePadraoDias,
		&cfg.LimiteEmissaoGestor, &cfg.CotacoesMinimas, &cfg.ValorExigeCotacoes,
		&cfg.UpdatedAt, &cfg.UpdatedBy, &cfg.ToleranciaPrecoPct, &cfg.DivergenciaPrecoAcao,
	)
	if err != nil {
		return negocio.Configuracao{}, fmt.Errorf("buscar parametros de negocio: %w", err)
	}
	return cfg, nil
}

// Atualizar grava a configuracao inteira e devolve a linha resultante.
func (r *NegocioRepositorio) Atualizar(ctx context.Context, d negocio.Dados, atualizadoPor string) (negocio.Configuracao, error) {
	sql := `UPDATE configuracao_negocio SET
			metodo_custeio = $1, tolerancia_excesso_recebimento_pct = $2, lead_time_padrao_dias = $3,
			limite_emissao_gestor = $4, cotacoes_minimas = $5, valor_exige_cotacoes = $6,
			updated_at = now(), updated_by = $7, tolerancia_preco_pct = $8, divergencia_preco_acao = coalesce(NULLIF($9, ''), 'BLOQUEAR')
		WHERE id = 1
		RETURNING ` + colunasNegocio

	return r.buscarUm(ctx, sql, d.MetodoCusteio, d.ToleranciaExcessoRecebimentoPct, d.LeadTimePadraoDias,
		d.LimiteEmissaoGestor, d.CotacoesMinimas, d.ValorExigeCotacoes, atualizadoPor,
		d.ToleranciaPrecoPct, d.DivergenciaPrecoAcao)
}
