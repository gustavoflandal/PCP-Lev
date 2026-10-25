# Telas de cadastro e painel — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as telas de Fornecedores, Partes/Peças e Produtos Acabados, a navegação lateral e o painel do RF6.1, fechando o frontend da Sprint 2.

**Architecture:** Primitivos compartilhados (`Tabela`, `Modal`, `Badge`, `Paginacao`, `Toast`) mais dois hooks (`useListagem`, `useMutacoesCadastro`); cada tela declara suas colunas e seu schema zod explicitamente. Sem motor genérico de CRUD.

**Tech Stack:** React 18, TypeScript strict, Vite, Tailwind, TanStack Query v5, react-hook-form + zod, zustand, Radix Dialog, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-29-telas-de-cadastro-design.md`

## Global Constraints

- **Idioma:** todo identificador, comentário e texto de tela em português do Brasil. Sentence case, nunca Title Case.
- **Design system:** `.claude/skills/pcp-design-system/SKILL.md` é obrigatório. Sem hex solto — sempre a classe do token. Ícones só do registro `componentes/ui/icones.ts`. Estado nunca comunicado só por cor: sempre cor + ícone + rótulo textual.
- **Espaçamento:** apenas a escala `4, 8, 12, 16, 24, 32, 48` (classes `1,2,3,4,6,8,12` do Tailwind). Nada fora disso.
- **Escrita:** verbo no infinitivo no botão, passado no resultado ("Salvar" → "Fornecedor cadastrado"). Erro diz o que fazer. Vazio é convite, nunca ilustração.
- **TDD sem exceção:** o teste vem primeiro, é executado e visto falhar, e só então vem a implementação mínima. Código de produção escrito antes do teste é apagado e refeito.
- **Comandos:** todos rodam de `frontend/`. `npm test` (suíte inteira), `npm test -- <arquivo>` (um arquivo), `npm run lint`, `npm run build`.
- **Commit:** ao fim de cada tarefa, em português, no padrão dos commits existentes. Rodapé `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Sem `localStorage`/`sessionStorage` para dado de negócio.** A sessão já usa `sessionStorage` e isso não muda; nada novo entra lá.
- **TypeScript strict com `noUnusedLocals` e `noUnusedParameters`.** Import não usado quebra o build.
- **Atenção ao `rtk`:** o shell reescreve comandos e filtra a saída. Nunca redirecione a saída de `head`, `cat`, `grep` ou `find` para dentro de um arquivo — o que é gravado é o texto já filtrado, não o conteúdo real. Para editar arquivo por script, use Python.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/tipos/cadastros.ts` | Tipos dos três cadastros, `Pagina<T>`, `ParametrosListagem`, `Recurso` |
| `src/servicos/cadastros.ts` | CRUD tipado que desembrulha o envelope do doc 3 |
| `src/testes/utilitarios.tsx` | `renderizarComProvedores` (existe) + servidor falso roteado (novo) |
| `src/lib/formato.ts` | `formatarCNPJ`, `formatarMoeda` |
| `src/lib/permissoes.ts` | `podeGerenciarCadastros` |
| `src/hooks/useDebounce.ts` | Adia um valor |
| `src/hooks/useListagem.ts` | Estado da lista + `useQuery` |
| `src/hooks/useMutacoesCadastro.ts` | Criar/atualizar/inativar + invalidação + toast |
| `src/componentes/ui/Badge.tsx` | `Badge` genérico + `BadgeSituacao` |
| `src/componentes/ui/Paginacao.tsx` | Navegação entre páginas |
| `src/componentes/ui/Tabela.tsx` | Tabela operacional com 5 estados |
| `src/componentes/ui/Modal.tsx` | Radix Dialog |
| `src/componentes/ui/Confirmacao.tsx` | Confirmação de ação destrutiva |
| `src/componentes/ui/Toast.tsx` | Store de toasts + região de exibição |
| `src/componentes/ui/Selecao.tsx` | `<select>` com a anatomia do `Campo` |
| `src/componentes/ui/BarraDeFiltros.tsx` | Busca + situação + ação |
| `src/componentes/layout/NavegacaoLateral.tsx` | Menu lateral |
| `src/paginas/Painel.tsx` | Painel do RF6.1 (substitui `Inicio`) |
| `src/paginas/cadastros/Fornecedores.tsx` | Lista de fornecedores |
| `src/paginas/cadastros/FormularioFornecedor.tsx` | Formulário no modal |
| `src/paginas/cadastros/PartesPecas.tsx` | Lista de partes/peças |
| `src/paginas/cadastros/FormularioPeca.tsx` | Formulário no modal |
| `src/paginas/cadastros/ProdutosAcabados.tsx` | Lista de produtos acabados |
| `src/paginas/cadastros/FormularioProduto.tsx` | Formulário no modal |

## Ordem das tarefas

1. Tipos, serviço de cadastros e servidor falso de teste
2. Badge de situação
3. Paginação
4. Tabela
5. Modal (instala `@radix-ui/react-dialog`)
6. Confirmação
7. Toast
8. Seleção
9. Barra de filtros
10. `useDebounce` e `useListagem`
11. `useMutacoesCadastro`
12. Helpers de formato e permissão
13. Navegação lateral, Shell e rotas
14. Painel (substitui `Inicio`)
15. Tela de Fornecedores
15b. Extrair `useCadastroCrud`
16. Tela de Partes/Peças
17. Tela de Produtos Acabados
18. Verificação final

As tarefas 2 a 12 são independentes entre si e podem ser feitas em qualquer ordem depois da 1. As telas (15 a 17) dependem de todas as anteriores.

---

## Task 1: Tipos, serviço de cadastros e servidor falso de teste

**Files:**
- Create: `frontend/src/tipos/cadastros.ts`
- Create: `frontend/src/servicos/cadastros.ts`
- Create: `frontend/src/servicos/cadastros.test.ts`
- Modify: `frontend/src/testes/utilitarios.tsx`
- Modify: `frontend/src/paginas/Login.test.tsx`

**Interfaces:**
- Consumes: `api` de `@/servicos/api` (já existe).
- Produces: `Recurso`, `Ordem`, `ParametrosListagem`, `DadosPaginacao`, `Pagina<T>`, `RegistroCadastro`, `ProdutoAcabado`, `PartePeca`, `Fornecedor` de `@/tipos/cadastros`; `listar`, `obter`, `criar`, `atualizar`, `excluir`, `paramsDeConsulta` de `@/servicos/cadastros`; `instalarServidorFalso`, `type ServidorFalso`, `type RotaFalsa` de `@/testes/utilitarios`.

- [ ] **Step 1: Criar os tipos**

`frontend/src/tipos/cadastros.ts`:

```ts
/** Recursos de cadastro da API. Tambem serve de chave de cache no TanStack Query. */
export type Recurso = 'produtos-acabados' | 'partes-pecas' | 'fornecedores';

export type Ordem = 'asc' | 'desc';

/**
 * Espelha exatamente o que `consulta.Analisar` aceita no backend. Nenhum outro
 * parametro deve ser enviado: `ordenar_por` fora da lista permitida vira 400.
 */
export interface ParametrosListagem {
  pagina: number;
  limite: number;
  ordenar_por: string;
  ordem: Ordem;
  busca: string;
  /** null significa "sem filtro": traz ativos e inativos. */
  filtro_ativo: boolean | null;
}

export interface DadosPaginacao {
  pagina: number;
  limite: number;
  total: number;
  total_paginas: number;
}

export interface Pagina<T> {
  itens: T[];
  paginacao: DadosPaginacao;
}

/** Campos que todo cadastro base carrega. */
export interface RegistroCadastro {
  id: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProdutoAcabado extends RegistroCadastro {
  codigo: string;
  descricao: string;
  unidade_medida: string;
  preco_venda: number;
  lead_time_producao: number;
}

export interface PartePeca extends RegistroCadastro {
  codigo: string;
  descricao: string;
  unidade_medida: string;
  estoque_minimo: number;
  estoque_maximo: number;
  /** Ausente no JSON quando nao ha fornecedor padrao (omitempty no backend). */
  fornecedor_padrao_id?: number | null;
  lead_time_compra: number;
}

export interface Fornecedor extends RegistroCadastro {
  razao_social: string;
  /** Somente digitos, como o backend persiste. A tela formata para exibir. */
  cnpj: string;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string;
  endereco: string;
  lead_time_medio: number;
  condicao_pagamento: string;
}
```

- [ ] **Step 2: Escrever o teste do serviço (falhando)**

`frontend/src/servicos/cadastros.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { atualizar, criar, excluir, listar, obter } from './cadastros';
import type { Fornecedor } from '@/tipos/cadastros';

const parametros = {
  pagina: 1,
  limite: 20,
  ordenar_por: 'razao_social',
  ordem: 'asc' as const,
  busca: '',
  filtro_ativo: null,
};

const fornecedor = {
  id: 1,
  razao_social: 'Componentes Eletronicos LTDA',
  cnpj: '11222333000181',
  contato_nome: 'Joao Silva',
  contato_email: 'joao@componentes.com.br',
  contato_telefone: '11999999999',
  endereco: 'Rua das Pecas, 100',
  lead_time_medio: 7,
  condicao_pagamento: '30 dias',
  ativo: true,
  created_at: '2026-08-29T12:00:00Z',
  updated_at: '2026-08-29T12:00:00Z',
};

const paginaVazia = {
  sucesso: true,
  dados: [],
  paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 },
};

describe('servico de cadastros', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('listar desembrulha o envelope em itens e paginacao', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/fornecedores',
        status: 200,
        corpo: {
          sucesso: true,
          dados: [fornecedor],
          paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 },
        },
      },
    ]);

    const pagina = await listar<Fornecedor>('fornecedores', parametros);

    expect(pagina.itens).toHaveLength(1);
    expect(pagina.itens[0].razao_social).toBe('Componentes Eletronicos LTDA');
    expect(pagina.paginacao.total).toBe(1);
  });

  it('listar omite busca vazia e filtro nulo da query', async () => {
    servidor.responder([{ metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaVazia }]);

    await listar<Fornecedor>('fornecedores', parametros);

    const enviados = servidor.requisicoes[0].params;
    expect(enviados).not.toHaveProperty('busca');
    expect(enviados).not.toHaveProperty('filtro_ativo');
    expect(enviados).toMatchObject({
      pagina: 1,
      limite: 20,
      ordenar_por: 'razao_social',
      ordem: 'asc',
    });
  });

  it('listar envia busca e filtro quando informados', async () => {
    servidor.responder([{ metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaVazia }]);

    await listar<Fornecedor>('fornecedores', { ...parametros, busca: 'radares', filtro_ativo: true });

    expect(servidor.requisicoes[0].params).toMatchObject({ busca: 'radares', filtro_ativo: true });
  });

  it('obter devolve o registro de dentro do envelope', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores/1', status: 200, corpo: { sucesso: true, dados: fornecedor } },
    ]);

    const encontrado = await obter<Fornecedor>('fornecedores', 1);

    expect(encontrado.id).toBe(1);
  });

  it('criar envia o corpo e devolve o registro criado', async () => {
    servidor.responder([
      { metodo: 'post', url: '/fornecedores', status: 201, corpo: { sucesso: true, dados: fornecedor } },
    ]);

    const criado = await criar<Fornecedor>('fornecedores', { razao_social: 'Componentes Eletronicos LTDA' });

    expect(servidor.requisicoes[0].corpo).toEqual({ razao_social: 'Componentes Eletronicos LTDA' });
    expect(criado.cnpj).toBe('11222333000181');
  });

  it('atualizar usa PUT no id informado', async () => {
    servidor.responder([
      { metodo: 'put', url: '/fornecedores/1', status: 200, corpo: { sucesso: true, dados: fornecedor } },
    ]);

    await atualizar<Fornecedor>('fornecedores', 1, { razao_social: 'Outra Razao' });

    expect(servidor.requisicoes[0].url).toBe('/fornecedores/1');
  });

  it('excluir usa DELETE e nao espera corpo', async () => {
    servidor.responder([{ metodo: 'delete', url: '/fornecedores/1', status: 204 }]);

    await expect(excluir('fornecedores', 1)).resolves.toBeUndefined();
  });

  it('erro da API chega normalizado como ErroApi', async () => {
    servidor.responder([
      {
        metodo: 'post',
        url: '/fornecedores',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'ja existe um fornecedor com este CNPJ' },
        },
      },
    ]);

    await expect(criar<Fornecedor>('fornecedores', {})).rejects.toMatchObject({
      codigo: 'CONFLITO',
      message: 'ja existe um fornecedor com este CNPJ',
    });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/servicos/cadastros.test.ts`

Expected: FAIL — `Failed to resolve import "./cadastros"` e `instalarServidorFalso` não exportado por `@/testes/utilitarios`.

- [ ] **Step 4: Acrescentar o servidor falso ao helper de teste**

Acrescentar ao fim de `frontend/src/testes/utilitarios.tsx`, mantendo `renderizarComProvedores` como está:

```tsx
import { api } from '@/servicos/api';

export interface RotaFalsa {
  metodo: 'get' | 'post' | 'put' | 'delete';
  /** Trecho da URL (comparado com includes) ou expressao regular. */
  url: string | RegExp;
  status: number;
  corpo?: unknown;
}

export interface RequisicaoObservada {
  metodo: string;
  url: string;
  corpo: unknown;
  params: Record<string, unknown>;
}

export interface ServidorFalso {
  /** Requisicoes ja feitas, na ordem, para assercao no teste. */
  requisicoes: RequisicaoObservada[];
  /** Define (ou redefine) as rotas atendidas. */
  responder: (rotas: RotaFalsa[]) => void;
}

function combina(padrao: string | RegExp, url: string): boolean {
  return typeof padrao === 'string' ? url.includes(padrao) : padrao.test(url);
}

/**
 * Troca apenas o transporte do axios: servico, store, formulario e componentes
 * seguem reais. Uma rota nao declarada responde 404 com mensagem explicita,
 * para que o teste acuse a chamada esquecida em vez de travar em "carregando".
 */
export function instalarServidorFalso(): ServidorFalso {
  let rotas: RotaFalsa[] = [];
  const requisicoes: RequisicaoObservada[] = [];

  api.defaults.adapter = async (config) => {
    const metodo = (config.method ?? 'get').toLowerCase();
    const url = config.url ?? '';
    requisicoes.push({
      metodo,
      url,
      corpo: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
      params: (config.params ?? {}) as Record<string, unknown>,
    });

    // A rota mais especifica ganha: "/fornecedores/1" antes de "/fornecedores".
    const rota = rotas
      .filter((candidata) => candidata.metodo === metodo && combina(candidata.url, url))
      .sort((a, b) => String(b.url).length - String(a.url).length)[0];

    const resposta = rota ?? {
      status: 404,
      corpo: {
        sucesso: false,
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: `sem rota falsa para ${metodo} ${url}` },
      },
    };

    if (resposta.status >= 400) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const erro: any = new Error('erro http');
      erro.isAxiosError = true;
      erro.config = config;
      erro.response = { status: resposta.status, data: resposta.corpo, headers: {}, config };
      throw erro;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: resposta.status, data: resposta.corpo, headers: {}, config } as any;
  };

  return {
    requisicoes,
    responder: (novas) => {
      rotas = novas;
    },
  };
}
```

- [ ] **Step 5: Implementar o serviço**

`frontend/src/servicos/cadastros.ts`:

```ts
import { api } from './api';
import type { DadosPaginacao, Pagina, ParametrosListagem, Recurso } from '@/tipos/cadastros';

interface EnvelopeLista<T> {
  dados: T[];
  paginacao: DadosPaginacao;
}

interface EnvelopeItem<T> {
  dados: T;
}

/**
 * Monta a query string. Busca vazia e filtro nulo sao omitidos: enviar
 * `busca=` faria o backend filtrar por string vazia sem necessidade.
 */
export function paramsDeConsulta(
  params: ParametrosListagem,
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {
    pagina: params.pagina,
    limite: params.limite,
    ordenar_por: params.ordenar_por,
    ordem: params.ordem,
  };

  if (params.busca.trim() !== '') {
    query.busca = params.busca.trim();
  }
  if (params.filtro_ativo !== null) {
    query.filtro_ativo = params.filtro_ativo;
  }
  return query;
}

export async function listar<T>(recurso: Recurso, params: ParametrosListagem): Promise<Pagina<T>> {
  const { data } = await api.get<EnvelopeLista<T>>(`/${recurso}`, {
    params: paramsDeConsulta(params),
  });
  return { itens: data.dados, paginacao: data.paginacao };
}

export async function obter<T>(recurso: Recurso, id: number): Promise<T> {
  const { data } = await api.get<EnvelopeItem<T>>(`/${recurso}/${id}`);
  return data.dados;
}

