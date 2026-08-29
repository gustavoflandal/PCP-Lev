# Telas de cadastro e painel — desenho

**Data**: 2026-08-29
**Sprint**: 2 (Semanas 3 e 4) — fecha o frontend da Fase 1
**Depende de**: backend de Produtos Acabados (RF1.1), Partes/Peças (RF1.2) e
Fornecedores (RF1.4), já concluído e no ar.

---

## 1. Problema

O backend dos três cadastros base está pronto e testado, mas o frontend tem
apenas Login e Início. Não existe navegação: a única rota autenticada é `/`.
Ninguém consegue cadastrar um produto, uma peça ou um fornecedor pela
interface — só por `curl`.

Esta entrega fecha essa lacuna e acrescenta o painel inicial do RF6.1 com
dados simulados, para que a tela de abertura mostre a forma final antes de
existirem OPs e pedidos reais.

## 2. Escopo

**Entra:**

- Navegação lateral e as rotas dos cadastros.
- Tela de Fornecedores, Partes/Peças e Produtos Acabados — listar, buscar,
  ordenar, paginar, criar, editar e inativar.
- Painel com os widgets do RF6.1 alimentados por dados simulados.
- Os componentes de UI que faltam para isso: tabela, modal, badge de estado,
  paginação, seleção, confirmação e toast.

**Fica de fora:**

- BOM (RF1.3) — é a próxima entrega, com desenho próprio.
- Qualquer widget do painel ligado a dado real. O painel desta entrega é
  explicitamente simulado e será refeito quando houver OPs e PCs.
- Tela de usuários e preferências.

## 3. Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Organização das três telas | Primitivos compartilhados, telas explícitas | Um motor genérico de CRUD ficaria imediatamente errado no BOM, que é mestre-detalhe. Cada tela declara suas colunas e seu schema à vista. |
| Onde vive o formulário | Modal sobre a lista | O uso real é cadastrar em sequência; o gestor não pode perder busca e rolagem a cada registro. Os formulários têm de 5 a 9 campos. |
| Biblioteca do modal | `@radix-ui/react-dialog` | O design system exige Radix como base. Radix já é dependência (`react-label`, `react-slot`). |
| Estratégia de teste | Troca do adapter do axios | Padrão já estabelecido em `Login.test.tsx`: só o transporte é falso, serviço, store e formulário são reais. |

## 4. Arquitetura

```
src/
  tipos/
    cadastros.ts            ProdutoAcabado, PartePeca, Fornecedor, Pagina<T>
  servicos/
    cadastros.ts            listar/obter/criar/atualizar/excluir tipados
  hooks/
    useListagem.ts          busca, página, ordenação, situação + useQuery
    useMutacoesCadastro.ts  criar/atualizar/excluir + invalidação + toast
    useDebounce.ts
  componentes/
    layout/
      NavegacaoLateral.tsx
      Shell.tsx             (alterado: passa a abrigar a navegação)
    ui/
      Tabela.tsx            cabeçalho fixo, aria-sort, skeleton/vazio/erro
      Modal.tsx             Radix Dialog
      Badge.tsx             ícone + texto, nunca só cor
      Paginacao.tsx
      Selecao.tsx           select rotulado, mesma anatomia do Campo
      Confirmacao.tsx       modal de confirmação de ação destrutiva
      Toast.tsx             + useToast
      BarraDeFiltros.tsx    busca + filtro de situação
  paginas/
    Painel.tsx              (novo — substitui Inicio como rota "/")
    cadastros/
      Fornecedores.tsx      + FormularioFornecedor.tsx
      PartesPecas.tsx       + FormularioPeca.tsx
      ProdutosAcabados.tsx  + FormularioProduto.tsx
```

### 4.1 Camada de dados

`servicos/cadastros.ts` desembrulha o envelope do doc 3 e devolve dados
tipados. Assinaturas:

```ts
listar<T>(recurso: Recurso, params: ParametrosListagem): Promise<Pagina<T>>
obter<T>(recurso: Recurso, id: number): Promise<T>
criar<T>(recurso: Recurso, corpo: unknown): Promise<T>
atualizar<T>(recurso: Recurso, id: number, corpo: unknown): Promise<T>
excluir(recurso: Recurso, id: number): Promise<void>
```

`Recurso` é a união `'produtos-acabados' | 'partes-pecas' | 'fornecedores'`,
usada também como chave de cache do TanStack Query.

