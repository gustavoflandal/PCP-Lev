-- 002_criar_tabelas_estoque.sql
-- Controle de estoque: saldo e movimentacoes. Ref: RF2

CREATE TABLE saldo_estoque (
  id BIGSERIAL PRIMARY KEY,
  parte_peca_id BIGINT NOT NULL UNIQUE,
  quantidade_atual INT NOT NULL DEFAULT 0,
  quantidade_reservada INT NOT NULL DEFAULT 0,
  localizacao_armazem VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'OK', -- OK, CRITICO, BLOQUEADO
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),

  CONSTRAINT fk_saldo_parte_peca FOREIGN KEY (parte_peca_id)
    REFERENCES partes_pecas(id) ON DELETE CASCADE,
  CONSTRAINT chk_saldo_quantidade CHECK (quantidade_atual >= 0),
  CONSTRAINT chk_saldo_reservada CHECK (quantidade_reservada >= 0),
  -- RN2: o disponivel (atual - reservado) nunca pode ficar negativo.
  CONSTRAINT chk_saldo_disponivel CHECK ((quantidade_atual - quantidade_reservada) >= 0),
  CONSTRAINT chk_saldo_status CHECK (status IN ('OK', 'CRITICO', 'BLOQUEADO'))
);

CREATE INDEX idx_saldo_status ON saldo_estoque(status);

CREATE TABLE movimentacao_estoque (
  id BIGSERIAL PRIMARY KEY,
  parte_peca_id BIGINT,
  produto_acabado_id BIGINT,
  tipo VARCHAR(20) NOT NULL,   -- Entrada, Saida, Ajuste
  quantidade INT NOT NULL,
  data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  motivo VARCHAR(50) NOT NULL, -- Compra, OP, Ajuste, Devolucao, Expedicao
  referencia_numero VARCHAR(50),
  observacoes TEXT,
  usuario_id BIGINT,

  CONSTRAINT fk_mov_pp FOREIGN KEY (parte_peca_id)
    REFERENCES partes_pecas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mov_pa FOREIGN KEY (produto_acabado_id)
    REFERENCES produtos_acabados(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mov_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_mov_quantidade CHECK (quantidade != 0),
  CONSTRAINT chk_mov_tipo CHECK (tipo IN ('Entrada', 'Saida', 'Ajuste')),
  -- A movimentacao e de uma PP ou de um PA, nunca de ambos.
  CONSTRAINT chk_pp_ou_pa CHECK (
    (parte_peca_id IS NOT NULL AND produto_acabado_id IS NULL) OR
    (parte_peca_id IS NULL AND produto_acabado_id IS NOT NULL)
  )
);

CREATE INDEX idx_mov_pp ON movimentacao_estoque(parte_peca_id);
CREATE INDEX idx_mov_pa ON movimentacao_estoque(produto_acabado_id);
CREATE INDEX idx_mov_data ON movimentacao_estoque(data_hora);
CREATE INDEX idx_mov_motivo ON movimentacao_estoque(motivo);

-- RF2.2: estoque de produtos acabados, alimentado pela conclusao de OP.
CREATE TABLE saldo_produto_acabado (
  id BIGSERIAL PRIMARY KEY,
  produto_acabado_id BIGINT NOT NULL UNIQUE,
  quantidade_atual INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),

  CONSTRAINT fk_saldo_pa FOREIGN KEY (produto_acabado_id)
    REFERENCES produtos_acabados(id) ON DELETE CASCADE,
  CONSTRAINT chk_saldo_pa_quantidade CHECK (quantidade_atual >= 0)
);
