// Package empresa contem os dados de identificacao da empresa que opera o
// sistema (doc 0, secao 4.6.2). E um singleton: uma unica linha no banco,
// nunca uma lista -- Buscar/Atualizar em vez de Listar/Criar/Excluir.
package empresa

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"image"
	_ "image/png"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/documento"
)

// Telefone institucional: mesma faixa do cadastro de Fornecedor (10 digitos
// fixo, 11 celular, sempre com DDD) -- a coluna e VARCHAR(11), entao um
// numero com DDI (ex.: "+55 12 3456-7890", 12 digitos) nunca caberia.
const (
	digitosMinimosTelefone = 10
	digitosMaximosTelefone = 11
)

var (
	ErrRazaoSocialObrigatoria = errors.New("a razao social e obrigatoria")
	ErrCNPJInvalido           = errors.New("o CNPJ informado e invalido")
	ErrUFInvalida             = errors.New("a UF deve ter 2 letras")
	ErrEmailInvalido          = errors.New("o email institucional e invalido")
	ErrTelefoneInvalido       = errors.New("o telefone deve ter DDD e 8 ou 9 digitos")
	ErrCEPInvalido            = errors.New("o CEP deve ter 8 digitos")
	// ErrCampoMuitoLongo e envolvido com fmt.Errorf para levar o nome do
	// campo e o limite na mensagem -- as colunas do banco sao VARCHAR de
	// tamanho fixo (ver migration 010), e sem essa checagem o Postgres
	// devolve um erro 22001 cru que o repositorio nao sabe traduzir,
	// virando "Erro interno do servidor" para o administrador.
	ErrCampoMuitoLongo = errors.New("um campo excede o tamanho maximo permitido")

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
// Nao exige Normalizar antes: CNPJ, CEP e telefone sao conferidos pelos
// digitos, entao um valor pontuado vindo da interface passa pelas mesmas
// regras.
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
	if err := validarCEP(d.CEP); err != nil {
		return err
	}
	if err := validarTelefone(d.Telefone); err != nil {
		return err
	}
	if err := validarEmail(d.Email); err != nil {
		return err
	}
	return validarComprimentos(d)
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

// validarCEP aceita o campo vazio -- nem toda empresa tem o CEP preenchido
// ainda (a busca automatica so preenche o resto do endereco depois).
func validarCEP(cep string) error {
	digitos := documento.ApenasDigitos(cep)
	if digitos == "" {
		return nil
	}
	if len(digitos) != 8 {
		return ErrCEPInvalido
	}
	return nil
}

// validarTelefone aceita o campo vazio, pelo mesmo motivo do CEP.
func validarTelefone(telefone string) error {
	digitos := documento.ApenasDigitos(telefone)
	if digitos == "" {
		return nil
	}
	if len(digitos) < digitosMinimosTelefone || len(digitos) > digitosMaximosTelefone {
		return ErrTelefoneInvalido
	}
	return nil
}

// limiteDeCampo casa um valor de Dados com o tamanho da coluna VARCHAR
// correspondente na migration 010, para o 400 explicar qual campo estourou
// em vez do Postgres devolver um 22001 cru.
type limiteDeCampo struct {
	nome  string
	valor string
	max   int
}

// validarComprimentos confere os campos de texto livre contra o limite da
// coluna. CNPJ e UF ja tem checagem propria (comprimento exato, nao
// maximo); CEP e telefone tambem; rodape/condicoes gerais sao TEXT, sem
// limite no banco.
func validarComprimentos(d Dados) error {
	limites := []limiteDeCampo{
		{"a razão social", d.RazaoSocial, 200},
		{"o nome fantasia", d.NomeFantasia, 200},
		{"a inscrição estadual", d.InscricaoEstadual, 30},
		{"a inscrição municipal", d.InscricaoMunicipal, 30},
		{"o CNAE", d.CNAE, 20},
		{"o logradouro", d.Logradouro, 200},
		{"o número", d.Numero, 20},
		{"o complemento", d.Complemento, 100},
		{"o bairro", d.Bairro, 100},
		{"a cidade", d.Cidade, 100},
		{"o e-mail", d.Email, 200},
		{"o site", d.Site, 200},
		{"o responsável técnico", d.ResponsavelTecnico, 200},
	}
	for _, l := range limites {
		if utf8.RuneCountInString(l.valor) > l.max {
			return fmt.Errorf("%w: %s deve ter no maximo %d caracteres", ErrCampoMuitoLongo, l.nome, l.max)
		}
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

// ehImagemSVG exige o mimetype declarado igual e analisa o XML de verdade
// (nao so `bytes.Contains(..., "<svg")`) para achar o elemento raiz --
// aceitar por substring deixava passar qualquer arquivo com "<svg" em
// algum comentario, e um SVG com um DOCTYPE/comentario de licenca longo
// (comum em exports corporativos) empurrava a tag raiz para alem de um
// recorte fixo de bytes, sendo rejeitado por engano.
//
// Isto NAO sanitiza o conteudo interno: um <svg> bem formado ainda pode
// carregar um <script>. Embutido via <img> o navegador nao executa esse
// script, mas a URL publica pode ser aberta direto -- por isso
// servirImagem tambem manda Content-Security-Policy: sandbox (ver
// handlers/empresa.go), que neutraliza a execucao nesse caso.
func ehImagemSVG(dados []byte, mimeDeclarado string) bool {
	if mimeDeclarado != mimeSVG {
		return false
	}
	decodificador := xml.NewDecoder(bytes.NewReader(dados))
	for {
		token, err := decodificador.Token()
		if err != nil {
			return false
		}
		if inicio, ok := token.(xml.StartElement); ok {
			return inicio.Name.Local == "svg"
		}
	}
}
