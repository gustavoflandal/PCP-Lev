package db_test

import (
	"context"
	"sync"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAplicarCriaSchemaCompleto(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.PoolLimpo(t)

	require.NoError(t, db.Aplicar(ctx, pool))

	var tabelas int
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT count(*) FROM information_schema.tables
		  WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`).Scan(&tabelas))
	assert.GreaterOrEqual(t, tabelas, 18, "todas as tabelas do doc 2 devem existir")

	var versoes int
	require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FROM schema_version`).Scan(&versoes))
	assert.Equal(t, 10, versoes, "as 10 migrations devem estar registradas")
}

func TestAplicarEhIdempotente(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.PoolLimpo(t)

	require.NoError(t, db.Aplicar(ctx, pool))
	require.NoError(t, db.Aplicar(ctx, pool), "reaplicar nao pode falhar")

	var versoes int
	require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FROM schema_version`).Scan(&versoes))
	assert.Equal(t, 10, versoes, "nenhuma migration pode ser aplicada duas vezes")
}

func TestAplicarCriaUsuarioAdministradorInicial(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.PoolLimpo(t)

	require.NoError(t, db.Aplicar(ctx, pool))

	var perfil string
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT perfil FROM usuarios WHERE username = 'admin'`).Scan(&perfil))
	assert.Equal(t, "ADMIN", perfil)
}

func TestSaldoEstoqueRejeitaDisponivelNegativo(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.PoolLimpo(t)
	require.NoError(t, db.Aplicar(ctx, pool))

	_, err := pool.Exec(ctx,
		`INSERT INTO partes_pecas (codigo, descricao, unidade_medida) VALUES ('CON-001','Conector RCA','und')`)
	require.NoError(t, err)

	_, err = pool.Exec(ctx,
		`INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, quantidade_reservada)
		 SELECT id, 5, 10 FROM partes_pecas WHERE codigo = 'CON-001'`)

	// RN2: o estoque disponivel nunca pode ficar negativo.
	require.Error(t, err)
	assert.Contains(t, err.Error(), "chk_saldo_disponivel")
}

func TestAplicarSuportaDuasInstanciasSubindoAoMesmoTempo(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.PoolLimpo(t)

	// Duas replicas da API iniciando em paralelo contra o mesmo banco.
	const replicas = 4
	erros := make(chan error, replicas)
	var largada sync.WaitGroup
	largada.Add(1)

	for i := 0; i < replicas; i++ {
		go func() {
			largada.Wait()
			erros <- db.Aplicar(ctx, pool)
		}()
	}
	largada.Done()

	for i := 0; i < replicas; i++ {
		require.NoError(t, <-erros, "nenhuma replica pode falhar ao migrar")
	}

	var versoes int
	require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FROM schema_version`).Scan(&versoes))
	assert.Equal(t, 10, versoes, "cada migration deve ser aplicada uma unica vez")
}