export async function criar<T>(recurso: Recurso, corpo: unknown): Promise<T> {
  const { data } = await api.post<EnvelopeItem<T>>(`/${recurso}`, corpo);
  return data.dados;
}

export async function atualizar<T>(recurso: Recurso, id: number, corpo: unknown): Promise<T> {
  const { data } = await api.put<EnvelopeItem<T>>(`/${recurso}/${id}`, corpo);
  return data.dados;
}

export async function excluir(recurso: Recurso, id: number): Promise<void> {
  await api.delete(`/${recurso}/${id}`);
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd frontend && npm test -- src/servicos/cadastros.test.ts`

Expected: PASS — 8 testes.

- [ ] **Step 7: Migrar `Login.test.tsx` para o helper compartilhado**

Em `frontend/src/paginas/Login.test.tsx`: apagar a função local `responderApi` e o import de `@/servicos/api`; importar `instalarServidorFalso` e `type ServidorFalso` de `@/testes/utilitarios`; declarar `let servidor: ServidorFalso;` dentro do `describe` e `servidor = instalarServidorFalso();` no `beforeEach` existente; trocar cada `responderApi(status, corpo)` por:

```tsx
servidor.responder([{ metodo: 'post', url: '/auth/login', status, corpo }]);
```

- [ ] **Step 8: Rodar a suíte inteira**

Run: `cd frontend && npm test`

Expected: PASS — nenhum teste a menos que antes da tarefa.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/tipos frontend/src/servicos/cadastros.ts frontend/src/servicos/cadastros.test.ts frontend/src/testes/utilitarios.tsx frontend/src/paginas/Login.test.tsx
git commit -m "feat(frontend): tipos e servico dos cadastros base

Acrescenta o CRUD tipado que desembrulha o envelope do doc 3 e um servidor
falso roteado por metodo e URL, promovido do helper local do Login.test.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Badge de situação

**Files:**
- Create: `frontend/src/componentes/ui/Badge.tsx`
- Create: `frontend/src/componentes/ui/Badge.test.tsx`

**Interfaces:**
- Consumes: `cn` de `@/lib/cn`; `icones`, `type NomeIcone` de `./icones`.
- Produces: `Badge` (props `{ tom, icone, children, className? }`) e `BadgeSituacao` (props `{ ativo: boolean }`) de `@/componentes/ui/Badge`. `type TomBadge = 'done' | 'pending' | 'warning' | 'blocked' | 'neutral'`.

- [ ] **Step 1: Escrever o teste (falhando)**

`frontend/src/componentes/ui/Badge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, BadgeSituacao } from './Badge';

