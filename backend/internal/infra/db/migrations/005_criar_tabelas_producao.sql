-- 005_criar_tabelas_producao.sql
-- Ordens de producao, reservas, Kanban e apontamentos. Ref: RF5

CREATE TABLE ordens_producao (
  id BIGSERIAL PRIMARY KEY,
  numero_op VARCHAR(50) NOT NULL UNIQUE,
  item_pedido_venda_id BIGINT NOT NULL UNIQUE,
  produto_acabado_id BIGINT NOT NULL,
  quantidade INT NOT NULL,
  estrutura_produto_id BIGINT NOT NULL,
  data_conclusao_prevista DATE NOT NULL,
  data_conclusao_real DATE,
  etapa_atual VARCHAR(50) NOT NULL DEFAULT 'Separacao',
  status VARCHAR(20) NOT NULL DEFAULT 'Aberta',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  CONSTRAINT fk_op_item_pv FOREIGN KEY (item_pedido_venda_id)
    REFERENCES itens_pedido_venda(id) ON DELETE RESTRICT,
  CONSTRAINT fk_op_pa FOREIGN KEY (produto_acabado_id)
    REFERENCES produtos_acabados(id) ON DELETE RESTRICT,
  CONSTRAINT fk_op_estrutura FOREIGN KEY (estrutura_produto_id)
    REFERENCES estrutura_produto(id) ON DELETE RESTRICT,
  CONSTRAINT chk_op_quantidade CHECK (quantidade > 0),
  -- RN3: sequencia obrigatoria Separacao -> Montagem -> Testes -> Expedicao.
  CONSTRAINT chk_op_etapa CHECK (etapa_atual IN (
    'Separacao', 'Montagem', 'Testes', 'Expedicao')),
  CONSTRAINT chk_op_status CHECK (status IN ('Aberta', 'Concluida', 'Cancelada'))
);

CREATE INDEX idx_op_numero ON ordens_producao(numero_op);
CREATE INDEX idx_op_status ON ordens_producao(status);
CREATE INDEX idx_op_etapa ON ordens_producao(etapa_atual);
CREATE INDEX idx_op_data_conclusao ON ordens_producao(data_conclusao_prevista);

CREATE TABLE reserva_estoque (
  id BIGSERIAL PRIMARY KEY,
  ordem_producao_id BIGINT NOT NULL,
  parte_peca_id BIGINT NOT NULL,
  quantidade_reservada INT NOT NULL,
  quantidade_consumida INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Reservada',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_reserva_op FOREIGN KEY (ordem_producao_id)
    REFERENCES ordens_producao(id) ON DELETE CASCADE,
  CONSTRAINT fk_reserva_pp FOREIGN KEY (parte_peca_id)
    REFERENCES partes_pecas(id) ON DELETE RESTRICT,
  CONSTRAINT chk_reserva_qtd CHECK (quantidade_reservada > 0),
  CONSTRAINT chk_reserva_consumida CHECK (
    quantidade_consumida >= 0 AND quantidade_consumida <= quantidade_reservada),
  CONSTRAINT chk_reserva_status CHECK (status IN ('Reservada', 'Consumida', 'Liberada')),
  CONSTRAINT uk_op_pp UNIQUE (ordem_producao_id, parte_peca_id)
);

CREATE INDEX idx_reserva_op ON reserva_estoque(ordem_producao_id);
CREATE INDEX idx_reserva_pp ON reserva_estoque(parte_peca_id);
CREATE INDEX idx_reserva_status ON reserva_estoque(status);

CREATE TABLE historico_kanban (
  id BIGSERIAL PRIMARY KEY,
  ordem_producao_id BIGINT NOT NULL,
  etapa_anterior VARCHAR(50),
  etapa_nova VARCHAR(50) NOT NULL,
  data_hora_transicao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_responsavel_id BIGINT,
  observacoes TEXT,

  CONSTRAINT fk_kanban_op FOREIGN KEY (ordem_producao_id)
    REFERENCES ordens_producao(id) ON DELETE CASCADE,
  CONSTRAINT fk_kanban_usuario FOREIGN KEY (usuario_responsavel_id)
    REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX idx_kanban_op ON historico_kanban(ordem_producao_id);
CREATE INDEX idx_kanban_data ON historico_kanban(data_hora_transicao);

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

  CONSTRAINT fk_apontamento_op FOREIGN KEY (ordem_producao_id)
    REFERENCES ordens_producao(id) ON DELETE CASCADE,
  CONSTRAINT fk_apontamento_operador FOREIGN KEY (operador_id)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_apontamento_tempo CHECK (tempo_fim IS NULL OR tempo_fim >= tempo_inicio)
);

CREATE INDEX idx_apontamento_op ON apontamento_producao(ordem_producao_id);
CREATE INDEX idx_apontamento_etapa ON apontamento_producao(etapa);
