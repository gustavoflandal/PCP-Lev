-- 019_recebimento_fiscal.sql
-- v1.2 R2: nota fiscal de entrada (doc 0, 4.3), de-para item x fornecedor,
-- lotes, series de componente e o rastro no estoque. RN-001: a entrada de
-- insumo comprado passa a ser so por nota fiscal.
-- Spec: docs/superpowers/specs/2026-10-24-v12-recebimento-fiscal-design.md.

-- De-para item x fornecedor: reconhece o item do XML e converte a unidade
-- do fornecedor (ex.: caixa com 100) para a de consumo (peca).
CREATE TABLE fornecedor_itens (
  id BIGSERIAL PRIMARY KEY,
  fornecedor_id BIGINT NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  parte_peca_id BIGINT NOT NULL REFERENCES partes_pecas(id) ON DELETE CASCADE,
  codigo_fornecedor VARCHAR(60) NOT NULL,
  descricao_fornecedor VARCHAR(255) NOT NULL DEFAULT '',
  unidade_fornecedor VARCHAR(10) NOT NULL DEFAULT '',
  fator_conversao NUMERIC(12, 4) NOT NULL DEFAULT 1 CHECK (fator_conversao > 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  UNIQUE (fornecedor_id, codigo_fornecedor)
);

-- Divergencia de preco NF x PC (4.3.4, item 3).
ALTER TABLE configuracao_negocio
  ADD COLUMN tolerancia_preco_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (tolerancia_preco_pct BETWEEN 0 AND 100),
  ADD COLUMN divergencia_preco_acao VARCHAR(10) NOT NULL DEFAULT 'BLOQUEAR'
    CHECK (divergencia_preco_acao IN ('BLOQUEAR', 'APROVAR'));

-- Encerramento do PC com saldo pendente (4.3.6): acao manual com motivo.
ALTER TABLE pedidos_compra
  ADD COLUMN motivo_encerramento VARCHAR(255),
  ADD COLUMN encerrado_por VARCHAR(100);

CREATE TABLE notas_fiscais_entrada (
  id BIGSERIAL PRIMARY KEY,
  pedido_compra_id BIGINT NOT NULL REFERENCES pedidos_compra(id) ON DELETE RESTRICT,
  fornecedor_id BIGINT NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  cnpj_emitente VARCHAR(14) NOT NULL,
  modelo VARCHAR(2) NOT NULL CHECK (modelo IN ('55', '01')),
  serie VARCHAR(3) NOT NULL,
  numero VARCHAR(9) NOT NULL,
  chave_acesso CHAR(44),
  data_emissao DATE NOT NULL,
  data_entrada DATE NOT NULL,
  cfop VARCHAR(4) NOT NULL,
  valor_produtos NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valor_frete NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valor_seguro NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valor_desconto NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valor_ipi NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valor_icms_st NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(12) NOT NULL DEFAULT 'Rascunho'
    CHECK (status IN ('Rascunho', 'Conferida', 'Efetivada', 'Cancelada', 'Estornada')),
  origem VARCHAR(6) NOT NULL DEFAULT 'MANUAL' CHECK (origem IN ('MANUAL', 'XML')),
  -- Versao: conferir/efetivar so valem sobre a versao conferida (outra
  -- pessoa editando no meio e recusada).
  versao INT NOT NULL DEFAULT 1,
  observacoes VARCHAR(1000) NOT NULL DEFAULT '',
  divergencia_aprovada_por VARCHAR(100),
  efetivada_em TIMESTAMP,
  efetivada_por VARCHAR(100),
  estornada_em TIMESTAMP,
  estornada_por VARCHAR(100),
  motivo_estorno VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  CONSTRAINT chk_nf_datas CHECK (data_entrada >= data_emissao),
  CONSTRAINT chk_nf_valores CHECK (valor_produtos >= 0 AND valor_frete >= 0 AND valor_seguro >= 0
    AND valor_desconto >= 0 AND valor_ipi >= 0 AND valor_icms_st >= 0 AND valor_total >= 0)
);
-- Unicidade pela chave e por CNPJ emitente + modelo + serie + numero. Nota
-- cancelada (nunca efetivada) ou estornada libera o relancamento correto
-- (4.3.6: corrige-se estornando e lancando de novo).
CREATE UNIQUE INDEX uq_nf_chave ON notas_fiscais_entrada (chave_acesso)
  WHERE chave_acesso IS NOT NULL AND status NOT IN ('Cancelada', 'Estornada');
CREATE UNIQUE INDEX uq_nf_emitente_numero ON notas_fiscais_entrada (cnpj_emitente, modelo, serie, numero)
  WHERE status NOT IN ('Cancelada', 'Estornada');
CREATE INDEX idx_nf_pedido ON notas_fiscais_entrada (pedido_compra_id);
CREATE INDEX idx_nf_status ON notas_fiscais_entrada (status);

-- Vinculo NF x PC no ITEM (4.3.2): cada linha aponta o item de PC que atende.
CREATE TABLE itens_nf_entrada (
  id BIGSERIAL PRIMARY KEY,
  nota_id BIGINT NOT NULL REFERENCES notas_fiscais_entrada(id) ON DELETE CASCADE,
  ordem INT NOT NULL DEFAULT 0,
  item_pedido_compra_id BIGINT REFERENCES itens_pedido_compra(id) ON DELETE RESTRICT,
  parte_peca_id BIGINT NOT NULL REFERENCES partes_pecas(id) ON DELETE RESTRICT,
  codigo_fornecedor VARCHAR(60) NOT NULL DEFAULT '',
  descricao_nf VARCHAR(255) NOT NULL DEFAULT '',
  unidade_nf VARCHAR(10) NOT NULL DEFAULT '',
  -- Quantidade e valor como estao na nota (unidade do fornecedor)...
  quantidade_nf NUMERIC(14, 4) NOT NULL CHECK (quantidade_nf > 0),
  valor_unitario NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  valor_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  fator_conversao NUMERIC(12, 4) NOT NULL DEFAULT 1 CHECK (fator_conversao > 0),
  -- ... e o que foi contado fisicamente, na unidade de consumo: e o que move
  -- o estoque (4.3.4, item 4).
  quantidade_recebida INT NOT NULL DEFAULT 0 CHECK (quantidade_recebida >= 0),
  bonificacao BOOLEAN NOT NULL DEFAULT FALSE,
  justificativa_bonificacao VARCHAR(255) NOT NULL DEFAULT '',
  certificado_arquivo_id UUID REFERENCES arquivos(id) ON DELETE RESTRICT,
  custo_unitario_entrada NUMERIC(14, 4),
  CONSTRAINT chk_item_nf_vinculo CHECK (bonificacao OR item_pedido_compra_id IS NOT NULL)
);
CREATE INDEX idx_item_nf_nota ON itens_nf_entrada (nota_id);
CREATE INDEX idx_item_nf_item_pc ON itens_nf_entrada (item_pedido_compra_id);

-- Lote do fornecedor: saldo segregado por lote (4.4) com validade (FEFO).
CREATE TABLE lotes (
  id BIGSERIAL PRIMARY KEY,
  parte_peca_id BIGINT NOT NULL REFERENCES partes_pecas(id) ON DELETE RESTRICT,
  fornecedor_id BIGINT REFERENCES fornecedores(id) ON DELETE RESTRICT,
  numero_lote VARCHAR(60) NOT NULL,
  data_fabricacao DATE,
  validade DATE,
  quantidade_atual INT NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
  quantidade_reservada INT NOT NULL DEFAULT 0 CHECK (quantidade_reservada >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_lote_disponivel CHECK (quantidade_atual >= quantidade_reservada)
);
CREATE UNIQUE INDEX uq_lote ON lotes (parte_peca_id, coalesce(fornecedor_id, 0), numero_lote);
CREATE INDEX idx_lote_fefo ON lotes (parte_peca_id, validade NULLS LAST, id) WHERE quantidade_atual > 0;

CREATE TABLE itens_nf_lotes (
  id BIGSERIAL PRIMARY KEY,
  item_nf_id BIGINT NOT NULL REFERENCES itens_nf_entrada(id) ON DELETE CASCADE,
  numero_lote VARCHAR(60) NOT NULL,
  data_fabricacao DATE,
  validade DATE,
  quantidade INT NOT NULL CHECK (quantidade >= 0),
  certificado_arquivo_id UUID REFERENCES arquivos(id) ON DELETE RESTRICT,
  lote_id BIGINT REFERENCES lotes(id) ON DELETE RESTRICT
);

-- Series informadas na digitacao (antes da efetivacao).
CREATE TABLE itens_nf_series (
  id BIGSERIAL PRIMARY KEY,
  item_nf_id BIGINT NOT NULL REFERENCES itens_nf_entrada(id) ON DELETE CASCADE,
  numero VARCHAR(80) NOT NULL,
  numero_lote VARCHAR(60) NOT NULL DEFAULT '',
  UNIQUE (item_nf_id, numero)
);

-- Serie de componente: unica por peca em todo o historico (4.3.5).
CREATE TABLE series_componente (
  id BIGSERIAL PRIMARY KEY,
  parte_peca_id BIGINT NOT NULL REFERENCES partes_pecas(id) ON DELETE RESTRICT,
  numero VARCHAR(80) NOT NULL,
  lote_id BIGINT REFERENCES lotes(id) ON DELETE RESTRICT,
  item_nf_id BIGINT REFERENCES itens_nf_entrada(id) ON DELETE RESTRICT,
  status VARCHAR(12) NOT NULL DEFAULT 'Em Estoque'
    CHECK (status IN ('Em Estoque', 'Reservado', 'Consumido', 'Instalado', 'Sucateado')),
  ordem_producao_id BIGINT REFERENCES ordens_producao(id) ON DELETE RESTRICT,
  numero_serie_pai_id BIGINT REFERENCES numeros_serie(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (parte_peca_id, numero)
);
CREATE INDEX idx_serie_comp_lote ON series_componente (lote_id);
CREATE INDEX idx_serie_comp_op ON series_componente (ordem_producao_id);

-- Kardex: documento de origem clicavel em cada movimento (4.4).
ALTER TABLE movimentacao_estoque
  ADD COLUMN documento_tipo VARCHAR(20) CHECK (documento_tipo IN ('NOTA_ENTRADA', 'ORDEM_PRODUCAO', 'PEDIDO_VENDA', 'AJUSTE')),
  ADD COLUMN documento_id BIGINT,
  ADD COLUMN lote_id BIGINT REFERENCES lotes(id) ON DELETE RESTRICT;

CREATE TRIGGER trg_fornecedor_itens_updated_at BEFORE UPDATE ON fornecedor_itens
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_updated_at();
CREATE TRIGGER trg_nf_entrada_updated_at BEFORE UPDATE ON notas_fiscais_entrada
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_updated_at();
CREATE TRIGGER trg_lotes_updated_at BEFORE UPDATE ON lotes
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_updated_at();
CREATE TRIGGER trg_series_componente_updated_at BEFORE UPDATE ON series_componente
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_updated_at();
CREATE TRIGGER trg_fornecedor_itens_auditoria AFTER INSERT OR UPDATE OR DELETE ON fornecedor_itens
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_nf_entrada_auditoria AFTER INSERT OR UPDATE OR DELETE ON notas_fiscais_entrada
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_itens_nf_entrada_auditoria AFTER INSERT OR UPDATE OR DELETE ON itens_nf_entrada
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_lotes_auditoria AFTER INSERT OR UPDATE OR DELETE ON lotes
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_series_componente_auditoria AFTER INSERT OR UPDATE OR DELETE ON series_componente
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

-- Permissoes. A ordem ganha folga (x10) para encaixar as novas sem renumerar
-- a mao a cada fase.
UPDATE permissoes SET ordem = ordem * 10;
INSERT INTO permissoes (codigo, modulo, acao, descricao, sensivel, ordem) VALUES
  ('pedidos_compra.encerrar', 'pedidos_compra', 'encerrar', 'Encerrar pedido de compra com saldo pendente', FALSE, 675),
  ('notas_entrada.visualizar', 'notas_entrada', 'visualizar', 'Ver notas fiscais de entrada', FALSE, 680),
  ('notas_entrada.lancar', 'notas_entrada', 'lancar', 'Lancar e conferir nota fiscal de entrada', FALSE, 681),
  ('notas_entrada.efetivar', 'notas_entrada', 'efetivar', 'Efetivar nota (entrada no estoque)', FALSE, 682),
  ('notas_entrada.estornar', 'notas_entrada', 'estornar', 'Estornar nota efetivada', TRUE, 683),
  ('notas_entrada.aprovar_divergencia', 'notas_entrada', 'aprovar_divergencia', 'Aprovar divergencia de preco', TRUE, 684);

INSERT INTO perfil_permissoes (perfil_codigo, permissao_codigo)
SELECT p.perfil, p.permissao FROM (VALUES
  ('GESTOR', 'pedidos_compra.encerrar'), ('GESTOR', 'notas_entrada.visualizar'), ('GESTOR', 'notas_entrada.lancar'),
  ('GESTOR', 'notas_entrada.efetivar'), ('GESTOR', 'notas_entrada.estornar'), ('GESTOR', 'notas_entrada.aprovar_divergencia'),
  ('ALMOXARIFE', 'notas_entrada.visualizar'), ('ALMOXARIFE', 'notas_entrada.lancar'), ('ALMOXARIFE', 'notas_entrada.efetivar'),
  ('COMPRADOR', 'notas_entrada.visualizar'), ('COMPRADOR', 'notas_entrada.lancar'),
  ('CONSULTA', 'notas_entrada.visualizar'), ('QUALIDADE', 'notas_entrada.visualizar')
) AS p(perfil, permissao)
WHERE EXISTS (SELECT 1 FROM perfis WHERE codigo = p.perfil);
