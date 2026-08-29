# Catálogo `.claude` — PCP-Lev

Agentes e skills selecionados para a stack do projeto
(Go 1.25 · Echo · pgx/v5 · PostgreSQL 16 · React 18 · TypeScript · Vite · Tailwind · TanStack Query).

## Skills (`.claude/skills/`)

| Skill | Quando usar |
| --- | --- |
| `pcp-design-system` | **Sempre** antes de criar ou alterar qualquer tela. Tokens, densidade, estados semânticos, acessibilidade. |
| `golang-pro` | Backend Go: concorrência, generics, interfaces, estrutura de pacotes, testes. |
| `postgres-pro` | Postgres 16: EXPLAIN, índices, JSONB, VACUUM, replicação. |
| `sql-pro` | Escrita e tuning de consultas, CTEs, window functions, modelagem. |
| `react-expert` | Componentes, hooks, Suspense, performance de render, estado. |
| `typescript-pro` | Tipos avançados, generics, type guards, segurança de tipos ponta a ponta. |
| `test-master` | Estratégia de testes, unitários, integração, cobertura (testify + Vitest). |
| `api-designer` | Desenho de recursos REST, versionamento, paginação, padrão de erros. |
| `debugging-wizard` | Investigação de erro, stack trace, análise de log, causa raiz. |
| `security-reviewer` | Auditoria de segurança, SAST, revisão de JWT/bcrypt e superfície da API. |
| `devops-engineer` | Docker, Docker Compose, pipelines de CI, infraestrutura. |

Cada skill traz uma seção **Contexto do projeto PCP-Lev** no fim do `SKILL.md`, com os
caminhos, portas e convenções reais do repositório.

## Agentes (`.claude/agents/`)

| Agente | Papel |
| --- | --- |
| `backend-architect` | Desenho de serviços e APIs, fronteiras de domínio, resiliência. |
| `architect-review` | Verifica se a mudança respeita a arquitetura em camadas do projeto. |
| `code-reviewer` | Revisão de qualidade, segurança e confiabilidade de diffs. |
| `security-auditor` | Auditoria de autenticação, autorização e vulnerabilidades. |
| `database-architect` | Modelagem de dados, escolha de estruturas, plano de migração. |
| `database-optimizer` | Query lenta, plano de execução, índices, particionamento. |
| `frontend-developer` | Implementação de UI React/TS seguindo o design system. |
| `test-automator` | Construção e manutenção de suítes de teste. |
| `performance-engineer` | Gargalos de latência, throughput e bundle. |
| `error-detective` | Correlação de erros e padrões em logs. |

## Origem

Selecionados de `D:\Claude Plugins`:

- **skills** → `claude-skills/skills` (formato `SKILL.md` + `references/`, licença MIT).
- **agentes** → `agents/plugins/*/agents` (o prefixo do plugin foi removido do campo `name`
  e o contexto do projeto foi acrescentado a cada `description`).
