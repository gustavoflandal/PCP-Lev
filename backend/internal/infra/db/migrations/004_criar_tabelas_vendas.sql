-- 004_criar_tabelas_vendas.sql
-- Pedidos de venda. Ref: RF4

CREATE TABLE pedidos_venda (
  id BIGSERIAL PRIMARY KEY,
  numero_pedido VARCHAR(50) NOT NULL UNIQUE,
  cliente_nome VARCHAR(100) NOT NULL,
  cliente_contato VARCHAR(100),
  data_pedido DATE NOT NULL,
  data_entrega_prometida DATE NOT NULL,
  data_entrega_real DATE,
  valor_total DECIMAL(12, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Aguardando Insumos',
  observacoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  CONSTRAINT chk_pv_data_entrega CHECK (data_entrega_prometida > data_pedido),
  CONSTRAINT chk_pv_status CHECK (status IN (
    'Aguardando Insumos', 'Em Producao', 'Pronto para Envio', 'Entregue', 'Cancelado'))
);

CREATE INDEX idx_pv_numero ON pedidos_venda(numero_pedido);
CREATE INDEX idx_pv_status ON pedidos_venda(status);
CREATE INDEX idx_pv_data_entrega ON pedidos_venda(data_entrega_prometida);

CREATE TABLE itens_pedido_venda (
  id BIGSERIAL PRIMARY KEY,
  pedido_venda_id BIGINT NOT NULL,
  produto_acabado_id BIGINT NOT NULL,
  quantidade INT NOT NULL,
  preco_unitario DECIMAL(10, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,

  CONSTRAINT fk_item_pv FOREIGN KEY (pedido_venda_id)
    REFERENCES pedidos_venda(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_pv_pa FOREIGN KEY (produto_acabado_id)
    REFERENCES produtos_acabados(id) ON DELETE RESTRICT,
  CONSTRAINT chk_item_pv_qtd CHECK (quantidade > 0),
  CONSTRAINT chk_item_pv_preco CHECK (preco_unitario > 0)
);

CREATE INDEX idx_item_pv ON itens_pedido_venda(pedido_venda_id);
