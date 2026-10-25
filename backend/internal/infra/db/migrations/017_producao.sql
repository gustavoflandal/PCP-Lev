-- 017_producao.sql
-- Fase 3 -- Producao: pedidos de venda com cliente, OP com liberacao e
-- reserva, apontamento por centro de trabalho, numeros de serie, metrologia
-- e custo real (CMP). Spec: docs/superpowers/specs/2026-10-24-producao-design.md.

-- ---------------------------------------------------------------------------
-- Pedidos de venda
-- ---------------------------------------------------------------------------
ALTER TABLE pedidos_venda
  ADD COLUMN cliente_id BIGINT REFERENCES clientes(id) ON DELETE RESTRICT,
  ALTER COLUMN cliente_nome DROP NOT NULL,
  ALTER COLUMN status SET DEFAULT 'Aberto',
  DROP CONSTRAINT chk_pv_status;
UPDATE pedidos_venda SET status = 'Aberto' WHERE status = 'Aguardando Insumos';
ALTER TABLE pedidos_venda ADD CONSTRAINT chk_pv_status CHECK (status IN (
  'Aberto', 'Em Producao', 'Pronto para Envio', 'Entregue', 'Cancelado'));
CREATE INDEX idx_pv_cliente ON pedidos_venda(cliente_id);

-- ---------------------------------------------------------------------------
-- Ordens de producao
-- ---------------------------------------------------------------------------
CREATE SEQUENCE seq_numero_op;

ALTER TABLE ordens_producao
  DROP CONSTRAINT chk_op_status,
  ADD COLUMN data_liberacao TIMESTAMP,
  ADD COLUMN observacoes VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE ordens_producao ADD CONSTRAINT chk_op_status
  CHECK (status IN ('Aberta', 'Liberada', 'Concluida', 'Cancelada'));
-- Uma OP ativa por item: cancelada a OP, o item pode gerar outra.
ALTER TABLE ordens_producao DROP CONSTRAINT ordens_producao_item_pedido_venda_id_key;
CREATE UNIQUE INDEX uq_op_item_ativa ON ordens_producao(item_pedido_venda_id) WHERE status <> 'Cancelada';

-- Custo: o orcado e congelado na liberacao (CMP do momento); o consumo grava o
-- CMP do momento da baixa.
ALTER TABLE reserva_estoque
  ADD COLUMN custo_unitario_orcado NUMERIC(14, 4) NOT NULL DEFAULT 0,
  ADD COLUMN custo_unitario_consumo NUMERIC(14, 4);

-- Dados legados (a tabela existia desde a 005 sem uso pela aplicacao):
-- normaliza antes das regras novas.
UPDATE apontamento_producao SET etapa = 'Separacao'
  WHERE etapa NOT IN ('Separacao', 'Montagem', 'Testes', 'Expedicao');
UPDATE apontamento_producao a SET tempo_fim = a.tempo_inicio, duracao_minutos = 0
  WHERE a.tempo_fim IS NULL AND EXISTS (SELECT 1 FROM apontamento_producao b
    WHERE b.ordem_producao_id = a.ordem_producao_id AND b.tempo_fim IS NULL AND b.id > a.id);

ALTER TABLE apontamento_producao
  ADD COLUMN centro_trabalho_id BIGINT REFERENCES centros_trabalho(id) ON DELETE RESTRICT,
  -- Custo/hora do centro no encerramento: mudar o custo do centro depois nao
  -- reescreve o custo de OPs passadas.
  ADD COLUMN custo_hora NUMERIC(10, 2),
  ADD CONSTRAINT chk_apontamento_etapa CHECK (etapa IN ('Separacao', 'Montagem', 'Testes', 'Expedicao'));
-- Um apontamento aberto por OP: o operador encerra antes de abrir outro.
CREATE UNIQUE INDEX uq_apontamento_aberto ON apontamento_producao(ordem_producao_id) WHERE tempo_fim IS NULL;

