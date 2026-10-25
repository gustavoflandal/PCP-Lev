// Package cripto cifra segredos de terceiros em repouso (doc 0, secao 4.7.6:
// "senha de SMTP e tokens de integracao armazenados criptografados em repouso
// com AES-256-GCM, com chave mestra fora do banco").
package cripto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

// TamanhoChave e o tamanho da chave mestra: 32 bytes = AES-256.
const TamanhoChave = 32

// versao prefixa todo texto cifrado: uma rotacao de chave ou de algoritmo
// futura reconhece o que foi gravado com o esquema atual sem adivinhar.
const versao = "v1:"

// ErrTextoCifradoInvalido indica um valor que nao foi gerado por este cofre
// com esta chave e este contexto (corrompido, cifrado com outra chave mestra
// ou movido para outro contexto).
var ErrTextoCifradoInvalido = errors.New("texto cifrado invalido, de outra chave mestra ou de outro contexto")

// Cofre cifra e decifra com AES-256-GCM. O nonce e aleatorio a cada Cifrar e
// vai junto do texto cifrado, entao cifrar o mesmo segredo duas vezes nunca
// produz o mesmo resultado.
type Cofre struct {
	aead cipher.AEAD
}

// NovoCofre monta o cofre a partir da chave mestra em base64 (padrao). Chave
// vazia devolve (nil, nil): o sistema funciona sem segredos de terceiros, e
// quem precisar gravar um recebe um erro explicito do dominio.
func NovoCofre(chaveBase64 string) (*Cofre, error) {
	if chaveBase64 == "" {
		return nil, nil
	}
	chave, err := base64.StdEncoding.DecodeString(chaveBase64)
	if err != nil {
		return nil, fmt.Errorf("chave mestra nao e base64 valido: %w", err)
	}
	if len(chave) != TamanhoChave {
		return nil, fmt.Errorf("chave mestra deve ter %d bytes, tem %d", TamanhoChave, len(chave))
	}
	bloco, err := aes.NewCipher(chave)
	if err != nil {
		return nil, fmt.Errorf("montar AES: %w", err)
	}
	aead, err := cipher.NewGCM(bloco)
	if err != nil {
		return nil, fmt.Errorf("montar GCM: %w", err)
	}
	return &Cofre{aead: aead}, nil
}

// Cifrar devolve "v1:" + base64(nonce || texto cifrado com etiqueta). O
// contexto entra como dado autenticado (AAD) do GCM: nao fica no resultado,
// mas o mesmo contexto e exigido para decifrar. Amarrar o segredo ao seu uso
// (ex.: a senha ao servidor SMTP de destino) impede que o valor gravado seja
// reaproveitado em outro lugar -- trocar o destino torna a senha ilegivel.
func (c *Cofre) Cifrar(texto, contexto string) (string, error) {
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("gerar nonce: %w", err)
	}
	selado := c.aead.Seal(nonce, nonce, []byte(texto), []byte(contexto))
	return versao + base64.StdEncoding.EncodeToString(selado), nil
}

// Decifrar desfaz Cifrar com o mesmo contexto. A etiqueta do GCM garante que
// um valor adulterado, de outra chave ou de outro contexto nao e decifrado em
// silencio para lixo.
func (c *Cofre) Decifrar(cifrado, contexto string) (string, error) {
	corpo, ok := strings.CutPrefix(cifrado, versao)
	if !ok {
		return "", ErrTextoCifradoInvalido
	}
	bruto, err := base64.StdEncoding.DecodeString(corpo)
	if err != nil || len(bruto) < c.aead.NonceSize() {
		return "", ErrTextoCifradoInvalido
	}
	nonce, selado := bruto[:c.aead.NonceSize()], bruto[c.aead.NonceSize():]
	texto, err := c.aead.Open(nil, nonce, selado, []byte(contexto))
	if err != nil {
		return "", ErrTextoCifradoInvalido
	}
	return string(texto), nil
}
