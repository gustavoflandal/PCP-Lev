// Package config carrega e valida a configuracao da aplicacao a partir do
// ambiente. Ref: docs/5_GUIA_IMPLEMENTACAO.md (Variaveis de Ambiente).
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// tamanhoMinimoSegredoJWT evita segredos fracos em producao: uma chave curta
// torna o HMAC do token quebravel por forca bruta.
const tamanhoMinimoSegredoJWT = 32

// Config reune toda a configuracao da API.
type Config struct {
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	DBMaxConns int

	JWTSecret      string
	JWTExpiraHoras int

	APIPort     int
	APIEnv      string
	CorsOrigens []string
	LogLevel    string
}

// Carregar le as variaveis de ambiente, aplica os padroes e valida o
// resultado. Retorna erro descrevendo a primeira variavel invalida.
func Carregar() (*Config, error) {
	cfg := &Config{
		DBHost:     texto("DB_HOST", "localhost"),
		DBPort:     inteiro("DB_PORT", 5432),
		DBUser:     texto("DB_USER", ""),
		DBPassword: texto("DB_PASSWORD", ""),
		DBName:     texto("DB_NAME", ""),
		DBSSLMode:  texto("DB_SSLMODE", "disable"),
		DBMaxConns: inteiro("DB_MAX_CONNS", 20),

		JWTSecret:      texto("JWT_SECRET", ""),
		JWTExpiraHoras: inteiro("JWT_EXPIRE_HOURS", 8),

		APIPort:     inteiro("API_PORT", 8000),
		APIEnv:      texto("API_ENV", "development"),
		CorsOrigens: lista("CORS_ORIGENS", []string{"http://localhost:5173"}),
		LogLevel:    texto("LOG_LEVEL", "info"),
	}

	if err := cfg.validar(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// DSN devolve a string de conexao no formato aceito pelo pgx.
func (c *Config) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName, c.DBSSLMode)
}

// EhProducao indica se a API roda em ambiente produtivo.
func (c *Config) EhProducao() bool {
	return strings.EqualFold(c.APIEnv, "production")
}

func (c *Config) validar() error {
	obrigatorios := []struct {
		nome  string
		valor string
	}{
		{"DB_USER", c.DBUser},
		{"DB_PASSWORD", c.DBPassword},
		{"DB_NAME", c.DBName},
		{"JWT_SECRET", c.JWTSecret},
	}
	for _, o := range obrigatorios {
		if strings.TrimSpace(o.valor) == "" {
			return fmt.Errorf("configuracao invalida: %s e obrigatorio", o.nome)
		}
	}

	if len(c.JWTSecret) < tamanhoMinimoSegredoJWT {
		return fmt.Errorf("configuracao invalida: JWT_SECRET deve ter no minimo %d caracteres",
			tamanhoMinimoSegredoJWT)
	}
	if c.JWTExpiraHoras <= 0 {
		return fmt.Errorf("configuracao invalida: JWT_EXPIRE_HOURS deve ser maior que zero")
	}
	if c.APIPort <= 0 || c.APIPort > 65535 {
		return fmt.Errorf("configuracao invalida: API_PORT fora da faixa valida")
	}
	return nil
}

func texto(chave, padrao string) string {
	if v := strings.TrimSpace(os.Getenv(chave)); v != "" {
		return v
	}
	return padrao
}

func inteiro(chave string, padrao int) int {
	v := strings.TrimSpace(os.Getenv(chave))
	if v == "" {
		return padrao
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return padrao
	}
	return n
}

func lista(chave string, padrao []string) []string {
	v := strings.TrimSpace(os.Getenv(chave))
	if v == "" {
		return padrao
	}
	partes := strings.Split(v, ",")
	saida := make([]string, 0, len(partes))
	for _, p := range partes {
		if p = strings.TrimSpace(p); p != "" {
			saida = append(saida, p)
		}
	}
	return saida
}
