# RBAC — Perfis e Permissões — Design (Fase 2.2a)

Referência: `docs/0_SUMARIO_EXECUTIVO.md` §4.7.3 e `docs/6_CRONOGRAMA_TECNICO.md` Fase 2.2.
A matriz definitiva dependia de uma sessão com o Gestor de Operações. **Decisão do
usuário (24/10/2026)**: construir o mecanismo com a matriz proposta abaixo; o Gestor
ajusta depois **pela própria tela**, sem mudar código.

A Fase 2.2 sai em duas entregas empilhadas:

- **2.2a (esta spec)**: perfis, catálogo de permissões, matriz editável, autorização por
  permissão em todo endpoint e interface guiada por permissão.
- **2.2b**: gestão de usuários (cadastro, campos estendidos do §4.7.3, situação, permissões
  individuais com justificativa, redefinição de senha, efeito imediato de troca de perfil).

## 1. Modelo

- `perfis` (`id`, `codigo` único, `nome`, `descricao`, `sistema`): os 8 perfis do §4.7.3
  semeados como `sistema = true` (não podem ser excluídos) e perfis **personalizados** criados
  pelo Administrador.
- `permissoes` (`codigo` = `modulo.acao`, `modulo`, `acao`, `descricao`, `sensivel`,
  `ordem`): **catálogo fixo**, semeado pela migration e espelhado em código Go (um teste
  garante que os dois batem). Só entra permissão que algum endpoint aplica.
- `perfil_permissoes` (`perfil_codigo`, `permissao_codigo`).
- `usuarios.perfil` passa a referenciar `perfis.codigo` (sai o `CHECK` dos 3 perfis).
- **Administrador**: tem sempre todas as permissões, inclusive as que forem criadas no
  futuro; não aparece editável na matriz. Garante que ninguém tranca o sistema para fora.
- Trilha de auditoria em `perfis` e `perfil_permissoes`.

## 2. Catálogo (o que cada permissão libera)

| Módulo | Ações |
|---|---|
| `fornecedores`, `partes_pecas`, `produtos` | `visualizar`, `incluir`, `editar`, `inativar` |
| `estrutura` (BOM) | `visualizar`, `incluir` (criar e nova versão) |
| `cotacoes` | `visualizar`, `incluir`, `editar` (inclui enviar e registrar resposta), `cancelar`, `converter` (em pedido de compra) |
| `pedidos_compra` | `visualizar`, `incluir`, `editar`, `emitir`, **`emitir_acima_alcada`** (sensível), `cancelar`, `receber`, `exportar` |
| `estoque` | `visualizar` (saldo, críticos, movimentações), **`ajustar`** (sensível — "ajustar saldo manualmente", §4.7.3), `exportar` |
| `necessidade_compra` | `visualizar` |
| `configuracoes` | `empresa`, `regional`, `negocio`, `integracoes`, `banco`, `auditoria`, `auditoria_exportar`, **`perfis`** (sensível — editar esta matriz) |

As leituras de Dados da empresa, Parâmetros regionais e Parâmetros de negócio continuam
abertas a qualquer usuário autenticado (o resto do sistema depende delas).

## 3. Matriz proposta (provisória — para validação com o Gestor de Operações)

| Perfil (código) | Pode |
|---|---|
| Administrador (`ADMIN`) | Tudo, sempre. |
| Gestor de Operações / PCP (`GESTOR`) | Todos os módulos operacionais por completo (cadastros, BOM, cotações, pedidos de compra até a alçada, recebimento, estoque inclusive ajuste, exportações) + auditoria. Sem integrações, banco e matriz de perfis ("sem acesso a credenciais técnicas"). |
| Comprador (`COMPRADOR`) | Fornecedores (completo), cotações (completo), pedidos de compra (incluir, editar, emitir até a alçada, cancelar, exportar), necessidade de compra; visualiza peças, produtos e estoque. |
| Almoxarife (`ALMOXARIFE`) | Recebimento de pedidos de compra, estoque (visualizar, ajustar, exportar); visualiza fornecedores, peças, produtos, pedidos e necessidade de compra. |
| Operador de Montagem (`OPERADOR`) | Visualiza produtos, peças, estrutura (BOM) e estoque. (Apontamento e refugo chegam na Fase 3.) |
| Qualidade (`QUALIDADE`) | Visualiza produtos, peças, estrutura, fornecedores e estoque. (Testes e não conformidades chegam na Fase 3.) |
| Vendas (`VENDAS`) | Visualiza produtos, estrutura e estoque (disponibilidade). (Pedidos de venda chegam na Fase 3.) |
| Consulta (`CONSULTA`) | Visualiza tudo que é operacional e exporta relatórios; não altera nada. |

