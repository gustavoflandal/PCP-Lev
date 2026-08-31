# Plano — Fase 4.2: Dados da Empresa

Referência: `docs/0_SUMARIO_EXECUTIVO.md` §4.6.2, `docs/6_CRONOGRAMA_TECNICO.md` Fase 4
(item 2). Branch: `feat/dados-empresa`, empilhada sobre `feat/aparencia-preferencias`
(PR ainda aberto).

## Escopo confirmado com o usuário

- **Logotipo**: incluído, guardado como `bytea` no Postgres (não é um anexo por
  documento/OP como a Fase 3.1 prevê — é um dado único da empresa, não precisa de
  MinIO/S3). Variante clara, variante escura e favicon.
- **Aplicação visual**: apenas no cabeçalho do sistema e na tela de login. Pedido de
  Compra (único documento existente hoje) não tem template de impressão — aplicar o
  logo em documentos impressos fica para quando esses templates existirem (Fase 3 em
  diante).
- **Fora de escopo desta rodada**: numeração automática de documentos (§4.6.5 — muda o
  comportamento de telas já entregues, decidir com o stakeholder antes), qualquer
  template de impressão novo.

## Decisões de design

- **Singleton, não CRUD**: uma única linha (`id = 1`, `CHECK (id = 1)` + PK), nunca
  inserida de novo — só lida e atualizada. Mesmo padrão conceitual de
  `usuario.Preferencias`, mas para a empresa inteira em vez de por usuário.
- **Leitura pública, escrita restrita a Administrador**: a tela de login e o favicon
  precisam do nome/logo **antes** da autenticação — não tem como um endpoint atrás de
  JWT servir isso. `GET /configuracoes/empresa` e os endpoints de imagem ficam sem
  `middleware.Autenticacao`. Nenhum campo aqui é sigiloso (é o que consta em qualquer
  nota fiscal da empresa). `PUT` exige `ExigirPerfil(usuario.PerfilAdmin)` — mais
  restrito que `PodeGerenciarCadastros()` (Admin+Gestor), porque é configuração de
  sistema, não cadastro de negócio.
- **Imagens fora do JSON de leitura**: `GET /configuracoes/empresa` devolve
  `tem_logo_claro`/`tem_logo_escuro`/`tem_favicon` (bool), não os bytes — os bytes vêm
  de três endpoints binários dedicados (`GET .../logotipo/claro`, `.../logotipo/escuro`,
  `.../favicon`), que respondem com o `Content-Type` real e cache de navegador. Mantém o
  payload principal leve e permite usar as URLs diretamente em `<img src>` e
  `<link rel="icon">`.
- **Upload em base64 no corpo do PUT**: consistente com o resto da API (tudo aqui é
  JSON, nunca multipart). Cada campo de imagem é `*string` — `nil` significa "não
  alterar", string vazia `""` significa "remover", string não vazia é o base64 novo
  (sem o prefixo `data:...;base64,` — o front remove antes de enviar).
- **Validação de imagem**: PNG ou SVG para os logos, só PNG para o favicon (evita
  depender de um parser de ICO, que a stdlib do Go não tem). Limite de tamanho (1 MiB
  logos, 200 KiB favicon — a doc não fixa um número, este é um valor conservador para
  não inchar a linha do banco) e dimensão mínima em PNG via `image.DecodeConfig`
  (32×32 logos, 16×16 favicon); SVG não tem dimensão em pixel garantida, então só passa
  pelo limite de tamanho e por uma checagem sintática mínima (contém `<svg`).
- **Endereço com CEP**: preenchimento automático é `fetch` direto do frontend para a
  ViaCEP (`https://viacep.com.br/ws/{cep}/json/`, pública, CORS liberado) — não precisa
  de proxy no backend nem de chave de API.

## Backend

### Task B1: migration + domínio

**Files:** `backend/internal/infra/db/migrations/010_criar_configuracao_empresa.sql`,
`backend/internal/domain/empresa/empresa.go` (+ teste)

