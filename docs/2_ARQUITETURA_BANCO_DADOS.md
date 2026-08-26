# Arquitetura de Banco de Dados - Sistema PCP 3PL

**Versão**: 1.0  
**Data**: Agosto 2026  
**SGBD**: PostgreSQL 14+  
**Padrão**: Normalização Boyce-Codd (BCNF)

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Diagrama E-R](#diagrama-er)
3. [Definição de Tabelas](#definição-de-tabelas)
4. [Relacionamentos](#relacionamentos)
5. [Índices e Performance](#índices-e-performance)
6. [Migrations](#migrations)

---

## Visão Geral

Banco de dados relacional normalizado para gerenciar toda a operação de PCP, incluindo:
- Cadastros base (PA, PP, Fornecedores, BOM)
- Controle de estoque (movimentações, reservas)
- Compras (cotações, PCs, recebimentos)
- Produção (OPs, Kanban, apontamentos)
- Vendas (pedidos, rastreamento)

### Princípios de Design

- Normalização BCNF (evitar redundâncias)
- Integridade referencial obrigatória
- Soft delete (flag `ativo` em vez de deletar)
- Auditoria (created_at, updated_at, created_by, updated_by)
- Versionamento para dados históricos (BOM, Preços)

---

## Diagrama E-R

```
┌─────────────────┐
│  PRODUTOS_ACABADOS (PA)
├─────────────────┤
│ id (PK)
│ codigo (UNIQUE)
│ descricao
│ unidade_medida
│ preco_venda
│ lead_time_producao
│ ativo
│ created_at, updated_at
└─────────────────┘
        │
        │ 1:N
        └────────────┐
                     │
            ┌────────▼──────────────┐
            │  ESTRUTURA_PRODUTO (BOM)
            ├───────────────────────┤
            │ id (PK)
            │ produto_acabado_id (FK)
            │ versao
            │ data_vigencia_inicio
            │ data_vigencia_fim
            │ ativo
            │ created_at, updated_at
            └───────────────────────┘
                     │
                     │ 1:N
                     └────────────┐
                                  │
                    ┌─────────────▼────────────┐
                    │  ITENS_ESTRUTURA_PRODUTO
                    ├────────────────────────┤
                    │ id (PK)
                    │ estrutura_produto_id (FK)
                    │ parte_peca_id (FK)
                    │ quantidade
                    └────────────────────────┘


┌──────────────────┐
│  PARTES_PECAS (PP)
├──────────────────┤
│ id (PK)
│ codigo (UNIQUE)
│ descricao
│ unidade_medida
│ estoque_minimo
│ estoque_maximo
│ fornecedor_padrao_id (FK)
│ lead_time_compra
│ ativo
│ created_at, updated_at
└──────────────────┘
        │
        │ 1:N
        └──────────────┐
                       │
            ┌──────────▼──────────────┐
            │  SALDO_ESTOQUE
            ├───────────────────────┤
            │ id (PK)
            │ parte_peca_id (FK, UNIQUE)
            │ quantidade_atual
            │ quantidade_reservada
            │ localizacao_armazem
            │ status (OK/CRITICO/BLOQUEADO)
            │ updated_at
            └───────────────────────┘


┌──────────────────┐
│  FORNECEDORES
├──────────────────┤
│ id (PK)
│ razao_social
│ cnpj (UNIQUE)
│ contato_nome
│ contato_email
│ contato_telefone
│ endereco
│ lead_time_medio
│ condicao_pagamento
│ ativo
│ created_at, updated_at
└──────────────────┘
        │
        │ 1:N
        └──────────────┐
                       │
            ┌──────────▼──────────────┐
            │  COTACOES
            ├───────────────────────┤
            │ id (PK)
            │ numero_cotacao (UNIQUE)
            │ fornecedor_id (FK)
            │ data_emissao
            │ data_validade
            │ data_resposta
            │ valor_total
            │ status (Rascunho/Enviada/...)
            │ created_at, updated_at
            └───────────────────────┘
                     │
                     │ 1:N
                     └────────────┐
                                  │
                    ┌─────────────▼────────────┐
                    │  ITENS_COTACAO
                    ├────────────────────────┤
                    │ id (PK)
                    │ cotacao_id (FK)
                    │ parte_peca_id (FK)
                    │ quantidade
                    │ preco_unitario
                    │ total
                    └────────────────────────┘


┌──────────────────────────┐
│  PEDIDOS_COMPRA (PC)
├──────────────────────────┤
│ id (PK)
│ numero_pc (UNIQUE)
│ cotacao_id (FK, nullable)
│ fornecedor_id (FK)
│ data_pedido
│ data_entrega_prevista
│ data_entrega_real
│ valor_total
│ condicao_pagamento
│ status (Rascunho/Emitido/...)
│ created_at, updated_at
└──────────────────────────┘
           │
           │ 1:N
           └────────────┐
                        │
           ┌────────────▼──────────────┐
           │  ITENS_PEDIDO_COMPRA
           ├───────────────────────┤
           │ id (PK)
           │ pedido_compra_id (FK)
           │ parte_peca_id (FK)
           │ quantidade_solicitada
           │ quantidade_recebida
           │ preco_unitario
           │ total
           └───────────────────────┘


┌──────────────────────────┐
│  PEDIDOS_VENDA (PV)
├──────────────────────────┤
│ id (PK)
│ numero_pedido (UNIQUE)
│ cliente_nome
│ cliente_contato
│ data_pedido
│ data_entrega_prometida
│ data_entrega_real
│ valor_total
│ status (Aguardando/Produção/...)
│ created_at, updated_at
└──────────────────────────┘
           │
           │ 1:N
           └────────────┐
                        │
           ┌────────────▼──────────────┐
           │  ITENS_PEDIDO_VENDA
           ├───────────────────────┤
           │ id (PK)
           │ pedido_venda_id (FK)
           │ produto_acabado_id (FK)
           │ quantidade
           │ preco_unitario
           │ total
           └───────────────────────┘
                   │
                   │ 1:1
                   └────────────┐
                                │
                    ┌───────────▼────────────┐
                    │  ORDENS_PRODUCAO (OP)
                    ├────────────────────┤
                    │ id (PK)
                    │ numero_op (UNIQUE)
                    │ item_pedido_venda_id (FK, UNIQUE)
                    │ produto_acabado_id (FK)
                    │ quantidade
                    │ estrutura_produto_id (FK)
                    │ data_conclusao_prevista
                    │ data_conclusao_real
                    │ etapa_atual (Separação/Montagem/...)
                    │ status (Aberta/Concluída/Cancelada)
                    │ created_at, updated_at
                    └────────────────────┘
                             │
                             │ 1:N
                             └────────────┐
                                          │
                        ┌─────────────────▼──────────────┐
                        │  RESERVA_ESTOQUE
                        ├──────────────────────────────┤
                        │ id (PK)
                        │ ordem_producao_id (FK)
                        │ parte_peca_id (FK)
                        │ quantidade_reservada
                        │ quantidade_consumida
                        │ status (Reservada/Consumida/Liberada)
                        │ created_at, updated_at
                        └──────────────────────────────┘


┌──────────────────────────┐
│  MOVIMENTACAO_ESTOQUE
├──────────────────────────┤
│ id (PK)
│ parte_peca_id (FK, nullable)
│ produto_acabado_id (FK, nullable)
│ tipo (Entrada/Saída/Ajuste)
│ quantidade
│ data_hora
│ motivo (Compra/OP/Ajuste/...)
│ referencia_numero (PC-nº / OP-nº / etc)
│ observacoes
│ usuario_id (FK)
│ created_at
└──────────────────────────┘


┌──────────────────────────┐
│  HISTORICO_KANBAN
├──────────────────────────┤
│ id (PK)
│ ordem_producao_id (FK)
│ etapa_anterior
│ etapa_nova
│ data_hora_transicao
│ usuario_responsavel_id (FK)
│ observacoes
│ created_at
└──────────────────────────┘


┌──────────────────────────┐
│  APONTAMENTO_PRODUCAO
├──────────────────────────┤
│ id (PK)
│ ordem_producao_id (FK)
│ etapa
│ tempo_inicio
│ tempo_fim
│ duracao_minutos
│ operador_id (FK)
│ observacoes
│ created_at
└──────────────────────────┘


┌──────────────────────────┐
│  AUDITORIA
├──────────────────────────┤
│ id (PK)
│ tabela
│ operacao (INSERT/UPDATE/DELETE)
│ registro_id
│ dados_antigos (JSONB)
│ dados_novos (JSONB)
│ usuario_id (FK)
│ data_hora
│ endereco_ip
└──────────────────────────┘
```

---

## Definição de Tabelas

### produtos_acabados

```sql
CREATE TABLE produtos_acabados (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  descricao VARCHAR(255) NOT NULL,
  unidade_medida VARCHAR(20) NOT NULL,
  preco_venda DECIMAL(10, 2) NOT NULL,
  lead_time_producao INT NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  
  CONSTRAINT chk_preco_venda CHECK (preco_venda > 0),
  CONSTRAINT chk_lead_time CHECK (lead_time_producao > 0)
);

CREATE INDEX idx_pa_codigo ON produtos_acabados(codigo);
CREATE INDEX idx_pa_ativo ON produtos_acabados(ativo);
```

### partes_pecas

```sql
CREATE TABLE partes_pecas (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  descricao VARCHAR(255) NOT NULL,
  unidade_medida VARCHAR(20) NOT NULL,
  estoque_minimo INT NOT NULL DEFAULT 5,
  estoque_maximo INT NOT NULL DEFAULT 100,
  fornecedor_padrao_id BIGINT,
  lead_time_compra INT NOT NULL DEFAULT 7,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  
  CONSTRAINT fk_fornecedor_padrao FOREIGN KEY (fornecedor_padrao_id) 
    REFERENCES fornecedores(id),
  CONSTRAINT chk_estoque_min_max CHECK (estoque_minimo < estoque_maximo),
  CONSTRAINT chk_lead_time_compra CHECK (lead_time_compra > 0)
);

CREATE INDEX idx_pp_codigo ON partes_pecas(codigo);
CREATE INDEX idx_pp_ativo ON partes_pecas(ativo);
CREATE INDEX idx_pp_fornecedor ON partes_pecas(fornecedor_padrao_id);
```

### saldo_estoque

```sql
CREATE TABLE saldo_estoque (
  id BIGSERIAL PRIMARY KEY,
  parte_peca_id BIGINT NOT NULL UNIQUE,
  quantidade_atual INT NOT NULL DEFAULT 0,
  quantidade_reservada INT NOT NULL DEFAULT 0,
  localizacao_armazem VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'OK', -- OK, CRITICO, BLOQUEADO
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  
  CONSTRAINT fk_parte_peca FOREIGN KEY (parte_peca_id) 
    REFERENCES partes_pecas(id) ON DELETE CASCADE,
  CONSTRAINT chk_quantidade CHECK (quantidade_atual >= 0),
  CONSTRAINT chk_quantidade_reservada CHECK (quantidade_reservada >= 0),
  CONSTRAINT chk_disponivel CHECK ((quantidade_atual - quantidade_reservada) >= 0)
);

CREATE INDEX idx_saldo_status ON saldo_estoque(status);
```

### fornecedores

```sql
CREATE TABLE fornecedores (
  id BIGSERIAL PRIMARY KEY,
  razao_social VARCHAR(255) NOT NULL,
  cnpj VARCHAR(14) NOT NULL UNIQUE,
  contato_nome VARCHAR(100),
  contato_email VARCHAR(100),
  contato_telefone VARCHAR(15),
  endereco VARCHAR(255),
  lead_time_medio INT NOT NULL DEFAULT 7,
  condicao_pagamento VARCHAR(50),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100)
);

CREATE INDEX idx_fornecedor_cnpj ON fornecedores(cnpj);
CREATE INDEX idx_fornecedor_ativo ON fornecedores(ativo);
```

### estrutura_produto

```sql
CREATE TABLE estrutura_produto (
  id BIGSERIAL PRIMARY KEY,
  produto_acabado_id BIGINT NOT NULL,
  versao INT NOT NULL DEFAULT 1,
  data_vigencia_inicio DATE NOT NULL,
  data_vigencia_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  
  CONSTRAINT fk_produto_acabado FOREIGN KEY (produto_acabado_id) 
    REFERENCES produtos_acabados(id),
  CONSTRAINT uk_pa_versao UNIQUE (produto_acabado_id, versao)
);

CREATE INDEX idx_estrutura_pa ON estrutura_produto(produto_acabado_id);
CREATE INDEX idx_estrutura_ativo ON estrutura_produto(ativo);
```

### itens_estrutura_produto

```sql
CREATE TABLE itens_estrutura_produto (
  id BIGSERIAL PRIMARY KEY,
  estrutura_produto_id BIGINT NOT NULL,
  parte_peca_id BIGINT NOT NULL,
  quantidade INT NOT NULL,
  
  CONSTRAINT fk_estrutura FOREIGN KEY (estrutura_produto_id) 
    REFERENCES estrutura_produto(id) ON DELETE CASCADE,
  CONSTRAINT fk_parte_peca FOREIGN KEY (parte_peca_id) 
    REFERENCES partes_pecas(id),
  CONSTRAINT chk_quantidade CHECK (quantidade > 0)
);

CREATE INDEX idx_item_estrutura ON itens_estrutura_produto(estrutura_produto_id);
CREATE INDEX idx_item_pp ON itens_estrutura_produto(parte_peca_id);
```

### cotacoes

```sql
CREATE TABLE cotacoes (
  id BIGSERIAL PRIMARY KEY,
  numero_cotacao VARCHAR(50) NOT NULL UNIQUE,
  fornecedor_id BIGINT NOT NULL,
  data_emissao DATE NOT NULL,
  data_validade DATE NOT NULL,
  data_resposta DATE,
  valor_total DECIMAL(12, 2),
  status VARCHAR(20) NOT NULL DEFAULT 'Rascunho', -- Rascunho, Enviada, Respondida, Cancelada
  observacoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  
  CONSTRAINT fk_fornecedor FOREIGN KEY (fornecedor_id) 
    REFERENCES fornecedores(id),
  CONSTRAINT chk_data_validade CHECK (data_validade > data_emissao)
);

CREATE INDEX idx_cotacao_numero ON cotacoes(numero_cotacao);
CREATE INDEX idx_cotacao_fornecedor ON cotacoes(fornecedor_id);
CREATE INDEX idx_cotacao_status ON cotacoes(status);
```

### itens_cotacao

```sql
CREATE TABLE itens_cotacao (
  id BIGSERIAL PRIMARY KEY,
  cotacao_id BIGINT NOT NULL,
  parte_peca_id BIGINT NOT NULL,
  quantidade INT NOT NULL,
  preco_unitario DECIMAL(10, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  
  CONSTRAINT fk_cotacao FOREIGN KEY (cotacao_id) 
    REFERENCES cotacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_parte_peca FOREIGN KEY (parte_peca_id) 
    REFERENCES partes_pecas(id),
  CONSTRAINT chk_quantidade CHECK (quantidade > 0),
  CONSTRAINT chk_preco CHECK (preco_unitario > 0)
);

CREATE INDEX idx_item_cotacao ON itens_cotacao(cotacao_id);
```

### pedidos_compra

```sql
CREATE TABLE pedidos_compra (
  id BIGSERIAL PRIMARY KEY,
  numero_pc VARCHAR(50) NOT NULL UNIQUE,
  cotacao_id BIGINT,
  fornecedor_id BIGINT NOT NULL,
  data_pedido DATE NOT NULL,
  data_entrega_prevista DATE NOT NULL,
  data_entrega_real DATE,
  valor_total DECIMAL(12, 2) NOT NULL,
  condicao_pagamento VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'Rascunho', 
  -- Rascunho, Emitido, Aceito, Aguardando, Recebido Parcial, Concluído, Cancelado
  observacoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  
  CONSTRAINT fk_cotacao FOREIGN KEY (cotacao_id) 
    REFERENCES cotacoes(id) ON DELETE SET NULL,
  CONSTRAINT fk_fornecedor FOREIGN KEY (fornecedor_id) 
    REFERENCES fornecedores(id),
  CONSTRAINT chk_data_entrega CHECK (data_entrega_prevista > data_pedido)
);

CREATE INDEX idx_pc_numero ON pedidos_compra(numero_pc);
CREATE INDEX idx_pc_fornecedor ON pedidos_compra(fornecedor_id);
CREATE INDEX idx_pc_status ON pedidos_compra(status);
CREATE INDEX idx_pc_data_entrega ON pedidos_compra(data_entrega_prevista);
```

### itens_pedido_compra

```sql
CREATE TABLE itens_pedido_compra (
  id BIGSERIAL PRIMARY KEY,
  pedido_compra_id BIGINT NOT NULL,
  parte_peca_id BIGINT NOT NULL,
  quantidade_solicitada INT NOT NULL,
  quantidade_recebida INT NOT NULL DEFAULT 0,
  preco_unitario DECIMAL(10, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  
  CONSTRAINT fk_pc FOREIGN KEY (pedido_compra_id) 
    REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  CONSTRAINT fk_parte_peca FOREIGN KEY (parte_peca_id) 
    REFERENCES partes_pecas(id),
  CONSTRAINT chk_quantidade CHECK (quantidade_solicitada > 0),
  CONSTRAINT chk_recebimento CHECK (quantidade_recebida <= quantidade_solicitada)
);

CREATE INDEX idx_item_pc ON itens_pedido_compra(pedido_compra_id);
CREATE INDEX idx_item_pp ON itens_pedido_compra(parte_peca_id);
```

### pedidos_venda

```sql
CREATE TABLE pedidos_venda (
  id BIGSERIAL PRIMARY KEY,
  numero_pedido VARCHAR(50) NOT NULL UNIQUE,
  cliente_nome VARCHAR(100) NOT NULL,
  cliente_contato VARCHAR(100),
  data_pedido DATE NOT NULL,
  data_entrega_prometida DATE NOT NULL,
  data_entrega_real DATE,
  valor_total DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Aguardando Insumos',
  -- Aguardando Insumos, Em Produção, Pronto, Entregue, Cancelado
  observacoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  
  CONSTRAINT chk_data_entrega CHECK (data_entrega_prometida > data_pedido)
);

CREATE INDEX idx_pv_numero ON pedidos_venda(numero_pedido);
CREATE INDEX idx_pv_status ON pedidos_venda(status);
CREATE INDEX idx_pv_data_entrega ON pedidos_venda(data_entrega_prometida);
```

### itens_pedido_venda

```sql
CREATE TABLE itens_pedido_venda (
  id BIGSERIAL PRIMARY KEY,
  pedido_venda_id BIGINT NOT NULL,
  produto_acabado_id BIGINT NOT NULL,
  quantidade INT NOT NULL,
  preco_unitario DECIMAL(10, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  
  CONSTRAINT fk_pv FOREIGN KEY (pedido_venda_id) 
    REFERENCES pedidos_venda(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa FOREIGN KEY (produto_acabado_id) 
    REFERENCES produtos_acabados(id),
  CONSTRAINT chk_quantidade CHECK (quantidade > 0)
);

CREATE INDEX idx_item_pv ON itens_pedido_venda(pedido_venda_id);
```

### ordens_producao

```sql
CREATE TABLE ordens_producao (
  id BIGSERIAL PRIMARY KEY,
  numero_op VARCHAR(50) NOT NULL UNIQUE,
  item_pedido_venda_id BIGINT NOT NULL UNIQUE,
  produto_acabado_id BIGINT NOT NULL,
  quantidade INT NOT NULL,
  estrutura_produto_id BIGINT NOT NULL,
  data_conclusao_prevista DATE NOT NULL,
  data_conclusao_real DATE,
  etapa_atual VARCHAR(50) NOT NULL DEFAULT 'Separação',
  -- Separação, Montagem, Testes, Expedição
  status VARCHAR(20) NOT NULL DEFAULT 'Aberta',
  -- Aberta, Concluída, Cancelada
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  
  CONSTRAINT fk_item_pv FOREIGN KEY (item_pedido_venda_id) 
    REFERENCES itens_pedido_venda(id),
  CONSTRAINT fk_pa FOREIGN KEY (produto_acabado_id) 
    REFERENCES produtos_acabados(id),
  CONSTRAINT fk_estrutura FOREIGN KEY (estrutura_produto_id) 
    REFERENCES estrutura_produto(id),
  CONSTRAINT chk_quantidade CHECK (quantidade > 0)
);

CREATE INDEX idx_op_numero ON ordens_producao(numero_op);
CREATE INDEX idx_op_status ON ordens_producao(status);
CREATE INDEX idx_op_etapa ON ordens_producao(etapa_atual);
CREATE INDEX idx_op_data_conclusao ON ordens_producao(data_conclusao_prevista);
```

### reserva_estoque

```sql
CREATE TABLE reserva_estoque (
  id BIGSERIAL PRIMARY KEY,
  ordem_producao_id BIGINT NOT NULL,
  parte_peca_id BIGINT NOT NULL,
  quantidade_reservada INT NOT NULL,
  quantidade_consumida INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Reservada',
  -- Reservada, Consumida, Liberada
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_op FOREIGN KEY (ordem_producao_id) 
    REFERENCES ordens_producao(id) ON DELETE CASCADE,
  CONSTRAINT fk_pp FOREIGN KEY (parte_peca_id) 
    REFERENCES partes_pecas(id),
  CONSTRAINT chk_quantidade CHECK (quantidade_reservada > 0),
  CONSTRAINT uk_op_pp UNIQUE (ordem_producao_id, parte_peca_id)
);

CREATE INDEX idx_reserva_op ON reserva_estoque(ordem_producao_id);
CREATE INDEX idx_reserva_pp ON reserva_estoque(parte_peca_id);
CREATE INDEX idx_reserva_status ON reserva_estoque(status);
```

### movimentacao_estoque

```sql
CREATE TABLE movimentacao_estoque (
  id BIGSERIAL PRIMARY KEY,
  parte_peca_id BIGINT,
  produto_acabado_id BIGINT,
  tipo VARCHAR(20) NOT NULL, -- Entrada, Saída, Ajuste
  quantidade INT NOT NULL,
  data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  motivo VARCHAR(50) NOT NULL, -- Compra, OP, Ajuste, Devolução, etc
  referencia_numero VARCHAR(50),
  observacoes TEXT,
  usuario_id BIGINT,
  
  CONSTRAINT fk_pp FOREIGN KEY (parte_peca_id) 
    REFERENCES partes_pecas(id),
  CONSTRAINT fk_pa FOREIGN KEY (produto_acabado_id) 
    REFERENCES produtos_acabados(id),
  CONSTRAINT chk_quantidade CHECK (quantidade != 0),
  CONSTRAINT chk_pp_ou_pa CHECK (
    (parte_peca_id IS NOT NULL AND produto_acabado_id IS NULL) OR
    (parte_peca_id IS NULL AND produto_acabado_id IS NOT NULL)
  )
);

CREATE INDEX idx_mov_pp ON movimentacao_estoque(parte_peca_id);
CREATE INDEX idx_mov_pa ON movimentacao_estoque(produto_acabado_id);
CREATE INDEX idx_mov_data ON movimentacao_estoque(data_hora);
CREATE INDEX idx_mov_motivo ON movimentacao_estoque(motivo);
```

### historico_kanban

```sql
CREATE TABLE historico_kanban (
  id BIGSERIAL PRIMARY KEY,
  ordem_producao_id BIGINT NOT NULL,
  etapa_anterior VARCHAR(50),
  etapa_nova VARCHAR(50) NOT NULL,
  data_hora_transicao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_responsavel_id BIGINT,
  observacoes TEXT,
  
  CONSTRAINT fk_op FOREIGN KEY (ordem_producao_id) 
    REFERENCES ordens_producao(id) ON DELETE CASCADE
);

CREATE INDEX idx_kanban_op ON historico_kanban(ordem_producao_id);
CREATE INDEX idx_kanban_data ON historico_kanban(data_hora_transicao);
```

### apontamento_producao

```sql
CREATE TABLE apontamento_producao (
  id BIGSERIAL PRIMARY KEY,
  ordem_producao_id BIGINT NOT NULL,
  etapa VARCHAR(50) NOT NULL,
  tempo_inicio TIMESTAMP NOT NULL,
  tempo_fim TIMESTAMP,
  duracao_minutos INT,
  operador_id BIGINT,
  observacoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_op FOREIGN KEY (ordem_producao_id) 
    REFERENCES ordens_producao(id) ON DELETE CASCADE
);

CREATE INDEX idx_apontamento_op ON apontamento_producao(ordem_producao_id);
CREATE INDEX idx_apontamento_etapa ON apontamento_producao(etapa);
```

### auditoria

```sql
CREATE TABLE auditoria (
  id BIGSERIAL PRIMARY KEY,
  tabela VARCHAR(100) NOT NULL,
  operacao VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
  registro_id BIGINT,
  dados_antigos JSONB,
  dados_novos JSONB,
  usuario_id BIGINT,
  data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  endereco_ip VARCHAR(45)
);

CREATE INDEX idx_auditoria_tabela ON auditoria(tabela);
CREATE INDEX idx_auditoria_data ON auditoria(data_hora);
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
```

---

## Relacionamentos

### Integridade Referencial

Todas as Foreign Keys têm ON DELETE CASCADE ou ON DELETE SET NULL conforme apropriado.

**Regras de Integridade**:
1. Não permitir deletar PA com PVs associadas → Use `RESTRICT`
2. Não permitir deletar PP com OPs que a consumem → Use `RESTRICT`
3. Deletar itens de cotação se cotação for deletada → Use `CASCADE`
4. Deletar itens de PC se PC for deletado → Use `CASCADE`

### Relacionamentos Principais

- **PA → BOM**: 1:N (um PA pode ter múltiplas versões de BOM)
- **BOM → Itens BOM**: 1:N (uma BOM tem múltiplos itens)
- **Itens BOM → PP**: N:1 (múltiplos itens podem referenciar mesma PP)
- **Fornecedor → Cotações**: 1:N
- **Fornecedor → PCs**: 1:N
- **Cotação → Itens Cotação**: 1:N
- **PC → Itens PC**: 1:N
- **PV → Itens PV**: 1:N
- **Itens PV → OP**: 1:1
- **OP → Reserva Estoque**: 1:N
- **PP → Reserva Estoque**: 1:N
- **OP → Histórico Kanban**: 1:N
- **OP → Apontamento**: 1:N

---

## Índices e Performance

### Índices Críticos (alta frequência de consulta)

```sql
-- Consultas por status e data
CREATE INDEX idx_op_status_data 
  ON ordens_producao(status, data_conclusao_prevista);

CREATE INDEX idx_pc_status_data 
  ON pedidos_compra(status, data_entrega_prevista);

CREATE INDEX idx_pv_status_data 
  ON pedidos_venda(status, data_entrega_prometida);

-- Consultas de saldo por status
CREATE INDEX idx_saldo_status_pp 
  ON saldo_estoque(status, parte_peca_id);

-- Consultas de movimentação
CREATE INDEX idx_mov_pp_data 
  ON movimentacao_estoque(parte_peca_id, data_hora DESC);

-- Histórico Kanban
CREATE INDEX idx_kanban_op_data 
  ON historico_kanban(ordem_producao_id, data_hora_transicao DESC);
```

### Estratégia de Partição (Futuro - para +500k registros)

```sql
-- Particionar tabela de movimentacao_estoque por mês/ano
CREATE TABLE movimentacao_estoque_2026_08 
  PARTITION OF movimentacao_estoque 
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
```

### Dicas de Performance

1. **Evitar `SELECT *`** - Sempre especificar colunas necessárias
2. **Usar índices para WHERE e JOIN** - Verificar EXPLAIN PLAN
3. **Denormalizar dados de leitura frequente** - Ex: valor_total em itens
4. **Cache de dados estáticos** - PA, PP, Fornecedores (usar Redis)
5. **Paginação em resultados** - Limit 50-100 registros

---

## Migrations

Usar framework de migrations (Flyway, Liquibase, ou Alembic).

### Estrutura de Migrations

```
migrations/
├── 001_criar_tabelas_base.sql
├── 002_criar_tabelas_estoque.sql
├── 003_criar_tabelas_compras.sql
├── 004_criar_tabelas_vendas.sql
├── 005_criar_tabelas_producao.sql
├── 006_criar_indices.sql
├── 007_criar_triggers_auditoria.sql
└── 008_dados_iniciais.sql
```

### Versionamento de Schema

```sql
CREATE TABLE schema_version (
  id INT PRIMARY KEY,
  descricao VARCHAR(255),
  data_aplicacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

**Data de Revisão**: Setembro 2026  
**Próxima Versão**: 1.1

