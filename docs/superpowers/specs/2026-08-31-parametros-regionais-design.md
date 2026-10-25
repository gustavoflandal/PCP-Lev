# Parâmetros Regionais — desenho

Referências: `docs/0_SUMARIO_EXECUTIVO.md` (§4.6.4), `docs/6_CRONOGRAMA_TECNICO.md`
(cronograma v2.1 — sub-entrega 2 da Fase 4, depois de Auditoria).

## 1. Problema

O doc 0 (§4.6.4) lista "Parâmetros Regionais e de Formatação" como parte do Módulo de
Configurações: formato de data, formato de hora, fuso horário, separadores, moeda,
casas decimais e primeiro dia da semana. Hoje nada disso é configurável — o formato
brasileiro (`DD/MM/AAAA`, vírgula decimal, BRL) está hardcoded em `frontend/src/lib/
formato.ts` e reimplementado localmente em `Auditoria.tsx`.

Boa parte da tabela do doc, olhada com calma, não descreve parâmetros de verdade: só
duas linhas (Formato de Data, Formato de Hora) listam alternativas reais; o resto lista
um único valor "padrão" sem opção — ou já está travado por decisões estruturais tomadas
em sub-entregas anteriores (o tipo `Dinheiro` é hardcoded em centavos/`DECIMAL(10,2)`; as
colunas `TIMESTAMP` não guardam timezone, achado feito ao corrigir a Auditoria). Ver
§2 para o detalhamento decisão por decisão.

## 2. Escopo

**Dentro:**
- **Formato de Data**: `DD/MM/AAAA` (padrão) | `DD-MM-AAAA` | `AAAA-MM-DD`.
- **Formato de Hora**: `24H` (padrão) | `12H`.
- Configuração **do sistema** (singleton, admin edita — mesmo padrão de Dados da
  Empresa), religada em todo lugar do frontend que hoje formata data/hora: os 12
  arquivos que já usam o helper compartilhado `formatarData`, mais `Auditoria.tsx`
  (tem uma cópia local `formatarDataHora`, unificada com o helper nesta tarefa).
- Nova seção "Configurações" (já existe, ganha mais um item) → tela
  `/configuracoes/regional`.

**Fora, com o motivo:**
- **Fuso Horário** — o doc pede `America/Sao_Paulo` com suporte a outras zonas "por
  unidade", mas o sistema não tem o conceito de unidade/site múltiplo. Mesmo um fuso
  único e trocável exigiria que os timestamps fossem realmente guardados em UTC — o
  que o próprio doc exige como regra técnica ("armazenados no banco em UTC"), mas o
  sistema não segue: as colunas `TIMESTAMP` (sem timezone) gravam a hora de parede do
  container Postgres (`TZ=America/Sao_Paulo` fixo no `docker-compose.yml`), achado
  feito e corrigido pontualmente na Auditoria (Fase 4, sub-entrega 1) com uma
  reetiquetagem de fuso fixo, não uma migração real para UTC. Resolver isso de verdade
  para o sistema inteiro é migrar as colunas relevantes para `TIMESTAMPTZ` — decisão
  maior, fora desta rodada. `America/Sao_Paulo` continua fixo.
- **Moeda** — fixo em BRL. Suporte a item precificado em USD/EUR exige moeda por
  registro (peça/cotação/pedido) e lógica de conversão — o tipo `Dinheiro` hoje nem
  guarda um código de moeda. Fatia própria, se algum dia for necessária.
- **Casas decimais** (quantidade, valor unitário, valor total) — já fixas no schema:
  colunas `DECIMAL(10,2)` e o tipo `Dinheiro` trabalham hardcoded em centavos/2 casas
  em todo o backend financeiro (cotações, pedidos de compra). Tornar configurável
  exige mudar schema + o tipo `Dinheiro` no sistema inteiro — risco desproporcional
  para este item do doc.
- **Separador Decimal** (vírgula) / **Separador de Milhar** (ponto) / **Primeiro Dia
  da Semana** (segunda) — a tabela do doc não lista alternativa real para nenhum dos
  três (só o valor "padrão brasileiro"). Tratados como constantes fixas no código,
  sem virar campo editável — expor um seletor sem opção prática só adicionaria
  ruído à tela.
- **Unidades de Medida** (cadastro livre com fator de conversão) — estruturalmente um
  CRUD novo (hoje `unidade_medida` em Peça é texto livre sem lista nem conversão), não
  um parâmetro de formatação. Mais perto de Estoque/Compras. Sub-entrega própria.

## 3. Decisões tomadas

