// Comando api sobe o servidor HTTP do Sistema PCP.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api"
	"github.com/gustavoflandal/pcp-lev/backend/internal/config"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/joho/godotenv"
)

const tempoLimiteEncerramento = 15 * time.Second

func main() {
	if err := executar(); err != nil {
		slog.Error("a API nao pode iniciar", "erro", err)
		os.Exit(1)
	}
}

func executar() error {
	carregarEnvLocal()

	cfg, err := config.Carregar()
	if err != nil {
		return err
	}
	configurarLog(cfg)

	ctx := context.Background()
	pool, err := db.Conectar(ctx, cfg)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := db.Aplicar(ctx, pool); err != nil {
		return fmt.Errorf("aplicar migrations: %w", err)
	}

	roteador := api.NovoRoteador(api.Dependencias{
		Cfg:    cfg,
		Pool:   pool,
		Tokens: auth.NovoServicoToken(cfg.JWTSecret, time.Duration(cfg.JWTExpiraHoras)*time.Hour),
	})

	endereco := fmt.Sprintf(":%d", cfg.APIPort)
	falhas := make(chan error, 1)
	go func() {
		slog.Info("API no ar", "endereco", endereco, "ambiente", cfg.APIEnv)
		if err := roteador.Start(endereco); err != nil && !errors.Is(err, http.ErrServerClosed) {
			falhas <- err
		}
	}()

	// Encerramento suave: para de aceitar conexoes novas e aguarda as em curso.
	encerrar := make(chan os.Signal, 1)
	signal.Notify(encerrar, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-falhas:
		return err
	case <-encerrar:
		slog.Info("encerrando a API")
		ctxEncerramento, cancelar := context.WithTimeout(context.Background(), tempoLimiteEncerramento)
		defer cancelar()
		return roteador.Shutdown(ctxEncerramento)
	}
}

// carregarEnvLocal le o .env do diretorio corrente ou da raiz do repositorio.
// E conveniencia de desenvolvimento: em producao as variaveis vem do ambiente
// e a ausencia do arquivo nao e erro. Cada caminho e tentado em separado
// porque godotenv.Load aborta na primeira ausencia quando recebe uma lista.
func carregarEnvLocal() {
	for _, caminho := range []string{".env", "../.env"} {
		if err := godotenv.Load(caminho); err == nil {
			slog.Debug("variaveis carregadas do arquivo", "caminho", caminho)
			return
		}
	}
}

func configurarLog(cfg *config.Config) {
	nivel := slog.LevelInfo
	switch strings.ToLower(cfg.LogLevel) {
	case "debug":
		nivel = slog.LevelDebug
	case "warn":
		nivel = slog.LevelWarn
	case "error":
		nivel = slog.LevelError
	}

	opcoes := &slog.HandlerOptions{Level: nivel}
	var handler slog.Handler = slog.NewTextHandler(os.Stdout, opcoes)
	if cfg.EhProducao() {
		handler = slog.NewJSONHandler(os.Stdout, opcoes)
	}
	slog.SetDefault(slog.New(handler))
}
