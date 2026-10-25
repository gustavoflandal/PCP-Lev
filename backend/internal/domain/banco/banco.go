// Package banco reune o diagnostico somente-leitura do PostgreSQL exibido na
// tela de Seguranca/Banco de Dados (doc 0, secao 4.7.6). Por decisao de
// arquitetura do proprio documento, nada aqui aceita ou devolve usuario,
// senha ou string de conexao -- so metadados do servidor. O log de falha
// (registrarFalha) guarda a mensagem do driver, que pode citar host e
// usuario, mas nunca a senha.
package banco

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

// ErrIndisponivel indica que o banco nao respondeu. A mensagem do driver
// nao e propagada: ela pode conter host e usuario da conexao.
var ErrIndisponivel = errors.New("banco de dados indisponivel")

// Tabela e uma das maiores tabelas do schema da aplicacao.
type Tabela struct {
	Nome         string `json:"tabela"`
	TamanhoBytes int64  `json:"tamanho_bytes"`
	// LinhasEstimadas e nulo quando o PostgreSQL ainda nao tem estimativa
	// (tabela nunca analisada e estatisticas zeradas).
	LinhasEstimadas *int64 `json:"linhas_estimadas"`
}

// Pool e o retrato do pool de conexoes da propria API.
type Pool struct {
	EmUso   int32 `json:"em_uso"`
	Ociosas int32 `json:"ociosas"`
	Total   int32 `json:"total"`
	Maximo  int32 `json:"maximo"`
}

// Metricas sao os dados lidos do servidor pelo repositorio.
type Metricas struct {
	Latencia       time.Duration
	Versao         string
	Banco          string
	TamanhoBytes   int64
	MaioresTabelas []Tabela
	Pool           Pool
	ConexoesAtivas int64
}

// Status e a resposta de GET /configuracoes/banco.
type Status struct {
	Conectado      bool     `json:"conectado"`
	LatenciaMs     float64  `json:"latencia_ms"`
	Host           string   `json:"host"`
	Banco          string   `json:"banco"`
	Versao         string   `json:"versao"`
	TamanhoBytes   int64    `json:"tamanho_bytes"`
	MaioresTabelas []Tabela `json:"maiores_tabelas"`
	Pool           Pool     `json:"pool"`
	ConexoesAtivas int64    `json:"conexoes_ativas"`
	// UltimoBackup fica sempre nulo ate Backup e Manutencao (doc 0, secao
	// 4.6.8) existir -- o campo ja faz parte do contrato para a tela reservar
	// o lugar.
	UltimoBackup *time.Time `json:"ultimo_backup"`
}

// Teste e a resposta de POST /configuracoes/banco/testar.
type Teste struct {
	OK         bool    `json:"ok"`
	LatenciaMs float64 `json:"latencia_ms"`
}

// Repositorio e a porta de leitura das metricas do servidor.
type Repositorio interface {
	Metricas(ctx context.Context) (Metricas, error)
	Ping(ctx context.Context) (time.Duration, error)
}

// Servico monta o diagnostico. Host e porta vem da configuracao da API (nao
// do banco), e saem sempre mascarados.
type Servico struct {
	repo  Repositorio
	host  string
	porta int
}

// NovoServico monta o servico sobre o repositorio e o destino da conexao.
func NovoServico(repo Repositorio, host string, porta int) *Servico {
	return &Servico{repo: repo, host: host, porta: porta}
}

// Status devolve o diagnostico completo.
func (s *Servico) Status(ctx context.Context) (Status, error) {
	m, err := s.repo.Metricas(ctx)
	if err != nil {
		registrarFalha("status", err)
		return Status{}, ErrIndisponivel
	}
	tabelas := m.MaioresTabelas
	if tabelas == nil {
		tabelas = []Tabela{}
	}
	return Status{
		Conectado:      true,
		LatenciaMs:     milissegundos(m.Latencia),
		Host:           fmt.Sprintf("%s:%d", MascararHost(s.host), s.porta),
		Banco:          m.Banco,
		Versao:         m.Versao,
		TamanhoBytes:   m.TamanhoBytes,
		MaioresTabelas: tabelas,
		Pool:           m.Pool,
		ConexoesAtivas: m.ConexoesAtivas,
	}, nil
}

// Testar executa um SELECT 1 e mede a latencia.
func (s *Servico) Testar(ctx context.Context) (Teste, error) {
	latencia, err := s.repo.Ping(ctx)
	if err != nil {
		registrarFalha("testar", err)
		return Teste{}, ErrIndisponivel
	}
	return Teste{OK: true, LatenciaMs: milissegundos(latencia)}, nil
}

// MascararHost mantem so as pontas do nome -- o suficiente para o
// administrador reconhecer o servidor, sem entregar o endereco inteiro a quem
// sequestrar a sessao dele.
func MascararHost(host string) string {
	runas := []rune(host)
	if len(runas) <= 4 {
		return "****"
	}
	return string(runas[:2]) + "*****" + string(runas[len(runas)-2:])
}

// registrarFalha guarda a causa real no log -- a resposta da API so diz
// "indisponivel", mas quem opera precisa saber se foi rede, timeout ou
// permissao. O texto do pgx traz host/usuario/banco, nunca a senha; o
// mascaramento de credenciais do doc 0 (secao 4.7.6) e sobre senha e DSN.
func registrarFalha(operacao string, err error) {
	slog.Error("diagnostico do banco falhou", "operacao", operacao, "erro", err)
}

func milissegundos(d time.Duration) float64 {
	return float64(d.Microseconds()) / 1000
}
