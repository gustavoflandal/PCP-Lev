// Package arquivo guarda arquivos (fotos, PDFs, XML de NF-e) e os vincula a
// entidades como anexos (doc 0, 4.1.2 e 4.3). Os bytes ficam em bytea no
// PostgreSQL (decisao do usuario); o resto das regras do 4.1.2 vale: tipo
// real pelo conteudo (magic number), SHA-256, id interno, URL assinada com
// expiracao curta. Spec: docs/superpowers/specs/2026-10-24-v12-recebimento-fiscal-design.md.
package arquivo

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png" // decodificador PNG para a miniatura
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // decodificador WebP para a miniatura
)

// Tipos aceitos (pelo conteudo, nunca pela extensao).
const (
	MimeJPEG = "image/jpeg"
	MimePNG  = "image/png"
	MimeWebP = "image/webp"
	MimePDF  = "application/pdf"
	MimeXML  = "application/xml"
)

// Limites por tipo (doc 0, 4.1.2).
const (
	LimiteImagem = 5 << 20
	LimitePDF    = 25 << 20
	LimiteXML    = 2 << 20
	// LimiteUpload e o teto do corpo da requisicao de upload.
	LimiteUpload = LimitePDF + (1 << 20)

	ladoMiniatura = 240
	// Limites de dimensao: um PNG de poucos KB pode declarar 60000x60000 e o
	// decodificador alocaria gigabytes (bomba de descompressao).
	ladoMaximo    = 10_000
	pixelsMaximos = 25_000_000
)

// decodificacoes limita quantas imagens sao decodificadas ao mesmo tempo:
// cada uma pode alocar ~100 MB (25 MP em RGBA).
var decodificacoes = make(chan struct{}, 2)

// Validade da URL assinada.
const ValidadeURL = 5 * time.Minute

var (
	ErrTipoNaoAceito = errors.New("tipo de arquivo nao aceito -- envie JPG, PNG, WebP, PDF ou o XML da NF-e")
	ErrGrandeDemais  = errors.New("arquivo grande demais: imagem ate 5 MB, PDF ate 25 MB, XML ate 2 MB")
	ErrVazio         = errors.New("arquivo vazio")
	ErrNaoEncontrado = errors.New("arquivo nao encontrado")
	ErrAssinatura    = errors.New("link do arquivo invalido ou expirado -- abra de novo pela tela")
	ErrDimensao      = errors.New("imagem grande demais em pixels: ate 10000 px por lado e 40 megapixels")
)

// Arquivo e o conteudo guardado (sem os bytes nas listagens).
type Arquivo struct {
	ID           string    `json:"id"`
	SHA256       string    `json:"sha256"`
	NomeOriginal string    `json:"nome_original"`
	TipoMime     string    `json:"tipo_mime"`
	Tamanho      int       `json:"tamanho"`
	TemMiniatura bool      `json:"tem_miniatura"`
	CreatedAt    time.Time `json:"created_at"`
	Conteudo     []byte    `json:"-"`
	Miniatura    []byte    `json:"-"`
}

// EhImagem diz se o tipo e uma das imagens aceitas.
func EhImagem(mime string) bool {
	return mime == MimeJPEG || mime == MimePNG || mime == MimeWebP
}

// DetectarTipo identifica o tipo pelo conteudo (magic number).
func DetectarTipo(conteudo []byte) (string, error) {
	if len(conteudo) == 0 {
		return "", ErrVazio
	}
	detectado := http.DetectContentType(conteudo)
	switch {
	case strings.HasPrefix(detectado, MimeJPEG):
		return MimeJPEG, nil
	case strings.HasPrefix(detectado, MimePNG):
		return MimePNG, nil
	case strings.HasPrefix(detectado, MimeWebP):
		return MimeWebP, nil
	case strings.HasPrefix(detectado, MimePDF):
		return MimePDF, nil
	case strings.HasPrefix(detectado, "text/xml"), strings.HasPrefix(detectado, MimeXML):
		return MimeXML, nil
	}
	// XML sem declaracao <?xml ...> chega como texto: aceito so se for NF-e.
	inicio := strings.TrimSpace(string(conteudo[:min(len(conteudo), 512)]))
	if strings.HasPrefix(inicio, "<nfeProc") || strings.HasPrefix(inicio, "<NFe") {
		return MimeXML, nil
	}
	return "", ErrTipoNaoAceito
}

