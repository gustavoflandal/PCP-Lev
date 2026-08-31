// Package estrutura contem o cadastro de Estrutura de Produto (BOM, RF1.3):
// o mapeamento de Partes/Pecas necessarias para montar 1 unidade de um
// Produto Acabado. So um nivel (PA -> lista de PPs, sem submontagens
// aninhadas) -- o schema (001_criar_tabelas_base.sql) so referencia
// Partes/Pecas em itens_estrutura_produto, nunca outro Produto Acabado.
package estrutura

import (
	"errors"
	"strings"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

var (
	ErrProdutoAcabadoObrigatorio = errors.New("informe o produto acabado")
	ErrProdutoAcabadoInexistente = errors.New("o produto acabado informado nao existe")
	ErrItensObrigatorios         = errors.New("informe ao menos um item")
	ErrQuantidadeInvalida        = errors.New("a quantidade de cada item deve ser maior que zero")
	ErrPartePecaInexistente      = errors.New("uma das pecas informadas nao existe")
	ErrDataVigenciaObrigatoria   = errors.New("informe a data de inicio da vigencia")
	ErrDataVigenciaFimInvalida   = errors.New("a data de fim da vigencia deve ser posterior ao inicio")
	// ErrVigenciaAnteriorAAtual e devolvido por Versionar quando a nova data
	// de inicio de vigencia nao e posterior a vigencia da estrutura sendo
	// substituida -- evita gravar um intervalo de datas invertido no historico.
	ErrVigenciaAnteriorAAtual = errors.New("a nova vigencia deve comecar depois da vigencia atual")
	// ErrJaPossuiEstruturaAtiva mapeia a violacao do indice unico parcial
	// uk_estrutura_ativa_por_pa -- o produto ja tem uma versao ativa, use
	// Versionar em vez de Criar.
	ErrJaPossuiEstruturaAtiva = errors.New("este produto ja possui uma estrutura ativa, use versionar")
	// ErrStatusInvalidoParaAcao cobre tentar versionar uma estrutura que nao
	// e mais a ativa (ja foi superada por uma versao posterior).
	ErrStatusInvalidoParaAcao = errors.New("esta estrutura nao esta ativa e nao pode ser versionada")
	ErrNaoEncontrado          = errors.New("estrutura de produto nao encontrada")
)

// Item e uma parte/peca com a quantidade necessaria para montar 1 unidade do
// produto acabado.
type Item struct {
	ID          int64 `json:"id"`
	PartePecaID int64 `json:"parte_peca_id"`
	Quantidade  int   `json:"quantidade"`
}

// Estrutura e uma versao da BOM de um Produto Acabado.
type Estrutura struct {
	ID                 int64      `json:"id"`
	ProdutoAcabadoID   int64      `json:"produto_acabado_id"`
	Versao             int        `json:"versao"`
	DataVigenciaInicio tempo.Data `json:"data_vigencia_inicio"`
	DataVigenciaFim    tempo.Data `json:"data_vigencia_fim,omitzero"`
	Ativo              bool       `json:"ativo"`
	Itens              []Item     `json:"itens,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	CreatedBy          *string    `json:"created_by,omitempty"`
	UpdatedBy          *string    `json:"updated_by,omitempty"`
}

// ItemDados sao os dados de um item informados na criacao/versionamento.
type ItemDados struct {
	PartePecaID int64
	Quantidade  int
}

// Dados serve tanto Criar quanto Versionar. ProdutoAcabadoID e lido do corpo
// em Criar (POST /boms); em Versionar o Servico ignora esse campo -- o
// produto e derivado da estrutura ativa que esta sendo substituida.
type Dados struct {
	ProdutoAcabadoID   int64
	DataVigenciaInicio tempo.Data
	DataVigenciaFim    tempo.Data
	Itens              []ItemDados
}

// Validar aplica as regras do RF1.3. err de "produto obrigatorio" so faz
// sentido em Criar -- Versionar nunca chama isto sobre o ProdutoAcabadoID.
func (d Dados) Validar() error {
	if len(d.Itens) == 0 {
		return ErrItensObrigatorios
	}
	for _, item := range d.Itens {
		if item.Quantidade <= 0 {
			return ErrQuantidadeInvalida
		}
	}
	if d.DataVigenciaInicio.IsZero() {
		return ErrDataVigenciaObrigatoria
	}
	if !d.DataVigenciaFim.IsZero() && !d.DataVigenciaFim.After(d.DataVigenciaInicio) {
		return ErrDataVigenciaFimInvalida
	}
	return nil
}

// ValidarProduto e chamada so por Criar (Versionar deriva o produto da
// estrutura ativa, nunca do corpo da requisicao).
func (d Dados) ValidarProduto() error {
	if d.ProdutoAcabadoID <= 0 {
		return ErrProdutoAcabadoObrigatorio
	}
	return nil
}

// Normalizar nao precisa limpar strings (nenhum campo de texto livre nesta
// tarefa), mas existe pela simetria com os outros dominios e para um lugar
// unico crescer se um campo de texto for adicionado depois.
func (d *Dados) Normalizar() {
	_ = strings.TrimSpace // no-op hoje; mantido por simetria com outros dominios
}