-- ---------------------------------------------------------------------------
-- Numeros de serie e metrologia (doc 0, 5.1.A e 5.1.B)
-- ---------------------------------------------------------------------------
ALTER TABLE produtos_acabados ADD COLUMN exige_metrologia BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE numeros_serie (
  id BIGSERIAL PRIMARY KEY,
  numero VARCHAR(80) NOT NULL UNIQUE,
  ordem_producao_id BIGINT NOT NULL REFERENCES ordens_producao(id) ON DELETE RESTRICT,
  produto_acabado_id BIGINT NOT NULL REFERENCES produtos_acabados(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'Em Producao'
    CHECK (status IN ('Em Producao', 'Aprovado', 'Reprovado', 'Em Estoque', 'Expedido', 'Cancelado')),
  resultado_teste VARCHAR(500) NOT NULL DEFAULT '',
  testado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  testado_em TIMESTAMP,
  pedido_venda_entrega_id BIGINT REFERENCES pedidos_venda(id) ON DELETE RESTRICT,
  expedido_em TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_serie_op ON numeros_serie(ordem_producao_id);

CREATE TABLE metrologia_serie (
  id BIGSERIAL PRIMARY KEY,
  numero_serie_id BIGINT NOT NULL UNIQUE REFERENCES numeros_serie(id) ON DELETE CASCADE,
  numero_aprovacao_modelo VARCHAR(60) NOT NULL,
  data_verificacao DATE NOT NULL,
  numero_lacre VARCHAR(60) NOT NULL,
  validade DATE NOT NULL,
  observacoes VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  CONSTRAINT chk_metrologia_validade CHECK (validade > data_verificacao)
);
CREATE INDEX idx_metrologia_validade ON metrologia_serie(validade);

-- ---------------------------------------------------------------------------
-- Custo real (doc 0, 5.1.D) -- CMP por peca
-- ---------------------------------------------------------------------------
ALTER TABLE saldo_estoque ADD COLUMN custo_medio NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (custo_medio >= 0);
ALTER TABLE movimentacao_estoque ADD COLUMN custo_unitario NUMERIC(14, 4);
ALTER TABLE centros_trabalho ADD COLUMN custo_hora NUMERIC(10, 2) CHECK (custo_hora >= 0);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_numeros_serie_updated_at BEFORE UPDATE ON numeros_serie
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_updated_at();
CREATE TRIGGER trg_metrologia_serie_updated_at BEFORE UPDATE ON metrologia_serie
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_updated_at();
CREATE TRIGGER trg_numeros_serie_auditoria AFTER INSERT OR UPDATE OR DELETE ON numeros_serie
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_metrologia_serie_auditoria AFTER INSERT OR UPDATE OR DELETE ON metrologia_serie
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_itens_pedido_venda_auditoria AFTER INSERT OR UPDATE OR DELETE ON itens_pedido_venda
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_apontamento_producao_auditoria AFTER INSERT OR UPDATE OR DELETE ON apontamento_producao
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

-- ---------------------------------------------------------------------------
-- Permissoes (spec secao 4)
-- ---------------------------------------------------------------------------
INSERT INTO permissoes (codigo, modulo, acao, descricao, sensivel, ordem) VALUES
  ('pedidos_venda.visualizar', 'pedidos_venda', 'visualizar', 'Ver pedidos de venda', FALSE, 75),
  ('pedidos_venda.incluir', 'pedidos_venda', 'incluir', 'Cadastrar pedido de venda', FALSE, 76),
  ('pedidos_venda.editar', 'pedidos_venda', 'editar', 'Editar pedido de venda', FALSE, 77),
  ('pedidos_venda.cancelar', 'pedidos_venda', 'cancelar', 'Cancelar pedido de venda', FALSE, 78),
  ('pedidos_venda.entregar', 'pedidos_venda', 'entregar', 'Registrar entrega', FALSE, 79),
  ('producao.visualizar', 'producao', 'visualizar', 'Ver OPs, Kanban e rastreabilidade', FALSE, 81),
  ('producao.gerar_op', 'producao', 'gerar_op', 'Gerar OP', FALSE, 82),
  ('producao.liberar', 'producao', 'liberar', 'Liberar OP (reserva material)', FALSE, 83),
  ('producao.apontar', 'producao', 'apontar', 'Apontar producao', FALSE, 84),
  ('producao.avancar', 'producao', 'avancar', 'Avancar etapa e concluir OP', FALSE, 85),
  ('producao.cancelar', 'producao', 'cancelar', 'Cancelar OP', FALSE, 86),
  ('producao.testar', 'producao', 'testar', 'Registrar resultado de teste', FALSE, 87),
  ('producao.metrologia', 'producao', 'metrologia', 'Registrar metrologia', TRUE, 88),
  ('producao.custos', 'producao', 'custos', 'Ver custo real das OPs', TRUE, 89);

INSERT INTO perfil_permissoes (perfil_codigo, permissao_codigo)
SELECT 'GESTOR', codigo FROM permissoes WHERE modulo IN ('pedidos_venda', 'producao');

INSERT INTO perfil_permissoes (perfil_codigo, permissao_codigo)
SELECT p.perfil, p.permissao FROM (VALUES
  ('VENDAS', 'pedidos_venda.visualizar'), ('VENDAS', 'pedidos_venda.incluir'),
  ('VENDAS', 'pedidos_venda.editar'), ('VENDAS', 'pedidos_venda.cancelar'),
  ('VENDAS', 'pedidos_venda.entregar'), ('VENDAS', 'producao.visualizar'),
  ('OPERADOR', 'producao.visualizar'), ('OPERADOR', 'producao.apontar'), ('OPERADOR', 'producao.avancar'),
  ('QUALIDADE', 'producao.visualizar'), ('QUALIDADE', 'producao.apontar'),
  ('QUALIDADE', 'producao.testar'), ('QUALIDADE', 'producao.metrologia'),
  ('ALMOXARIFE', 'producao.visualizar'), ('ALMOXARIFE', 'producao.apontar'), ('ALMOXARIFE', 'producao.avancar'),
  ('CONSULTA', 'pedidos_venda.visualizar'), ('CONSULTA', 'producao.visualizar'),
  ('COMPRADOR', 'producao.visualizar')
) AS p(perfil, permissao)
WHERE EXISTS (SELECT 1 FROM perfis WHERE codigo = p.perfil);