```sql
CREATE TABLE configuracao_empresa (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  razao_social VARCHAR(200) NOT NULL DEFAULT '',
  nome_fantasia VARCHAR(200) NOT NULL DEFAULT '',
  cnpj VARCHAR(14) NOT NULL DEFAULT '',
  inscricao_estadual VARCHAR(30) NOT NULL DEFAULT '',
  inscricao_municipal VARCHAR(30) NOT NULL DEFAULT '',
  cnae VARCHAR(20) NOT NULL DEFAULT '',
  cep VARCHAR(8) NOT NULL DEFAULT '',
  logradouro VARCHAR(200) NOT NULL DEFAULT '',
  numero VARCHAR(20) NOT NULL DEFAULT '',
  complemento VARCHAR(100) NOT NULL DEFAULT '',
  bairro VARCHAR(100) NOT NULL DEFAULT '',
  cidade VARCHAR(100) NOT NULL DEFAULT '',
  uf CHAR(2) NOT NULL DEFAULT '',
  telefone VARCHAR(11) NOT NULL DEFAULT '',
  email VARCHAR(200) NOT NULL DEFAULT '',
  site VARCHAR(200) NOT NULL DEFAULT '',
  rodape_padrao TEXT NOT NULL DEFAULT '',
  condicoes_gerais_compra TEXT NOT NULL DEFAULT '',
  responsavel_tecnico VARCHAR(200) NOT NULL DEFAULT '',
  logo_claro BYTEA,
  logo_claro_tipo VARCHAR(20),
  logo_escuro BYTEA,
  logo_escuro_tipo VARCHAR(20),
  favicon BYTEA,
  favicon_tipo VARCHAR(20),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by VARCHAR(50)
);

INSERT INTO configuracao_empresa (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
```

Domínio (`empresa.go`): `Empresa` (entidade completa, com os bytes de imagem omitidos
do JSON via `json:"-"`, expostos só como `TemLogoClaro bool`
`json:"tem_logo_claro"` etc.), `Dados` (campos de texto do PUT, todos `string` — não
existe "não informado" aqui, é sempre a empresa inteira sendo salva de novo, diferente
de um `PATCH` parcial de cadastro) e `DadosImagem` (`LogoClaro, LogoEscuro, Favicon
*string`, base64 cru).

CNPJ reaproveita `platform/documento.CNPJValido` — mas **opcional**: campo vazio passa
(nem toda empresa que usa o sistema em ambiente de teste/demo tem CNPJ definido ainda;
different de fornecedor, aqui não faz sentido travar a primeira configuração do sistema
por falta de CNPJ). Razão Social **obrigatória** (é o único campo sem sentido vazio — é
o nome que aparece em tudo).

`ValidarImagem(dados []byte, mimeDeclarado string, ehFavicon bool) (tipoNormalizado
string, err error)` no próprio pacote `empresa` (não em `platform/documento` — é regra
específica deste domínio, não reutilizável por outro cadastro).

- [ ] Teste: `Dados.Validar()` — razão social vazia falha; CNPJ vazio passa; CNPJ com
  dígito verificador errado falha; UF fora de 2 letras falha.
- [ ] Teste: `ValidarImagem` — PNG pequeno demais falha; SVG sem `<svg` falha; acima do
  limite de tamanho falha; PNG válido dentro do limite passa e devolve `"image/png"`.
- [ ] Commit: `feat(backend): migration e validacao de dados da empresa`

### Task B2: repositório

**Files:** `backend/internal/infra/repository/empresa_repo.go` (+ teste)

`Buscar(ctx) (empresa.Empresa, error)` (sempre `id = 1`, nunca vazio depois da
migration) e `Atualizar(ctx, empresa.Dados, atualizadoPor string) (empresa.Empresa,
error)` — um `UPDATE ... WHERE id = 1 RETURNING *`, nunca `INSERT`. Métodos separados
para imagem: `AtualizarImagem(ctx, campo string, bytes []byte, tipo string) error` com
`campo` restrito a uma constante do próprio pacote (`ColunaLogoClaro` etc.) para não
montar SQL dinâmico a partir de entrada externa.

