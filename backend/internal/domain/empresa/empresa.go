// Package empresa contem os dados de identificacao da empresa que opera o
// sistema (doc 0, secao 4.6.2). E um singleton: uma unica linha no banco,
// nunca uma lista -- Buscar/Atualizar em vez de Listar/Criar/Excluir.
package empresa

import (
	"bytes"
	"errors"
	"image"
	_ "image/png"
	"net/mail"
	"strings"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/documento"
)

var (
	ErrRazaoSocialObrigatoria = errors.New("a razao social e obrigatoria")
	ErrCNPJInvalido           = errors.New("o CNPJ informado e invalido")
	ErrUFInvalida             = errors.New("a UF deve ter 2 letras")
	ErrEmailInvalido          = errors.New("o email institucional e invalido")

	// ErrImagemFormatoInvalido cobre tanto o formato errado (nem PNG nem SVG,
	// ou SVG onde so PNG e aceito) quanto um arquivo corrompido/vazio.
	ErrImagemFormatoInvalido = errors.New("a imagem deve ser PNG ou SVG")
	ErrImagemMuitoGrande     = errors.New("a imagem excede o tamanho maximo permitido")
	ErrImagemPequenaDemais   = errors.New("a imagem esta abaixo da dimensao minima exigida")
)

// Limites de upload -- a doc 0 pede "limite de tamanho e validacao de
// dimensoes minimas" sem fixar numeros; sao valores conservadores para nao
// inchar a linha do banco (o logo fica em bytea, nao em object storage).
const (
	TamanhoMaximoLogoBytes    = 1 << 20   // 1 MiB
	TamanhoMaximoFaviconBytes = 200 << 10 // 200 KiB

	dimensaoMinimaLogo    = 32
	dimensaoMinimaFavicon = 16
)

const (
	mimePNG = "image/png"
	mimeSVG = "image/svg+xml"
)

// Empresa e a configuracao singleton lida por GET /configuracoes/empresa. Os
// bytes de imagem nunca aparecem aqui -- so a existencia (ver os endpoints
// binarios dedicados, .../logotipo/claro etc.), para manter o payload leve.
type Empresa struct {
	RazaoSocial           string `json:"razao_social"`
	NomeFantasia          string `json:"nome_fantasia"`
	CNPJ                  string `json:"cnpj"`
	InscricaoEstadual     string `json:"inscricao_estadual"`
	InscricaoMunicipal    string `json:"inscricao_municipal"`
	CNAE                  string `json:"cnae"`
	CEP                   string `json:"cep"`
	Logradouro            string `json:"logradouro"`
	Numero                string `json:"numero"`
	Complemento           string `json:"complemento"`
	Bairro                string `json:"bairro"`
	Cidade                string `json:"cidade"`
	UF                    string `json:"uf"`
	Telefone              string `json:"telefone"`
	Email                 string `json:"email"`
	Site                  string `json:"site"`
	RodapePadrao          string `json:"rodape_padrao"`
	CondicoesGeraisCompra string `json:"condicoes_gerais_compra"`
	ResponsavelTecnico    string `json:"responsavel_tecnico"`

	TemLogoClaro  bool `json:"tem_logo_claro"`
	TemLogoEscuro bool `json:"tem_logo_escuro"`
	TemFavicon    bool `json:"tem_favicon"`

	UpdatedAt time.Time `json:"updated_at"`
	UpdatedBy *string   `json:"updated_by,omitempty"`
}

// Dados sao os campos de texto informados no PUT. Sempre a empresa inteira
// sendo salva de novo -- nao existe "campo nao informado" aqui como em um
// PATCH de cadastro, entao nao ha ponteiros.
type Dados struct {
	RazaoSocial           string
	NomeFantasia          string
	CNPJ                  string
	InscricaoEstadual     string
	InscricaoMunicipal    string
	CNAE                  string
	CEP                   string
	Logradouro            string
	Numero                string
	Complemento           string
	Bairro                string
	Cidade                string
	UF                    string
	Telefone              string
	Email                 string
	Site                  string
	RodapePadrao          string
	CondicoesGeraisCompra string
	ResponsavelTecnico    string
}

