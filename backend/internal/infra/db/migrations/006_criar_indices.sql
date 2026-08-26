-- 006_criar_indices.sql
-- Indices compostos para as consultas de alta frequencia. Ref: doc 2, RNF5

CREATE INDEX idx_op_status_data
  ON ordens_producao(status, data_conclusao_prevista);

CREATE INDEX idx_pc_status_data
  ON pedidos_compra(status, data_entrega_prevista);

CREATE INDEX idx_pv_status_data
  ON pedidos_venda(status, data_entrega_prometida);

CREATE INDEX idx_saldo_status_pp
  ON saldo_estoque(status, parte_peca_id);

CREATE INDEX idx_mov_pp_data
  ON movimentacao_estoque(parte_peca_id, data_hora DESC);

CREATE INDEX idx_kanban_op_data
  ON historico_kanban(ordem_producao_id, data_hora_transicao DESC);

-- Busca textual por descricao nas telas de cadastro (ILIKE '%termo%').
CREATE INDEX idx_pa_descricao_lower ON produtos_acabados(lower(descricao));
CREATE INDEX idx_pp_descricao_lower ON partes_pecas(lower(descricao));
CREATE INDEX idx_fornecedor_razao_lower ON fornecedores(lower(razao_social));