// Preparar valida o conteudo e monta o Arquivo (hash, tipo, miniatura).
func Preparar(nomeOriginal string, conteudo []byte) (*Arquivo, error) {
	tipo, err := DetectarTipo(conteudo)
	if err != nil {
		return nil, err
	}
	limite := LimiteImagem
	switch tipo {
	case MimePDF:
		limite = LimitePDF
	case MimeXML:
		limite = LimiteXML
	}
	if len(conteudo) > limite {
		return nil, ErrGrandeDemais
	}
	soma := sha256.Sum256(conteudo)
	a := &Arquivo{
		SHA256:       hex.EncodeToString(soma[:]),
		NomeOriginal: sanitizarNome(nomeOriginal),
		TipoMime:     tipo,
		Tamanho:      len(conteudo),
		Conteudo:     conteudo,
	}
	if EhImagem(tipo) {
		mini, err := miniatura(conteudo)
		if errors.Is(err, ErrDimensao) {
			return nil, err
		}
		if err != nil {
			// Assinatura de imagem valida, mas conteudo corrompido.
			return nil, fmt.Errorf("%w: imagem ilegivel", ErrTipoNaoAceito)
		}
		a.Miniatura = mini
		a.TemMiniatura = true
	}
	return a, nil
}

// sanitizarNome guarda so o nome base, sem caminho nem controle, ate 255.
func sanitizarNome(nome string) string {
	nome = filepath.Base(strings.ReplaceAll(nome, "\\", "/"))
	nome = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 || r == '"' {
			return -1
		}
		return r
	}, nome)
	if nome == "" || nome == "." || nome == "/" {
		nome = "arquivo"
	}
	for utf8.RuneCountInString(nome) > 255 {
		_, tamanho := utf8.DecodeLastRuneInString(nome)
		nome = nome[:len(nome)-tamanho]
	}
	return nome
}

// miniatura reduz a imagem para caber em 240x240 (JPEG).
func miniatura(conteudo []byte) ([]byte, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(conteudo))
	if err != nil {
		return nil, err
	}
	if cfg.Width > ladoMaximo || cfg.Height > ladoMaximo || cfg.Width*cfg.Height > pixelsMaximos {
		return nil, ErrDimensao
	}
	decodificacoes <- struct{}{}
	defer func() { <-decodificacoes }()
	origem, _, err := image.Decode(bytes.NewReader(conteudo))
	if err != nil {
		return nil, err
	}
	b := origem.Bounds()
	largura, altura := b.Dx(), b.Dy()
	if largura == 0 || altura == 0 {
		return nil, errors.New("imagem vazia")
	}
	escala := min(1, float64(ladoMiniatura)/float64(max(largura, altura)))
	destino := image.NewRGBA(image.Rect(0, 0, max(1, int(float64(largura)*escala)), max(1, int(float64(altura)*escala))))
	draw.CatmullRom.Scale(destino, destino.Bounds(), origem, b, draw.Over, nil)
	var saida bytes.Buffer
	if err := jpeg.Encode(&saida, destino, &jpeg.Options{Quality: 80}); err != nil {
		return nil, err
	}
	return saida.Bytes(), nil
}

// IDValido confere o formato de um id de arquivo (UUID).
func IDValido(id string) bool {
	if len(id) != 36 {
		return false
	}
	for i, r := range id {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if r != '-' {
				return false
			}
		} else if !strings.ContainsRune("0123456789abcdefABCDEF", r) {
			return false
		}
	}
	return true
}

// Assinador gera e confere URLs assinadas (HMAC-SHA256) de vida curta.
type Assinador struct {
	chave []byte
	agora func() time.Time
}

// NovoAssinador cria o assinador com a chave do servidor.
func NovoAssinador(chave string) *Assinador {
	derivada := sha256.Sum256([]byte("pcp-arquivos:" + chave))
	return &Assinador{chave: derivada[:], agora: time.Now}
}

func (a *Assinador) assinatura(id string, expira int64, miniatura bool) string {
	mac := hmac.New(sha256.New, a.chave)
	fmt.Fprintf(mac, "%s|%d|%t", id, expira, miniatura)
	return hex.EncodeToString(mac.Sum(nil))
}

// URL devolve o caminho assinado (relativo a /api/v1) e a expiracao.
func (a *Assinador) URL(id string, miniatura bool) (string, time.Time) {
	expira := a.agora().Add(ValidadeURL).Truncate(time.Second)
	q := fmt.Sprintf("exp=%d&sig=%s", expira.Unix(), a.assinatura(id, expira.Unix(), miniatura))
	if miniatura {
		q += "&mini=1"
	}
	return "/api/v1/arquivos/" + id + "/conteudo?" + q, expira
}

// Conferir valida a assinatura e a expiracao.
func (a *Assinador) Conferir(id, exp, sig string, miniatura bool) error {
	expira, err := strconv.ParseInt(exp, 10, 64)
	if err != nil || a.agora().Unix() > expira {
		return ErrAssinatura
	}
	esperado := a.assinatura(id, expira, miniatura)
	if !hmac.Equal([]byte(esperado), []byte(sig)) {
		return ErrAssinatura
	}
	return nil
}
