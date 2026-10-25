-- 012_criar_configuracao_negocio.sql
-- Parametros de negocio de Estoque e Compras (Fase 4, doc 0 secao 4.7.5).
-- Singleton, mesmo padrao de configuracao_regional (011): PK fixa + CHECK
-- garantem uma unica linha, que ja nasce com os defaults -- o comportamento
-- do sistema antes desta migration (tolerancia 0%, sem alcada, sem minimo de
-- cotacoes) e exatamente o dos defaults.
CREATE TABLE configuracao_negocio (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Estoque. Usado pelo custo real por OP (Fase 3, item 5.1.D).
  metodo_custeio VARCHAR(4) NOT NULL DEFAULT 'CMP'
    CHECK (metodo_custeio IN ('CMP', 'PEPS', 'UPC')),

  -- Recebimento: excesso aceito sobre a quantidade solicitada de cada item.
  tolerancia_excesso_recebimento_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (tolerancia_excesso_recebimento_pct BETWEEN 0 AND 100),

  -- Compras.
  lead_time_padrao_dias INT NOT NULL DEFAULT 7
    CHECK (lead_time_padrao_dias BETWEEN 1 AND 365),
  -- NULL = Gestor emite pedido de compra de qualquer valor.
  limite_emissao_gestor NUMERIC(12,2) CHECK (limite_emissao_gestor >= 0),
  -- 0 = regra desligada.
  cotacoes_minimas INT NOT NULL DEFAULT 0 CHECK (cotacoes_minimas BETWEEN 0 AND 10),
  valor_exige_cotacoes NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_exige_cotacoes >= 0),

  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50)
);

INSERT INTO configuracao_negocio (id) VALUES (1);

-- Alcada e minimo de cotacoes sao controles internos: quem os afrouxou (e
-- depois restaurou), e quando, precisa ficar na trilha da migration 007 --
-- updated_by/updated_at so guardam a ultima alteracao.
CREATE TRIGGER trg_configuracao_negocio_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON configuracao_negocio
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

-- A tolerancia de recebimento (ate 100%) passa a permitir receber mais que o
-- solicitado. O CHECK original da migration 003 (recebida <= solicitada)
-- recusaria qualquer excesso; o novo teto e o maximo que a tolerancia
-- consegue liberar. O limite efetivo (com a tolerancia configurada) e
-- aplicado pela aplicacao, dentro da transacao do recebimento.
ALTER TABLE itens_pedido_compra DROP CONSTRAINT chk_item_pc_recebimento;
ALTER TABLE itens_pedido_compra ADD CONSTRAINT chk_item_pc_recebimento CHECK (
  quantidade_recebida >= 0 AND quantidade_recebida <= quantidade_solicitada::bigint * 2);