1. **Configuração do sistema, não por usuário** — uma linha global editada pelo
   Administrador, todo mundo vê os mesmos formatos. Decisão do usuário: consistência
   ao olhar o mesmo documento/tela importa mais do que preferência individual aqui
   (diferente de Aparência/Preferências, que é por usuário).
2. **`GET /configuracoes/regional` exige autenticação** (qualquer perfil), diferente
   de `GET /configuracoes/empresa` (público). Nada antes do login usa formato de
   data/hora — não há tela de login com datas, não há favicon/branding dependente
   disso. `PUT` continua restrito a Administrador.
3. **Leitura não-reativa via `.getState()`** — `formatarData`/`formatarHora`
   continuam funções simples (não viram hooks), lendo a store Zustand fora do ciclo de
   render, mesmo padrão já usado para o token de autenticação (`tokenAtual()` em
   `store/autenticacao.ts`, consumido por `servicos/api.ts`). Evita reescrever os 12
   call sites existentes para um hook.
4. **`Auditoria.tsx` perde sua cópia local `formatarDataHora`**, passando a usar o
   helper compartilhado — remove a duplicação e garante que a Auditoria também
   respeita a configuração, sem trabalho extra dedicado a ela.

## 4. Arquitetura

### 4.1 Migration 011

```sql
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

Singleton, mesmo padrão de `configuracao_empresa` (`010_criar_configuracao_empresa.sql`):
PK fixa + `CHECK (id = 1)` garante linha única; semeada na própria migration (diferente
de empresa, que nasce vazia e é preenchida pelo admin — aqui os defaults já são um
sistema funcional sem nenhuma ação do admin).

### 4.2 Domínio `regional` (backend)

Pacote novo `backend/internal/domain/regional`, mirror de `empresa`:

```go
type FormatoData string
const (
    FormatoDataBR   FormatoData = "DD/MM/AAAA"
    FormatoDataBRH  FormatoData = "DD-MM-AAAA"
    FormatoDataISO  FormatoData = "AAAA-MM-DD"
)

type FormatoHora string
const (
    FormatoHora24 FormatoHora = "24H"
    FormatoHora12 FormatoHora = "12H"
)

