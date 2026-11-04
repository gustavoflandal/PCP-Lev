// Package integracao cuida das chaves de API com que o ERP consome a API
// publica de consulta (/api/integracao/v1). O segredo de uma chave so existe
// em claro no momento da criacao: o banco guarda apenas o hash SHA-256.
package integracao

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	// PrefixoChave identifica uma chave do PCP num cofre de segredos do ERP.
	PrefixoChave = "pcp_"
	// tamanhoPrefixoVisivel: quantos caracteres a tela mostra para identificar a chave.
	tamanhoPrefixoVisivel = 12
	bytesAleatorios       = 24
	// intervaloUltimoUso evita uma escrita no banco a cada chamada da API.
	intervaloUltimoUso = time.Minute
)

var (
	ErrNomeObrigatorio = errors.New("informe o nome da chave (ate 80 caracteres)")
	ErrDescricaoLonga  = errors.New("a descricao vai ate 255 caracteres")
	ErrNaoEncontrada   = errors.New("chave de API nao encontrada")
	ErrJaRevogada      = errors.New("a chave de API ja foi revogada")
	// ErrChaveInvalida cobre chave ausente, desconhecida ou revogada: a API
	// nao diz qual, para nao ajudar quem tenta adivinhar.
	ErrChaveInvalida = errors.New("chave de API invalida ou revogada")
)

// ChaveAPI e uma chave de integracao como a tela a exibe (nunca o segredo).
type ChaveAPI struct {
	ID          int64      `json:"id"`
	Nome        string     `json:"nome"`
	Descricao   string     `json:"descricao"`
	Prefixo     string     `json:"prefixo"`
	Ativo       bool       `json:"ativo"`
	CriadoPor   string     `json:"criado_por"`
	UltimoUso   *time.Time `json:"ultimo_uso,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	RevogadaEm  *time.Time `json:"revogada_em,omitempty"`
	RevogadaPor string     `json:"revogada_por,omitempty"`
}

// ChaveCriada e a resposta da criacao: a unica vez em que o segredo aparece.
type ChaveCriada struct {
	ChaveAPI
	Segredo string `json:"chave"`
}

// Repositorio e a porta de persistencia das chaves.
type Repositorio interface {
	Criar(ctx context.Context, c *ChaveAPI, hash string) error
	Listar(ctx context.Context) ([]ChaveAPI, error)
	// BuscarAtivaPorHash devolve a chave ativa com este hash, ou ErrNaoEncontrada.
	BuscarAtivaPorHash(ctx context.Context, hash string) (*ChaveAPI, error)
	Revogar(ctx context.Context, id int64, autor string) error
	RegistrarUso(ctx context.Context, id int64) error
}

// Servico reune os casos de uso.
type Servico struct {
	repo  Repositorio
	agora func() time.Time
}

// NovoServico monta o servico.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo, agora: time.Now}
}

// HashDaChave e o hash SHA-256 (hex) guardado no banco.
func HashDaChave(segredo string) string {
	soma := sha256.Sum256([]byte(segredo))
	return hex.EncodeToString(soma[:])
}

// gerarSegredo devolve "pcp_" + 48 caracteres hexadecimais (192 bits).
func gerarSegredo() (string, error) {
	bruto := make([]byte, bytesAleatorios)
	if _, err := rand.Read(bruto); err != nil {
		return "", err
	}
	return PrefixoChave + hex.EncodeToString(bruto), nil
}

// Criar gera uma chave nova. O segredo devolvido nao pode ser recuperado depois.
func (s *Servico) Criar(ctx context.Context, nome, descricao, autor string) (*ChaveCriada, error) {
	nome = strings.TrimSpace(nome)
	descricao = strings.TrimSpace(descricao)
	if nome == "" || utf8.RuneCountInString(nome) > 80 {
		return nil, ErrNomeObrigatorio
	}
	if utf8.RuneCountInString(descricao) > 255 {
		return nil, ErrDescricaoLonga
	}

	segredo, err := gerarSegredo()
	if err != nil {
		return nil, err
	}
	chave := &ChaveAPI{
		Nome: nome, Descricao: descricao, Prefixo: segredo[:tamanhoPrefixoVisivel],
		Ativo: true, CriadoPor: autor,
	}
	if err := s.repo.Criar(ctx, chave, HashDaChave(segredo)); err != nil {
		return nil, err
	}
	return &ChaveCriada{ChaveAPI: *chave, Segredo: segredo}, nil
}

// Listar devolve todas as chaves, ativas e revogadas.
func (s *Servico) Listar(ctx context.Context) ([]ChaveAPI, error) {
	return s.repo.Listar(ctx)
}

// Revogar desativa a chave: a API passa a recusa-la na proxima chamada.
func (s *Servico) Revogar(ctx context.Context, id int64, autor string) error {
	return s.repo.Revogar(ctx, id, autor)
}

// Autenticar confere o segredo recebido no cabecalho X-API-Key e registra o
// uso (no maximo uma vez por minuto por chave).
func (s *Servico) Autenticar(ctx context.Context, segredo string) (*ChaveAPI, error) {
	segredo = strings.TrimSpace(segredo)
	if !strings.HasPrefix(segredo, PrefixoChave) || len(segredo) < tamanhoPrefixoVisivel {
		return nil, ErrChaveInvalida
	}
	hash := HashDaChave(segredo)
	chave, err := s.repo.BuscarAtivaPorHash(ctx, hash)
	if err != nil {
		if errors.Is(err, ErrNaoEncontrada) {
			return nil, ErrChaveInvalida
		}
		return nil, err
	}
	if chave.UltimoUso == nil || s.agora().Sub(*chave.UltimoUso) > intervaloUltimoUso {
		// Best-effort: registrar o uso nao pode derrubar a consulta do ERP.
		_ = s.repo.RegistrarUso(ctx, chave.ID)
	}
	return chave, nil
}
