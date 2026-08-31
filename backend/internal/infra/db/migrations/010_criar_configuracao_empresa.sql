-- 010_criar_configuracao_empresa.sql
-- Dados da empresa (Fase 4.2, doc 0 secao 4.6.2). Singleton: uma unica linha,
-- id fixo em 1, nunca inserida de novo -- so lida e atualizada. O CHECK
-- (id = 1) combinado com a PK garante que nao existe segunda linha possivel.
CREATE TABLE configuracao_empresa (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  razao_social VARCHAR(200) NOT NULL DEFAULT '',
  nome_fantasia VARCHAR(200) NOT NULL DEFAULT '',
  cnpj VARCHAR(14) NOT NULL DEFAULT '',
  inscricao_estadual VARCHAR(30) NOT NULL DEFAULT '',
  inscricao_municipal VARCHAR(30) NOT NULL DEFAULT '',
  cnae VARCHAR(20) NOT NULL DEFAULT '',

  cep VARCHAR(8) NOT NULL DEFAULT '',
  logradouro VARCHAR(200) NOT NULL DEFAULT '',
  numero VARCHAR(20) NOT NULL DEFAULT '',
  complemento VARCHAR(100) NOT NULL DEFAULT '',
  bairro VARCHAR(100) NOT NULL DEFAULT '',
  cidade VARCHAR(100) NOT NULL DEFAULT '',
  -- VARCHAR, nao CHAR: um bpchar e preenchido com espacos ate o tamanho
  -- fixo, entao uma UF vazia sairia como "  " (dois espacos) no JSON
  -- publico em vez de "" -- um valor "truthy" indevido no frontend.
  uf VARCHAR(2) NOT NULL DEFAULT '',

  telefone VARCHAR(11) NOT NULL DEFAULT '',
  email VARCHAR(200) NOT NULL DEFAULT '',
  site VARCHAR(200) NOT NULL DEFAULT '',

  rodape_padrao TEXT NOT NULL DEFAULT '',
  condicoes_gerais_compra TEXT NOT NULL DEFAULT '',
  responsavel_tecnico VARCHAR(200) NOT NULL DEFAULT '',

  -- Logotipo guardado como bytea: e um dado unico por empresa (nao um anexo
  -- por documento/OP como a Fase 3.1 preve), entao nao justifica esperar a
  -- decisao de object storage (MinIO/S3) ainda pendente para os anexos.
  logo_claro BYTEA,
  logo_claro_tipo VARCHAR(20),
  logo_escuro BYTEA,
  logo_escuro_tipo VARCHAR(20),
  favicon BYTEA,
  favicon_tipo VARCHAR(20),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by VARCHAR(50)
);

INSERT INTO configuracao_empresa (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
