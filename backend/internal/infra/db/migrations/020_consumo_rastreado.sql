-- 020_consumo_rastreado.sql
-- v1.2 R4: a OP reserva e consome lotes (FEFO) e series de componente, para
-- a rastreabilidade equipamento -> lote -> nota fiscal -> fornecedor (4.3.7).

CREATE TABLE reservas_lote (
  id BIGSERIAL PRIMARY KEY,
  ordem_producao_id BIGINT NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
  parte_peca_id BIGINT NOT NULL REFERENCES partes_pecas(id) ON DELETE RESTRICT,
  lote_id BIGINT NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT,
  quantidade INT NOT NULL CHECK (quantidade > 0),
  consumida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ordem_producao_id, lote_id)
);
CREATE INDEX idx_reservas_lote_lote ON reservas_lote (lote_id);

CREATE TRIGGER trg_reservas_lote_auditoria AFTER INSERT OR UPDATE OR DELETE ON reservas_lote
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
