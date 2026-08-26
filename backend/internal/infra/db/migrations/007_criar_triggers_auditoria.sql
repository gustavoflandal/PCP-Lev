-- 007_criar_triggers_auditoria.sql
-- Auditoria (RNF3) e manutencao automatica de updated_at (RNF6).

CREATE TABLE auditoria (
  id BIGSERIAL PRIMARY KEY,
  tabela VARCHAR(100) NOT NULL,
  operacao VARCHAR(10) NOT NULL,
  registro_id BIGINT,
  dados_antigos JSONB,
  dados_novos JSONB,
  usuario_id BIGINT,
  data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  endereco_ip VARCHAR(45),

  CONSTRAINT chk_auditoria_operacao CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX idx_auditoria_tabela ON auditoria(tabela);
CREATE INDEX idx_auditoria_data ON auditoria(data_hora);
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);

-- ---------------------------------------------------------------------------
-- updated_at automatico
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_atualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'usuarios', 'fornecedores', 'produtos_acabados', 'partes_pecas',
    'estrutura_produto', 'saldo_estoque', 'saldo_produto_acabado',
    'cotacoes', 'pedidos_compra', 'pedidos_venda',
    'ordens_producao', 'reserva_estoque'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION fn_atualizar_updated_at()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Trilha de auditoria
-- O usuario responsavel chega pela variavel de sessao `pcp.usuario_id`,
-- definida pelo middleware de autenticacao a cada transacao.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_registrar_auditoria()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id BIGINT;
  v_ip         VARCHAR(45);
  v_registro   BIGINT;
BEGIN
  v_usuario_id := NULLIF(current_setting('pcp.usuario_id', true), '')::BIGINT;
  v_ip         := NULLIF(current_setting('pcp.endereco_ip', true), '');

  IF TG_OP = 'DELETE' THEN
    v_registro := OLD.id;
    INSERT INTO auditoria (tabela, operacao, registro_id, dados_antigos, dados_novos, usuario_id, endereco_ip)
    VALUES (TG_TABLE_NAME, TG_OP, v_registro, to_jsonb(OLD), NULL, v_usuario_id, v_ip);
    RETURN OLD;
  END IF;

  v_registro := NEW.id;
  INSERT INTO auditoria (tabela, operacao, registro_id, dados_antigos, dados_novos, usuario_id, endereco_ip)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_registro,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW),
    v_usuario_id,
    v_ip
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auditar apenas as tabelas de decisao de negocio; movimentacao_estoque e
-- historico_kanban ja sao, por si, tabelas de trilha.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'usuarios', 'fornecedores', 'produtos_acabados', 'partes_pecas',
    'estrutura_produto', 'itens_estrutura_produto',
    'cotacoes', 'pedidos_compra', 'pedidos_venda',
    'ordens_producao', 'reserva_estoque'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_auditoria AFTER INSERT OR UPDATE OR DELETE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria()', t);
  END LOOP;
END $$;
