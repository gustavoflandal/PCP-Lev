# Cronograma Técnico - Sistema PCP 3PL

**Versão**: 1.0  
**Data**: Agosto 2026  
**Duração Total**: 13-18 semanas (3-4 meses)  
**Modelo**: Agile (Sprints de 2 semanas)

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Fase 1: Fundação](#fase-1-fundação-sprint-1-2)
3. [Fase 2: Compras](#fase-2-compras-sprint-3-5)
4. [Fase 3: Produção](#fase-3-produção-sprint-6-8)
5. [Fase 4: Testes e Otimizações](#fase-4-testes-e-otimizações-sprint-9-10)
6. [Dependências e Riscos](#dependências-e-riscos)

---

## Visão Geral

```
Semana 1-2:   Fundação (BD, Cadastros Base)
             │
Semana 3-5:   Compras (Cotações, PCs, Recebimento)
             │
Semana 6-8:   Produção (OPs, Kanban, Apontamentos)
             │
Semana 9-10:  Testes, Relatórios, Otimizações
             │
Semana 11-13: UAT, Treinamento, Deploy
```

---

## Fase 1: Fundação (Sprint 1-2)

**Duração**: 4 semanas  
**Objetivo**: Estrutura base, BD, e cadastros simples  
**Status**: Crítico (bloqueador para outras fases)

### Sprint 1: Infraestrutura e Banco de Dados

**Semana 1**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| Setup inicial (repos, Docker, CI/CD) | DevOps | 2d | 🔵 |
| Criar estrutura de pastas (BE/FE) | Lead Dev | 1d | 🔵 |
| Configurar PostgreSQL e migrations | Backend | 2d | 🔵 |
| Implementar migrations de schema | Backend | 1d | 🔵 |
| Setup React + TypeScript + Vite | Frontend | 1d | 🔵 |
| Criar componentes base (Button, Input, Card) | Frontend | 1d | 🔵 |

**Semana 2**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| Implementar autenticação JWT (BE) | Backend | 2d | 🔵 |
| Implementar login page (FE) | Frontend | 1d | 🔵 |
| Criar middleware de auth (BE) | Backend | 1d | 🔵 |
| Testes unitários de auth | Backend | 1d | 🔵 |

**Deliverables**:
- ✅ Ambiente de dev funcionando (Docker Compose)
- ✅ PostgreSQL com schema initial
- ✅ Autenticação JWT implementada
- ✅ Login page funcional

### Sprint 2: Cadastros Base

**Semana 3**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| API CRUD Produtos Acabados | Backend | 2d | 🔵 |
| API CRUD Partes/Peças | Backend | 2d | 🔵 |
| Testes de API (CRUD PA/PP) | Backend | 1d | 🔵 |
| Página listagem PA | Frontend | 1d | 🔵 |
| Página listagem PP | Frontend | 1d | 🔵 |

**Semana 4**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| API CRUD Fornecedores | Backend | 1d | 🔵 |
| API CRUD BOM | Backend | 2d | 🔵 |
| Página BOM (criar/editar) | Frontend | 2d | 🔵 |
| Testes de integração BOM | Backend | 1d | 🔵 |
| Dashboard básico (mock data) | Frontend | 1d | 🔵 |

**Deliverables**:
- ✅ Cadastros base CRUD completos (PA, PP, BOM, Fornecedores)
- ✅ Telas de listagem funcionando
- ✅ Validações de negócio implementadas
- ✅ Cobertura de testes > 80%

---

## Fase 2: Compras (Sprint 3-5)

**Duração**: 6 semanas  
**Objetivo**: Sistema completo de compras com PC, cotações, e recebimento  
**Depende de**: Fase 1 ✅

### Sprint 3: Cotações e Pedidos de Compra

**Semana 5**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| API CRUD Cotações | Backend | 2d | 🔵 |
| API gerar Cotação automática | Backend | 1d | 🔵 |
| Página cotações | Frontend | 2d | 🔵 |
| Testes API cotações | Backend | 1d | 🔵 |

**Semana 6**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| API CRUD Pedidos de Compra | Backend | 2d | 🔵 |
| API converter cotação → PC | Backend | 1d | 🔵 |
| Página PCs (listagem/detalhes) | Frontend | 2d | 🔵 |
| Testes API PCs | Backend | 1d | 🔵 |

**Deliverables**:
- ✅ Cotações CRUD
- ✅ Pedidos de Compra CRUD
- ✅ Conversão Cotação → PC

### Sprint 4: Recebimento e Estoque

**Semana 7**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| API Saldo Estoque (read) | Backend | 1d | 🔵 |
| API Movimentação Estoque | Backend | 1d | 🔵 |
| API Registrar Recebimento | Backend | 2d | 🔵 |
| Página Estoque (visualizar saldo) | Frontend | 1d | 🔵 |
| Testes de recebimento (cenários) | Backend | 1d | 🔵 |

**Semana 8**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| Página Recebimento de PC | Frontend | 2d | 🔵 |
| Alertas de estoque crítico | Backend | 1d | 🔵 |
| Widget alertas no Dashboard | Frontend | 1d | 🔵 |
| Testes e-2-e recebimento | QA | 1d | 🔵 |

**Deliverables**:
- ✅ Recebimento de insumos
- ✅ Saldo de estoque real-time
- ✅ Alertas de criticalidade
- ✅ Movimentação auditada

### Sprint 5: Necessidade de Compra e Relatórios

**Semana 9**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| API gerar sugestão de compra | Backend | 2d | 🔵 |
| Página sugestões de compra | Frontend | 1d | 🔵 |
| API Relatório Compras | Backend | 1d | 🔵 |
| Testes sugestão de compra | Backend | 1d | 🔵 |

**Semana 10**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| Relatório Estoque (PDF/CSV) | Backend | 2d | 🔵 |
| Download relatórios | Frontend | 1d | 🔵 |
| Testes de carga (queries estoque) | QA | 1d | 🔵 |
| Code review e refactoring | Team | 1d | 🔵 |

**Deliverables**:
- ✅ Sugestão automática de compras
- ✅ Relatórios de estoque e compras
- ✅ Performance otimizada (queries)

---

## Fase 3: Produção (Sprint 6-8)

**Duração**: 6 semanas  
**Objetivo**: OPs, Kanban, e fluxo de produção  
**Depende de**: Fase 1 ✅, Fase 2 (parcial)

### Sprint 6: OPs e Reserva de Estoque

**Semana 11**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| API CRUD Pedidos de Venda | Backend | 2d | 🔵 |
| Página Pedidos de Venda | Frontend | 2d | 🔵 |
| Testes API Pedidos Venda | Backend | 1d | 🔵 |

**Semana 12**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| API gerar OPs (a partir de PV) | Backend | 2d | 🔵 |
| API Reserva Estoque | Backend | 2d | 🔵 |
| Testes de reserva (cenários) | Backend | 1d | 🔵 |

**Deliverables**:
- ✅ Pedidos de Venda CRUD
- ✅ Geração automática de OPs
- ✅ Reserva de componentes

### Sprint 7: Kanban Visual

**Semana 13**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| API Kanban (GET todas as OPs) | Backend | 1d | 🔵 |
| API mover OP (transição etapa) | Backend | 2d | 🔵 |
| Componente Kanban (React) | Frontend | 2d | 🔵 |
| Testes API Kanban | Backend | 1d | 🔵 |

**Semana 14**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| Funcionalidade drag-drop | Frontend | 1d | 🔵 |
| Histórico de transições | Backend | 1d | 🔵 |
| Visualizar histórico no Kanban | Frontend | 1d | 🔵 |
| Testes e-2-e Kanban | QA | 1d | 🔵 |

**Deliverables**:
- ✅ Kanban funcional com 4 etapas
- ✅ Drag-drop de cartões
- ✅ Histórico de movimentações

### Sprint 8: Finalização e Apontamentos

**Semana 15**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| API finalizar OP | Backend | 2d | 🔵 |
| API Apontamento de Produção | Backend | 1d | 🔵 |
| Página apontamento de tempo | Frontend | 1d | 🔵 |
| Testes finalização OP | Backend | 1d | 🔵 |

**Semana 16**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| API Relatório Produção | Backend | 2d | 🔵 |
| Dashboard Produção (widgets) | Frontend | 1d | 🔵 |
| Testes e-2-e produção | QA | 1d | 🔵 |

**Deliverables**:
- ✅ OPs finalizadas com consumo de estoque
- ✅ Apontamento de produção
- ✅ Relatório de produção

---

## Fase 4: Testes e Otimizações (Sprint 9-10)

**Duração**: 4 semanas  
**Objetivo**: Qualidade, performance, e preparação para produção

### Sprint 9: Testes e Cobertura

**Semana 17**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| Testes unitários (backend cobertura 85%) | Backend | 2d | 🔵 |
| Testes unitários (frontend cobertura 80%) | Frontend | 2d | 🔵 |
| Testes de carga (até 100k OPs) | QA | 1d | 🔵 |

**Semana 18**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| Testes de segurança (OWASP) | Security | 2d | 🔵 |
| Correções de bugs críticos | Team | 2d | 🔵 |
| Otimização de queries (índices) | Backend | 1d | 🔵 |

**Deliverables**:
- ✅ Cobertura de testes > 80%
- ✅ Performance validada
- ✅ Segurança checada

### Sprint 10: UAT e Deploy

**Semana 19**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| Preparar ambiente de staging | DevOps | 1d | 🔵 |
| Deploy para staging | DevOps | 1d | 🔵 |
| UAT com Gestor | PCP/QA | 2d | 🔵 |
| Correções por UAT | Team | 1d | 🔵 |

**Semana 20**

| Tarefa | Proprietário | Duração | Status |
|--------|--------------|---------|--------|
| Treinamento da equipe | Product | 2d | 🔵 |
| Documentação final | Tech Writer | 1d | 🔵 |
| Deploy para produção | DevOps | 0.5d | 🔵 |
| Suporte pós-deploy | Support | 1d | 🔵 |

**Deliverables**:
- ✅ Sistema pronto para produção
- ✅ Equipe treinada
- ✅ Documentação completa

---

## Dependências e Riscos

### Dependências Críticas

1. **BD ↦ Todos os módulos**: Sem schema completo, nada sai
2. **Cadastros ↦ Compras**: Sem produtos/fornecedores, não há compras
3. **Estoque ↦ Produção**: Sem saldo, não abre OP
4. **Compras ↦ Produção**: Sem insumos, OP não sai

### Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|--------|-----------|
| Requisitos incompletos | Alta | Alto | Sessões semanais com Gestor |
| Performance inadequada | Média | Alto | Testes de carga antecipados |
| Atrasos em Design | Média | Médio | Designer dedicado desde sprint 1 |
| Bugs críticos em produção | Baixa | Alto | Testes abrangentes + staging |

---

## Timeline Resumida

```
AGOSTO        SETEMBRO       OUTUBRO        NOVEMBRO
├─ Sprint 1-2 ├─ Sprint 3-4  ├─ Sprint 6-7  ├─ Sprint 9-10
│ Fundação   │ Compras P1   │ Produção P1  │ Testes/UAT
│            │              │              │
├─────────────├─────────────├─────────────├────────────
 Semana 1-4    Semana 5-8    Semana 9-14   Semana 15-20

Go-Live: Final de NOVEMBRO 2026
```

---

**Data de Revisão**: Setembro 2026

