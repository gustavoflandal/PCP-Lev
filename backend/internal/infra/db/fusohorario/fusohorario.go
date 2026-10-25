// Package fusohorario faz o pgx ler as colunas TIMESTAMP (sem fuso) no fuso
// em que o banco as grava.
//
// As colunas created_at, data_hora, tempo_inicio etc. recebem
// CURRENT_TIMESTAMP, que o PostgreSQL calcula na hora de parede do fuso da
// sessao (TZ=America/Sao_Paulo no compose). Sem isto o pgx devolve esses
// digitos rotulados como UTC: o JSON sai "...T13:45:00Z" para um evento das
// 13:45 em Sao Paulo, e o navegador exibe 10:45.
package fusohorario

import (
	"context"
	"fmt"
	"time"
	_ "time/tzdata" // a imagem alpine nao tem a base de fusos do sistema

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Configurar registra, em cada conexao nova do pool, o codec de TIMESTAMP com
// o fuso da propria sessao do banco.
func Configurar(cfg *pgxpool.Config) {
	anterior := cfg.AfterConnect
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		if anterior != nil {
			if err := anterior(ctx, conn); err != nil {
				return err
			}
		}
		var nome string
		if err := conn.QueryRow(ctx, `SELECT current_setting('TimeZone')`).Scan(&nome); err != nil {
			return fmt.Errorf("ler fuso da sessao: %w", err)
		}
		local, err := time.LoadLocation(nome)
		if err != nil {
			return fmt.Errorf("fuso %q desconhecido: %w", nome, err)
		}
		conn.TypeMap().RegisterType(&pgtype.Type{
			Name: "timestamp", OID: pgtype.TimestampOID, Codec: &pgtype.TimestampCodec{ScanLocation: local},
		})
		return nil
	}
}
