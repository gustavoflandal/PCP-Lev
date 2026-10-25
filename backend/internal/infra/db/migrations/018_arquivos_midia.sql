-- 018_arquivos_midia.sql
-- v1.2 R1: servico de arquivos (bytea), anexos por entidade, flags de controle
-- do item (doc 0, 4.1.1) e midia/documentos de produto (4.1.2).
-- Spec: docs/superpowers/specs/2026-10-24-v12-recebimento-fiscal-design.md.

-- Conteudo deduplicado por SHA-256; o nome original e so metadado (o id e
-- interno). Nenhum arquivo e servido por caminho publico: so por URL assinada.
CREATE TABLE arquivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256 CHAR(64) NOT NULL UNIQUE,
  nome_original VARCHAR(255) NOT NULL,
  tipo_mime VARCHAR(100) NOT NULL,
  tamanho INT NOT NULL CHECK (tamanho > 0),
  conteudo BYTEA NOT NULL,
  miniatura BYTEA,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100)
);

-- Vinculo de um arquivo a uma entidade. Documentos versionados compartilham
-- `documento_chave` (o id da primeira versao); so uma versao e vigente.
CREATE TABLE anexos (
  id BIGSERIAL PRIMARY KEY,
  entidade VARCHAR(30) NOT NULL CHECK (entidade IN (
    'produto_acabado', 'parte_peca', 'nota_entrada', 'lote', 'ordem_producao',
    'fornecedor', 'pedido_compra', 'pedido_venda', 'cliente')),
  entidade_id BIGINT NOT NULL,
  arquivo_id UUID NOT NULL REFERENCES arquivos(id) ON DELETE RESTRICT,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('FOTO', 'DOCUMENTO', 'ANEXO')),
  categoria VARCHAR(40) NOT NULL DEFAULT '',
  titulo VARCHAR(150) NOT NULL DEFAULT '',
  descricao VARCHAR(500) NOT NULL DEFAULT '',
  versao VARCHAR(20) NOT NULL DEFAULT '',
  documento_chave BIGINT,
  vigente BOOLEAN NOT NULL DEFAULT TRUE,
  data_emissao DATE,
  data_validade DATE,
  fornecedor_id BIGINT REFERENCES fornecedores(id) ON DELETE SET NULL,
  estrutura_produto_id BIGINT REFERENCES estrutura_produto(id) ON DELETE SET NULL,
  principal BOOLEAN NOT NULL DEFAULT FALSE,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  CONSTRAINT chk_anexo_validade CHECK (data_validade IS NULL OR data_emissao IS NULL OR data_validade >= data_emissao)
);
CREATE INDEX idx_anexos_entidade ON anexos (entidade, entidade_id);
CREATE INDEX idx_anexos_validade ON anexos (data_validade) WHERE data_validade IS NOT NULL AND vigente;
-- Uma foto principal por entidade.
CREATE UNIQUE INDEX uq_anexo_foto_principal ON anexos (entidade, entidade_id) WHERE principal;

CREATE TRIGGER trg_anexos_updated_at BEFORE UPDATE ON anexos
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_updated_at();
CREATE TRIGGER trg_anexos_auditoria AFTER INSERT OR UPDATE OR DELETE ON anexos
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

-- Flags de controle do item (4.1.1): determinam o recebimento e o consumo.
ALTER TABLE partes_pecas
  ADD COLUMN controla_numero_serie BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN controla_lote BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN controla_validade BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN item_critico BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN exige_certificado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN validade_minima_dias INT NOT NULL DEFAULT 0 CHECK (validade_minima_dias BETWEEN 0 AND 3650),
  ADD COLUMN mascara_serie VARCHAR(120) NOT NULL DEFAULT '',
  -- Validade so existe vinculada a lote.
  ADD CONSTRAINT chk_pp_validade_com_lote CHECK (NOT controla_validade OR controla_lote);
ALTER TABLE produtos_acabados
  ADD COLUMN controla_numero_serie BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN controla_lote BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN controla_validade BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN item_critico BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN exige_certificado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT chk_pa_validade_com_lote CHECK (NOT controla_validade OR controla_lote);