// Normalizar deixa os dados na forma em que sao persistidos: documento e CEP
// so com digitos, UF em maiusculas, texto sem espacos nas pontas.
func (d *Dados) Normalizar() {
	d.RazaoSocial = strings.TrimSpace(d.RazaoSocial)
	d.NomeFantasia = strings.TrimSpace(d.NomeFantasia)
	d.CNPJ = documento.ApenasDigitos(d.CNPJ)
	d.InscricaoEstadual = strings.TrimSpace(d.InscricaoEstadual)
	d.InscricaoMunicipal = strings.TrimSpace(d.InscricaoMunicipal)
	d.CNAE = strings.TrimSpace(d.CNAE)
	d.CEP = documento.ApenasDigitos(d.CEP)
	d.Logradouro = strings.TrimSpace(d.Logradouro)
	d.Numero = strings.TrimSpace(d.Numero)
	d.Complemento = strings.TrimSpace(d.Complemento)
	d.Bairro = strings.TrimSpace(d.Bairro)
	d.Cidade = strings.TrimSpace(d.Cidade)
	d.UF = strings.ToUpper(strings.TrimSpace(d.UF))
	d.Telefone = documento.ApenasDigitos(d.Telefone)
	d.Email = strings.ToLower(strings.TrimSpace(d.Email))
	d.Site = strings.TrimSpace(d.Site)
	d.RodapePadrao = strings.TrimSpace(d.RodapePadrao)
	d.CondicoesGeraisCompra = strings.TrimSpace(d.CondicoesGeraisCompra)
	d.ResponsavelTecnico = strings.TrimSpace(d.ResponsavelTecnico)
}

// Validar aplica as regras do doc 0 §4.6.2. Diferente de Fornecedor, o CNPJ
// aqui e opcional: nao faz sentido travar a primeira configuracao do sistema
// (ambiente novo, demo, homologacao) por falta de CNPJ definitivo.
//
// Nao exige Normalizar antes: CNPJ e conferido pelos digitos, entao um valor
// pontuado vindo da interface passa pelas mesmas regras.
func (d Dados) Validar() error {
	if strings.TrimSpace(d.RazaoSocial) == "" {
		return ErrRazaoSocialObrigatoria
	}
	if cnpj := documento.ApenasDigitos(d.CNPJ); cnpj != "" && !documento.CNPJValido(cnpj) {
		return ErrCNPJInvalido
	}
	if uf := strings.TrimSpace(d.UF); uf != "" && len(uf) != 2 {
		return ErrUFInvalida
	}
	return validarEmail(d.Email)
}

// validarEmail aceita o campo vazio: nem toda empresa tem e-mail
// institucional definido ainda.
func validarEmail(email string) error {
	email = strings.TrimSpace(email)
	if email == "" {
		return nil
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return ErrEmailInvalido
	}
	return nil
}

// ValidarImagem confere tamanho, formato e dimensao minima de um upload de
// logo (claro/escuro) ou favicon. dados sao os bytes ja decodificados do
// base64; mimeDeclarado vem do arquivo escolhido no navegador (pode vir
// vazio em alguns casos, por isso o conteudo tambem e conferido).
func ValidarImagem(dados []byte, mimeDeclarado string, ehFavicon bool) (tipoNormalizado string, err error) {
	limite := TamanhoMaximoLogoBytes
	dimensaoMinima := dimensaoMinimaLogo
	if ehFavicon {
		limite = TamanhoMaximoFaviconBytes
		dimensaoMinima = dimensaoMinimaFavicon
	}

	if len(dados) == 0 {
		return "", ErrImagemFormatoInvalido
	}
	if len(dados) > limite {
		return "", ErrImagemMuitoGrande
	}

	// Favicon so aceita PNG (evita depender de um parser de ICO, que a
	// stdlib do Go nao tem) -- SVG so entra pela via de logo claro/escuro.
	if !ehFavicon && ehImagemSVG(dados, mimeDeclarado) {
		return mimeSVG, nil
	}

	cfg, formato, decErr := image.DecodeConfig(bytes.NewReader(dados))
	if decErr != nil || formato != "png" {
		return "", ErrImagemFormatoInvalido
	}
	if cfg.Width < dimensaoMinima || cfg.Height < dimensaoMinima {
		return "", ErrImagemPequenaDemais
	}
	return mimePNG, nil
}

// ehImagemSVG aceita pelo conteudo, nao so pelo mimetype declarado -- o
// mimetype de um <input type=file> pode vir vazio dependendo do navegador e
// da extensao do arquivo.
func ehImagemSVG(dados []byte, mimeDeclarado string) bool {
	if mimeDeclarado != mimeSVG && mimeDeclarado != "" {
		return false
	}
	trecho := dados
	if len(trecho) > 1024 {
		trecho = trecho[:1024]
	}
	return bytes.Contains(bytes.ToLower(trecho), []byte("<svg"))
}