`ParametrosListagem` espelha exatamente o que `consulta.Analisar` aceita no
backend: `pagina`, `limite`, `ordenar_por`, `ordem` (`asc`/`desc`), `busca` e
`filtro_ativo`. Nenhum outro parâmetro é enviado — o backend rejeita
`ordenar_por` fora da lista permitida com 400.

`Pagina<T>` é `{ itens: T[]; paginacao: { pagina, limite, total, total_paginas } }`.

### 4.2 Hooks

`useListagem(recurso, colunaPadrao)` é o estado da tela de lista. Guarda
busca, página, coluna de ordenação, ordem e filtro de situação; aplica
debounce de 300 ms sobre a busca; volta para a página 1 quando a busca ou o
filtro mudam; e devolve o resultado do `useQuery` com a chave
`[recurso, params]`.

`useMutacoesCadastro(recurso)` devolve `criar`, `atualizar` e `excluir`. Cada
uma invalida a chave `[recurso]` no sucesso e dispara o toast com o verbo no
passado ("Fornecedor cadastrado", "Fornecedor atualizado", "Fornecedor
inativado").

### 4.3 Componentes de UI

Todos seguem os padrões do §6 do design system. Os pontos que a implementação
não pode negociar:

- **Tabela** — cabeçalho em `surface-sunken`, sem zebra, divisórias em
  `borda-subtle`, colunas numéricas à direita com `tabular-nums`, coluna de
  código em fonte mono. Ordenação por clique no cabeçalho, com `aria-sort` no
  `<th>` e seta visível. Cinco estados: carregando (skeleton com a forma das
  linhas, não spinner), vazio, com dados, erro e sem permissão.
- **Badge** — situação Ativo/Inativo com ícone Lucide + rótulo textual. Nunca
  comunica só por cor. `check-circle-2` sobre `estado-done-bg` para ativo,
  `circle` sobre `estado-neutral-bg` para inativo.
- **Modal** — Radix Dialog: foco preso, Esc fecha, retorno de foco ao gatilho,
  `aria-labelledby` no título. Sombra apenas `elevado`.
- **Confirmacao** — usada antes de inativar. Diz o que vai acontecer e é
  reversível: "Inativar o fornecedor Componentes Eletrônicos LTDA? Ele deixa de
  aparecer nas listas de seleção. O histórico é preservado."
- **Toast** — canto inferior direito, 4 s, `role="status"`.

Nenhum componente novo além destes. Se uma tela precisar de algo, primeiro
tenta uma prop nos existentes.

### 4.4 Telas

Cada tela é a mesma composição: `BarraDeFiltros` + `Tabela` + `Paginacao`, com
um botão "Novo …" que abre o modal, e um `Formulario*` próprio com schema zod.

**Fornecedores** (`/fornecedores`)

| Coluna | Formato | Ordenável |
|---|---|---|
| Razão social | texto | sim (`razao_social`, padrão) |
| CNPJ | mono, formatado `00.000.000/0000-00` | sim (`cnpj`) |
| Contato | nome + e-mail em `label` abaixo | não |
| Lead time | número à direita, sufixo "d" | sim (`lead_time_medio`) |
| Situação | badge | não |

Formulário: razão social\*, CNPJ\*, lead time médio\*, nome do contato,
e-mail, telefone, endereço, condição de pagamento, situação. O CNPJ é digitado
com ou sem pontuação — o backend normaliza; a tela exibe formatado.

**Partes/Peças** (`/partes-pecas`)

| Coluna | Formato | Ordenável |
|---|---|---|
| Código | mono, caixa alta | sim (`codigo`, padrão) |
| Descrição | texto | sim (`descricao`) |
| Unidade | texto | não |
| Estoque mín./máx. | dois números à direita | sim (`estoque_minimo`) |
| Lead time | número à direita, sufixo "d" | sim (`lead_time_compra`) |
| Situação | badge | não |

Formulário: código\*, descrição\*, unidade\*, estoque mínimo\*, estoque
máximo\*, lead time de compra\*, fornecedor padrão (seleção carregada de
`/fornecedores?filtro_ativo=true`), situação.

**Produtos Acabados** (`/produtos-acabados`)

| Coluna | Formato | Ordenável |
|---|---|---|
| Código | mono, caixa alta | sim (`codigo`, padrão) |
| Descrição | texto | sim (`descricao`) |
| Unidade | texto | não |
| Preço de venda | à direita, `R$ 0.000,00` | sim (`preco_venda`) |
| Lead time | número à direita, sufixo "d" | sim (`lead_time_producao`) |
| Situação | badge | não |

Formulário: código\*, descrição\*, unidade\*, preço de venda\*, lead time de
produção\*, situação. O preço vai para a API como número decimal (o backend
aceita `5000.00`).

**Painel** (`/`)

Substitui a tela `Inicio`, que passa a ser removida. Quatro cartões com dados
simulados, cada um com o aviso "Dados simulados — os números reais entram com
o módulo de produção":

- OPs em atraso (contagem + lista curta)
- Pedidos de compra a receber nos próximos 7 dias
- Insumos em nível crítico
- Conexão com o servidor (o cartão real que já existe em `Inicio`, preservado)

### 4.5 Navegação

`NavegacaoLateral` fica dentro do `Shell`, à esquerda, 220 px, fixa. Itens:

- Painel (`layout-dashboard`) → `/`
- Cadastros (grupo): Produtos acabados (`package`), Partes e peças (`boxes`),
  Fornecedores (`users`)
- Compras (`shopping-cart`), Estoque (`clipboard-list`), Produção (`factory`) —
  desabilitados, com "Próxima sprint" em `label`. Ficam visíveis porque o
  operador precisa saber que o sistema terá esses módulos.

Item ativo marcado com `aria-current="page"` e fundo `brand-subtle`.

### 4.6 Permissões

Escrita é ADMIN/GESTOR (o backend responde 403 para OPERADOR). A interface não
oferece o que será negado: para OPERADOR, os botões "Novo …", "Editar" e
"Inativar" não são renderizados. A leitura é liberada a todos os perfis.

O perfil vem de `useAutenticacao`. Um helper `podeGerenciarCadastros(perfil)`
concentra a regra em um lugar só.

### 4.7 Erros

- **Validação (400 com `detalhes`)** — cada `{campo, mensagem}` marca o campo
  correspondente do formulário. O mapeamento usa o nome do campo da API, que é
  igual ao nome do campo do formulário.
- **Validação sem `detalhes`** (regra de domínio, ex.: CNPJ inválido) — alerta
  persistente no topo do modal com a mensagem da API.
- **Conflito (409)** — mesmo tratamento do alerta persistente. É o caso de CNPJ
  duplicado e de exclusão bloqueada por pedido pendente.
- **Falha de rede na listagem** — a `Tabela` mostra o estado de erro com a
  mensagem legível e um botão "Tentar de novo".
- **401** — já tratado pelo interceptor do `api.ts`, que derruba para o login.

## 5. Testes

Vitest + Testing Library, seguindo TDD: teste antes da implementação, sempre.

O helper `responderApi` de `Login.test.tsx` é promovido para
`testes/utilitarios.tsx` e ganha roteamento por URL e método, para que uma tela
possa responder à listagem e à mutação na mesma montagem.

Cobertura por tela de cadastro:

1. lista carregando mostra skeleton;
2. lista vazia mostra a frase-convite, não ilustração;
3. lista com dados mostra as colunas formatadas (CNPJ pontuado, preço em reais);
4. falha na listagem mostra o erro e o botão de nova tentativa;
5. OPERADOR não vê os botões de escrita;
6. criar pelo modal envia o corpo certo e fecha com toast;
7. erro 400 com `detalhes` marca o campo no formulário;
8. erro 409 mostra o alerta persistente e mantém o modal aberto;
9. inativar pede confirmação antes de chamar a API.

Componentes compartilhados têm teste próprio: `Tabela` (ordenação e
`aria-sort`), `Modal` (Esc fecha, foco preso), `Badge` (texto presente junto da
cor), `Paginacao` (limites), `Confirmacao` (cancela sem chamar a ação).

`NavegacaoLateral`: item ativo com `aria-current`, itens de sprint futura
inertes.

## 6. Verificação antes de entregar

- `npm test` verde;
- `npm run lint` sem avisos;
- `npm run build` (o `tsc -b` é parte do build) sem erros;
- as três telas exercitadas no navegador contra a API real, com o Postgres no
  ar, incluindo um erro de CNPJ duplicado e uma inativação;
- checagem do §8.4 do design system: leitura em escala de cinza, navegação só
  por teclado, janela em 1280 px.

## 7. Riscos

- **`@radix-ui/react-dialog` é dependência nova.** Baixo risco: mesma família
  já usada, sem peer dependency nova.
- **O painel simulado pode ser confundido com dado real.** Mitigado pelo aviso
  explícito em cada cartão. Se ainda parecer ambíguo na revisão visual, os
  números saem e ficam só os rótulos.
- **A tabela é o componente mais reusado do sistema** e nasce aqui. Se ficar
  errada, o custo se espalha. Por isso ela tem teste próprio e não só teste
  através das telas.
