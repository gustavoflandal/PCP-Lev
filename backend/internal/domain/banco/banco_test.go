package banco_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/banco"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type repoFalso struct {
	metricas banco.Metricas
	erro     error
}

func (r repoFalso) Metricas(context.Context) (banco.Metricas, error) { return r.metricas, r.erro }

func (r repoFalso) Ping(context.Context) (time.Duration, error) {
	return 1500 * time.Microsecond, r.erro
}

func TestMascararHost(t *testing.T) {
	assert.Equal(t, "po*****es", banco.MascararHost("postgres"))
	assert.Equal(t, "db*****om", banco.MascararHost("db.interno.empresa.com"))
	assert.Equal(t, "****", banco.MascararHost("db"))
	assert.Equal(t, "****", banco.MascararHost(""))
}

func TestStatusMascaraHostEPreencheCampos(t *testing.T) {
	servico := banco.NovoServico(repoFalso{metricas: banco.Metricas{
		Latencia: 2 * time.Millisecond, Versao: "16.4", Banco: "pcp_db", TamanhoBytes: 100,
	}}, "postgres", 5432)

	status, err := servico.Status(context.Background())

	require.NoError(t, err)
	assert.True(t, status.Conectado)
	assert.Equal(t, "po*****es:5432", status.Host)
	assert.Equal(t, 2.0, status.LatenciaMs)
	assert.NotNil(t, status.MaioresTabelas, "lista vazia sai como [] no JSON, nao null")
	assert.Nil(t, status.UltimoBackup)
}

func TestStatusNaoPropagaErroDoDriver(t *testing.T) {
	servico := banco.NovoServico(repoFalso{erro: errors.New("dial tcp postgres:5432 user=pcp_user")}, "postgres", 5432)

	_, err := servico.Status(context.Background())

	assert.ErrorIs(t, err, banco.ErrIndisponivel)
	assert.NotContains(t, err.Error(), "pcp_user")
}

func TestTestarMedeLatencia(t *testing.T) {
	servico := banco.NovoServico(repoFalso{}, "postgres", 5432)

	teste, err := servico.Testar(context.Background())

	require.NoError(t, err)
	assert.True(t, teste.OK)
	assert.Equal(t, 1.5, teste.LatenciaMs)
}