**Mudança de comportamento registrada**: o `OPERADOR` atual (somente leitura de tudo)
passa a ser o Operador de Montagem do §4.7.3, com escopo menor. O único usuário real na base
hoje é o `admin`, então nenhum usuário perde acesso na prática; quem precisar do escopo antigo
recebe o perfil `CONSULTA`.

## 4. Aplicação

- Middleware `ExigirPermissao("modulo.acao")` substitui `ExigirPerfil` em todos os
  handlers. Permissões efetivas = matriz do perfil do token (cache em memória, invalidado a
  cada alteração de perfil feita por este processo).
- Alçada de emissão de PC (sub-entrega 4 da Fase 4): deixa de ser "não é ADMIN" e passa a
  ser a permissão `pedidos_compra.emitir_acima_alcada`.
- `POST /auth/login` e `GET /auth/eu` devolvem `permissoes: [...]`. O frontend decide menu,
  botões e telas por permissão (`pode('fornecedores.incluir')`), nunca por código de perfil,
  e atualiza a sessão ao abrir o sistema (a matriz pode ter mudado desde o login).
- **Limitação conhecida, resolvida na 2.2b**: o perfil vem do token; trocar o perfil de um
  usuário só vale no próximo login dele (até 8 h).

## 4.1 Decisões após a revisão de código

- **Quem edita perfis não vira ADMIN**: ninguém edita o **próprio** perfil, e só concede
  permissões que o próprio perfil tem (manter ou retirar o que o perfil editado já tinha é
  livre). O Administrador tem tudo, então não é afetado; um Gestor que receba
  `configuracoes.perfis` não consegue se dar integrações, alçada etc.
- **Cache**: contador de geração (uma leitura iniciada antes de uma edição não regrava o
  conjunto antigo) + validade de 60 s como rede de segurança para mudanças fora do processo.
  **Restrição de implantação**: com mais de uma réplica da API, uma edição leva até 60 s para
  valer nas outras.
- `cotacoes.converter` também exige `pedidos_compra.incluir` (converter cria um PC).
- Trilha de `perfis` e `perfil_permissoes` filtrável na tela de Auditoria.
- No frontend, a sincronização da sessão é por usuário e o cache de consultas é descartado
  no logout (terminal compartilhado).

## 5. API (permissão `configuracoes.perfis`)

- `GET /acesso/permissoes` — catálogo.
- `GET /acesso/perfis`, `GET /acesso/perfis/:codigo` — perfis com suas permissões e a
  quantidade de usuários.
- `POST /acesso/perfis` — cria perfil personalizado (`codigo`, `nome`, `descricao`,
  `permissoes`).
- `PUT /acesso/perfis/:codigo` — nome, descrição e permissões (o conjunto inteiro).
  `ADMIN` → 409.
- `DELETE /acesso/perfis/:codigo` — só personalizado e sem usuários → senão 409.

## 6. Plano (uma task = um commit)

- **B1** Migration 014 (tabelas, seed dos perfis, catálogo e matriz) + domínio `acesso`
  (catálogo em Go, validação, serviço com cache) + repositório + teste "catálogo do banco =
  catálogo do código".
- **B2** Middleware `ExigirPermissao` + permissões no login/`/auth/eu` + migração de todos os
  handlers e testes + alçada por permissão.
- **B3** Endpoints `/acesso/*`.
- **F1** Sessão com permissões + `pode()` + troca de todas as checagens por perfil +
  atualização da sessão ao abrir.
- **F2** Tela "Perfis e permissões" (matriz).
- **F3** Verificação final.
