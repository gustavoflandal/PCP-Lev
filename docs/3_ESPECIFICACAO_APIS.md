# Especificação de APIs REST - Sistema PCP 3PL

**Versão**: 1.0  
**Data**: Agosto 2026  
**Protocolo**: REST HTTP/HTTPS  
**Formato**: JSON  
**Autenticação**: JWT (Bearer Token)

---

## 📋 Índice

1. [Autenticação](#autenticação)
2. [Padrões Gerais](#padrões-gerais)
3. [APIs - Cadastros Base](#apis---cadastros-base)
4. [APIs - Estoque](#apis---estoque)
5. [APIs - Compras](#apis---compras)
6. [APIs - Vendas](#apis---vendas)
7. [APIs - Produção](#apis---produção)
8. [APIs - Dashboard](#apis---dashboard)
9. [Códigos de Erro](#códigos-de-erro)

---

## Autenticação

### POST /auth/login

Autenticar usuário e obter JWT token.

**Request**:
```json
{
  "username": "gestor01",
  "password": "senha_segura_123"
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "usuario": {
    "id": 1,
    "username": "gestor01",
    "nome": "Gustavo Landal",
    "perfil": "GESTOR"
  }
}
```

**Headers em Requisições Posteriores**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Padrões Gerais

### Response Padrão de Sucesso (200 OK)

```json
{
  "sucesso": true,
  "dados": { /* dados da resposta */ },
  "mensagem": "Operação realizada com sucesso"
}
```

### Response Padrão de Erro

```json
{
  "sucesso": false,
  "erro": {
    "codigo": "ERRO_VALIDACAO",
    "mensagem": "Descrição do erro",
    "detalhes": [
      {
        "campo": "codigo",
        "mensagem": "Campo obrigatório"
      }
    ]
  }
}
```

### Paginação

```json
{
  "sucesso": true,
  "dados": [/* array de itens */],
  "paginacao": {
    "pagina": 1,
    "limite": 50,
    "total": 150,
    "total_paginas": 3
  }
}
```

### Filtros Comuns

Todos os endpoints GET suportam:
- `pagina=1` (número da página)
- `limite=50` (itens por página)
- `ordenar_por=codigo` (campo para ordenar)
- `ordem=asc|desc` (ascendente/descendente)
- `filtro_ativo=true` (filtrar ativos)

---

## APIs - Cadastros Base

### PRODUTOS_ACABADOS

#### POST /api/v1/produtos-acabados

Criar novo Produto Acabado.

**Request**:
```json
{
  "codigo": "VMS-01",
  "descricao": "Painel de Velocidade VMS Série 01",
  "unidade_medida": "und",
  "preco_venda": 5000.00,
  "lead_time_producao": 10,
  "ativo": true
}
```

**Response** (201 Created):
```json
{
  "sucesso": true,
  "dados": {
    "id": 1,
    "codigo": "VMS-01",
    "descricao": "Painel de Velocidade VMS Série 01",
    "unidade_medida": "und",
    "preco_venda": 5000.00,
    "lead_time_producao": 10,
    "ativo": true,
    "created_at": "2026-08-25T10:30:00Z",
    "created_by": "gestor01"
  }
}
```

#### GET /api/v1/produtos-acabados

Listar todos os Produtos Acabados (com paginação e filtros).

**Query Params**:
- `pagina=1`
- `limite=50`
- `filtro_ativo=true`
- `ordenar_por=codigo`

**Response** (200 OK):
```json
{
  "sucesso": true,
  "dados": [
    {
      "id": 1,
      "codigo": "VMS-01",
      "descricao": "Painel de Velocidade VMS Série 01",
      /* ... outros campos ... */
    }
  ],
  "paginacao": { /* ... */ }
}
```

#### GET /api/v1/produtos-acabados/{id}

Obter detalhes de um Produto Acabado específico.

**Response** (200 OK):
```json
{
  "sucesso": true,
  "dados": {
    "id": 1,
    "codigo": "VMS-01",
    /* ... */
  }
}
```

#### PUT /api/v1/produtos-acabados/{id}

Atualizar Produto Acabado.

**Request/Response**: Mesmo padrão do POST

#### DELETE /api/v1/produtos-acabados/{id}

Deletar Produto Acabado (soft delete).

**Response** (204 No Content)

---

### PARTES_PECAS

#### POST /api/v1/partes-pecas

Criar nova Parte/Peça.

**Request**:
```json
{
  "codigo": "CON-001",
  "descricao": "Conector RCA Macho",
  "unidade_medida": "und",
  "estoque_minimo": 50,
  "estoque_maximo": 500,
  "fornecedor_padrao_id": 1,
  "lead_time_compra": 7,
  "ativo": true
}
```

**Response** (201 Created): Mesmo padrão anterior

#### GET /api/v1/partes-pecas
#### GET /api/v1/partes-pecas/{id}
#### PUT /api/v1/partes-pecas/{id}
#### DELETE /api/v1/partes-pecas/{id}

---

### ESTRUTURA_PRODUTO (BOM)

#### POST /api/v1/boms

Criar nova BOM para Produto Acabado.

**Request**:
```json
{
  "produto_acabado_id": 1,
  "data_vigencia_inicio": "2026-08-25",
  "data_vigencia_fim": null,
  "itens": [
    {
      "parte_peca_id": 1,
      "quantidade": 2
    },
    {
      "parte_peca_id": 2,
      "quantidade": 4
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "sucesso": true,
  "dados": {
    "id": 1,
    "produto_acabado_id": 1,
    "versao": 1,
    "data_vigencia_inicio": "2026-08-25",
    "itens": [ /* ... */ ]
  }
}
```

#### GET /api/v1/produtos-acabados/{id}/boms

Listar BOMs de um PA.

**Response**: Array de BOMs com versões

#### GET /api/v1/boms/{id}

Obter detalhes de uma BOM (com itens).

#### POST /api/v1/boms/{id}/versionar

Criar nova versão de uma BOM (inativa versão anterior).

---

### FORNECEDORES

#### POST /api/v1/fornecedores

**Request**:
```json
{
  "razao_social": "Componentes Eletrônicos LTDA",
  "cnpj": "12345678000190",
  "contato_nome": "João Silva",
  "contato_email": "joao@componentes.com.br",
  "contato_telefone": "(11) 99999-9999",
  "endereco": "Rua das Peças, 100, São Paulo - SP",
  "lead_time_medio": 7,
  "condicao_pagamento": "30 dias",
  "ativo": true
}
```

#### GET /api/v1/fornecedores
#### GET /api/v1/fornecedores/{id}
#### PUT /api/v1/fornecedores/{id}
#### DELETE /api/v1/fornecedores/{id}

---

## APIs - Estoque

### SALDO_ESTOQUE

#### GET /api/v1/estoque

Listar saldo de todas as Partes/Peças com status.

**Query Params**:
- `pagina=1`
- `filtro_status=CRITICO` (OK, CRITICO, BLOQUEADO)

**Response**:
```json
{
  "sucesso": true,
  "dados": [
    {
      "id": 1,
      "parte_peca_id": 1,
      "codigo": "CON-001",
      "descricao": "Conector RCA Macho",
      "quantidade_atual": 250,
      "quantidade_reservada": 100,
      "disponivel": 150,
      "estoque_minimo": 50,
      "status": "OK",
      "localizacao_armazem": "A-01-05"
    }
  ]
}
```

#### GET /api/v1/estoque/{parte_peca_id}

Detalhes de saldo de uma PP específica.

#### GET /api/v1/estoque/criticos

Listar itens com estoque crítico (≤ mínimo).

**Response**: Array de itens em alerta

#### POST /api/v1/estoque/ajuste

Registrar ajuste manual de estoque.

**Request**:
```json
{
  "parte_peca_id": 1,
  "quantidade": 10,
  "motivo": "Inventário Físico",
  "observacoes": "Recontagem - diferença encontrada"
}
```

---

### MOVIMENTACAO_ESTOQUE

#### GET /api/v1/movimentacoes

Listar todas as movimentações (com filtros).

**Query Params**:
- `data_inicio=2026-08-01`
- `data_fim=2026-08-31`
- `motivo=Compra|OP|Ajuste`
- `parte_peca_id=1`

**Response**:
```json
{
  "sucesso": true,
  "dados": [
    {
      "id": 1,
      "parte_peca_id": 1,
      "codigo_pp": "CON-001",
      "tipo": "Entrada",
      "quantidade": 100,
      "data_hora": "2026-08-25T14:30:00Z",
      "motivo": "Compra",
      "referencia_numero": "PC-2026-001",
      "usuario": "gestor01"
    }
  ]
}
```

#### GET /api/v1/movimentacoes/{id}

Detalhes de uma movimentação

#### GET /api/v1/relatorio/movimentacoes

Gerar relatório de movimentações (exportar CSV/PDF).

**Query Params**:
- `formato=csv|pdf|excel`
- `data_inicio`, `data_fim`
- `motivo`

---

## APIs - Compras

### COTACOES

#### POST /api/v1/cotacoes

Criar nova cotação.

**Request**:
```json
{
  "fornecedor_id": 1,
  "data_validade": "2026-09-25",
  "itens": [
    {
      "parte_peca_id": 1,
      "quantidade": 100,
      "preco_unitario": 50.00
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "sucesso": true,
  "dados": {
    "id": 1,
    "numero_cotacao": "COT-2026-001",
    "fornecedor_id": 1,
    "status": "Rascunho",
    "valor_total": 5000.00,
    "itens": [ /* ... */ ]
  }
}
```

#### GET /api/v1/cotacoes
#### GET /api/v1/cotacoes/{id}
#### PUT /api/v1/cotacoes/{id}

#### POST /api/v1/cotacoes/{id}/enviar

Enviar cotação para fornecedor (muda status para "Enviada").

#### POST /api/v1/cotacoes/{id}/registrar-resposta

Registrar resposta do fornecedor.

**Request**:
```json
{
  "data_resposta": "2026-08-26",
  "itens": [
    {
      "parte_peca_id": 1,
      "preco_unitario": 48.00
    }
  ]
}
```

#### POST /api/v1/cotacoes/{id}/converter-pc

Converter cotação em Pedido de Compra.

---

### PEDIDOS_COMPRA

#### POST /api/v1/pedidos-compra

Criar novo Pedido de Compra (a partir de cotação ou manual).

**Request**:
```json
{
  "cotacao_id": 1,
  "fornecedor_id": 1,
  "data_entrega_prevista": "2026-09-01",
  "condicao_pagamento": "30 dias",
  "itens": [
    {
      "parte_peca_id": 1,
      "quantidade_solicitada": 100,
      "preco_unitario": 50.00
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "sucesso": true,
  "dados": {
    "id": 1,
    "numero_pc": "PC-2026-001",
    "status": "Rascunho",
    "valor_total": 5000.00,
    /* ... */
  }
}
```

#### GET /api/v1/pedidos-compra
#### GET /api/v1/pedidos-compra/{id}
#### PUT /api/v1/pedidos-compra/{id}

#### POST /api/v1/pedidos-compra/{id}/emitir

Emitir PC (muda status para "Emitido").

#### POST /api/v1/pedidos-compra/{id}/registrar-recebimento

Registrar recebimento total ou parcial.

**Request**:
```json
{
  "itens": [
    {
      "parte_peca_id": 1,
      "quantidade_recebida": 100
    }
  ]
}
```

**Response**: PC atualizado com novo status

#### GET /api/v1/pedidos-compra/em-atraso

Listar PCs com data de entrega vencida.

#### POST /api/v1/necessidade-compra/gerar

Executar análise automática de necessidades (cruza OPs + BOM + estoque).

**Response**:
```json
{
  "sucesso": true,
  "dados": {
    "sugestoes": [
      {
        "parte_peca_id": 1,
        "codigo": "CON-001",
        "quantidade_necessaria": 200,
        "quantidade_disponivel": 150,
        "diferenca": 50,
        "fornecedor_padrao_id": 1
      }
    ]
  }
}
```

---

## APIs - Vendas

### PEDIDOS_VENDA

#### POST /api/v1/pedidos-venda

Criar novo Pedido de Venda.

**Request**:
```json
{
  "cliente_nome": "Prefeitura Municipal",
  "cliente_contato": "contato@prefeitura.gov.br",
  "data_entrega_prometida": "2026-09-15",
  "itens": [
    {
      "produto_acabado_id": 1,
      "quantidade": 5,
      "preco_unitario": 5000.00
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "sucesso": true,
  "dados": {
    "id": 1,
    "numero_pedido": "PV-2026-001",
    "cliente_nome": "Prefeitura Municipal",
    "status": "Aguardando Insumos",
    "valor_total": 25000.00,
    "itens": [ /* ... */ ]
  }
}
```

#### GET /api/v1/pedidos-venda
#### GET /api/v1/pedidos-venda/{id}
#### PUT /api/v1/pedidos-venda/{id}

#### POST /api/v1/pedidos-venda/{id}/gerar-op

Gerar OP(s) a partir do Pedido de Venda.

**Response**:
```json
{
  "sucesso": true,
  "dados": {
    "ops_criadas": [
      {
        "id": 1,
        "numero_op": "OP-2026-001",
        "produto_acabado_id": 1,
        "quantidade": 5
      }
    ]
  }
}
```

#### GET /api/v1/pedidos-venda/em-atraso

Listar PVs com data de entrega vencida.

---

## APIs - Produção

### ORDENS_PRODUCAO

#### GET /api/v1/ordens-producao

Listar OPs (com filtros por status e etapa).

**Query Params**:
- `status=Aberta|Concluída|Cancelada`
- `etapa=Separação|Montagem|Testes|Expedição`
- `filtro_atrasos=true`

**Response**:
```json
{
  "sucesso": true,
  "dados": [
    {
      "id": 1,
      "numero_op": "OP-2026-001",
      "produto_acabado": "VMS-01",
      "quantidade": 5,
      "etapa_atual": "Separação",
      "status": "Aberta",
      "data_conclusao_prevista": "2026-09-04",
      "em_atraso": false
    }
  ]
}
```

#### GET /api/v1/ordens-producao/{id}

Detalhes de uma OP (incluindo componentes reservados).

**Response**:
```json
{
  "sucesso": true,
  "dados": {
    "id": 1,
    "numero_op": "OP-2026-001",
    "produto_acabado_id": 1,
    "quantidade": 5,
    "estrutura_produto": {
      "versao": 1,
      "itens": [
        {
          "parte_peca_id": 1,
          "codigo": "CON-001",
          "quantidade": 10,
          "quantidade_reservada": 10
        }
      ]
    },
    "historico_kanban": [
      {
        "etapa": "Separação",
        "data_hora": "2026-08-25T10:00:00Z"
      }
    ]
  }
}
```

#### POST /api/v1/ordens-producao/{id}/mudar-etapa

Mover OP para próxima etapa no Kanban.

**Request**:
```json
{
  "nova_etapa": "Montagem",
  "observacoes": "Componentes separados e validados"
}
```

**Response**: OP atualizada com novo status

#### POST /api/v1/ordens-producao/{id}/finalizar

Finalizar OP (conclusão, libera estoque, cria PA).

**Request**:
```json
{
  "observacoes": "Testes passaram com sucesso"
}
```

**Response**:
```json
{
  "sucesso": true,
  "dados": {
    "id": 1,
    "numero_op": "OP-2026-001",
    "status": "Concluída",
    "data_conclusao_real": "2026-08-25T16:30:00Z"
  }
}
```

#### POST /api/v1/ordens-producao/{id}/cancelar

Cancelar OP (libera componentes reservados).

---

### KANBAN (Visão Consolidada)

#### GET /api/v1/kanban

Obter todas as OPs agrupadas por etapa (para visualização Kanban).

**Response**:
```json
{
  "sucesso": true,
  "dados": {
    "Separação": [
      {
        "id": 1,
        "numero_op": "OP-2026-001",
        "produto": "VMS-01",
        "quantidade": 5,
        "data_conclusao_prevista": "2026-09-04",
        "em_atraso": false
      }
    ],
    "Montagem": [ /* ... */ ],
    "Testes": [ /* ... */ ],
    "Expedição": [ /* ... */ ]
  }
}
```

#### GET /api/v1/kanban/estatisticas

Estatísticas do Kanban.

**Response**:
```json
{
  "sucesso": true,
  "dados": {
    "total_ops_abertas": 15,
    "por_etapa": {
      "Separação": 3,
      "Montagem": 5,
      "Testes": 4,
      "Expedição": 3
    },
    "ops_atrasadas": 2,
    "taxa_conclusao_dia": 4
  }
}
```

---

### APONTAMENTO_PRODUCAO

#### POST /api/v1/apontamentos

Registrar apontamento de tempo em uma etapa.

**Request**:
```json
{
  "ordem_producao_id": 1,
  "etapa": "Montagem",
  "tempo_inicio": "2026-08-25T10:00:00Z",
  "tempo_fim": "2026-08-25T12:30:00Z",
  "operador_id": 5,
  "observacoes": "Soldagem concluída"
}
```

#### GET /api/v1/ordens-producao/{id}/apontamentos

Listar apontamentos de uma OP.

---

## APIs - Dashboard

### GET /api/v1/dashboard

Painel de Controle Principal (resumo de alertas e status).

**Response**:
```json
{
  "sucesso": true,
  "dados": {
    "ops_em_atraso": {
      "quantidade": 2,
      "ops": [
        {
          "numero_op": "OP-2026-001",
          "dias_atraso": 3
        }
      ]
    },
    "pedidos_compra_a_receber": {
      "quantidade": 5,
      "valor_total": 25000.00,
      "atrasados": 2
    },
    "insumos_criticos": {
      "quantidade": 3,
      "itens": [
        {
          "codigo": "CON-001",
          "quantidade_atual": 10,
          "estoque_minimo": 50,
          "diferenca": -40
        }
      ]
    },
    "status_fabrica": {
      "ops_abertas": 15,
      "ops_prontas": 3,
      "taxa_conclusao": "85%"
    }
  }
}
```

### GET /api/v1/relatorios/estoque

Gerar relatório de estoque.

**Query Params**:
- `formato=pdf|csv|excel`
- `data_corte=2026-08-25`

### GET /api/v1/relatorios/compras

Relatório de compras (período, fornecedores, custos).

### GET /api/v1/relatorios/producao

Relatório de produção (OPs, prazos, consumos).

### GET /api/v1/relatorios/vendas

Relatório de vendas (pedidos, receita, cumprimento).

---

## Códigos de Erro

| Código | Status | Descrição |
|--------|--------|-----------|
| SUCESSO | 200 | Operação bem-sucedida |
| CRIADO | 201 | Recurso criado com sucesso |
| NAO_CONTEUDO | 204 | Operação bem-sucedida, sem retorno |
| REQUISICAO_INVALIDA | 400 | Dados inválidos na request |
| ERRO_VALIDACAO | 400 | Erro de validação de negócio |
| NAO_AUTORIZADO | 401 | Token ausente ou inválido |
| ACESSO_NEGADO | 403 | Usuário sem permissão |
| NAO_ENCONTRADO | 404 | Recurso não encontrado |
| CONFLITO | 409 | Conflito (ex: código duplicado) |
| ERRO_INTERNO | 500 | Erro interno do servidor |
| INDISPONIVEL | 503 | Serviço temporariamente indisponível |

---

**Data de Revisão**: Setembro 2026  
**Próxima Versão**: 1.1