- [ ] Teste: `Buscar` devolve a linha seedada pela migration; `Atualizar` grava e
  `updated_by`; `AtualizarImagem` grava bytes e tipo, e `nil`/vazio remove (volta a
  `NULL`).
- [ ] Commit: `feat(backend): repositorio de dados da empresa`

### Task B3: handler + rotas

**Files:** `backend/internal/api/handlers/empresa.go` (+ teste), `routes.go`

```
GET  /api/v1/configuracoes/empresa                  -- publico
GET  /api/v1/configuracoes/empresa/logotipo/claro   -- publico, serve bytes
GET  /api/v1/configuracoes/empresa/logotipo/escuro  -- publico, serve bytes
GET  /api/v1/configuracoes/empresa/favicon          -- publico, serve bytes
PUT  /api/v1/configuracoes/empresa                  -- ExigirPerfil(ADMIN)
```

Os handlers de imagem escrevem direto em `c.Response()` com
`c.Blob(http.StatusOK, tipo, bytes)`; 404 (`httpx` padrão) quando a coluna está `NULL` —
o frontend cai para o ícone/nome padrão nesse caso, não deve nem tentar carregar a URL
se `tem_logo_claro` já veio `false` no GET principal.

`updated_by` vem de `middleware.ClaimsDoContexto(c).Username` (mesmo padrão de
`created_by`/`updated_by` nos outros cadastros).

- [ ] Teste: GET sem token funciona (200); PUT sem token → 401; PUT com token
  OPERADOR/GESTOR → 403; PUT com ADMIN e razão social vazia → 400; PUT válido → 200 e
  reflete no GET seguinte; upload de imagem inválida → 400 com mensagem explicando o
  motivo (tamanho/dimensão/formato); endpoint de imagem sem logo cadastrado → 404.
- [ ] Commit: `feat(backend): endpoints de dados da empresa`

---

## Frontend

### Task F1: serviço e tipos

**Files:** `frontend/src/tipos/empresa.ts`, `frontend/src/servicos/empresa.ts` (+ teste)

`buscarDadosEmpresa()` (GET, sem depender de sessão — chamado tanto no login quanto
autenticado), `atualizarDadosEmpresa(dados)` (PUT), mais os três helpers de URL
(`urlLogoClaro()`, `urlLogoEscuro()`, `urlFavicon()`) que montam a partir de
`api.defaults.baseURL` — não fazem requisição, só compõem a string usada em `<img src>`
e `<link>`.

### Task F2: branding aplicado no cabeçalho, login e favicon

**Files:** `frontend/src/hooks/useDadosEmpresa.ts` (+ teste),
`frontend/src/componentes/layout/AplicarBrandingEmpresa.tsx` (+ teste),
`frontend/src/componentes/layout/Cabecalho.tsx`, `frontend/src/paginas/Login.tsx`,
`frontend/src/App.tsx`

`useDadosEmpresa()`: `useQuery` com `staleTime: Infinity` (muda raramente, e a própria
tela de edição invalida a query ao salvar) — evitar refetch a cada navegação.

`useTemaResolvido()` (novo, em `store/preferencias.ts`): `useSyncExternalStore` sobre o
mesmo par store+`matchMedia` que já resolve "automático" hoje, para o cabeçalho e o
login escolherem logo claro vs. escuro sem duplicar a lógica de `resolverTema`.

`AplicarBrandingEmpresa`: componente sem UI própria, montado uma vez em `App.tsx` (fora
das rotas, sempre ativo — vale tanto logado quanto no login), que só faz
`document.title` e o `<link rel="icon">` acompanharem `tem_favicon`/`nome_fantasia` via
`useEffect`.