type Dados struct {
    FormatoData FormatoData
    FormatoHora FormatoHora
}
```

`Validar()`: `slices.Contains` contra os dois conjuntos fechados (mesmo padrão de
`usuario.Preferencias.Validar`, que já faz exatamente isso para `tema`/`densidade`).
Erros: `ErrFormatoDataInvalido`, `ErrFormatoHoraInvalido`.

`Servico`: `Buscar(ctx) (*Dados, error)`, `Atualizar(ctx, dados, autor) error` — sem
`Criar` (a linha já nasce pela migration).

### 4.3 Repositório

`backend/internal/infra/repository/regional_repo.go` — `Buscar`/`Atualizar` sobre a
linha única (nunca insere), mesmo padrão de `EmpresaRepositorio`.

### 4.4 Endpoints

| Rota | Handler | Perfil |
|---|---|---|
| `GET /api/v1/configuracoes/regional` | devolve a configuração atual | qualquer autenticado |
| `PUT /api/v1/configuracoes/regional` | atualiza (`{formato_data, formato_hora}`) | Administrador |

Erros mapeados: `ErrFormatoDataInvalido`/`ErrFormatoHoraInvalido` → 400 (mesmo padrão
de `mapaDeErros`).

### 4.5 Frontend

- `tipos/regional.ts`, `servicos/regional.ts` (`buscarConfiguracaoRegional`,
  `atualizarConfiguracaoRegional`) — mirror de `empresa.ts`.
- `store/configuracaoRegional.ts` (Zustand): estado `{ formatoData, formatoHora }`
  com os defaults do backend, e uma ação `aplicar(dados)`. Populada por um componente
  sem UI `CarregarConfiguracaoRegional`, montado uma vez em `App.tsx` (fora das
  rotas, mesmo padrão de `AplicarBrandingEmpresa`) — busca a config ao montar (só
  depois de autenticado, já que o endpoint exige token) e chama `aplicar`.
- `lib/formato.ts`:
  - `formatarData` passa a montar a string de saída conforme
    `useConfiguracaoRegional.getState().formatoData`, em vez do `${dia}/${mes}/${ano}`
    hardcoded — mesma assinatura, mesmo contrato de entrada (`AAAA-MM-DD` ou prefixo
    de timestamp), só o separador/ordem mudam.
  - `formatarDataHora(iso: string): string` (nova, substitui a cópia local de
    `Auditoria.tsx`): mesma extração de data de `formatarData`, mais hora/minuto
    formatados conforme `formatoHora` (`HH:mm` ou `hh:mm AM/PM`).
- `paginas/configuracoes/ParametrosRegionais.tsx`: dois campos `Selecao` (Formato de
  Data, Formato de Hora), preview ao vivo (ex.: "Assim: 31/08/2026 14:30") calculado
  a partir dos valores selecionados no formulário, não da store (evita salvar sem
  querer só porque o preview precisa refletir a escolha ainda não confirmada).
  Restrita a `perfil === 'ADMIN'` (mesmo guard de `DadosEmpresa.tsx`/`Auditoria.tsx`).
  Ao salvar com sucesso, chama `useConfiguracaoRegional.getState().aplicar(...)`
  diretamente (mesmo padrão de `atualizarPreferenciasSessao`) — sem esperar um
  refetch, a mudança aparece imediatamente em qualquer tela aberta.
- Rota `/configuracoes/regional`, item "Parâmetros regionais" na seção
  "Configurações" da navegação lateral (depois de Auditoria), ajuda contextual.

### 4.6 Erros e validação

Mesma convenção das sub-entregas anteriores: sentinelas de domínio mapeadas por
`mapaDeErros`, `noValidate` no formulário desde o commit inicial.

## 5. Testes

TDD, sem mocks (`testsupport.BancoMigrado`), mesmo rigor das sub-entregas anteriores.
Casos-chave:

- `Validar` rejeita `formato_data`/`formato_hora` fora do conjunto fechado.
- Repositório: `Buscar` devolve os defaults da migration numa base recém-migrada;
  `Atualizar` grava e é lido de volta.
- Handler: `GET` sem token → 401; `PUT` como não-admin → 403; `PUT` com valor
  inválido → 400; ciclo completo `PUT` → `GET` reflete a mudança.
- Frontend: `formatarData` cobre os 3 formatos; `formatarDataHora` cobre a
  combinação de formato de data × formato de hora (3×2 = 6 casos, incluindo o
  comportamento atual como um deles — não deve haver regressão visível quando a
  configuração está nos defaults). Suítes dos 12 arquivos que já chamam
  `formatarData`, e a suíte de `Auditoria.test.tsx`, continuam passando sem alteração
  nas asserções existentes (mudança aditiva: com os defaults, a saída é idêntica à
  atual).
- Tela `ParametrosRegionais`: preview muda ao trocar a seleção antes de salvar;
  salvar aplica a store imediatamente; acesso restrito para não-admin.

## 6. Verificação antes de entregar

- `go build/vet/test ./...` e `npm test`/`lint`/`build` — todos verdes, sem
  regressão na suíte já existente.
- Revisão de código (`code-reviewer`) sobre o diff completo, mesmo padrão das
  sub-entregas anteriores — atenção a: a store não-reativa (`.getState()`) não
  atualiza uma tela já renderizada quando outro usuário muda a config em outra aba
  (aceitável para um valor de configuração de baixa frequência de mudança, mas vale o
  revisor confirmar que não há um caso de uso real prejudicado); `formatarData`
  continuar tratando entrada ausente como `—`, não quebrando quando a store ainda não
  carregou (config chega depois do primeiro render de qualquer tela protegida).
- Fluxo manual via Playwright: trocar para `DD-MM-AAAA`/`AAAA-MM-DD` e para `12H`,
  confirmar que uma tela com data (ex. Cotações) e a Auditoria (data+hora) refletem a
  escolha sem F5; confirmar acesso restrito para não-admin; reverter para o padrão.
- Screenshots + seção 15 do manual de operação (a próxima livre — Auditoria ocupou a
  14), `.superpowers/sdd/progress.md` atualizado a cada etapa, não só no fechamento.

## 7. Riscos

- **`formatarData`/`formatarDataHora` lidas via `.getState()` não são reativas**: uma
  tela já montada não re-renderiza sozinha se a config mudar em segundo plano (só ao
  navegar/remontar). Aceitável porque é uma configuração de sistema, de baixa
  frequência de mudança, alterada só pelo Administrador — mas documentar essa
  limitação explicitamente no comentário do código, para não ser redescoberta como
  bug depois.
- **`Auditoria.tsx` perde sua função local**: qualquer teste que dependa do formato
  de saída exato de `formatarDataHora` (hoje fixo em `DD/MM/AAAA HH:mm`) precisa
  continuar passando com os defaults — checar `Auditoria.test.tsx` linha a linha ao
  migrar, não só rodar a suíte e confiar no resultado verde (um teste que já mockava
  a store com os valores default passaria mesmo com um bug de wiring).
