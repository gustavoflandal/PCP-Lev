### Task B1: Migration e domínio `regional`

**Files:**
- Create: `backend/internal/infra/db/migrations/011_criar_configuracao_regional.sql`
- Create: `backend/internal/domain/regional/regional.go`
- Test: `backend/internal/domain/regional/regional_test.go`

**Interfaces:**
- Produces: `regional.FormatoData` (`"DD/MM/AAAA"`, `"DD-MM-AAAA"`, `"AAAA-MM-DD"`),
  `regional.FormatoHora` (`"24H"`, `"12H"`), `regional.Regional{FormatoData,
  FormatoHora, UpdatedAt time.Time, UpdatedBy *string}`, `regional.Dados{FormatoData,
  FormatoHora}`, `regional.Dados.Validar() error`, `regional.ErrFormatoDataInvalido`,
  `regional.ErrFormatoHoraInvalido` — usados por Task B2.

- [ ] **Passo 1: migration**

```sql
-- 011_criar_configuracao_regional.sql
-- Parametros regionais e de formatacao (Fase 4, doc 0 secao 4.6.4). Singleton,
-- mesmo padrao de configuracao_empresa (010): PK fixa + CHECK garantem uma
-- unica linha. Diferente de empresa, a linha ja nasce com os defaults
-- funcionais (DD/MM/AAAA, 24H) -- nao ha "primeira configuracao pelo admin"
-- aqui, o sistema ja funciona sem nenhuma acao.
CREATE TABLE configuracao_regional (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  formato_data VARCHAR(10) NOT NULL DEFAULT 'DD/MM/AAAA'
    CHECK (formato_data IN ('DD/MM/AAAA', 'DD-MM-AAAA', 'AAAA-MM-DD')),
  formato_hora VARCHAR(3) NOT NULL DEFAULT '24H'
    CHECK (formato_hora IN ('24H', '12H')),

  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50)
);

INSERT INTO configuracao_regional (id) VALUES (1);
```

- [ ] **Passo 2: domínio**

```go
// Package regional contem os parametros regionais e de formatacao (doc 0,
// secao 4.6.4). E um singleton: uma unica linha no banco, nunca uma lista --
// Buscar/Atualizar em vez de Listar/Criar/Excluir. Mesmo molde de
// internal/domain/empresa.
package regional

import (
	"errors"
	"slices"
	"time"
)

// FormatoData e o conjunto fechado de formatos de exibicao de data.
type FormatoData string

const (
	FormatoDataBR    FormatoData = "DD/MM/AAAA"
	FormatoDataTraco FormatoData = "DD-MM-AAAA"
	FormatoDataISO   FormatoData = "AAAA-MM-DD"
)

var formatosDataValidos = []FormatoData{FormatoDataBR, FormatoDataTraco, FormatoDataISO}

// FormatoHora e o conjunto fechado de formatos de exibicao de hora.
type FormatoHora string

const (
	FormatoHora24 FormatoHora = "24H"
	FormatoHora12 FormatoHora = "12H"
)

var formatosHoraValidos = []FormatoHora{FormatoHora24, FormatoHora12}

var (
	ErrFormatoDataInvalido = errors.New("formato de data invalido")
	ErrFormatoHoraInvalido = errors.New("formato de hora invalido")
)

// Regional e a configuracao singleton lida por GET /configuracoes/regional.
type Regional struct {
	FormatoData FormatoData `json:"formato_data"`
	FormatoHora FormatoHora `json:"formato_hora"`
	UpdatedAt   time.Time   `json:"updated_at"`
	UpdatedBy   *string     `json:"updated_by,omitempty"`
}

// Dados sao os campos informados no PUT -- sempre a configuracao inteira
// sendo salva de novo, mesmo padrao de empresa.Dados.
type Dados struct {
	FormatoData FormatoData
	FormatoHora FormatoHora
}

// Validar confere o conjunto fechado de cada campo -- um valor fora da lista
// quebraria o CHECK constraint da migration 011 com um 500 generico em vez
// de um 400 explicando o motivo (mesmo padrao de usuario.Preferencias.Validar).
func (d Dados) Validar() error {
	if !slices.Contains(formatosDataValidos, d.FormatoData) {
		return ErrFormatoDataInvalido
	}
	if !slices.Contains(formatosHoraValidos, d.FormatoHora) {
		return ErrFormatoHoraInvalido
	}
	return nil
}
```

- [ ] **Passo 3: teste do domínio**

```go
package regional_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/stretchr/testify/assert"
)

func TestValidarAceitaACombinacaoPadrao(t *testing.T) {
	d := regional.Dados{FormatoData: regional.FormatoDataBR, FormatoHora: regional.FormatoHora24}
	assert.NoError(t, d.Validar())
}

func TestValidarAceitaTodasAsCombinacoes(t *testing.T) {
	formatosData := []regional.FormatoData{regional.FormatoDataBR, regional.FormatoDataTraco, regional.FormatoDataISO}
	formatosHora := []regional.FormatoHora{regional.FormatoHora24, regional.FormatoHora12}
	for _, fd := range formatosData {
		for _, fh := range formatosHora {
			d := regional.Dados{FormatoData: fd, FormatoHora: fh}
			assert.NoError(t, d.Validar(), "formato_data=%s formato_hora=%s", fd, fh)
		}
	}
}

func TestValidarRejeitaFormatoDataForaDoConjunto(t *testing.T) {
	d := regional.Dados{FormatoData: "MM/DD/AAAA", FormatoHora: regional.FormatoHora24}
	assert.ErrorIs(t, d.Validar(), regional.ErrFormatoDataInvalido)
}

func TestValidarRejeitaFormatoHoraForaDoConjunto(t *testing.T) {
	d := regional.Dados{FormatoData: regional.FormatoDataBR, FormatoHora: "36H"}
	assert.ErrorIs(t, d.Validar(), regional.ErrFormatoHoraInvalido)
}
```

- [ ] **Passo 4: rodar a suíte do backend via Docker (comando no Global Constraints)**
  e confirmar que a migration 011 aplica sem erro e os 4 testes novos passam.

- [ ] **Passo 5: commit**

```bash
git add backend/internal/infra/db/migrations/011_criar_configuracao_regional.sql \
        backend/internal/domain/regional/
git commit -m "feat(backend): dominio de parametros regionais"
```

---

