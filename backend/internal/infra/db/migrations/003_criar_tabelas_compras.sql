-- 003_criar_tabelas_compras.sql
-- Cotacoes e pedidos de compra. Ref: RF3

CREATE TABLE cotacoes (
  id BIGSERIAL PRIMARY KEY,
  numero_cotacao VARCHAR(50) NOT NULL UNIQUE,
  fornecedor_id BIGINT NOT NULL,
  data_emissao DATE NOT NULL,
  data_validade DATE NOT NULL,
  data_resposta DATE,
  valor_total DECIMAL(12, 2),
  status VARCHAR(20) NOT NULL DEFAULT 'Rascunho',
  observacoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  CONSTRAINT fk_cotacao_fornecedor FOREIGN KEY (fornecedor_id)
    REFERENCES fornecedores(id) ON DELETE RESTRICT,
  CONSTRAINT chk_cotacao_validade CHECK (data_validade > data_emissao),
  CONSTRAINT chk_cotacao_status CHECK (
    status IN ('Rascunho', 'Enviada', 'Respondida', 'Cancelada'))
);

CREATE INDEX idx_cotacao_numero ON cotacoes(numero_cotacao);
CREATE INDEX idx_cotacao_fornecedor ON cotacoes(fornecedor_id);
CREATE INDEX idx_cotacao_status ON cotacoes(status);

CREATE TABLE itens_cotacao (
  id BIGSERIAL PRIMARY KEY,
  cotacao_id BIGINT NOT NULL,
  parte_peca_id BIGINT NOT NULL,
  quantidade INT NOT NULL,
  preco_unitario DECIMAL(10, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,

  CONSTRAINT fk_item_cotacao FOREIGN KEY (cotacao_id)
    REFERENCES cotacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_cotacao_pp FOREIGN KEY (parte_peca_id)
    REFERENCES partes_pecas(id) ON DELETE RESTRICT,
  CONSTRAINT chk_item_cotacao_qtd CHECK (quantidade > 0),
  CONSTRAINT chk_item_cotacao_preco CHECK (preco_unitario > 0)
);

CREATE INDEX idx_item_cotacao ON itens_cotacao(cotacao_id);

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
  status VARCHAR(30) NOT NULL DEFAULT 'Rascunho',
  observacoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  CONSTRAINT fk_pc_cotacao FOREIGN KEY (cotacao_id)
    REFERENCES cotacoes(id) ON DELETE SET NULL,
  CONSTRAINT fk_pc_fornecedor FOREIGN KEY (fornecedor_id)
    REFERENCES fornecedores(id) ON DELETE RESTRICT,
  CONSTRAINT chk_pc_data_entrega CHECK (data_entrega_prevista > data_pedido),
  CONSTRAINT chk_pc_status CHECK (status IN (
    'Rascunho', 'Emitido', 'Aceito', 'Aguardando Entrega',
    'Recebido Parcial', 'Concluido', 'Cancelado'))
);

CREATE INDEX idx_pc_numero ON pedidos_compra(numero_pc);
CREATE INDEX idx_pc_fornecedor ON pedidos_compra(fornecedor_id);
CREATE INDEX idx_pc_status ON pedidos_compra(status);
CREATE INDEX idx_pc_data_entrega ON pedidos_compra(data_entrega_prevista);

CREATE TABLE itens_pedido_compra (
  id BIGSERIAL PRIMARY KEY,
  pedido_compra_id BIGINT NOT NULL,
  parte_peca_id BIGINT NOT NULL,
  quantidade_solicitada INT NOT NULL,
  quantidade_recebida INT NOT NULL DEFAULT 0,
  preco_unitario DECIMAL(10, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,

  CONSTRAINT fk_item_pc FOREIGN KEY (pedido_compra_id)
    REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_pc_pp FOREIGN KEY (parte_peca_id)
    REFERENCES partes_pecas(id) ON DELETE RESTRICT,
  CONSTRAINT chk_item_pc_qtd CHECK (quantidade_solicitada > 0),
  -- RF3.5: recebimento parcial ate 100% do solicitado.
  CONSTRAINT chk_item_pc_recebimento CHECK (
    quantidade_recebida >= 0 AND quantidade_recebida <= quantidade_solicitada)
);

CREATE INDEX idx_item_pc ON itens_pedido_compra(pedido_compra_id);
CREATE INDEX idx_item_pc_pp ON itens_pedido_compra(parte_peca_id);
