# Guia de Implementação - Sistema PCP 3PL

**Versão**: 1.0  
**Data**: Agosto 2026  
**Stack**: React + Golang/Rust + PostgreSQL + Docker

---

## 📋 Índice

1. [Stack Tecnológico](#stack-tecnológico)
2. [Estrutura de Pastas](#estrutura-de-pastas)
3. [Padrões de Código](#padrões-de-código)
4. [Arquitetura](#arquitetura)
5. [Convenções](#convenções)
6. [Testing](#testing)
7. [Deployment](#deployment)

---

## Stack Tecnológico

### Frontend

- **Framework**: React 18+ com TypeScript
- **UI Library**: Tailwind CSS + shadcn/ui
- **State Management**: Redux Toolkit ou Zustand
- **HTTP Client**: Axios + TanStack Query
- **Validação**: Zod + React Hook Form
- **Dev Tools**: Vite, ESLint, Prettier

### Backend

- **Linguagem**: Golang 1.21+ OR Rust 1.70+
- **Framework Golang**: Echo (lightweight) ou Gin
- **Framework Rust**: Actix-web ou Axum
- **ORM**: sqlc (Go) ou Diesel (Rust)
- **Auth**: JWT (golang-jwt)
- **Validation**: validator (Go) ou Validator (Rust)
- **Logging**: slog (Go) ou log (Rust)
- **Testes**: testify (Go) ou standard (Rust)

### Banco de Dados

- **SGBD**: PostgreSQL 14+
- **Migrations**: Flyway ou Liquibase
- **Connection Pool**: pgx (Go) ou sqlx (Rust)

### DevOps

- **Containerização**: Docker + Docker Compose
- **Orquestração**: Kubernetes (opcional)
- **CI/CD**: GitHub Actions / GitLab CI
- **Monitoring**: Prometheus + Grafana (opcional)

---

## Estrutura de Pastas

### Frontend

```
frontend/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   ├── common/          # Botões, inputs, cards
│   │   ├── forms/           # Formulários
│   │   ├── tables/          # Tabelas
│   │   └── kanban/          # Quadro Kanban
│   │
│   ├── pages/               # Páginas (rotas)
│   │   ├── Dashboard.tsx
│   │   ├── ProdutosAcabados.tsx
│   │   ├── Estoque.tsx
│   │   ├── Compras.tsx
│   │   ├── Producao.tsx
│   │   └── Vendas.tsx
│   │
│   ├── services/            # Chamadas de API
│   │   ├── api.ts           # Configuração Axios
│   │   ├── produtosService.ts
│   │   ├── estoqueService.ts
│   │   ├── comprasService.ts
│   │   ├── producaoService.ts
│   │   └── vendasService.ts
│   │
│   ├── store/               # Estado global
│   │   ├── slices/
│   │   │   ├── authSlice.ts
│   │   │   ├── produtosSlice.ts
│   │   │   └── ...
│   │   └── index.ts
│   │
│   ├── hooks/               # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useProdutos.ts
│   │   └── ...
│   │
│   ├── utils/               # Funções utilitárias
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   │
│   ├── types/               # Types TypeScript
│   │   ├── produto.ts
│   │   ├── estoque.ts
│   │   ├── compra.ts
│   │   └── ...
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .prettierrc
```

### Backend (Golang)

```
backend/
├── cmd/
│   └── api/
│       └── main.go          # Entry point
│
├── internal/
│   ├── api/
│   │   ├── routes.go
│   │   ├── middleware/
│   │   │   ├── auth.go
│   │   │   └── logging.go
│   │   └── handlers/
│   │       ├── produtos.go
│   │       ├── estoque.go
│   │       ├── compras.go
│   │       ├── producao.go
│   │       └── vendas.go
│   │
│   ├── domain/              # Lógica de negócio (DDD)
│   │   ├── produto/
│   │   ├── estoque/
│   │   ├── compra/
│   │   ├── producao/
│   │   └── venda/
│   │
│   ├── infra/               # Camada de dados
│   │   ├── db/
│   │   │   ├── postgres.go
│   │   │   └── migrations/
│   │   └── repository/
│   │       ├── produto_repo.go
│   │       ├── estoque_repo.go
│   │       └── ...
│   │
│   └── config/
│       └── config.go
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── go.mod
├── go.sum
├── Dockerfile
└── docker-compose.yml
```

---

## Padrões de Código

### TypeScript (Frontend)

```typescript
// ✅ BOM - Component Structure
const ProdutosPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { produtos, loading, error } = useAppSelector(selectProdutos);
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchProdutos({ page, limit: 50 }));
  }, [page, dispatch]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Produtos Acabados</h1>
      <ProdutosTable 
        data={produtos}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      <Pagination 
        page={page}
        onPageChange={setPage}
      />
    </div>
  );
};

export default ProdutosPage;
```

### Golang (Backend)

```go
// ✅ Handler com validação
func (h *ProdutoHandler) CreateProduto(c echo.Context) error {
  var req CreateProdutoRequest
  
  if err := c.Bind(&req); err != nil {
    return c.JSON(http.StatusBadRequest, ErrorResponse{
      Sucesso: false,
      Erro: ErrorDetail{
        Codigo: "ERRO_VALIDACAO",
        Mensagem: "Dados inválidos",
      },
    })
  }

  // Validar
  if err := req.Validate(); err != nil {
    return c.JSON(http.StatusBadRequest, ErrorResponse{
      Sucesso: false,
      Erro: ErrorDetail{
        Codigo: "ERRO_VALIDACAO",
        Detalhes: err.Details(),
      },
    })
  }

  // Usar caso de uso
  produto, err := h.createProdutoUC.Execute(c.Request().Context(), req)
  if err != nil {
    return handleError(c, err)
  }

  return c.JSON(http.StatusCreated, SuccessResponse{
    Sucesso: true,
    Dados: produto,
  })
}
```

---

## Arquitetura

### DDD (Domain-Driven Design) no Backend

```
Domain Layer (Lógica de Negócio)
  ├── Entities: Produto, Estoque, OP, etc
  ├── Value Objects: Quantidade, Status, etc
  ├── Repositories: Interfaces
  └── Services: Casos de uso

Application Layer
  ├── Use Cases: CreateProduto, ReservarEstoque, etc
  ├── DTOs: Request/Response
  └── Mappers: Entity → DTO

Infrastructure Layer
  ├── DB: PostgreSQL
  ├── Repository Implementations
  └── External Services

API Layer
  ├── Handlers/Controllers
  ├── Middleware
  └── Routes
```

### Padrão de Resposta

```typescript
// Success
interface SuccessResponse<T> {
  sucesso: true;
  dados: T;
  mensagem?: string;
  paginacao?: {
    pagina: number;
    limite: number;
    total: number;
    total_paginas: number;
  };
}

// Error
interface ErrorResponse {
  sucesso: false;
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: Array<{
      campo: string;
      mensagem: string;
    }>;
  };
}
```

---

## Convenções

### Nomenclatura

- **Tabelas**: snake_case (produtos_acabados, partes_pecas)
- **Colunas**: snake_case (produto_acabado_id, data_criacao)
- **Variáveis**: camelCase (produtoId, dataCriacao)
- **Constantes**: UPPER_SNAKE_CASE (ESTOQUE_MINIMO)
- **Funções/Métodos**: camelCase (criarProduto, atualizarEstoque)
- **Classes/Types**: PascalCase (Produto, EstoqueService)

### Commits Git

```
feat: adicionar cadastro de produtos acabados
fix: corrigir cálculo de estoque reservado
refactor: reorganizar estrutura de pastas
docs: atualizar API de compras
test: adicionar testes para Kanban
chore: atualizar dependências
```

### Code Comments

```typescript
// ✅ Bom: Explica o porquê
// Se saldo insuficiente, não permitir OP para evitar
// problemas na linha de montagem
if (saldo < necessario) {
  throw new InsufficientStockError();
}

// ❌ Ruim: Óbvio demais
// Verificar se saldo >= necessario
if (saldo >= necessario) {
  // ...
}
```

---

## Testing

### Frontend (Vitest + React Testing Library)

```typescript
describe("ProdutosPage", () => {
  it("deve listar produtos com paginação", async () => {
    const { getByText, getByRole } = render(<ProdutosPage />);
    
    await waitFor(() => {
      expect(getByText("VMS-01")).toBeInTheDocument();
    });
  });

  it("deve filtrar por código", async () => {
    const { getByPlaceholderText } = render(<ProdutosPage />);
    const input = getByPlaceholderText("Filtrar...");
    
    fireEvent.change(input, { target: { value: "VMS" } });
    
    await waitFor(() => {
      expect(getByText("VMS-01")).toBeInTheDocument();
    });
  });
});
```

### Backend (Testify - Go)

```go
func TestCreateProduto(t *testing.T) {
  // Setup
  repo := &MockProdutoRepository{}
  uc := NewCreateProdutoUseCase(repo)
  
  // Execute
  req := CreateProdutoRequest{
    Codigo: "VMS-01",
    Descricao: "Painel VMS",
  }
  
  result, err := uc.Execute(context.Background(), req)
  
  // Assert
  assert.NoError(t, err)
  assert.Equal(t, "VMS-01", result.Codigo)
  assert.True(t, repo.SaveCalled)
}
```

### Cobertura Mínima

- Frontend: 80% de cobertura
- Backend: 85% de cobertura
- Testes de integração: 100% dos fluxos críticos

---

## Deployment

### Docker Compose (Desenvolvimento)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_USER: pcp_user
      POSTGRES_PASSWORD: senha_segura
      POSTGRES_DB: pcp_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: pcp_user
      DB_PASSWORD: senha_segura
      DB_NAME: pcp_db
      JWT_SECRET: seu_secret_aqui
    ports:
      - "8000:8000"
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### CI/CD (GitHub Actions)

```yaml
name: CI/CD

on: [push, pull_request]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      - run: go test ./...

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run build

  deploy:
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and Push Docker
        run: docker build -t pcp-sistema:latest .
      - name: Deploy to Server
        run: ssh user@server "docker pull pcp-sistema && docker-compose up -d"
```

---

## Variáveis de Ambiente

```env
# Backend
DB_HOST=localhost
DB_PORT=5432
DB_USER=pcp_user
DB_PASSWORD=senha_segura
DB_NAME=pcp_db

JWT_SECRET=sua_chave_super_secreta_aqui
JWT_EXPIRE_HOURS=24

API_PORT=8000
API_ENV=development

LOG_LEVEL=info

# Frontend
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_NAME=Sistema PCP
```

---

**Data de Revisão**: Setembro 2026