describe('Badge', () => {
  it('mostra o rotulo textual junto da cor', () => {
    render(<Badge tom="warning" icone="alert-triangle">Atrasado</Badge>);

    expect(screen.getByText('Atrasado')).toBeInTheDocument();
  });

  it('esconde o icone dos leitores de tela, porque o texto ja informa', () => {
    const { container } = render(<Badge tom="done" icone="check-circle-2">Concluido</Badge>);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('BadgeSituacao', () => {
  it('ativo aparece com rotulo Ativo', () => {
    render(<BadgeSituacao ativo />);

    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('inativo aparece com rotulo Inativo e tom neutro, nao de erro', () => {
    render(<BadgeSituacao ativo={false} />);

    const badge = screen.getByText('Inativo');
    expect(badge).toBeInTheDocument();
    // Inativo e um estado normal do cadastro, nao uma falha.
    expect(badge.className).toContain('estado-neutral');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/componentes/ui/Badge.test.tsx`

Expected: FAIL — `Failed to resolve import "./Badge"`.

- [ ] **Step 3: Implementar**

`frontend/src/componentes/ui/Badge.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { icones, type NomeIcone } from './icones';

/** Tons semanticos do §2 do design system. Cada um tem um significado unico. */
export type TomBadge = 'done' | 'pending' | 'warning' | 'blocked' | 'neutral';

const tons: Record<TomBadge, string> = {
  done: 'bg-estado-done-bg text-estado-done',
  pending: 'bg-estado-pending-bg text-estado-pending',
  warning: 'bg-estado-warning-bg text-estado-warning',
  blocked: 'bg-estado-blocked-bg text-estado-blocked',
  neutral: 'bg-estado-neutral-bg text-estado-neutral',
};

export interface BadgeProps {
  tom: TomBadge;
  icone: NomeIcone;
  children: ReactNode;
  className?: string;
}

/**
 * Selo de estado. O texto e sempre obrigatorio: o design system proibe
 * comunicar estado apenas por cor, e a tela precisa sobreviver em escala de
 * cinza e para quem nao distingue verde de vermelho.
 */
export function Badge({ tom, icone, children, className }: BadgeProps) {
  const Icone = icones[icone];

  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-label',
        tons[tom],
        className,
      )}
    >
      <Icone size={12} aria-hidden="true" className="shrink-0" />
      {children}
    </span>
  );
}

/** Situacao dos cadastros base. Inativo e neutro, nao vermelho: nao e falha. */
export function BadgeSituacao({ ativo }: { ativo: boolean }) {
  return ativo ? (
    <Badge tom="done" icone="check-circle-2">
      Ativo
    </Badge>
  ) : (
    <Badge tom="neutral" icone="circle">
      Inativo
    </Badge>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/componentes/ui/Badge.test.tsx`

Expected: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/componentes/ui/Badge.tsx frontend/src/componentes/ui/Badge.test.tsx
git commit -m "feat(frontend): badge de estado com icone e rotulo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Paginação

**Files:**
- Create: `frontend/src/componentes/ui/Paginacao.tsx`
- Create: `frontend/src/componentes/ui/Paginacao.test.tsx`
- Modify: `frontend/src/componentes/ui/icones.ts` (acrescenta `chevron-left`)

**Interfaces:**
- Consumes: `Botao` de `./Botao`; `icones` de `./icones`.
- Produces: `Paginacao` com props `{ pagina: number; totalPaginas: number; total: number; aoMudar: (pagina: number) => void }`.

- [ ] **Step 1: Escrever o teste (falhando)**

`frontend/src/componentes/ui/Paginacao.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Paginacao } from './Paginacao';

describe('Paginacao', () => {
  it('informa a posicao e o total de registros', () => {
    render(<Paginacao pagina={2} totalPaginas={5} total={97} aoMudar={vi.fn()} />);

    expect(screen.getByText('Página 2 de 5 · 97 registros')).toBeInTheDocument();
  });

  it('usa o singular quando ha um unico registro', () => {
    render(<Paginacao pagina={1} totalPaginas={1} total={1} aoMudar={vi.fn()} />);

    expect(screen.getByText('Página 1 de 1 · 1 registro')).toBeInTheDocument();
  });

  it('na primeira pagina o botao anterior fica desabilitado', () => {
    render(<Paginacao pagina={1} totalPaginas={3} total={50} aoMudar={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeEnabled();
  });

  it('na ultima pagina o botao proxima fica desabilitado', () => {
    render(<Paginacao pagina={3} totalPaginas={3} total={50} aoMudar={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
  });

  it('avancar pede a pagina seguinte', async () => {
    const aoMudar = vi.fn();
    render(<Paginacao pagina={2} totalPaginas={5} total={97} aoMudar={aoMudar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));

    expect(aoMudar).toHaveBeenCalledWith(3);
  });

  it('voltar pede a pagina anterior', async () => {
    const aoMudar = vi.fn();
    render(<Paginacao pagina={2} totalPaginas={5} total={97} aoMudar={aoMudar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));

    expect(aoMudar).toHaveBeenCalledWith(1);
  });

  it('some da tela quando nao ha registro nenhum', () => {
    const { container } = render(<Paginacao pagina={1} totalPaginas={0} total={0} aoMudar={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/componentes/ui/Paginacao.test.tsx`

Expected: FAIL — `Failed to resolve import "./Paginacao"`.

- [ ] **Step 3: Acrescentar `chevron-left` ao registro de ícones**

Em `frontend/src/componentes/ui/icones.ts`, acrescentar `ChevronLeft` ao import de `lucide-react` (em ordem alfabética, antes de `ChevronRight`) e a entrada `'chevron-left': ChevronLeft,` ao objeto `icones` (antes de `'chevron-right'`).

- [ ] **Step 4: Implementar**

`frontend/src/componentes/ui/Paginacao.tsx`:

```tsx
import { Botao } from './Botao';

export interface PaginacaoProps {
  pagina: number;
  totalPaginas: number;
  total: number;
  aoMudar: (pagina: number) => void;
}

/**
 * Navegacao entre paginas da listagem. Sem numeros de pagina clicaveis: com
 * busca e filtro na tela, pular para a pagina 7 nao e um gesto real — o
 * gestor refina o filtro em vez de folhear.
 */
export function Paginacao({ pagina, totalPaginas, total, aoMudar }: PaginacaoProps) {
  // Lista vazia ja e explicada pelo estado vazio da tabela; repetir aqui polui.
  if (total === 0) {
    return null;
  }

  const registros = total === 1 ? '1 registro' : `${total} registros`;

  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-between gap-4 border-t border-borda-subtle px-3 py-2"
    >
      <p className="text-label text-texto-secondary">
        {`Página ${pagina} de ${totalPaginas} · ${registros}`}
      </p>

      <div className="flex items-center gap-2">
        <Botao
          variante="secundaria"
          icone="chevron-left"
          disabled={pagina <= 1}
          onClick={() => aoMudar(pagina - 1)}
          aria-label="Página anterior"
        >
          Anterior
        </Botao>
        <Botao
          variante="secundaria"
          icone="chevron-right"
          disabled={pagina >= totalPaginas}
          onClick={() => aoMudar(pagina + 1)}
          aria-label="Próxima página"
        >
          Próxima
        </Botao>
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npm test -- src/componentes/ui/Paginacao.test.tsx`

Expected: PASS — 7 testes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/componentes/ui/Paginacao.tsx frontend/src/componentes/ui/Paginacao.test.tsx frontend/src/componentes/ui/icones.ts
git commit -m "feat(frontend): paginacao da listagem

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Tabela

**Files:**
- Create: `frontend/src/componentes/ui/Tabela.tsx`
- Create: `frontend/src/componentes/ui/Tabela.test.tsx`

**Interfaces:**
- Consumes: `cn` de `@/lib/cn`; `Botao` de `./Botao`; `icones` de `./icones`; `type Ordem` de `@/tipos/cadastros`.
- Produces: `Tabela<T>` e `type Coluna<T>` de `@/componentes/ui/Tabela`.

```ts
export interface Coluna<T> {
  /** Nome da coluna no `ordenar_por` da API. So e usado quando ordenavel. */
  chave: string;
  rotulo: string;
  ordenavel?: boolean;
  alinhamento?: 'esquerda' | 'direita';
  renderizar: (item: T) => ReactNode;
}

export interface TabelaProps<T> {
  rotulo: string;
  colunas: Coluna<T>[];
  itens: T[];
  chaveDe: (item: T) => string | number;
  ordenarPor: string;
  ordem: Ordem;
  aoOrdenar: (chave: string) => void;
  vazio: string;
  carregando?: boolean;
  erro?: string | null;
  aoTentarDeNovo?: () => void;
  acoes?: (item: T) => ReactNode;
}
```

Este é o componente mais reusado do sistema. Ele nasce aqui e vai ser herdado por compras, estoque e produção — por isso tem teste próprio, e não só teste através das telas.

- [ ] **Step 1: Escrever o teste (falhando)**

`frontend/src/componentes/ui/Tabela.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tabela, type Coluna } from './Tabela';

interface Linha {
  id: number;
  codigo: string;
  quantidade: number;
}

const itens: Linha[] = [
  { id: 1, codigo: 'CON-001', quantidade: 50 },
  { id: 2, codigo: 'PLC-100', quantidade: 5 },
];

const colunas: Coluna<Linha>[] = [
  { chave: 'codigo', rotulo: 'Código', ordenavel: true, renderizar: (l) => l.codigo },
  {
    chave: 'quantidade',
    rotulo: 'Quantidade',
    ordenavel: true,
    alinhamento: 'direita',
    renderizar: (l) => l.quantidade,
  },
  { chave: 'observacao', rotulo: 'Observação', renderizar: () => '—' },
];

function renderizar(sobrescritas: Partial<Parameters<typeof Tabela<Linha>>[0]> = {}) {
  return render(
    <Tabela<Linha>
      rotulo="Partes e peças"
      colunas={colunas}
      itens={itens}
      chaveDe={(l) => l.id}
      ordenarPor="codigo"
      ordem="asc"
      aoOrdenar={vi.fn()}
      vazio="Nenhuma peça cadastrada. Cadastre a primeira para começar."
      {...sobrescritas}
    />,
  );
}

describe('Tabela', () => {
  it('mostra os cabecalhos e as linhas', () => {
    renderizar();

    expect(screen.getByRole('table', { name: 'Partes e peças' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Código/ })).toBeInTheDocument();
    expect(screen.getByText('CON-001')).toBeInTheDocument();
    expect(screen.getByText('PLC-100')).toBeInTheDocument();
  });

  it('marca aria-sort so na coluna ordenada', () => {
    renderizar();

    expect(screen.getByRole('columnheader', { name: /Código/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: /Quantidade/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('descendente aparece como descending', () => {
    renderizar({ ordem: 'desc' });

    expect(screen.getByRole('columnheader', { name: /Código/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('clicar no cabecalho ordenavel pede a ordenacao pela chave da API', async () => {
    const aoOrdenar = vi.fn();
    renderizar({ aoOrdenar });

    await userEvent.click(screen.getByRole('button', { name: /Quantidade/ }));

    expect(aoOrdenar).toHaveBeenCalledWith('quantidade');
  });

  it('coluna nao ordenavel nao vira botao', () => {
    renderizar();

    const cabecalho = screen.getByRole('columnheader', { name: 'Observação' });
    expect(within(cabecalho).queryByRole('button')).not.toBeInTheDocument();
  });

  it('coluna numerica alinha a direita com tabular-nums', () => {
    renderizar();

    expect(screen.getByText('50')).toHaveClass('text-right', 'tabular');
  });

  it('carregando mostra esqueleto, nao a mensagem de vazio', () => {
    renderizar({ carregando: true, itens: [] });

    expect(screen.getByTestId('esqueleto-tabela')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma peça cadastrada/)).not.toBeInTheDocument();
  });

  it('lista vazia convida a agir, sem ilustracao', () => {
    renderizar({ itens: [] });

    expect(
      screen.getByText('Nenhuma peça cadastrada. Cadastre a primeira para começar.'),
    ).toBeInTheDocument();
  });

  it('erro mostra a mensagem legivel e oferece nova tentativa', async () => {
    const aoTentarDeNovo = vi.fn();
    renderizar({
      itens: [],
      erro: 'Não foi possível conectar ao servidor. Verifique sua rede e tente novamente.',
      aoTentarDeNovo,
    });

    expect(screen.getByText(/Não foi possível conectar ao servidor/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(aoTentarDeNovo).toHaveBeenCalled();
  });

  it('erro tem precedencia sobre carregando', () => {
    renderizar({ itens: [], carregando: true, erro: 'Servidor indisponível.' });

    expect(screen.getByText('Servidor indisponível.')).toBeInTheDocument();
    expect(screen.queryByTestId('esqueleto-tabela')).not.toBeInTheDocument();
  });

  it('coluna de acoes aparece quando informada', () => {
    renderizar({ acoes: (l) => <button type="button">{`Editar ${l.codigo}`}</button> });

    expect(screen.getByRole('button', { name: 'Editar CON-001' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ações' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/componentes/ui/Tabela.test.tsx`

Expected: FAIL — `Failed to resolve import "./Tabela"`.

- [ ] **Step 3: Implementar**

`frontend/src/componentes/ui/Tabela.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Ordem } from '@/tipos/cadastros';
import { Botao } from './Botao';
import { icones } from './icones';

export interface Coluna<T> {
  /** Nome da coluna no `ordenar_por` da API. So e usado quando ordenavel. */
  chave: string;
  rotulo: string;
  ordenavel?: boolean;
  alinhamento?: 'esquerda' | 'direita';
  renderizar: (item: T) => ReactNode;
}

export interface TabelaProps<T> {
  /** Nome acessivel da tabela. */
  rotulo: string;
  colunas: Coluna<T>[];
  itens: T[];
  chaveDe: (item: T) => string | number;
  ordenarPor: string;
  ordem: Ordem;
  aoOrdenar: (chave: string) => void;
  /** Frase do estado vazio. Diz o que fazer, nao so que esta vazio. */
  vazio: string;
  carregando?: boolean;
  erro?: string | null;
  aoTentarDeNovo?: () => void;
  acoes?: (item: T) => ReactNode;
}

const LINHAS_DO_ESQUELETO = 5;

/**
 * Tabela operacional do sistema (§6 do design system): cabecalho fixo em
 * surface-sunken, sem zebra, divisoria entre linhas, numeros a direita com
 * tabular-nums.
 *
 * Cobre os cinco estados que toda tela precisa desenhar: carregando, vazio,
 * com dados, erro e — via `acoes` ausente — sem permissao de escrita.
 */
export function Tabela<T>({
  rotulo,
  colunas,
  itens,
  chaveDe,
  ordenarPor,
  ordem,
  aoOrdenar,
  vazio,
  carregando,
  erro,
  aoTentarDeNovo,
  acoes,
}: TabelaProps<T>) {
  const IconeOrdenacao = icones['arrow-up-down'];
  const IconeFalha = icones['alert-triangle'];
  const totalColunas = colunas.length + (acoes ? 1 : 0);

  // Erro vem antes de carregando: uma nova tentativa em andamento nao pode
  // esconder do operador o motivo pelo qual a tela esta sem dados.
  const estado = erro ? 'erro' : carregando ? 'carregando' : itens.length === 0 ? 'vazio' : 'dados';

  return (
    <div className="overflow-x-auto border border-borda-subtle bg-surface-raised">
      <table className="w-full border-collapse" aria-label={rotulo}>
        <thead>
          <tr className="bg-surface-sunken">
            {colunas.map((coluna) => {
              const ordenada = coluna.ordenavel && coluna.chave === ordenarPor;
              return (
                <th
                  key={coluna.chave}
                  scope="col"
                  aria-sort={
                    !coluna.ordenavel
                      ? undefined
                      : ordenada
                        ? ordem === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                  }
                  className={cn(
                    'border-b border-borda-subtle px-3 py-2 text-label text-texto-secondary',
                    coluna.alinhamento === 'direita' ? 'text-right' : 'text-left',
                  )}
                >
                  {coluna.ordenavel ? (
                    <button
                      type="button"
                      onClick={() => aoOrdenar(coluna.chave)}
                      className={cn(
                        'inline-flex items-center gap-1 text-label text-texto-secondary',
                        'hover:text-texto-primary',
                        coluna.alinhamento === 'direita' && 'flex-row-reverse',
                      )}
                    >
                      {coluna.rotulo}
                      <IconeOrdenacao
                        size={12}
                        aria-hidden="true"
                        className={cn('shrink-0', ordenada ? 'text-brand' : 'text-texto-disabled')}
                      />
                    </button>
                  ) : (
                    coluna.rotulo
                  )}
                </th>
              );
            })}
            {acoes && (
              <th
                scope="col"
                className="border-b border-borda-subtle px-3 py-2 text-right text-label text-texto-secondary"
              >
                Ações
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {estado === 'erro' && (
            <tr>
              <td colSpan={totalColunas} className="px-3 py-8">
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="flex items-center gap-2 text-body text-estado-pending">
                    <IconeFalha size={16} aria-hidden="true" />
                    {erro}
                  </p>
                  {aoTentarDeNovo && (
                    <Botao variante="secundaria" icone="refresh-cw" onClick={aoTentarDeNovo}>
                      Tentar de novo
                    </Botao>
                  )}
                </div>
              </td>
            </tr>
          )}

          {estado === 'carregando' &&
            Array.from({ length: LINHAS_DO_ESQUELETO }, (_, indice) => (
              <tr key={indice} data-testid="esqueleto-tabela">
                {Array.from({ length: totalColunas }, (_, celula) => (
                  <td key={celula} className="border-b border-borda-subtle px-3 py-2">
                    <span className="block h-3 w-full rounded-campo bg-surface-sunken" />
                  </td>
                ))}
              </tr>
            ))}

          {estado === 'vazio' && (
            <tr>
              <td colSpan={totalColunas} className="px-3 py-8 text-center text-body text-texto-secondary">
                {vazio}
              </td>
            </tr>
          )}

          {estado === 'dados' &&
            itens.map((item) => (
              <tr key={chaveDe(item)} className="min-h-linha">
                {colunas.map((coluna) => (
                  <td
                    key={coluna.chave}
                    className={cn(
                      'border-b border-borda-subtle px-3 py-2 text-body text-texto-primary',
                      coluna.alinhamento === 'direita' && 'text-right tabular',
                    )}
                  >
                    {coluna.renderizar(item)}
                  </td>
                ))}
                {acoes && (
                  <td className="border-b border-borda-subtle px-3 py-2 text-right">{acoes(item)}</td>
                )}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/componentes/ui/Tabela.test.tsx`

Expected: PASS — 11 testes.

`tabular` não é utilitário do Tailwind: é uma classe própria do projeto, declarada em `src/index.css` (`@layer base`), e o `Campo` já a usa para `tipoDado="quantidade"`. Use `tabular`, não `tabular-nums`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/componentes/ui/Tabela.tsx frontend/src/componentes/ui/Tabela.test.tsx
git commit -m "feat(frontend): tabela operacional com os cinco estados

Cabecalho fixo, ordenacao com aria-sort, numeros a direita com tabular-nums,
e os estados carregando, vazio, com dados e erro desenhados.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Modal

**Files:**
- Create: `frontend/src/componentes/ui/Modal.tsx`
- Create: `frontend/src/componentes/ui/Modal.test.tsx`
- Modify: `frontend/package.json` (nova dependência)

**Interfaces:**
- Consumes: `@radix-ui/react-dialog`; `cn` de `@/lib/cn`; `icones` de `./icones`.
- Produces: `Modal` com props `{ aberto: boolean; aoFechar: () => void; titulo: string; descricao?: string; children: ReactNode; rodape?: ReactNode }`.

- [ ] **Step 1: Instalar a dependência**

```bash
cd frontend && npm install @radix-ui/react-dialog@^1.1.4
```

- [ ] **Step 2: Escrever o teste (falhando)**

`frontend/src/componentes/ui/Modal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('fechado nao renderiza nada', () => {
    render(
      <Modal aberto={false} aoFechar={vi.fn()} titulo="Novo fornecedor">
        <p>conteudo</p>
      </Modal>,
    );

    expect(screen.queryByText('conteudo')).not.toBeInTheDocument();
  });

  it('aberto anuncia o titulo como nome do dialogo', () => {
    render(
      <Modal aberto aoFechar={vi.fn()} titulo="Novo fornecedor">
        <p>conteudo</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Novo fornecedor' })).toBeInTheDocument();
  });

  it('Esc fecha', async () => {
    const aoFechar = vi.fn();
    render(
      <Modal aberto aoFechar={aoFechar} titulo="Novo fornecedor">
        <p>conteudo</p>
      </Modal>,
    );

    await userEvent.keyboard('{Escape}');

    expect(aoFechar).toHaveBeenCalled();
  });

  it('o botao de fechar tem nome acessivel', async () => {
    const aoFechar = vi.fn();
    render(
      <Modal aberto aoFechar={aoFechar} titulo="Novo fornecedor">
        <p>conteudo</p>
      </Modal>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(aoFechar).toHaveBeenCalled();
  });

  it('mostra a descricao quando informada', () => {
    render(
      <Modal aberto aoFechar={vi.fn()} titulo="Novo fornecedor" descricao="Campos com * são obrigatórios.">
        <p>conteudo</p>
      </Modal>,
    );

    expect(screen.getByText('Campos com * são obrigatórios.')).toBeInTheDocument();
  });

  it('renderiza o rodape recebido', () => {
    render(
      <Modal
        aberto
        aoFechar={vi.fn()}
        titulo="Novo fornecedor"
        rodape={<button type="button">Salvar</button>}
      >
        <p>conteudo</p>
      </Modal>,
    );

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/componentes/ui/Modal.test.tsx`

Expected: FAIL — `Failed to resolve import "./Modal"`.

- [ ] **Step 4: Implementar**

`frontend/src/componentes/ui/Modal.tsx`:

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { icones } from './icones';

export interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  /** Texto de apoio abaixo do titulo. */
  descricao?: string;
  children: ReactNode;
  /** Acoes do rodape, alinhadas a direita. */
  rodape?: ReactNode;
}

/**
 * Dialogo modal sobre a tela. O Radix cuida de prender o foco, devolver o
 * foco ao gatilho e fechar no Esc — comportamentos que um modal caseiro
 * costuma errar.
 */
export function Modal({ aberto, aoFechar, titulo, descricao, children, rodape }: ModalProps) {
  const IconeFechar = icones.x;

  return (
    <Dialog.Root open={aberto} onOpenChange={(estaAberto) => !estaAberto && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-texto-primary/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 max-h-[90vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-cartao border border-borda-subtle bg-surface-raised shadow-elevado"
        >
          <div className="flex items-start justify-between gap-4 border-b border-borda-subtle p-4">
            <div>
              <Dialog.Title className="text-subtitle text-texto-primary">{titulo}</Dialog.Title>
              {descricao ? (
                <Dialog.Description className="mt-1 text-label text-texto-secondary">
                  {descricao}
                </Dialog.Description>
              ) : (
                // O Radix avisa no console quando falta descricao; o vazio
                // explicito silencia o aviso sem inventar texto na tela.
                <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
              )}
            </div>

            <Dialog.Close
              aria-label="Fechar"
              className="rounded-campo p-1 text-texto-secondary hover:bg-surface-sunken"
            >
              <IconeFechar size={16} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="p-4">{children}</div>

          {rodape && (
            <div className="flex items-center justify-end gap-2 border-t border-borda-subtle p-4">
              {rodape}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npm test -- src/componentes/ui/Modal.test.tsx`

Expected: PASS — 6 testes.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/componentes/ui/Modal.tsx frontend/src/componentes/ui/Modal.test.tsx
git commit -m "feat(frontend): modal sobre Radix Dialog

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Confirmação

**Files:**
- Create: `frontend/src/componentes/ui/Confirmacao.tsx`
- Create: `frontend/src/componentes/ui/Confirmacao.test.tsx`

**Interfaces:**
- Consumes: `Modal` de `./Modal`; `Botao` de `./Botao`.
- Produces: `Confirmacao` com props `{ aberto: boolean; titulo: string; mensagem: string; rotuloConfirmar: string; rotuloOcupado: string; ocupado?: boolean; aoConfirmar: () => void; aoCancelar: () => void }`.

- [ ] **Step 1: Escrever o teste (falhando)**

`frontend/src/componentes/ui/Confirmacao.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Confirmacao } from './Confirmacao';

function renderizar(sobrescritas: Partial<Parameters<typeof Confirmacao>[0]> = {}) {
  const props = {
    aberto: true,
    titulo: 'Inativar fornecedor',
    mensagem:
      'Inativar o fornecedor Componentes Eletrônicos LTDA? Ele deixa de aparecer nas listas de seleção. O histórico é preservado.',
    rotuloConfirmar: 'Inativar',
    rotuloOcupado: 'Inativando…',
    aoConfirmar: vi.fn(),
    aoCancelar: vi.fn(),
    ...sobrescritas,
  };
  render(<Confirmacao {...props} />);
  return props;
}

describe('Confirmacao', () => {
  it('explica a consequencia da acao', () => {
    renderizar();

    expect(screen.getByText(/deixa de aparecer nas listas de seleção/)).toBeInTheDocument();
  });

  it('confirmar dispara a acao', async () => {
    const { aoConfirmar } = renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Inativar' }));

    expect(aoConfirmar).toHaveBeenCalled();
  });

  it('cancelar nao dispara a acao', async () => {
    const { aoConfirmar, aoCancelar } = renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(aoCancelar).toHaveBeenCalled();
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it('ocupado bloqueia um segundo clique', () => {
    renderizar({ ocupado: true });

    expect(screen.getByRole('button', { name: 'Inativando…' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/componentes/ui/Confirmacao.test.tsx`

Expected: FAIL — `Failed to resolve import "./Confirmacao"`.

- [ ] **Step 3: Implementar**

`frontend/src/componentes/ui/Confirmacao.tsx`:

```tsx
import { Botao } from './Botao';
import { Modal } from './Modal';

export interface ConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  /** Diz o que vai acontecer e se e reversivel. */
  mensagem: string;
  /** Verbo no infinitivo, igual ao botao que abriu a confirmacao. */
  rotuloConfirmar: string;
  /** O mesmo verbo no gerundio ("Inativando…"). Explicito porque a
   *  conjugacao em portugues nao sai de uma regra generica confiavel. */
  rotuloOcupado: string;
  ocupado?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

/**
 * Confirmacao de acao destrutiva. O rotulo do botao repete o verbo da acao —
 * "Inativar", nao "OK" — para que a pessoa leia o que esta confirmando.
 */
export function Confirmacao({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar,
  rotuloOcupado,
  ocupado,
  aoConfirmar,
  aoCancelar,
}: ConfirmacaoProps) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoCancelar}
      titulo={titulo}
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoCancelar} disabled={ocupado}>
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            onClick={aoConfirmar}
            ocupado={ocupado}
            rotuloOcupado={rotuloOcupado}
          >
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      <p className="text-body text-texto-primary">{mensagem}</p>
    </Modal>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/componentes/ui/Confirmacao.test.tsx`

Expected: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/componentes/ui/Confirmacao.tsx frontend/src/componentes/ui/Confirmacao.test.tsx
git commit -m "feat(frontend): confirmacao de acao destrutiva

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Toast

**Files:**
- Create: `frontend/src/componentes/ui/Toast.tsx`
- Create: `frontend/src/componentes/ui/Toast.test.tsx`

**Interfaces:**
- Consumes: `create` de `zustand`; `icones` de `./icones`; `cn` de `@/lib/cn`.
- Produces: `useToasts` (store zustand com `{ itens, mostrar(mensagem, tom?), remover(id) }`, tom `'done' | 'pending'`, padrão `'done'`) e o componente `Toasts` de `@/componentes/ui/Toast`.

O toast é uma store zustand, não um contexto React: o `useMutacoesCadastro` precisa disparar toast de dentro de um callback do TanStack Query, onde não há árvore de componentes por perto. O projeto já usa zustand para a sessão.

- [ ] **Step 1: Escrever o teste (falhando)**

`frontend/src/componentes/ui/Toast.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toasts, useToasts } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToasts.setState({ itens: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sem toast, nada aparece', () => {
    render(<Toasts />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mostra a mensagem no verbo passado', () => {
    render(<Toasts />);

    act(() => {
      useToasts.getState().mostrar('Fornecedor cadastrado');
    });

    expect(screen.getByText('Fornecedor cadastrado')).toBeInTheDocument();
  });

  it('a regiao e anunciada como status, sem roubar o foco', () => {
    render(<Toasts />);

    act(() => {
      useToasts.getState().mostrar('Fornecedor cadastrado');
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('some sozinho depois de 4 segundos', () => {
    render(<Toasts />);

    act(() => {
      useToasts.getState().mostrar('Fornecedor cadastrado');
    });
    expect(screen.getByText('Fornecedor cadastrado')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Fornecedor cadastrado')).not.toBeInTheDocument();
  });

  it('empilha mais de um aviso', () => {
    render(<Toasts />);

    act(() => {
      useToasts.getState().mostrar('Fornecedor cadastrado');
      useToasts.getState().mostrar('Peça atualizada');
    });

    expect(screen.getByText('Fornecedor cadastrado')).toBeInTheDocument();
    expect(screen.getByText('Peça atualizada')).toBeInTheDocument();
  });

  it('tom de falha usa o estado pendente', () => {
    render(<Toasts />);

    act(() => {
      useToasts.getState().mostrar('Não foi possível inativar', 'pending');
    });

    expect(screen.getByText('Não foi possível inativar').closest('li')?.className).toContain(
      'estado-pending',
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/componentes/ui/Toast.test.tsx`

Expected: FAIL — `Failed to resolve import "./Toast"`.

- [ ] **Step 3: Implementar**

`frontend/src/componentes/ui/Toast.tsx`:

```tsx
import { create } from 'zustand';
import { cn } from '@/lib/cn';
import { icones } from './icones';

export type TomToast = 'done' | 'pending';

interface ItemToast {
  id: number;
  mensagem: string;
  tom: TomToast;
}

interface EstadoToasts {
  itens: ItemToast[];
  /** Mensagem no verbo passado, espelhando o botao acionado. */
  mostrar: (mensagem: string, tom?: TomToast) => void;
  remover: (id: number) => void;
}

const DURACAO_MS = 4000;

let proximoId = 1;

export const useToasts = create<EstadoToasts>((set, get) => ({
  itens: [],

  mostrar: (mensagem, tom = 'done') => {
    const id = proximoId++;
    set((estado) => ({ itens: [...estado.itens, { id, mensagem, tom }] }));
    setTimeout(() => get().remover(id), DURACAO_MS);
  },

  remover: (id) => set((estado) => ({ itens: estado.itens.filter((item) => item.id !== id) })),
}));

const tons: Record<TomToast, string> = {
  done: 'border-estado-done bg-estado-done-bg text-estado-done',
  pending: 'border-estado-pending bg-estado-pending-bg text-estado-pending',
};

const iconesPorTom: Record<TomToast, 'check-circle-2' | 'alert-triangle'> = {
  done: 'check-circle-2',
  pending: 'alert-triangle',
};

/**
 * Regiao de avisos, no canto inferior direito. Usa `role="status"`, que anuncia
 * sem interromper: o operador nao pode perder o foco do campo por causa de uma
 * confirmacao.
 */
export function Toasts() {
  const itens = useToasts((estado) => estado.itens);

  if (itens.length === 0) {
    return null;
  }

  return (
    <ul
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[min(360px,92vw)] flex-col gap-2"
    >
      {itens.map((item) => {
        const Icone = icones[iconesPorTom[item.tom]];
        return (
          <li
            key={item.id}
            className={cn(
              'flex items-center gap-2 rounded-cartao border px-3 py-2 text-body shadow-elevado',
              tons[item.tom],
            )}
          >
            <Icone size={16} aria-hidden="true" className="shrink-0" />
            {item.mensagem}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/componentes/ui/Toast.test.tsx`

Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/componentes/ui/Toast.tsx frontend/src/componentes/ui/Toast.test.tsx
git commit -m "feat(frontend): avisos de acao concluida

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Seleção

**Files:**
- Create: `frontend/src/componentes/ui/Selecao.tsx`
- Create: `frontend/src/componentes/ui/Selecao.test.tsx`

**Interfaces:**
- Consumes: `cn` de `@/lib/cn`.
- Produces: `Selecao` (encaminha `ref` para o `<select>`) com props `SelectHTMLAttributes<HTMLSelectElement>` menos `required`, mais `{ rotulo: string; erro?: string; ajuda?: string; obrigatorio?: boolean; opcoes: OpcaoSelecao[] }`, e `interface OpcaoSelecao { valor: string; rotulo: string }`.

Mesma anatomia do `Campo` já existente: rótulo acima, erro abaixo em `estado-pending`, `aria-invalid` e `aria-describedby`.

- [ ] **Step 1: Escrever o teste (falhando)**

`frontend/src/componentes/ui/Selecao.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Selecao } from './Selecao';

const opcoes = [
  { valor: 'und', rotulo: 'Unidade' },
  { valor: 'kg', rotulo: 'Quilograma' },
];

describe('Selecao', () => {
  it('associa o rotulo ao controle', () => {
    render(<Selecao rotulo="Unidade de medida" opcoes={opcoes} />);

    expect(screen.getByLabelText('Unidade de medida')).toBeInTheDocument();
  });

  it('lista as opcoes recebidas', () => {
    render(<Selecao rotulo="Unidade de medida" opcoes={opcoes} />);

    expect(screen.getByRole('option', { name: 'Unidade' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Quilograma' })).toBeInTheDocument();
  });

  it('seleciona o valor escolhido', async () => {
    const aoMudar = vi.fn();
    render(<Selecao rotulo="Unidade de medida" opcoes={opcoes} onChange={aoMudar} />);

    await userEvent.selectOptions(screen.getByLabelText('Unidade de medida'), 'kg');

    expect(aoMudar).toHaveBeenCalled();
  });

  it('erro marca o campo como invalido e diz o que fazer', () => {
    render(
      <Selecao rotulo="Unidade de medida" opcoes={opcoes} erro="Escolha a unidade de medida" />,
    );

    const controle = screen.getByLabelText('Unidade de medida');
    expect(controle).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha a unidade de medida');
  });

  it('obrigatorio marca o rotulo', () => {
    render(<Selecao rotulo="Unidade de medida" opcoes={opcoes} obrigatorio />);

    expect(screen.getByLabelText(/Unidade de medida/)).toBeRequired();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/componentes/ui/Selecao.test.tsx`

Expected: FAIL — `Failed to resolve import "./Selecao"`.

- [ ] **Step 3: Implementar**

`frontend/src/componentes/ui/Selecao.tsx`:

```tsx
import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface OpcaoSelecao {
  valor: string;
  rotulo: string;
}

export interface SelecaoProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'required'> {
  /** Rotulo exibido acima do controle. */
  rotulo: string;
  /** Mensagem de erro: diga o que fazer, nao o que aconteceu. */
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  opcoes: OpcaoSelecao[];
  /** Primeira opcao, vazia, para "nao informado". */
  placeholder?: string;
}

export const Selecao = forwardRef<HTMLSelectElement, SelecaoProps>(function Selecao(
  { rotulo, erro, ajuda, obrigatorio, opcoes, placeholder, className, id, ...resto },
  ref,
) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;
  const idDescricao = `${idCampo}-descricao`;
  const descricao = erro ?? ajuda;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idCampo} className="text-label text-texto-secondary">
        {rotulo}
        {obrigatorio && (
          <span aria-hidden="true" className="ml-1 text-estado-pending">
            *
          </span>
        )}
      </label>

      <select
        ref={ref}
        id={idCampo}
        required={obrigatorio}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao ? idDescricao : undefined}
        className={cn(
          'h-[40px] w-full rounded-campo border bg-surface-raised px-3 text-body',
          'text-texto-primary',
          erro ? 'border-estado-pending' : 'border-borda-strong',
          'disabled:bg-surface-sunken disabled:text-texto-disabled',
          className,
        )}
        {...resto}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>

      {descricao && (
        <p
          id={idDescricao}
          role={erro ? 'alert' : undefined}
          className={cn('text-label', erro ? 'text-estado-pending' : 'text-texto-secondary')}
        >
          {descricao}
        </p>
      )}
    </div>
  );
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/componentes/ui/Selecao.test.tsx`

Expected: PASS — 5 testes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/componentes/ui/Selecao.tsx frontend/src/componentes/ui/Selecao.test.tsx
git commit -m "feat(frontend): campo de selecao com a anatomia do Campo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Barra de filtros

**Files:**
- Create: `frontend/src/componentes/ui/BarraDeFiltros.tsx`
- Create: `frontend/src/componentes/ui/BarraDeFiltros.test.tsx`

**Interfaces:**
- Consumes: `Campo` de `./Campo`; `Selecao` de `./Selecao`.
- Produces: `BarraDeFiltros` com props `{ busca: string; aoBuscar: (texto: string) => void; rotuloBusca: string; filtroAtivo: boolean | null; aoFiltrarSituacao: (valor: boolean | null) => void; children?: ReactNode }`. O `children` é a área de ação à direita (o botão "Novo …").

- [ ] **Step 1: Escrever o teste (falhando)**

`frontend/src/componentes/ui/BarraDeFiltros.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BarraDeFiltros } from './BarraDeFiltros';

function renderizar(sobrescritas: Partial<Parameters<typeof BarraDeFiltros>[0]> = {}) {
  const props = {
    busca: '',
    aoBuscar: vi.fn(),
    rotuloBusca: 'Buscar por razão social ou CNPJ',
    filtroAtivo: true as boolean | null,
    aoFiltrarSituacao: vi.fn(),
    ...sobrescritas,
  };
  render(<BarraDeFiltros {...props} />);
  return props;
}

describe('BarraDeFiltros', () => {
  it('o campo de busca tem rotulo proprio da tela', () => {
    renderizar();

    expect(screen.getByLabelText('Buscar por razão social ou CNPJ')).toBeInTheDocument();
  });

  it('digitar avisa a tela a cada tecla', async () => {
    const { aoBuscar } = renderizar();

    await userEvent.type(screen.getByLabelText('Buscar por razão social ou CNPJ'), 'ra');

    expect(aoBuscar).toHaveBeenCalledTimes(2);
    expect(aoBuscar).toHaveBeenLastCalledWith('a');
  });

  it('a situacao comeca em ativos', () => {
    renderizar();

    expect(screen.getByLabelText('Situação')).toHaveValue('ativos');
  });

  it('escolher todos limpa o filtro', async () => {
    const { aoFiltrarSituacao } = renderizar();

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'todos');

    expect(aoFiltrarSituacao).toHaveBeenCalledWith(null);
  });

  it('escolher inativos filtra por falso', async () => {
    const { aoFiltrarSituacao } = renderizar();

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'inativos');

    expect(aoFiltrarSituacao).toHaveBeenCalledWith(false);
  });

  it('mostra a acao passada como filho', () => {
    renderizar({ children: <button type="button">Novo fornecedor</button> });

    expect(screen.getByRole('button', { name: 'Novo fornecedor' })).toBeInTheDocument();
  });
});
```

Nota sobre o segundo teste: o `aoBuscar` recebe o texto de cada tecla porque o campo é controlado pela tela; o `userEvent.type` com o valor fixo em `''` faz cada tecla chegar sozinha. O debounce não vive aqui — vive no `useListagem` (Task 10).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/componentes/ui/BarraDeFiltros.test.tsx`

Expected: FAIL — `Failed to resolve import "./BarraDeFiltros"`.

- [ ] **Step 3: Implementar**

`frontend/src/componentes/ui/BarraDeFiltros.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Campo } from './Campo';
import { Selecao } from './Selecao';

export interface BarraDeFiltrosProps {
  busca: string;
  aoBuscar: (texto: string) => void;
  /** Rotulo especifico da tela: diz por quais campos a busca procura. */
  rotuloBusca: string;
  filtroAtivo: boolean | null;
  aoFiltrarSituacao: (valor: boolean | null) => void;
  /** Acao principal da tela, alinhada a direita. */
  children?: ReactNode;
}

const OPCOES_SITUACAO = [
  { valor: 'ativos', rotulo: 'Ativos' },
  { valor: 'inativos', rotulo: 'Inativos' },
  { valor: 'todos', rotulo: 'Todos' },
];

function paraValor(filtroAtivo: boolean | null): string {
  if (filtroAtivo === null) return 'todos';
  return filtroAtivo ? 'ativos' : 'inativos';
}

function paraFiltro(valor: string): boolean | null {
  if (valor === 'todos') return null;
  return valor === 'ativos';
}

/**
 * Filtros da listagem. A situacao comeca em "Ativos" porque o cadastro
 * inativo e historico: quem abre a tela quer trabalhar com o que esta em uso.
 */
export function BarraDeFiltros({
  busca,
  aoBuscar,
  rotuloBusca,
  filtroAtivo,
  aoFiltrarSituacao,
  children,
}: BarraDeFiltrosProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-[320px] max-w-full">
          <Campo
            rotulo={rotuloBusca}
            value={busca}
            onChange={(evento) => aoBuscar(evento.target.value)}
            placeholder="Digite para filtrar"
          />
        </div>

        <div className="w-[160px]">
          <Selecao
            rotulo="Situação"
            opcoes={OPCOES_SITUACAO}
            value={paraValor(filtroAtivo)}
            onChange={(evento) => aoFiltrarSituacao(paraFiltro(evento.target.value))}
          />
        </div>
      </div>

      {children}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/componentes/ui/BarraDeFiltros.test.tsx`

Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/componentes/ui/BarraDeFiltros.tsx frontend/src/componentes/ui/BarraDeFiltros.test.tsx
git commit -m "feat(frontend): barra de busca e filtro de situacao

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: `useDebounce` e `useListagem`

**Files:**
- Create: `frontend/src/hooks/useDebounce.ts`
- Create: `frontend/src/hooks/useDebounce.test.ts`
- Create: `frontend/src/hooks/useListagem.ts`
- Create: `frontend/src/hooks/useListagem.test.tsx`

**Interfaces:**
- Consumes: `listar` de `@/servicos/cadastros`; tipos de `@/tipos/cadastros`; `useQuery`, `keepPreviousData` de `@tanstack/react-query`.
- Produces:

```ts
export function useDebounce<T>(valor: T, atraso?: number): T;

export interface Listagem<T> {
  busca: string;
  definirBusca: (texto: string) => void;
  pagina: number;
  definirPagina: (pagina: number) => void;
  ordenarPor: string;
  ordem: Ordem;
  alternarOrdenacao: (chave: string) => void;
  filtroAtivo: boolean | null;
  definirFiltroAtivo: (valor: boolean | null) => void;
  itens: T[];
  paginacao: DadosPaginacao;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

export function useListagem<T>(recurso: Recurso, colunaPadrao: string): Listagem<T>;
```

- [ ] **Step 1: Escrever o teste do `useDebounce` (falhando)**

`frontend/src/hooks/useDebounce.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('devolve o valor inicial de imediato', () => {
    const { result } = renderHook(() => useDebounce('inicial', 300));

    expect(result.current).toBe('inicial');
  });

  it('so entrega o novo valor depois do atraso', () => {
    const { result, rerender } = renderHook(({ valor }) => useDebounce(valor, 300), {
      initialProps: { valor: 'a' },
    });

    rerender({ valor: 'ab' });
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('ab');
  });

  it('digitacao continua reinicia a contagem', () => {
    const { result, rerender } = renderHook(({ valor }) => useDebounce(valor, 300), {
      initialProps: { valor: 'a' },
    });

    rerender({ valor: 'ab' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ valor: 'abc' });
    act(() => vi.advanceTimersByTime(200));

    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/hooks/useDebounce.test.ts`

Expected: FAIL — `Failed to resolve import "./useDebounce"`.

- [ ] **Step 3: Implementar o `useDebounce`**

`frontend/src/hooks/useDebounce.ts`:

```ts
import { useEffect, useState } from 'react';

/**
 * Adia um valor. Usado na busca das listagens: sem isso, cada tecla dispara
 * uma requisicao e a rede da fabrica nao aguenta o ritmo da digitacao.
 */
export function useDebounce<T>(valor: T, atraso = 300): T {
  const [adiado, setAdiado] = useState(valor);

  useEffect(() => {
    const temporizador = setTimeout(() => setAdiado(valor), atraso);
    return () => clearTimeout(temporizador);
  }, [valor, atraso]);

  return adiado;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/hooks/useDebounce.test.ts`

Expected: PASS — 3 testes.

- [ ] **Step 5: Escrever o teste do `useListagem` (falhando)**

`frontend/src/hooks/useListagem.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import type { Fornecedor } from '@/tipos/cadastros';
import { useListagem } from './useListagem';

function envolver({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

const paginaVazia = {
  sucesso: true,
  dados: [],
  paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 },
};

describe('useListagem', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    servidor.responder([{ metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaVazia }]);
  });

  it('comeca na pagina 1, ordenado pela coluna padrao e so com ativos', async () => {
    const { result } = renderHook(() => useListagem<Fornecedor>('fornecedores', 'razao_social'), {
      wrapper: envolver,
    });

    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.pagina).toBe(1);
    expect(result.current.ordenarPor).toBe('razao_social');
    expect(result.current.ordem).toBe('asc');
    expect(result.current.filtroAtivo).toBe(true);
    expect(servidor.requisicoes[0].params).toMatchObject({ filtro_ativo: true });
  });

  it('clicar na mesma coluna inverte a ordem', async () => {
    const { result } = renderHook(() => useListagem<Fornecedor>('fornecedores', 'razao_social'), {
      wrapper: envolver,
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    act(() => result.current.alternarOrdenacao('razao_social'));

    expect(result.current.ordem).toBe('desc');
  });

  it('clicar em outra coluna ordena por ela em ordem crescente', async () => {
    const { result } = renderHook(() => useListagem<Fornecedor>('fornecedores', 'razao_social'), {
      wrapper: envolver,
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    act(() => result.current.alternarOrdenacao('razao_social'));
    act(() => result.current.alternarOrdenacao('cnpj'));

    expect(result.current.ordenarPor).toBe('cnpj');
    expect(result.current.ordem).toBe('asc');
  });

  it('mudar o filtro de situacao volta para a primeira pagina', async () => {
    const { result } = renderHook(() => useListagem<Fornecedor>('fornecedores', 'razao_social'), {
      wrapper: envolver,
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    act(() => result.current.definirPagina(3));
    expect(result.current.pagina).toBe(3);

    act(() => result.current.definirFiltroAtivo(null));

    await waitFor(() => expect(result.current.pagina).toBe(1));
  });

  it('falha na listagem vira mensagem legivel, nao stack trace', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/fornecedores',
        status: 500,
        corpo: {
          sucesso: false,
          erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' },
        },
      },
    ]);

    const { result } = renderHook(() => useListagem<Fornecedor>('fornecedores', 'razao_social'), {
      wrapper: envolver,
    });

    await waitFor(() => expect(result.current.erro).toBe('Erro interno do servidor'));
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/hooks/useListagem.test.tsx`

Expected: FAIL — `Failed to resolve import "./useListagem"`.

- [ ] **Step 7: Implementar o `useListagem`**

`frontend/src/hooks/useListagem.ts`:

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ErroApi } from '@/servicos/api';
import { listar } from '@/servicos/cadastros';
import type { DadosPaginacao, Ordem, ParametrosListagem, Recurso } from '@/tipos/cadastros';
import { useDebounce } from './useDebounce';

const LIMITE_PADRAO = 20;

const PAGINACAO_VAZIA: DadosPaginacao = {
  pagina: 1,
  limite: LIMITE_PADRAO,
  total: 0,
  total_paginas: 0,
};

export interface Listagem<T> {
  busca: string;
  definirBusca: (texto: string) => void;
  pagina: number;
  definirPagina: (pagina: number) => void;
  ordenarPor: string;
  ordem: Ordem;
  alternarOrdenacao: (chave: string) => void;
  filtroAtivo: boolean | null;
  definirFiltroAtivo: (valor: boolean | null) => void;
  itens: T[];
  paginacao: DadosPaginacao;
  carregando: boolean;
  /** Mensagem legivel da API, pronta para a tela. */
  erro: string | null;
  recarregar: () => void;
}

/**
 * Estado da tela de lista: busca, pagina, ordenacao e situacao, mais a
 * consulta ao servidor. A busca e adiada para nao disparar uma requisicao por
 * tecla, e o resultado anterior fica na tela enquanto o proximo carrega —
 * uma tabela que pisca em branco a cada pagina cansa quem trabalha nela o dia
 * inteiro.
 */
export function useListagem<T>(recurso: Recurso, colunaPadrao: string): Listagem<T> {
  const [busca, definirBusca] = useState('');
  const [pagina, definirPagina] = useState(1);
  const [ordenarPor, definirOrdenarPor] = useState(colunaPadrao);
  const [ordem, definirOrdem] = useState<Ordem>('asc');
  // Cadastro inativo e historico: quem abre a tela quer o que esta em uso.
  const [filtroAtivo, definirFiltroAtivo] = useState<boolean | null>(true);

  const buscaAdiada = useDebounce(busca);

  // Filtrar de dentro da pagina 5 e cair num resultado de 2 paginas deixaria
  // a tela vazia sem motivo aparente.
  useEffect(() => {
    definirPagina(1);
  }, [buscaAdiada, filtroAtivo]);

  const params: ParametrosListagem = {
    pagina,
    limite: LIMITE_PADRAO,
    ordenar_por: ordenarPor,
    ordem,
    busca: buscaAdiada,
    filtro_ativo: filtroAtivo,
  };

  const consulta = useQuery({
    queryKey: [recurso, params],
    queryFn: () => listar<T>(recurso, params),
    placeholderData: keepPreviousData,
  });

  function alternarOrdenacao(chave: string) {
    if (chave === ordenarPor) {
      definirOrdem(ordem === 'asc' ? 'desc' : 'asc');
    } else {
      definirOrdenarPor(chave);
      definirOrdem('asc');
    }
    definirPagina(1);
  }

  const erro = consulta.error
    ? consulta.error instanceof ErroApi
      ? consulta.error.message
      : 'Não foi possível carregar a lista. Tente de novo.'
    : null;

  return {
    busca,
    definirBusca,
    pagina,
    definirPagina,
    ordenarPor,
    ordem,
    alternarOrdenacao,
    filtroAtivo,
    definirFiltroAtivo,
    itens: consulta.data?.itens ?? [],
    paginacao: consulta.data?.paginacao ?? PAGINACAO_VAZIA,
    carregando: consulta.isPending,
    erro,
    recarregar: () => void consulta.refetch(),
  };
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `cd frontend && npm test -- src/hooks/useListagem.test.tsx`

Expected: PASS — 5 testes.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/hooks/useDebounce.ts frontend/src/hooks/useDebounce.test.ts frontend/src/hooks/useListagem.ts frontend/src/hooks/useListagem.test.tsx
git commit -m "feat(frontend): estado da listagem com busca adiada

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: `useMutacoesCadastro`

**Files:**
- Create: `frontend/src/hooks/useMutacoesCadastro.ts`
- Create: `frontend/src/hooks/useMutacoesCadastro.test.tsx`

**Interfaces:**
- Consumes: `criar`, `atualizar`, `excluir` de `@/servicos/cadastros`; `useToasts` de `@/componentes/ui/Toast`; `useMutation`, `useQueryClient` de `@tanstack/react-query`.
- Produces:

```ts
export interface MensagensCadastro {
  /** "Fornecedor cadastrado" — concordancia de genero fica com quem chama. */
  criado: string;
  atualizado: string;
  inativado: string;
}

export function useMutacoesCadastro(recurso: Recurso, mensagens: MensagensCadastro): {
  criar: UseMutationResult<unknown, Error, unknown>;
  atualizar: UseMutationResult<unknown, Error, { id: number; corpo: unknown }>;
  inativar: UseMutationResult<void, Error, number>;
};
```

As mensagens vêm de fora porque o português concorda em gênero: "Fornecedor cadastrado" e "Peça cadastrada" não saem de um molde único.

- [ ] **Step 1: Escrever o teste (falhando)**

`frontend/src/hooks/useMutacoesCadastro.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { useMutacoesCadastro } from './useMutacoesCadastro';

function envolver({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

const mensagens = {
  criado: 'Fornecedor cadastrado',
  atualizado: 'Fornecedor atualizado',
  inativado: 'Fornecedor inativado',
};

const fornecedor = { id: 1, razao_social: 'Componentes Eletronicos LTDA' };

describe('useMutacoesCadastro', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    useToasts.setState({ itens: [] });
  });

  it('criar avisa com o verbo no passado', async () => {
    servidor.responder([
      { metodo: 'post', url: '/fornecedores', status: 201, corpo: { sucesso: true, dados: fornecedor } },
    ]);
    const { result } = renderHook(() => useMutacoesCadastro('fornecedores', mensagens), {
      wrapper: envolver,
    });

    result.current.criar.mutate({ razao_social: 'Componentes Eletronicos LTDA' });

    await waitFor(() => expect(result.current.criar.isSuccess).toBe(true));
    expect(useToasts.getState().itens[0].mensagem).toBe('Fornecedor cadastrado');
  });

  it('atualizar usa PUT no id e avisa', async () => {
    servidor.responder([
      { metodo: 'put', url: '/fornecedores/1', status: 200, corpo: { sucesso: true, dados: fornecedor } },
    ]);
    const { result } = renderHook(() => useMutacoesCadastro('fornecedores', mensagens), {
      wrapper: envolver,
    });

    result.current.atualizar.mutate({ id: 1, corpo: { razao_social: 'Outra' } });

    await waitFor(() => expect(result.current.atualizar.isSuccess).toBe(true));
    expect(servidor.requisicoes[0].url).toBe('/fornecedores/1');
    expect(useToasts.getState().itens[0].mensagem).toBe('Fornecedor atualizado');
  });

  it('inativar avisa com o verbo no passado', async () => {
    servidor.responder([{ metodo: 'delete', url: '/fornecedores/1', status: 204 }]);
    const { result } = renderHook(() => useMutacoesCadastro('fornecedores', mensagens), {
      wrapper: envolver,
    });

    result.current.inativar.mutate(1);

    await waitFor(() => expect(result.current.inativar.isSuccess).toBe(true));
    expect(useToasts.getState().itens[0].mensagem).toBe('Fornecedor inativado');
  });

  it('falha nao dispara aviso de sucesso e deixa o erro disponivel', async () => {
    servidor.responder([
      {
        metodo: 'post',
        url: '/fornecedores',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'ja existe um fornecedor com este CNPJ' },
        },
      },
    ]);
    const { result } = renderHook(() => useMutacoesCadastro('fornecedores', mensagens), {
      wrapper: envolver,
    });

    result.current.criar.mutate({});

    await waitFor(() => expect(result.current.criar.isError).toBe(true));
    expect(useToasts.getState().itens).toHaveLength(0);
    expect(result.current.criar.error).toMatchObject({ codigo: 'CONFLITO' });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/hooks/useMutacoesCadastro.test.tsx`

Expected: FAIL — `Failed to resolve import "./useMutacoesCadastro"`.

- [ ] **Step 3: Implementar**

`frontend/src/hooks/useMutacoesCadastro.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToasts } from '@/componentes/ui/Toast';
import { atualizar, criar, excluir } from '@/servicos/cadastros';
import type { Recurso } from '@/tipos/cadastros';

export interface MensagensCadastro {
  /** "Fornecedor cadastrado", "Peca cadastrada" — a concordancia de genero
   *  fica com quem chama, porque nao sai de um molde unico em portugues. */
  criado: string;
  atualizado: string;
  inativado: string;
}

export interface AtualizacaoCadastro {
  id: number;
  corpo: unknown;
}

/**
 * Escrita dos cadastros base. Cada sucesso invalida a lista e avisa com o
 * verbo no passado do botao acionado. O erro nao vira toast: ele volta para o
 * formulario, que sabe marcar o campo certo.
 */
export function useMutacoesCadastro(recurso: Recurso, mensagens: MensagensCadastro) {
  const clienteQuery = useQueryClient();
  const mostrar = useToasts((estado) => estado.mostrar);

  const invalidarLista = () => clienteQuery.invalidateQueries({ queryKey: [recurso] });

  return {
    criar: useMutation({
      mutationFn: (corpo: unknown) => criar(recurso, corpo),
      onSuccess: () => {
        void invalidarLista();
        mostrar(mensagens.criado);
      },
    }),

    atualizar: useMutation({
      mutationFn: ({ id, corpo }: AtualizacaoCadastro) => atualizar(recurso, id, corpo),
      onSuccess: () => {
        void invalidarLista();
        mostrar(mensagens.atualizado);
      },
    }),

    inativar: useMutation({
      mutationFn: (id: number) => excluir(recurso, id),
      onSuccess: () => {
        void invalidarLista();
        mostrar(mensagens.inativado);
      },
    }),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/hooks/useMutacoesCadastro.test.tsx`

Expected: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useMutacoesCadastro.ts frontend/src/hooks/useMutacoesCadastro.test.tsx
git commit -m "feat(frontend): mutacoes dos cadastros com aviso e invalidacao

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Helpers de formato e permissão

**Files:**
- Create: `frontend/src/lib/formato.ts`
- Create: `frontend/src/lib/formato.test.ts`
- Create: `frontend/src/lib/permissoes.ts`
- Create: `frontend/src/lib/permissoes.test.ts`

**Interfaces:**
- Consumes: `type Perfil` de `@/store/autenticacao`.
- Produces: `formatarCNPJ(cnpj: string): string`, `formatarMoeda(valor: number): string`, `formatarDias(dias: number): string` de `@/lib/formato`; `podeGerenciarCadastros(perfil: Perfil | null | undefined): boolean` de `@/lib/permissoes`.

- [ ] **Step 1: Escrever os testes (falhando)**

`frontend/src/lib/formato.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatarCNPJ, formatarDias, formatarMoeda } from './formato';

describe('formatarCNPJ', () => {
  it('pontua os 14 digitos vindos da API', () => {
    expect(formatarCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('devolve como veio quando nao tem 14 digitos', () => {
    expect(formatarCNPJ('112223')).toBe('112223');
  });

  it('vazio continua vazio', () => {
    expect(formatarCNPJ('')).toBe('');
  });
});

describe('formatarMoeda', () => {
  it('formata em reais com duas casas', () => {
    // O espaco entre "R$" e o numero e o U+00A0 do Intl, nao um espaco comum.
    expect(formatarMoeda(5000)).toBe('R$\u00a05.000,00');
  });

  it('mantem os centavos', () => {
    expect(formatarMoeda(1234.5)).toBe('R$\u00a01.234,50');
  });
});

describe('formatarDias', () => {
  it('usa o singular para um dia', () => {
    expect(formatarDias(1)).toBe('1 dia');
  });

  it('usa o plural para os demais', () => {
    expect(formatarDias(7)).toBe('7 dias');
  });
});
```

`frontend/src/lib/permissoes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { podeGerenciarCadastros } from './permissoes';

describe('podeGerenciarCadastros', () => {
  it('admin gerencia', () => {
    expect(podeGerenciarCadastros('ADMIN')).toBe(true);
  });

  it('gestor gerencia', () => {
    expect(podeGerenciarCadastros('GESTOR')).toBe(true);
  });

  it('operador so consulta', () => {
    expect(podeGerenciarCadastros('OPERADOR')).toBe(false);
  });

  it('sem sessao, nao gerencia', () => {
    expect(podeGerenciarCadastros(null)).toBe(false);
    expect(podeGerenciarCadastros(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/lib`

Expected: FAIL — `Failed to resolve import "./formato"` e `"./permissoes"`.

- [ ] **Step 3: Implementar**

`frontend/src/lib/formato.ts`:

```ts
const TAMANHO_CNPJ = 14;

const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Pontua o CNPJ para exibicao. O banco guarda so digitos, entao a pontuacao e
 * sempre derivada — nunca persistida.
 */
export function formatarCNPJ(cnpj: string): string {
  if (cnpj.length !== TAMANHO_CNPJ) {
    return cnpj;
  }
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export function formatarMoeda(valor: number): string {
  return moedaBR.format(valor);
}

/** Lead time em dias, com concordancia. */
export function formatarDias(dias: number): string {
  return dias === 1 ? '1 dia' : `${dias} dias`;
}
```

`frontend/src/lib/permissoes.ts`:

```ts
import type { Perfil } from '@/store/autenticacao';

/**
 * Escrita nos cadastros base e de ADMIN e GESTOR (o backend responde 403 para
 * OPERADOR). A regra mora aqui para que a interface nao ofereca o que vai ser
 * negado — e para que so exista um lugar a mudar quando o RNF3 mudar.
 */
export function podeGerenciarCadastros(perfil: Perfil | null | undefined): boolean {
  return perfil === 'ADMIN' || perfil === 'GESTOR';
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/lib`

Expected: PASS — 11 testes.

Se `formatarMoeda` falhar por causa do espaço, confirme se o Node do ambiente usa `U+00A0` (espaço não separável) entre `R$` e o número — é o comportamento padrão do ICU. Ajuste a expectativa do teste ao que o ambiente produz, nunca a implementação.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/formato.ts frontend/src/lib/formato.test.ts frontend/src/lib/permissoes.ts frontend/src/lib/permissoes.test.ts
git commit -m "feat(frontend): formatadores de CNPJ, moeda e dias, e regra de permissao

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 13: Navegação lateral, Shell e rotas

**Files:**
- Create: `frontend/src/componentes/layout/NavegacaoLateral.tsx`
- Create: `frontend/src/componentes/layout/NavegacaoLateral.test.tsx`
- Modify: `frontend/src/componentes/layout/Shell.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `NavLink` de `react-router-dom`; `icones` de `@/componentes/ui/icones`; `cn` de `@/lib/cn`.
- Produces: `NavegacaoLateral` (sem props). O `Shell` passa a renderizar `NavegacaoLateral` à esquerda e `Toasts` no fim da árvore.

- [ ] **Step 1: Escrever o teste (falhando)**

`frontend/src/componentes/layout/NavegacaoLateral.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NavegacaoLateral } from './NavegacaoLateral';

function renderizarEm(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <NavegacaoLateral />
    </MemoryRouter>,
  );
}

describe('NavegacaoLateral', () => {
  it('lista os cadastros disponiveis', () => {
    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Painel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Produtos acabados' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Partes e peças' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fornecedores' })).toBeInTheDocument();
  });

  it('marca a rota atual para leitor de tela', () => {
    renderizarEm('/fornecedores');

    expect(screen.getByRole('link', { name: 'Fornecedores' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current');
  });

  it('modulos de sprint futura aparecem, mas nao sao links', () => {
    renderizarEm('/');

    expect(screen.queryByRole('link', { name: /Compras/ })).not.toBeInTheDocument();
    expect(screen.getByText('Compras')).toBeInTheDocument();
    expect(screen.getAllByText('Próxima sprint').length).toBeGreaterThan(0);
  });

  it('a navegacao tem nome acessivel', () => {
    renderizarEm('/');

    expect(screen.getByRole('navigation', { name: 'Módulos do sistema' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/componentes/layout/NavegacaoLateral.test.tsx`

Expected: FAIL — `Failed to resolve import "./NavegacaoLateral"`.

- [ ] **Step 3: Implementar a navegação**

`frontend/src/componentes/layout/NavegacaoLateral.tsx`:

```tsx
import { NavLink } from 'react-router-dom';
import { icones, type NomeIcone } from '@/componentes/ui/icones';
import { cn } from '@/lib/cn';

interface ItemNavegacao {
  rota: string;
  rotulo: string;
  icone: NomeIcone;
}

interface ItemFuturo {
  rotulo: string;
  icone: NomeIcone;
}

const PAINEL: ItemNavegacao = { rota: '/', rotulo: 'Painel', icone: 'layout-dashboard' };

const CADASTROS: ItemNavegacao[] = [
  { rota: '/produtos-acabados', rotulo: 'Produtos acabados', icone: 'package' },
  { rota: '/partes-pecas', rotulo: 'Partes e peças', icone: 'boxes' },
  { rota: '/fornecedores', rotulo: 'Fornecedores', icone: 'users' },
];

// Ficam visiveis de proposito: quem usa o sistema precisa saber que estes
// modulos vao existir, e em que ordem chegam.
const FUTUROS: ItemFuturo[] = [
  { rotulo: 'Compras', icone: 'shopping-cart' },
  { rotulo: 'Estoque', icone: 'clipboard-list' },
  { rotulo: 'Produção', icone: 'factory' },
];

function classesDoLink({ isActive }: { isActive: boolean }): string {
  return cn(
    'flex min-h-linha items-center gap-2 rounded-campo px-3 text-body',
    isActive ? 'bg-brand-subtle text-brand' : 'text-texto-secondary hover:bg-surface-sunken',
  );
}

function Link({ item }: { item: ItemNavegacao }) {
  const Icone = icones[item.icone];
  return (
    <NavLink to={item.rota} end={item.rota === '/'} className={classesDoLink}>
      {({ isActive }) => (
        <>
          <Icone size={16} aria-hidden="true" className="shrink-0" />
          {item.rotulo}
          {isActive && <span className="sr-only">(página atual)</span>}
        </>
      )}
    </NavLink>
  );
}

export function NavegacaoLateral() {
  return (
    <nav
      aria-label="Módulos do sistema"
      className="w-[220px] shrink-0 border-r border-borda-subtle bg-surface-raised p-3"
    >
      <ul className="flex flex-col gap-1">
        <li>
          <Link item={PAINEL} />
        </li>
      </ul>

      <p className="mb-1 mt-6 px-3 text-label text-texto-disabled">Cadastros</p>
      <ul className="flex flex-col gap-1">
        {CADASTROS.map((item) => (
          <li key={item.rota}>
            <Link item={item} />
          </li>
        ))}
      </ul>

      <p className="mb-1 mt-6 px-3 text-label text-texto-disabled">Em construção</p>
      <ul className="flex flex-col gap-1">
        {FUTUROS.map((item) => {
          const Icone = icones[item.icone];
          return (
            <li
              key={item.rotulo}
              className="flex min-h-linha flex-col justify-center rounded-campo px-3"
            >
              <span className="flex items-center gap-2 text-body text-texto-disabled">
                <Icone size={16} aria-hidden="true" className="shrink-0" />
                {item.rotulo}
              </span>
              <span className="pl-6 text-label text-texto-disabled">Próxima sprint</span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

Nota: `NavLink` aplica `aria-current="page"` sozinho na rota ativa — não passe o atributo à mão. O `end` no item do Painel evita que `/` fique marcado como ativo em todas as rotas.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/componentes/layout/NavegacaoLateral.test.tsx`

Expected: PASS — 4 testes.

- [ ] **Step 5: Encaixar a navegação e os toasts no Shell**

`frontend/src/componentes/layout/Shell.tsx` passa a ser:

```tsx
import { Outlet } from 'react-router-dom';
import { Toasts } from '@/componentes/ui/Toast';
import { Cabecalho } from './Cabecalho';
import { NavegacaoLateral } from './NavegacaoLateral';

/** Moldura das telas internas: cabecalho fixo, navegacao lateral e conteudo. */
export function Shell() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <Cabecalho />

      <div className="flex flex-1">
        <NavegacaoLateral />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}
```

- [ ] **Step 6: Registrar as rotas**

Em `frontend/src/App.tsx`, dentro do `<Route element={<Shell />}>`, acrescentar as três rotas de cadastro (a rota `/` passa a apontar para `Painel` na Task 14; por ora mantenha `Inicio`):

```tsx
<Route path="/produtos-acabados" element={<ProdutosAcabados />} />
<Route path="/partes-pecas" element={<PartesPecas />} />
<Route path="/fornecedores" element={<Fornecedores />} />
```

com os imports correspondentes de `@/paginas/cadastros/...`.

**Atenção:** as três páginas só existem a partir da Task 15. Se esta tarefa for executada antes delas, deixe as rotas comentadas e faça o Step 6 no fim da Task 17 — o `tsc` quebra com import de arquivo inexistente.

- [ ] **Step 7: Rodar a suíte inteira**

Run: `cd frontend && npm test`

Expected: PASS — os testes de `App` continuam verdes, porque a rota `/` ainda é a `Inicio`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/componentes/layout frontend/src/App.tsx
git commit -m "feat(frontend): navegacao lateral dos modulos

Modulos de sprint futura ficam visiveis e inertes: quem usa o sistema
precisa saber que eles vao existir e em que ordem chegam.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 14: Painel

**Files:**
- Create: `frontend/src/paginas/Painel.tsx`
- Create: `frontend/src/paginas/Painel.test.tsx`
- Delete: `frontend/src/paginas/Inicio.tsx`
- Delete: `frontend/src/paginas/Inicio.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `Cartao` de `@/componentes/ui/Cartao`; `icones`; `api` de `@/servicos/api`; `useAutenticacao`.
- Produces: `Painel` de `@/paginas/Painel`. A rota `/` passa a renderizar `Painel`.

O painel mostra a **estrutura** dos widgets do RF6.1, sem número nenhum. Número simulado em tela de gestão é armadilha: alguém decide com ele.

**Mudança de nome:** o heading da rota `/` deixa de ser "Início" e passa a ser "Painel". `App.test.tsx` afirma `heading name: 'Início'` em quatro pontos — todos passam a `'Painel'`.

- [ ] **Step 1: Escrever o teste (falhando)**

`frontend/src/paginas/Painel.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { useAutenticacao } from '@/store/autenticacao';
import { Painel } from './Painel';

const saudeOk = { sucesso: true, dados: { status: 'ok', ambiente: 'test' } };

describe('Painel', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    servidor = instalarServidorFalso();
    servidor.responder([{ metodo: 'get', url: '/saude', status: 200, corpo: saudeOk }]);
  });

  it('anuncia a tela', () => {
    renderizarComProvedores(<Painel />);

    expect(screen.getByRole('heading', { name: 'Painel', level: 1 })).toBeInTheDocument();
  });

  it('mostra os quatro widgets do RF6.1', () => {
    renderizarComProvedores(<Painel />);

    expect(screen.getByRole('heading', { name: 'Ordens de produção em atraso' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pedidos de compra a receber' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Insumos em nível crítico' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conexão com o servidor' })).toBeInTheDocument();
  });

  it('cada widget diz em que sprint o dado passa a existir', () => {
    renderizarComProvedores(<Painel />);

    expect(screen.getByText(/O módulo de produção entra na Sprint 6/)).toBeInTheDocument();
    expect(screen.getByText(/O módulo de compras entra na Sprint 3/)).toBeInTheDocument();
    expect(screen.getByText(/O controle de estoque entra na Sprint 3/)).toBeInTheDocument();
  });

  it('nao exibe metrica nenhuma: os widgets estao vazios de proposito', () => {
    const { container } = renderizarComProvedores(<Painel />);

    // `text-dado-lg` e a classe da quantidade em destaque. Enquanto nao houver
    // dado real, nenhum widget pode mostrar numero como se fosse medicao.
    expect(container.querySelectorAll('.text-dado-lg')).toHaveLength(0);
    expect(container.querySelectorAll('[data-widget-vazio]')).toHaveLength(3);
  });

  it('mostra o estado real da conexao', async () => {
    renderizarComProvedores(<Painel />);

    expect(await screen.findByText(/Operacional · ambiente test/)).toBeInTheDocument();
  });

  it('servidor fora do ar aparece como falha', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/saude',
        status: 503,
        corpo: { sucesso: false, erro: { codigo: 'INDISPONIVEL', mensagem: 'Banco de dados indisponivel' } },
      },
    ]);

    renderizarComProvedores(<Painel />);

    expect(await screen.findByText(/Servidor indisponível/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/paginas/Painel.test.tsx`

Expected: FAIL — `Failed to resolve import "./Painel"`.

- [ ] **Step 3: Implementar**

`frontend/src/paginas/Painel.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Cartao } from '@/componentes/ui/Cartao';
import { icones } from '@/componentes/ui/icones';
import { api } from '@/servicos/api';
import { useAutenticacao } from '@/store/autenticacao';

interface RespostaSaude {
  dados: { status: string; ambiente: string };
}

interface WidgetPendente {
  titulo: string;
  /** Convite do §7: diz o que falta e quando chega. */
  vazio: string;
}

/**
 * Widgets do RF6.1 sem numero. Enquanto nao houver OP e PC de verdade, o
 * painel mostra apenas onde a informacao vai aparecer e quando: numero
 * simulado em tela de gestao acaba virando base de decisao.
 */
const WIDGETS: WidgetPendente[] = [
  {
    titulo: 'Ordens de produção em atraso',
    vazio: 'Nenhuma ordem de produção ainda. O módulo de produção entra na Sprint 6.',
  },
  {
    titulo: 'Pedidos de compra a receber',
    vazio: 'Nenhum pedido de compra ainda. O módulo de compras entra na Sprint 3.',
  },
  {
    titulo: 'Insumos em nível crítico',
    vazio: 'Nenhum insumo monitorado ainda. O controle de estoque entra na Sprint 3.',
  },
];

export function Painel() {
  const usuario = useAutenticacao((estado) => estado.usuario);

  const saude = useQuery({
    queryKey: ['saude'],
    queryFn: async () => (await api.get<RespostaSaude>('/saude')).data.dados,
    refetchInterval: 60_000,
  });

  const IconeOk = icones['check-circle-2'];
  const IconeFalha = icones['alert-triangle'];

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Painel</h1>
        <p className="text-body text-texto-secondary">
          {usuario ? `Sessão aberta como ${usuario.nome}.` : 'Sessão aberta.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {WIDGETS.map((widget) => (
          <Cartao key={widget.titulo} titulo={widget.titulo}>
            <p data-widget-vazio className="text-body text-texto-secondary">
              {widget.vazio}
            </p>
          </Cartao>
        ))}
      </div>

      <Cartao titulo="Conexão com o servidor">
        {saude.isPending && <p className="text-body text-texto-secondary">Verificando…</p>}

        {saude.isError && (
          <p className="flex items-center gap-2 text-body text-estado-pending">
            <IconeFalha size={16} aria-hidden="true" />
            Servidor indisponível. As telas de operação não funcionarão até a conexão voltar.
          </p>
        )}

        {saude.data && (
          <p className="flex items-center gap-2 text-body text-estado-done">
            <IconeOk size={16} aria-hidden="true" />
            Operacional · ambiente {saude.data.ambiente}
          </p>
        )}
      </Cartao>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/paginas/Painel.test.tsx`

Expected: PASS — 6 testes.

- [ ] **Step 5: Trocar a rota e apagar a tela antiga**

Em `frontend/src/App.tsx`: trocar o import de `Inicio` por `Painel` e `<Route path="/" element={<Inicio />} />` por `<Route path="/" element={<Painel />} />`.

Apagar `frontend/src/paginas/Inicio.tsx` e `frontend/src/paginas/Inicio.test.tsx`.

Em `frontend/src/App.test.tsx`, trocar as quatro ocorrências de `{ name: 'Início' }` por `{ name: 'Painel' }`.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `cd frontend && npm test`

Expected: PASS — sem referência remanescente a `Inicio`.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src/paginas frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): painel do RF6.1 sem numeros simulados

Substitui a tela Inicio. Os widgets mostram o leiaute final e dizem em qual
sprint cada informacao passa a existir; o cartao de conexao segue com dado
real.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 15: Tela de Fornecedores

**Files:**
- Create: `frontend/src/paginas/cadastros/FormularioFornecedor.tsx`
- Create: `frontend/src/paginas/cadastros/Fornecedores.tsx`
- Create: `frontend/src/paginas/cadastros/Fornecedores.test.tsx`

**Interfaces:**
- Consumes: tudo das tarefas 1 a 12.
- Produces: `Fornecedores` de `@/paginas/cadastros/Fornecedores`; `FormularioFornecedor` com props `{ inicial?: Fornecedor; ocupado: boolean; erroGeral: string | null; errosPorCampo: Record<string, string>; aoEnviar: (corpo: CorpoFornecedor) => void; aoCancelar: () => void }` e `type CorpoFornecedor`.

Esta é a tela de referência: as tarefas 16 e 17 repetem a mesma estrutura trocando colunas, schema e mensagens.

- [ ] **Step 1: Escrever o formulário**

`frontend/src/paginas/cadastros/FormularioFornecedor.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import type { Fornecedor } from '@/tipos/cadastros';

/**
 * Validacao de forma, nao de regra: o dominio no backend e a autoridade sobre
 * CNPJ valido e e-mail valido. Aqui so evitamos o ida-e-volta obvio.
 */
const esquema = z.object({
  razao_social: z.string().trim().min(1, 'Informe a razão social'),
  cnpj: z.string().trim().min(1, 'Informe o CNPJ'),
  lead_time_medio: z.coerce.number().int().positive('O lead time deve ser maior que zero'),
  contato_nome: z.string().trim().max(100).default(''),
  contato_email: z.string().trim().max(100).default(''),
  contato_telefone: z.string().trim().max(20).default(''),
  endereco: z.string().trim().max(255).default(''),
  condicao_pagamento: z.string().trim().max(50).default(''),
  ativo: z.enum(['true', 'false']),
});

type Formulario = z.input<typeof esquema>;

export interface CorpoFornecedor {
  razao_social: string;
  cnpj: string;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string;
  endereco: string;
  lead_time_medio: number;
  condicao_pagamento: string;
  ativo: boolean;
}

export interface FormularioFornecedorProps {
  inicial?: Fornecedor;
  ocupado: boolean;
  /** Mensagem da API que nao aponta para um campo (regra de dominio, 409). */
  erroGeral: string | null;
  /** Erros por campo vindos do `detalhes` do 400. */
  errosPorCampo: Record<string, string>;
  aoEnviar: (corpo: CorpoFornecedor) => void;
  aoCancelar: () => void;
}

const SITUACAO = [
  { valor: 'true', rotulo: 'Ativo' },
  { valor: 'false', rotulo: 'Inativo' },
];

export function FormularioFornecedor({
  inicial,
  ocupado,
  erroGeral,
  errosPorCampo,
  aoEnviar,
  aoCancelar,
}: FormularioFornecedorProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      razao_social: inicial?.razao_social ?? '',
      cnpj: inicial?.cnpj ?? '',
      lead_time_medio: inicial?.lead_time_medio ?? 7,
      contato_nome: inicial?.contato_nome ?? '',
      contato_email: inicial?.contato_email ?? '',
      contato_telefone: inicial?.contato_telefone ?? '',
      endereco: inicial?.endereco ?? '',
      condicao_pagamento: inicial?.condicao_pagamento ?? '',
      ativo: inicial ? String(inicial.ativo) as 'true' | 'false' : 'true',
    },
  });

  /** O erro do formulario vence o da API: e o mais recente que a pessoa viu. */
  const erroDe = (campo: keyof Formulario): string | undefined =>
    errors[campo]?.message ?? errosPorCampo[campo];

  return (
    <form
      onSubmit={handleSubmit((valores) =>
        aoEnviar({
          razao_social: valores.razao_social,
          cnpj: valores.cnpj,
          contato_nome: valores.contato_nome ?? '',
          contato_email: valores.contato_email ?? '',
          contato_telefone: valores.contato_telefone ?? '',
          endereco: valores.endereco ?? '',
          lead_time_medio: Number(valores.lead_time_medio),
          condicao_pagamento: valores.condicao_pagamento ?? '',
          ativo: valores.ativo === 'true',
        }),
      )}
      className="flex flex-col gap-4"
    >
      {erroGeral && (
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          {erroGeral}
        </p>
      )}

      <Campo rotulo="Razão social" obrigatorio erro={erroDe('razao_social')} {...register('razao_social')} />

      <div className="grid gap-4 md:grid-cols-2">
        <Campo
          rotulo="CNPJ"
          obrigatorio
          tipoDado="codigo"
          ajuda="Com ou sem pontuação"
          erro={erroDe('cnpj')}
          {...register('cnpj')}
        />
        <Campo
          rotulo="Lead time médio (dias)"
          obrigatorio
          tipoDado="quantidade"
          erro={erroDe('lead_time_medio')}
          {...register('lead_time_medio')}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Campo rotulo="Nome do contato" erro={erroDe('contato_nome')} {...register('contato_nome')} />
        <Campo rotulo="E-mail do contato" type="email" erro={erroDe('contato_email')} {...register('contato_email')} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Campo rotulo="Telefone do contato" erro={erroDe('contato_telefone')} {...register('contato_telefone')} />
        <Campo rotulo="Condição de pagamento" erro={erroDe('condicao_pagamento')} {...register('condicao_pagamento')} />
      </div>

      <Campo rotulo="Endereço" erro={erroDe('endereco')} {...register('endereco')} />

      <div className="w-[200px]">
        <Selecao rotulo="Situação" opcoes={SITUACAO} {...register('ativo')} />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Botao variante="secundaria" onClick={aoCancelar} disabled={ocupado}>
          Cancelar
        </Botao>
        <Botao type="submit" icone="save" ocupado={ocupado} rotuloOcupado="Salvando…">
          Salvar
        </Botao>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Escrever o teste da tela (falhando)**

`frontend/src/paginas/cadastros/Fornecedores.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao, type Perfil } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Fornecedores } from './Fornecedores';

const fornecedor = {
  id: 1,
  razao_social: 'Componentes Eletronicos LTDA',
  cnpj: '11222333000181',
  contato_nome: 'Joao Silva',
  contato_email: 'joao@componentes.com.br',
  contato_telefone: '11999999999',
  endereco: 'Rua das Pecas, 100',
  lead_time_medio: 7,
  condicao_pagamento: '30 dias',
  ativo: true,
  created_at: '2026-08-29T12:00:00Z',
  updated_at: '2026-08-29T12:00:00Z',
};

function paginaCom(itens: unknown[]) {
  return {
    sucesso: true,
    dados: itens,
    paginacao: { pagina: 1, limite: 20, total: itens.length, total_paginas: 1 },
  };
}

function entrarComo(perfil: Perfil) {
  useAutenticacao.getState().entrar({
    access_token: 'token-abc',
    token_type: 'Bearer',
    expires_in: 28800,
    usuario: { id: 1, username: 'gestor01', nome: 'Gustavo Landal', perfil },
  });
}

describe('Fornecedores', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
    entrarComo('GESTOR');
  });

  it('mostra o esqueleto enquanto carrega', () => {
    servidor.responder([{ metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) }]);

    renderizarComProvedores(<Fornecedores />);

    expect(screen.getAllByTestId('esqueleto-tabela').length).toBeGreaterThan(0);
  });

  it('lista vazia convida a cadastrar', async () => {
    servidor.responder([{ metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) }]);

    renderizarComProvedores(<Fornecedores />);

    expect(
      await screen.findByText('Nenhum fornecedor cadastrado. Cadastre o primeiro para começar.'),
    ).toBeInTheDocument();
  });

  it('mostra o CNPJ pontuado e o lead time em dias', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([fornecedor]) },
    ]);

    renderizarComProvedores(<Fornecedores />);

    expect(await screen.findByText('11.222.333/0001-81')).toBeInTheDocument();
    expect(screen.getByText('7 dias')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('falha na listagem mostra o erro e oferece nova tentativa', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/fornecedores',
        status: 500,
        corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } },
      },
    ]);

    renderizarComProvedores(<Fornecedores />);

    expect(await screen.findByText('Erro interno do servidor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('operador nao ve as acoes de escrita', async () => {
    entrarComo('OPERADOR');
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([fornecedor]) },
    ]);

    renderizarComProvedores(<Fornecedores />);

    await screen.findByText('11.222.333/0001-81');
    expect(screen.queryByRole('button', { name: 'Novo fornecedor' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inativar/ })).not.toBeInTheDocument();
  });
});
```

Continuação do mesmo `describe`, cobrindo a escrita:

```tsx
  it('cadastrar envia o corpo e avisa no verbo passado', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      { metodo: 'post', url: '/fornecedores', status: 201, corpo: { sucesso: true, dados: fornecedor } },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText(/Nenhum fornecedor cadastrado/);

    await userEvent.click(screen.getByRole('button', { name: 'Novo fornecedor' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo fornecedor' });
    await userEvent.type(within(dialogo).getByLabelText(/Razão social/), 'Componentes Eletronicos LTDA');
    await userEvent.type(within(dialogo).getByLabelText(/CNPJ/), '11.222.333/0001-81');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Fornecedor cadastrado'));

    const envio = servidor.requisicoes.find((r) => r.metodo === 'post');
    expect(envio?.corpo).toMatchObject({
      razao_social: 'Componentes Eletronicos LTDA',
      cnpj: '11.222.333/0001-81',
      lead_time_medio: 7,
      ativo: true,
    });
  });

  it('erro 400 com detalhes marca o campo', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      {
        metodo: 'post',
        url: '/fornecedores',
        status: 400,
        corpo: {
          sucesso: false,
          erro: {
            codigo: 'ERRO_VALIDACAO',
            mensagem: 'Dados invalidos',
            detalhes: [{ campo: 'razao_social', mensagem: 'Campo obrigatorio' }],
          },
        },
      },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText(/Nenhum fornecedor cadastrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo fornecedor' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo fornecedor' });
    await userEvent.type(within(dialogo).getByLabelText(/Razão social/), 'X');
    await userEvent.type(within(dialogo).getByLabelText(/CNPJ/), '11222333000181');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByText('Campo obrigatorio')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Novo fornecedor' })).toBeInTheDocument();
  });

  it('conflito 409 mostra alerta e mantem o modal aberto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      {
        metodo: 'post',
        url: '/fornecedores',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'ja existe um fornecedor com este CNPJ' },
        },
      },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText(/Nenhum fornecedor cadastrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo fornecedor' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo fornecedor' });
    await userEvent.type(within(dialogo).getByLabelText(/Razão social/), 'Componentes Eletronicos LTDA');
    await userEvent.type(within(dialogo).getByLabelText(/CNPJ/), '11222333000181');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'ja existe um fornecedor com este CNPJ',
    );
    expect(screen.getByRole('dialog', { name: 'Novo fornecedor' })).toBeInTheDocument();
  });

  it('editar abre o modal preenchido', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([fornecedor]) },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText('11.222.333/0001-81');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Componentes Eletronicos LTDA' }));

    const dialogo = screen.getByRole('dialog', { name: 'Editar fornecedor' });
    expect(within(dialogo).getByLabelText(/Razão social/)).toHaveValue('Componentes Eletronicos LTDA');
  });

  it('inativar pede confirmacao antes de chamar a API', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([fornecedor]) },
      { metodo: 'delete', url: '/fornecedores/1', status: 204 },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText('11.222.333/0001-81');

    await userEvent.click(
      screen.getByRole('button', { name: 'Inativar Componentes Eletronicos LTDA' }),
    );

    expect(servidor.requisicoes.some((r) => r.metodo === 'delete')).toBe(false);
    expect(screen.getByText(/deixa de aparecer nas listas de seleção/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Inativar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Fornecedor inativado'));
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/paginas/cadastros/Fornecedores.test.tsx`

Expected: FAIL — `Failed to resolve import "./Fornecedores"`.

- [ ] **Step 4: Implementar a tela**

`frontend/src/paginas/cadastros/Fornecedores.tsx`:

```tsx
import { useState } from 'react';
import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { BadgeSituacao } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useListagem } from '@/hooks/useListagem';
import { useMutacoesCadastro } from '@/hooks/useMutacoesCadastro';
import { formatarCNPJ, formatarDias } from '@/lib/formato';
import { podeGerenciarCadastros } from '@/lib/permissoes';
import { ErroApi } from '@/servicos/api';
import { useAutenticacao } from '@/store/autenticacao';
import type { Fornecedor } from '@/tipos/cadastros';
import { FormularioFornecedor, type CorpoFornecedor } from './FormularioFornecedor';

/** Separa o erro da API em "marca o campo" e "mostra no topo do modal". */
function separarErro(erro: unknown): { geral: string | null; porCampo: Record<string, string> } {
  if (!(erro instanceof ErroApi)) {
    return { geral: erro ? 'Não foi possível salvar. Tente de novo.' : null, porCampo: {} };
  }
  if (erro.detalhes?.length) {
    return {
      geral: null,
      porCampo: Object.fromEntries(erro.detalhes.map((d) => [d.campo, d.mensagem])),
    };
  }
  return { geral: erro.message, porCampo: {} };
}

export function Fornecedores() {
  const perfil = useAutenticacao((estado) => estado.usuario?.perfil);
  const podeGerenciar = podeGerenciarCadastros(perfil);

  const lista = useListagem<Fornecedor>('fornecedores', 'razao_social');
  const mutacoes = useMutacoesCadastro('fornecedores', {
    criado: 'Fornecedor cadastrado',
    atualizado: 'Fornecedor atualizado',
    inativado: 'Fornecedor inativado',
  });

  const [emEdicao, definirEmEdicao] = useState<Fornecedor | null>(null);
  const [formularioAberto, definirFormularioAberto] = useState(false);
  const [aInativar, definirAInativar] = useState<Fornecedor | null>(null);

  const mutacaoAtiva = emEdicao ? mutacoes.atualizar : mutacoes.criar;
  const { geral, porCampo } = separarErro(mutacaoAtiva.error);

  function abrirNovo() {
    mutacoes.criar.reset();
    definirEmEdicao(null);
    definirFormularioAberto(true);
  }

  function abrirEdicao(f: Fornecedor) {
    mutacoes.atualizar.reset();
    definirEmEdicao(f);
    definirFormularioAberto(true);
  }

  function fecharFormulario() {
    definirFormularioAberto(false);
    definirEmEdicao(null);
  }

  function salvar(corpo: CorpoFornecedor) {
    const aoConcluir = { onSuccess: () => fecharFormulario() };
    if (emEdicao) {
      mutacoes.atualizar.mutate({ id: emEdicao.id, corpo }, aoConcluir);
    } else {
      mutacoes.criar.mutate(corpo, aoConcluir);
    }
  }

  const colunas: Coluna<Fornecedor>[] = [
    {
      chave: 'razao_social',
      rotulo: 'Razão social',
      ordenavel: true,
      renderizar: (f) => f.razao_social,
    },
    {
      chave: 'cnpj',
      rotulo: 'CNPJ',
      ordenavel: true,
      renderizar: (f) => <span className="font-mono">{formatarCNPJ(f.cnpj)}</span>,
    },
    {
      chave: 'contato',
      rotulo: 'Contato',
      renderizar: (f) =>
        f.contato_nome || f.contato_email ? (
          <span className="flex flex-col">
            <span>{f.contato_nome || '—'}</span>
            {f.contato_email && (
              <span className="text-label text-texto-secondary">{f.contato_email}</span>
            )}
          </span>
        ) : (
          '—'
        ),
    },
    {
      chave: 'lead_time_medio',
      rotulo: 'Lead time',
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (f) => formatarDias(f.lead_time_medio),
    },
    { chave: 'ativo', rotulo: 'Situação', renderizar: (f) => <BadgeSituacao ativo={f.ativo} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Fornecedores</h1>
        <p className="text-body text-texto-secondary">
          Quem abastece as partes e peças usadas na produção.
        </p>
      </div>

      <BarraDeFiltros
        busca={lista.busca}
        aoBuscar={lista.definirBusca}
        rotuloBusca="Buscar por razão social, CNPJ ou contato"
        filtroAtivo={lista.filtroAtivo}
        aoFiltrarSituacao={lista.definirFiltroAtivo}
      >
        {podeGerenciar && (
          <Botao icone="plus" onClick={abrirNovo}>
            Novo fornecedor
          </Botao>
        )}
      </BarraDeFiltros>

      <div>
        <Tabela<Fornecedor>
          rotulo="Fornecedores"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(f) => f.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhum fornecedor cadastrado. Cadastre o primeiro para começar."
          acoes={
            podeGerenciar
              ? (f) => (
                  <span className="flex items-center justify-end gap-2">
                    <Botao
                      variante="fantasma"
                      icone="pencil"
                      aria-label={`Editar ${f.razao_social}`}
                      onClick={() => abrirEdicao(f)}
                    >
                      Editar
                    </Botao>
                    {f.ativo && (
                      <Botao
                        variante="fantasma"
                        icone="trash-2"
                        aria-label={`Inativar ${f.razao_social}`}
                        onClick={() => definirAInativar(f)}
                      >
                        Inativar
                      </Botao>
                    )}
                  </span>
                )
              : undefined
          }
        />
        <Paginacao
          pagina={lista.paginacao.pagina}
          totalPaginas={lista.paginacao.total_paginas}
          total={lista.paginacao.total}
          aoMudar={lista.definirPagina}
        />
      </div>

      <Modal
        aberto={formularioAberto}
        aoFechar={fecharFormulario}
        titulo={emEdicao ? 'Editar fornecedor' : 'Novo fornecedor'}
        descricao="Campos com * são obrigatórios."
      >
        <FormularioFornecedor
          // A chave remonta o formulario ao trocar de registro: sem isso os
          // defaultValues do react-hook-form ficam presos no primeiro item.
          key={emEdicao?.id ?? 'novo'}
          inicial={emEdicao ?? undefined}
          ocupado={mutacaoAtiva.isPending}
          erroGeral={geral}
          errosPorCampo={porCampo}
          aoEnviar={salvar}
          aoCancelar={fecharFormulario}
        />
      </Modal>

      <Confirmacao
        aberto={aInativar !== null}
        titulo="Inativar fornecedor"
        mensagem={
          aInativar
            ? `Inativar o fornecedor ${aInativar.razao_social}? Ele deixa de aparecer nas listas de seleção. O histórico é preservado.`
            : ''
        }
        rotuloConfirmar="Inativar"
        rotuloOcupado="Inativando…"
        ocupado={mutacoes.inativar.isPending}
        aoConfirmar={() => {
          if (aInativar) {
            mutacoes.inativar.mutate(aInativar.id, { onSuccess: () => definirAInativar(null) });
          }
        }}
        aoCancelar={() => definirAInativar(null)}
      />
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npm test -- src/paginas/cadastros/Fornecedores.test.tsx`

Expected: PASS — 10 testes.

- [ ] **Step 6: Registrar a rota**

Em `frontend/src/App.tsx`, dentro do `<Route element={<Shell />}>`:

```tsx
<Route path="/fornecedores" element={<Fornecedores />} />
```

com `import { Fornecedores } from '@/paginas/cadastros/Fornecedores';`.

- [ ] **Step 7: Rodar a suíte inteira e commitar**

Run: `cd frontend && npm test && npm run lint`

```bash
git add frontend/src/paginas/cadastros frontend/src/App.tsx
git commit -m "feat(frontend): tela de fornecedores

Lista com busca, ordenacao e paginacao; formulario em modal; inativacao com
confirmacao. Operador so consulta — a interface nao oferece o que o backend
vai negar com 403.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 15b: Extrair `useCadastroCrud`

**Files:**
- Create: `frontend/src/hooks/useCadastroCrud.ts`
- Create: `frontend/src/hooks/useCadastroCrud.test.tsx`
- Create: `frontend/src/lib/errosDeFormulario.ts`
- Modify: `frontend/src/paginas/cadastros/Fornecedores.tsx`

**Por que esta tarefa existe:** as tarefas 16 e 17 repetiriam, verbatim, a máquina de estado da tela de Fornecedores — abrir novo, abrir edição, fechar, salvar, pedir e confirmar inativação, separar o erro da API. São ~40 linhas idênticas por tela. O hook extrai só isso. Colunas, schema zod e JSX continuam explícitos em cada tela: **não** transforme isto num componente genérico de tela — a spec descartou esse caminho porque o BOM é mestre-detalhe e não caberia nele.

**Interfaces:**
- Consumes: `useMutacoesCadastro`, `type MensagensCadastro` de `@/hooks/useMutacoesCadastro`; `ErroApi` de `@/servicos/api`.
- Produces:

```ts
// frontend/src/lib/errosDeFormulario.ts
export interface ErroDeFormulario {
  geral: string | null;
  porCampo: Record<string, string>;
}
export function separarErro(erro: unknown): ErroDeFormulario;

// frontend/src/hooks/useCadastroCrud.ts
export interface CadastroCrud<T> {
  emEdicao: T | null;
  formularioAberto: boolean;
  aInativar: T | null;
  salvando: boolean;
  inativando: boolean;
  erroGeral: string | null;
  errosPorCampo: Record<string, string>;
  abrirNovo: () => void;
  abrirEdicao: (item: T) => void;
  fecharFormulario: () => void;
  salvar: (corpo: unknown) => void;
  pedirInativacao: (item: T) => void;
  cancelarInativacao: () => void;
  confirmarInativacao: () => void;
}
export function useCadastroCrud<T extends { id: number }>(
  recurso: Recurso,
  mensagens: MensagensCadastro,
): CadastroCrud<T>;
```

- [ ] **Step 1: Mover `separarErro` para `@/lib/errosDeFormulario`**

Tirar a função de `Fornecedores.tsx`, pôr em `frontend/src/lib/errosDeFormulario.ts` com o mesmo corpo, exportada, e importar de volta em `Fornecedores.tsx`.

Run: `cd frontend && npm test -- src/paginas/cadastros/Fornecedores.test.tsx` — segue verde, é só movimentação.

- [ ] **Step 2: Escrever o teste do hook (falhando)**

`frontend/src/hooks/useCadastroCrud.test.tsx` — cobre a máquina de estado, com o servidor falso respondendo às mutações:

1. `formularioAberto` começa falso e `emEdicao` nulo;
2. `abrirNovo` abre o formulário sem registro em edição;
3. `abrirEdicao(item)` abre com o registro;
4. `fecharFormulario` fecha e limpa `emEdicao`;
5. `salvar` sem `emEdicao` faz POST; com `emEdicao` faz PUT no id;
6. sucesso do `salvar` fecha o formulário sozinho;
7. `pedirInativacao` guarda o item **sem** chamar a API;
8. `confirmarInativacao` chama DELETE e limpa `aInativar` no sucesso;
9. erro 400 com `detalhes` preenche `errosPorCampo` e deixa `erroGeral` nulo;
10. erro 409 preenche `erroGeral` e mantém o formulário aberto.

Use o mesmo `envolver` com `QueryClientProvider` dos testes das tarefas 10 e 11, e `useToasts.setState({ itens: [] })` no `beforeEach`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/hooks/useCadastroCrud.test.tsx`
Expected: FAIL — `Failed to resolve import "./useCadastroCrud"`.

- [ ] **Step 4: Implementar o hook**

Mover para dentro dele, sem mudar comportamento, os estados `emEdicao`, `formularioAberto` e `aInativar` de `Fornecedores.tsx`, a escolha de `mutacaoAtiva`, o `separarErro` aplicado a ela, e as funções `abrirNovo`, `abrirEdicao`, `fecharFormulario`, `salvar`. Acrescentar `pedirInativacao`, `cancelarInativacao` e `confirmarInativacao` a partir do que hoje está inline no `<Confirmacao>`.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npm test -- src/hooks/useCadastroCrud.test.tsx`
Expected: PASS — 10 testes.

- [ ] **Step 6: Refazer `Fornecedores.tsx` sobre o hook**

A tela passa a chamar `const crud = useCadastroCrud<Fornecedor>('fornecedores', { criado: 'Fornecedor cadastrado', atualizado: 'Fornecedor atualizado', inativado: 'Fornecedor inativado' })` e a usar `crud.*` no lugar dos estados locais. Nenhum teste de `Fornecedores.test.tsx` muda: o comportamento é o mesmo.

Run: `cd frontend && npm test`
Expected: PASS — tudo verde, inclusive os 10 testes de `Fornecedores`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useCadastroCrud.ts frontend/src/hooks/useCadastroCrud.test.tsx frontend/src/lib/errosDeFormulario.ts frontend/src/paginas/cadastros/Fornecedores.tsx
git commit -m "refactor(frontend): extrai a maquina de estado dos cadastros

As telas de pecas e produtos repetiriam verbatim abrir/editar/fechar/salvar
e a separacao do erro da API. O hook fica com isso; colunas, schema e JSX
seguem explicitos em cada tela.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 16: Tela de Partes/Peças

**Files:**
- Create: `frontend/src/paginas/cadastros/FormularioPeca.tsx`
- Create: `frontend/src/paginas/cadastros/PartesPecas.tsx`
- Create: `frontend/src/paginas/cadastros/PartesPecas.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: tudo das tarefas 1 a 12, mais `useCadastroCrud` de `@/hooks/useCadastroCrud` e `separarErro` de `@/lib/errosDeFormulario` (Task 15b). A tela **não** repete a máquina de estado: usa o hook.
- Produces: `PartesPecas` de `@/paginas/cadastros/PartesPecas`; `FormularioPeca` e `type CorpoPeca`.

**Estrutura idêntica à Task 15.** O que muda:

| Item | Valor |
|---|---|
| Recurso | `'partes-pecas'` |
| Coluna padrão | `'codigo'` |
| Título / subtítulo | "Partes e peças" / "Componentes comprados e consumidos na montagem." |
| Rótulo da busca | "Buscar por código ou descrição" |
| Vazio | "Nenhuma parte ou peça cadastrada. Cadastre a primeira para começar." |
| Botão | "Nova peça" |
| Mensagens | `{ criado: 'Peça cadastrada', atualizado: 'Peça atualizada', inativado: 'Peça inativada' }` |
| Confirmação | "Inativar a peça CON-001? Ela deixa de aparecer nas listas de seleção. O histórico é preservado." |

Colunas: Código (`codigo`, ordenável, `font-mono`), Descrição (`descricao`, ordenável), Unidade (não ordenável), Estoque mín./máx. (`estoque_minimo`, ordenável, à direita, renderizado como `${min} / ${max}`), Lead time (`lead_time_compra`, ordenável, à direita, `formatarDias`), Situação (badge).

Campos do formulário: código\* (`tipoDado="codigo"`), descrição\*, unidade\*, estoque mínimo\* (`tipoDado="quantidade"`), estoque máximo\* (`tipoDado="quantidade"`), lead time de compra\* (`tipoDado="quantidade"`), fornecedor padrão (`Selecao` com `placeholder="Sem fornecedor padrão"`), situação.

O schema zod:

```ts
const esquema = z.object({
  codigo: z.string().trim().min(1, 'Informe o código'),
  descricao: z.string().trim().min(5, 'A descrição precisa de ao menos 5 caracteres'),
  unidade_medida: z.string().trim().min(1, 'Informe a unidade de medida'),
  estoque_minimo: z.coerce.number().int().min(0, 'O estoque mínimo não pode ser negativo'),
  estoque_maximo: z.coerce.number().int().positive('O estoque máximo deve ser maior que zero'),
  lead_time_compra: z.coerce.number().int().positive('O lead time deve ser maior que zero'),
  fornecedor_padrao_id: z.string().default(''),
  ativo: z.enum(['true', 'false']),
});
```

No envio, `fornecedor_padrao_id` vira `valores.fornecedor_padrao_id === '' ? null : Number(valores.fornecedor_padrao_id)`.

A lista de fornecedores da seleção vem de uma consulta própria dentro de `FormularioPeca`:

```ts
const fornecedores = useQuery({
  queryKey: ['fornecedores', 'selecao'],
  queryFn: () =>
    listar<Fornecedor>('fornecedores', {
      pagina: 1,
      limite: 200,
      ordenar_por: 'razao_social',
      ordem: 'asc',
      busca: '',
      filtro_ativo: true,
    }),
});
```

`limite: 200` é o teto que `consulta.Analisar` aceita. Se a base passar disso, troque a `Selecao` por um campo de busca — não aumente o limite.

- [ ] **Step 2: Escrever o teste de `PartesPecas` (falhando)**

Copiar a estrutura de `Fornecedores.test.tsx`, adaptando os dados e as asserções. Os dez casos são os mesmos: esqueleto, vazio, dados formatados, erro com nova tentativa, operador sem escrita, cadastrar com toast, 400 com detalhes, 409 com alerta, editar preenchido, inativar com confirmação.

O item de teste:

```ts
const peca = {
  id: 1,
  codigo: 'CON-001',
  descricao: 'Conector RCA macho',
  unidade_medida: 'und',
  estoque_minimo: 50,
  estoque_maximo: 500,
  fornecedor_padrao_id: null,
  lead_time_compra: 7,
  ativo: true,
  created_at: '2026-08-29T12:00:00Z',
  updated_at: '2026-08-29T12:00:00Z',
};
```

O `beforeEach` precisa responder também à consulta de fornecedores da seleção:

```ts
servidor.responder([
  { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([peca]) },
  { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
]);
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/paginas/cadastros/PartesPecas.test.tsx`

Expected: FAIL — `Failed to resolve import "./PartesPecas"`.

- [ ] **Step 4: Implementar o formulário e a tela**

Seguindo `FormularioFornecedor.tsx` e `Fornecedores.tsx` como molde, com as diferenças da tabela acima.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd frontend && npm test -- src/paginas/cadastros/PartesPecas.test.tsx`

Expected: PASS — 10 testes.

- [ ] **Step 6: Registrar a rota e commitar**

```tsx
<Route path="/partes-pecas" element={<PartesPecas />} />
```

Run: `cd frontend && npm test && npm run lint`

```bash
git add frontend/src/paginas/cadastros frontend/src/lib/errosDeFormulario.ts frontend/src/App.tsx
git commit -m "feat(frontend): tela de partes e pecas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 17: Tela de Produtos Acabados

**Files:**
- Create: `frontend/src/paginas/cadastros/FormularioProduto.tsx`
- Create: `frontend/src/paginas/cadastros/ProdutosAcabados.tsx`
- Create: `frontend/src/paginas/cadastros/ProdutosAcabados.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: tudo das tarefas 1 a 12, mais `useCadastroCrud` de `@/hooks/useCadastroCrud` (Task 15b). A tela **não** repete a máquina de estado: usa o hook.
- Produces: `ProdutosAcabados` de `@/paginas/cadastros/ProdutosAcabados`; `FormularioProduto` e `type CorpoProduto`.

**Estrutura idêntica à Task 15.** O que muda:

| Item | Valor |
|---|---|
| Recurso | `'produtos-acabados'` |
| Coluna padrão | `'codigo'` |
| Título / subtítulo | "Produtos acabados" / "O que é vendido ao cliente." |
| Rótulo da busca | "Buscar por código ou descrição" |
| Vazio | "Nenhum produto acabado cadastrado. Cadastre o primeiro para começar." |
| Botão | "Novo produto" |
| Mensagens | `{ criado: 'Produto cadastrado', atualizado: 'Produto atualizado', inativado: 'Produto inativado' }` |
| Confirmação | "Inativar o produto RAD-001? Ele deixa de aparecer nas listas de seleção. O histórico é preservado." |

Colunas: Código (`codigo`, ordenável, `font-mono`), Descrição (`descricao`, ordenável), Unidade (não ordenável), Preço de venda (`preco_venda`, ordenável, à direita, `formatarMoeda`), Lead time (`lead_time_producao`, ordenável, à direita, `formatarDias`), Situação (badge).

Campos do formulário: código\* (`tipoDado="codigo"`), descrição\*, unidade\*, preço de venda\* (`tipoDado="quantidade"`, `step="0.01"`), lead time de produção\* (`tipoDado="quantidade"`), situação.

O schema zod:

```ts
const esquema = z.object({
  codigo: z.string().trim().min(1, 'Informe o código'),
  descricao: z.string().trim().min(5, 'A descrição precisa de ao menos 5 caracteres'),
  unidade_medida: z.string().trim().min(1, 'Informe a unidade de medida'),
  preco_venda: z.coerce.number().positive('O preço de venda deve ser maior que zero'),
  lead_time_producao: z.coerce.number().int().positive('O lead time deve ser maior que zero'),
  ativo: z.enum(['true', 'false']),
});
```

`preco_venda` vai para a API como número decimal (`5000` ou `5000.5`); o backend aceita número ou texto e recusa mais de duas casas. Não formate como moeda no envio — a formatação é só de exibição.

- [ ] **Step 1: Escrever o teste (falhando)**

Mesma estrutura de `Fornecedores.test.tsx`, com o item:

```ts
const produto = {
  id: 1,
  codigo: 'RAD-001',
  descricao: 'Radar de trânsito fixo',
  unidade_medida: 'und',
  preco_venda: 5000,
  lead_time_producao: 15,
  ativo: true,
  created_at: '2026-08-29T12:00:00Z',
  updated_at: '2026-08-29T12:00:00Z',
};
```

E a asserção de formatação:

```ts
expect(await screen.findByText('R$\u00a05.000,00')).toBeInTheDocument();
expect(screen.getByText('15 dias')).toBeInTheDocument();
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npm test -- src/paginas/cadastros/ProdutosAcabados.test.tsx`

Expected: FAIL — `Failed to resolve import "./ProdutosAcabados"`.

- [ ] **Step 3: Implementar o formulário e a tela**

Seguindo o molde da Task 15 com as diferenças da tabela acima.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npm test -- src/paginas/cadastros/ProdutosAcabados.test.tsx`

Expected: PASS — 10 testes.

- [ ] **Step 5: Registrar a rota e commitar**

```tsx
<Route path="/produtos-acabados" element={<ProdutosAcabados />} />
```

Run: `cd frontend && npm test && npm run lint`

```bash
git add frontend/src/paginas/cadastros frontend/src/App.tsx
git commit -m "feat(frontend): tela de produtos acabados

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 18: Verificação final

**Files:** nenhum arquivo novo. Esta tarefa é a checagem antes de considerar a entrega pronta.

- [ ] **Step 1: Suíte, lint e build**

```bash
cd frontend
npm test
npm run lint
npm run build
```

Expected: os três verdes. O `build` roda `tsc -b` antes do Vite, então um import não usado ou um tipo errado aparecem aqui mesmo que o teste passe.

- [ ] **Step 2: Subir o ambiente**

```bash
docker compose up -d postgres
cd backend && go run ./cmd/api &
cd frontend && npm run dev
```

Login: `admin` / `Admin@123`.

- [ ] **Step 3: Exercitar as três telas no navegador**

Em cada uma (`/fornecedores`, `/partes-pecas`, `/produtos-acabados`):

1. cadastrar um registro válido — confirma o toast e o registro na lista;
2. cadastrar o mesmo de novo — confirma o 409 no alerta do modal, com o modal aberto;
3. cadastrar sem um campo obrigatório — confirma o erro marcado no campo;
4. buscar por um trecho — confirma que a lista filtra;
5. clicar em dois cabeçalhos diferentes — confirma a inversão e a troca de coluna;
6. editar um registro — confirma o modal preenchido e o toast de atualização;
7. inativar — confirma a pergunta antes da chamada e o sumiço da lista de ativos;
8. trocar a situação para "Todos" — confirma o registro inativo com o badge cinza.

Em `/fornecedores`, cadastre com CNPJ pontuado (`11.222.333/0001-81`) e confirme que a lista exibe pontuado.

- [ ] **Step 4: Checagem do §8.4 do design system**

1. **Escala de cinza** — no DevTools, Rendering → Emulate vision deficiencies → Achromatopsia. Percorra as três telas: nenhuma informação pode sumir. Os badges precisam continuar legíveis pelo ícone e pelo texto.
2. **Só teclado** — Tab da barra de filtros até a última ação da tabela, abra o modal, preencha, salve e feche, tudo sem mouse. O foco tem que ser visível em todo ponto e voltar ao gatilho ao fechar o modal.
3. **Largura** — 1280 px e ~800 px (tablet). A tabela rola dentro do próprio contêiner; a página não rola na horizontal.

- [ ] **Step 5: Tirar um acessório**

Olhe cada tela e remova o elemento que menos serve à decisão de quem a usa. O design system pede isso explicitamente antes de entregar.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "chore(frontend): ajustes da revisao visual das telas de cadastro

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

## Notas de revisão do plano

**Tarefas 16 e 17 são delta, não código completo.** Repetir as ~200 linhas de `Fornecedores.tsx` mais duas vezes tornaria este documento pior, não melhor: o que muda está na tabela de diferenças, no schema zod e nos dados de teste, e é isso que o implementador precisa. Abra `Fornecedores.tsx` e `FormularioFornecedor.tsx` lado a lado ao fazer essas duas tarefas — eles são o molde literal.

**`z.coerce.number()` e a tipagem do `react-hook-form`.** Campos numéricos chegam do `<input>` como texto, e `z.input<typeof esquema>` tipa o campo coagido como `unknown`. Se o `register('lead_time_medio')` reclamar, tipe o formulário como um objeto de strings e converta no `aoEnviar`:

```ts
type Formulario = {
  razao_social: string;
  cnpj: string;
  lead_time_medio: string;
  // …
};
```

com `resolver: zodResolver(esquema)` mantido. Não troque o resolver nem remova a validação para calar o TypeScript.

**A `Selecao` aceita `placeholder`** (primeira opção vazia). Está na implementação da Task 8, mas não na lista de `Produces` — a Task 16 depende dela para "Sem fornecedor padrão".

**A Task 13 registra rotas que só existem a partir da Task 15.** Se as tarefas forem executadas na ordem, faça o Step 6 da Task 13 apenas para `/` e deixe as três rotas de cadastro para os passos finais das tarefas 15, 16 e 17, onde cada uma registra a sua. `tsc` quebra com import de arquivo inexistente.

**Contagem de testes esperada ao fim:** 4 (Badge) + 7 (Paginacao) + 11 (Tabela) + 6 (Modal) + 4 (Confirmacao) + 6 (Toast) + 5 (Selecao) + 6 (BarraDeFiltros) + 3 (useDebounce) + 5 (useListagem) + 4 (useMutacoes) + 11 (lib) + 4 (Navegacao) + 6 (Painel) + 8 (servico) + 30 (três telas) = **120 testes novos**, somados aos que já existem.
