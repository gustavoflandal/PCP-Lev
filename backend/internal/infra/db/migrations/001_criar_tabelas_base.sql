-- 001_criar_tabelas_base.sql
-- Cadastros base: usuarios, fornecedores, produtos acabados, partes/pecas e BOM.
-- Ref: docs/2_ARQUITETURA_BANCO_DADOS.md

-- ---------------------------------------------------------------------------
-- usuarios
-- ADICAO AO MODELO: o doc 2 nao define esta tabela, mas ela e referenciada por
-- movimentacao_estoque, historico_kanban, apontamento_producao e auditoria,
-- alem de ser exigida pelo RNF3 (perfis GESTOR / OPERADOR / ADMIN).
-- ---------------------------------------------------------------------------
CREATE TABLE usuarios (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(20) NOT NULL DEFAULT 'OPERADOR',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_login TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  CONSTRAINT chk_perfil CHECK (perfil IN ('ADMIN', 'GESTOR', 'OPERADOR')),
  CONSTRAINT chk_username CHECK (length(trim(username)) >= 3)
);

CREATE INDEX idx_usuario_username ON usuarios(username);
CREATE INDEX idx_usuario_ativo ON usuarios(ativo);

-- ---------------------------------------------------------------------------
-- fornecedores (RF1.4)
-- ---------------------------------------------------------------------------
CREATE TABLE fornecedores (
  id BIGSERIAL PRIMARY KEY,
  razao_social VARCHAR(255) NOT NULL,
  cnpj VARCHAR(14) NOT NULL UNIQUE,
  contato_nome VARCHAR(100),
  contato_email VARCHAR(100),
  contato_telefone VARCHAR(15),
  endereco VARCHAR(255),
  lead_time_medio INT NOT NULL DEFAULT 7,
  condicao_pagamento VARCHAR(50),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  CONSTRAINT chk_lead_time_medio CHECK (lead_time_medio > 0)
);

CREATE INDEX idx_fornecedor_cnpj ON fornecedores(cnpj);
CREATE INDEX idx_fornecedor_ativo ON fornecedores(ativo);

-- ---------------------------------------------------------------------------
-- produtos_acabados (RF1.1)
-- ---------------------------------------------------------------------------
CREATE TABLE produtos_acabados (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  descricao VARCHAR(255) NOT NULL,
  unidade_medida VARCHAR(20) NOT NULL,
  preco_venda DECIMAL(10, 2) NOT NULL,
  lead_time_producao INT NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  CONSTRAINT chk_preco_venda CHECK (preco_venda > 0),
  CONSTRAINT chk_lead_time CHECK (lead_time_producao > 0),
  CONSTRAINT chk_descricao_pa CHECK (length(trim(descricao)) >= 5)
);

CREATE INDEX idx_pa_codigo ON produtos_acabados(codigo);
CREATE INDEX idx_pa_ativo ON produtos_acabados(ativo);

-- ---------------------------------------------------------------------------
-- partes_pecas (RF1.2)
-- ---------------------------------------------------------------------------
CREATE TABLE partes_pecas (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  descricao VARCHAR(255) NOT NULL,
  unidade_medida VARCHAR(20) NOT NULL,
  estoque_minimo INT NOT NULL DEFAULT 5,
  estoque_maximo INT NOT NULL DEFAULT 100,
  fornecedor_padrao_id BIGINT,
  lead_time_compra INT NOT NULL DEFAULT 7,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  CONSTRAINT fk_fornecedor_padrao FOREIGN KEY (fornecedor_padrao_id)
    REFERENCES fornecedores(id) ON DELETE RESTRICT,
  CONSTRAINT chk_estoque_min_max CHECK (estoque_minimo < estoque_maximo),
  CONSTRAINT chk_estoque_minimo CHECK (estoque_minimo >= 0),
  CONSTRAINT chk_lead_time_compra CHECK (lead_time_compra > 0),
  CONSTRAINT chk_descricao_pp CHECK (length(trim(descricao)) >= 5)
);

CREATE INDEX idx_pp_codigo ON partes_pecas(codigo);
CREATE INDEX idx_pp_ativo ON partes_pecas(ativo);
CREATE INDEX idx_pp_fornecedor ON partes_pecas(fornecedor_padrao_id);

-- ---------------------------------------------------------------------------
-- estrutura_produto (BOM) (RF1.3)
-- ---------------------------------------------------------------------------
CREATE TABLE estrutura_produto (
  id BIGSERIAL PRIMARY KEY,
  produto_acabado_id BIGINT NOT NULL,
  versao INT NOT NULL DEFAULT 1,
  data_vigencia_inicio DATE NOT NULL,
  data_vigencia_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  CONSTRAINT fk_produto_acabado FOREIGN KEY (produto_acabado_id)
    REFERENCES produtos_acabados(id) ON DELETE RESTRICT,
  CONSTRAINT uk_pa_versao UNIQUE (produto_acabado_id, versao),
  CONSTRAINT chk_vigencia CHECK (data_vigencia_fim IS NULL OR data_vigencia_fim >= data_vigencia_inicio),
  CONSTRAINT chk_versao CHECK (versao > 0)
);

CREATE INDEX idx_estrutura_pa ON estrutura_produto(produto_acabado_id);
CREATE INDEX idx_estrutura_ativo ON estrutura_produto(ativo);

-- RN4: apenas uma versao ativa de BOM por produto acabado.
CREATE UNIQUE INDEX uk_estrutura_ativa_por_pa
  ON estrutura_produto(produto_acabado_id) WHERE ativo;

-- ---------------------------------------------------------------------------
-- itens_estrutura_produto
-- ---------------------------------------------------------------------------
CREATE TABLE itens_estrutura_produto (
  id BIGSERIAL PRIMARY KEY,
  estrutura_produto_id BIGINT NOT NULL,
  parte_peca_id BIGINT NOT NULL,
  quantidade INT NOT NULL,

  CONSTRAINT fk_estrutura FOREIGN KEY (estrutura_produto_id)
    REFERENCES estrutura_produto(id) ON DELETE CASCADE,
  CONSTRAINT fk_parte_peca FOREIGN KEY (parte_peca_id)
    REFERENCES partes_pecas(id) ON DELETE RESTRICT,
  CONSTRAINT chk_quantidade CHECK (quantidade > 0),
  CONSTRAINT uk_estrutura_pp UNIQUE (estrutura_produto_id, parte_peca_id)
);

CREATE INDEX idx_item_estrutura ON itens_estrutura_produto(estrutura_produto_id);
CREATE INDEX idx_item_estrutura_pp ON itens_estrutura_produto(parte_peca_id);