`Cabecalho.tsx` e `Login.tsx`: se `tem_logo_claro`/`tem_logo_escuro` (conforme o tema
resolvido) vier `true`, trocam o ícone de fábrica + "Sistema PCP" por `<img>` com o
`nome_fantasia` como `alt`; senão, mantém o fallback atual (não muda o visual de quem
não configurou nada ainda).

- [ ] Teste: `useTemaResolvido` reflete o tema salvo e a mudança de
  `prefers-color-scheme` quando "automático"; `AplicarBrandingEmpresa` seta o `<link
  rel="icon">` quando `tem_favicon` é `true` e não mexe nele quando é `false`; Cabecalho
  mostra o nome padrão sem dado de empresa e o `nome_fantasia` quando presente.
- [ ] Commit: `feat(frontend): aplica logo e nome da empresa no cabecalho e no login`

### Task F3: tela de Dados da Empresa

**Files:** `frontend/src/paginas/configuracoes/DadosEmpresa.tsx` (+ teste)

Só acessível a `perfil === 'ADMIN'` — sem rota genérica de guarda por perfil ainda (isso
é o retrofit inteiro da Fase 2.2); a própria página checa e mostra "Acesso restrito a
administradores" para quem chegar nela sem ser Admin (a mesma mensagem, em espírito, do
403 que o backend já devolve).

`react-hook-form` + `zod` (primeiro formulário desta fase grande o bastante para
justificar — diferente de Preferências, que tinha 4 controles independentes sem
validação cruzada; aqui há ~15 campos de texto). Seções: Identificação, Endereço
(com botão "Buscar CEP" chamando ViaCEP), Contato, Documentos (rodapé/condições/
responsável técnico), Logotipo (upload de claro/escuro/favicon com preview e botão
remover cada um).

Upload: `<input type="file">` lido com `FileReader.readAsDataURL`, removendo o prefixo
`data:...;base64,` antes de mandar no PUT.

- [ ] Teste: envia o corpo certo no PUT; erro de validação do backend marca o campo
  certo (`separarErro`, mesmo padrão dos outros formulários); "Buscar CEP" preenche
  logradouro/bairro/cidade/UF a partir de uma resposta simulada da ViaCEP; troca de
  perfil para não-ADMIN mostra a mensagem de acesso restrito em vez do formulário.
- [ ] Commit: `feat(frontend): tela de dados da empresa`

### Task F4: navegação e ajuda

**Files:** `App.tsx`, `NavegacaoLateral.tsx` (+ teste), `Ajuda.tsx` (+ teste)

Rota `/configuracoes/empresa`. Nova seção "Configurações" na navegação lateral, com o
link visível só para Admin (mesmo padrão de `FUTUROS`/`ESTRUTURA`, mas condicionado ao
perfil em vez de sempre visível) — evita levar quem não pode editar a uma tela que só
vai mostrar "acesso restrito".

- [ ] Commit: `feat(frontend): navegacao e ajuda para dados da empresa`

### Task F5: verificação final

- [ ] `npm test`/`eslint`/`tsc`/`build` limpos (via Docker); suíte de backend completa
  (via Docker).
- [ ] `code-reviewer` (background) sobre o diff completo do branch.
- [ ] Roteiro Playwright real: login sem empresa configurada mostra o fallback padrão →
  Admin preenche razão social/CNPJ/endereço (com "Buscar CEP") → upload de logo claro e
  escuro → salvar → cabeçalho já mostra o novo nome/logo sem F5 → F5 na tela de login
  (deslogado) mostra o mesmo logo, confirmando que o endpoint público funciona sem
  sessão → trocar para OPERADOR e confirmar que a tela de configuração fica inacessível
  (mensagem de acesso restrito) e o link some da navegação.
- [ ] Screenshots novos em `docs/screenshots/`.
- [ ] Atualizar `docs/8_MANUAL_OPERACAO.md` (nova seção) e o ledger.
- [ ] Commit final, push, link de PR.
