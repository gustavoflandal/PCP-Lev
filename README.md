# Sistema PCP 3PL

Planejamento e Controle da Produção para montagem de painéis eletrônicos e radares
de trânsito. Substitui o acompanhamento manual em Excel, integrando cadastros,
compras, estoque, produção e expedição.

A especificação completa está em [docs/](docs/). O desenvolvimento segue a ordem do
[cronograma técnico](docs/6_CRONOGRAMA_TECNICO.md).

---

## Stack

| Camada   | Tecnologia                                              |
| -------- | ------------------------------------------------------- |
| Frontend | React 18 · TypeScript · Vite · Tailwind · TanStack Query |
| Backend  | Go 1.25 · Echo · pgx                                    |
| Banco    | PostgreSQL 16                                           |
| Testes   | Vitest + Testing Library · testify                      |
| Deploy   | Docker + Docker Compose                                 |

---

## Como rodar

### 1. Variáveis de ambiente

```bash
cp .env.example .env
```

Em produção, troque `JWT_SECRET` e a senha do banco.

### 2. Banco de dados

```bash
docker compose up -d postgres
```

O Postgres sobe na porta **5442** do host (a 5432 costuma estar ocupada por outro
projeto local). As migrations são aplicadas automaticamente pela API na subida.

### 3. Backend

```bash
cd backend
go run ./cmd/api
```

API em <http://localhost:8000>. Verificação rápida:

```bash
curl http://localhost:8000/api/v1/saude
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Interface em <http://localhost:5173>.

### Tudo junto, em containers

```bash
docker compose up -d --build
```

Frontend na porta **3010**, API na **8000**.

---

## Acesso inicial

| Usuário | Senha       | Perfil |
| ------- | ----------- | ------ |
| `admin` | `Admin@123` | ADMIN  |

Criado pela migration `008_dados_iniciais.sql`. **Troque a senha antes de
qualquer ambiente que não seja o seu.**

---

## Testes

```bash
# Backend (precisa do Postgres no ar; usa o banco pcp_db_test)
cd backend && go test ./...

# Frontend
cd frontend && npm test
cd frontend && npm run test:cobertura
```

O banco de testes é criado uma vez:

```bash
docker exec pcp_postgres psql -U pcp_user -d postgres -c "CREATE DATABASE pcp_db_test OWNER pcp_user;"
```

Cada teste roda em um schema exclusivo, então a suíte pode rodar em paralelo.

---

## Estrutura

```
backend/
├── cmd/api/                 # ponto de entrada
├── internal/
│   ├── api/                 # rotas, handlers, middleware
│   ├── domain/              # entidades e casos de uso (DDD)
│   ├── infra/               # PostgreSQL, repositórios, migrations
│   ├── platform/httpx/      # envelope de resposta e validação
│   └── testsupport/         # apoio aos testes com banco real
frontend/
├── src/
│   ├── componentes/ui/      # Botao, Campo, Cartao, ícones
│   ├── componentes/layout/  # Shell, Cabecalho, RotaProtegida
│   ├── paginas/             # telas
│   ├── servicos/            # cliente HTTP e chamadas de API
│   ├── store/               # estado global (Zustand)
│   └── estilos/             # tokens do sistema de design
docs/                        # especificação do projeto
```

---

## Progresso

| Fase                        | Situação    |
| --------------------------- | ----------- |
| Sprint 1 — Fundação         | ✅ concluída |
| Sprint 2 — Cadastros base   | em aberto   |
| Sprint 3–5 — Compras        | em aberto   |
| Sprint 6–8 — Produção       | em aberto   |
| Sprint 9–10 — Testes e UAT  | em aberto   |

**Sprint 1 entregue:** ambiente Docker, schema completo do doc 2 em 8 migrations,
autenticação JWT com perfis, envelope de API do doc 3, componentes base do sistema
de design, tela de login e encerramento de sessão por inatividade (RNF3).
