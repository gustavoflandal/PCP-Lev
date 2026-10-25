-- 016_criar_clientes_centros.sql
-- Cadastros de Clientes e Centros de Trabalho (Fase 2.3, doc 0 secao 4.1).
-- Spec: docs/superpowers/specs/2026-10-24-clientes-centros-design.md.

CREATE TABLE clientes (
  id BIGSERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL
    CHECK (tipo IN ('ORGAO_PUBLICO', 'CONCESSIONARIA', 'INTEGRADOR', 'OUTRO')),
  razao_social VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255) NOT NULL DEFAULT '',
  cnpj VARCHAR(14) NOT NULL UNIQUE,
  inscricao_estadual VARCHAR(30) NOT NULL DEFAULT '',
  contato_nome VARCHAR(100) NOT NULL DEFAULT '',
  contato_email VARCHAR(100) NOT NULL DEFAULT '',
  contato_telefone VARCHAR(20) NOT NULL DEFAULT '',
  endereco VARCHAR(255) NOT NULL DEFAULT '',
  cidade VARCHAR(100) NOT NULL DEFAULT '',
  uf VARCHAR(2) NOT NULL DEFAULT '',
  -- Contratos publicos: numero do contrato/ata e a vigencia.
  numero_contrato VARCHAR(60) NOT NULL DEFAULT '',
  vigencia_inicio DATE,
  vigencia_fim DATE,
  condicao_pagamento VARCHAR(50) NOT NULL DEFAULT '',
  observacoes VARCHAR(1000) NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  CONSTRAINT chk_clientes_vigencia CHECK (vigencia_fim IS NULL OR vigencia_inicio IS NULL OR vigencia_fim >= vigencia_inicio)
);

CREATE INDEX idx_clientes_razao_social ON clientes (razao_social);

-- Centros de trabalho / bancadas: o recurso onde cada etapa fixa do Kanban
-- (RN3: Separacao -> Montagem -> Testes -> Expedicao) acontece.
CREATE TABLE centros_trabalho (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  etapa VARCHAR(20) NOT NULL
    CHECK (etapa IN ('SEPARACAO', 'MONTAGEM', 'TESTES', 'EXPEDICAO')),
  capacidade_horas_dia NUMERIC(3, 1) CHECK (capacidade_horas_dia > 0 AND capacidade_horas_dia <= 24),
  descricao VARCHAR(255) NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100)
);

CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_updated_at();
CREATE TRIGGER trg_centros_trabalho_updated_at BEFORE UPDATE ON centros_trabalho
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_updated_at();
CREATE TRIGGER trg_clientes_auditoria AFTER INSERT OR UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_centros_trabalho_auditoria AFTER INSERT OR UPDATE OR DELETE ON centros_trabalho
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

INSERT INTO permissoes (codigo, modulo, acao, descricao, sensivel, ordem) VALUES
  ('clientes.visualizar', 'clientes', 'visualizar', 'Ver clientes', FALSE, 15),
  ('clientes.incluir', 'clientes', 'incluir', 'Cadastrar cliente', FALSE, 16),
  ('clientes.editar', 'clientes', 'editar', 'Editar cliente', FALSE, 17),
  ('clientes.inativar', 'clientes', 'inativar', 'Inativar cliente', FALSE, 18),
  ('centros_trabalho.visualizar', 'centros_trabalho', 'visualizar', 'Ver centros de trabalho', FALSE, 42),
  ('centros_trabalho.incluir', 'centros_trabalho', 'incluir', 'Cadastrar centro de trabalho', FALSE, 43),
  ('centros_trabalho.editar', 'centros_trabalho', 'editar', 'Editar centro de trabalho', FALSE, 44),
  ('centros_trabalho.inativar', 'centros_trabalho', 'inativar', 'Inativar centro de trabalho', FALSE, 45);

-- Matriz inicial (spec secao 3). ADMIN tem tudo por regra.
INSERT INTO perfil_permissoes (perfil_codigo, permissao_codigo)
SELECT p.perfil, p.permissao FROM (VALUES
  ('GESTOR', 'clientes.visualizar'), ('GESTOR', 'clientes.incluir'),
  ('GESTOR', 'clientes.editar'), ('GESTOR', 'clientes.inativar'),
  ('GESTOR', 'centros_trabalho.visualizar'), ('GESTOR', 'centros_trabalho.incluir'),
  ('GESTOR', 'centros_trabalho.editar'), ('GESTOR', 'centros_trabalho.inativar'),
  ('VENDAS', 'clientes.visualizar'), ('VENDAS', 'clientes.incluir'),
  ('VENDAS', 'clientes.editar'), ('VENDAS', 'clientes.inativar'),
  ('VENDAS', 'centros_trabalho.visualizar'),
  ('OPERADOR', 'centros_trabalho.visualizar'),
  ('QUALIDADE', 'centros_trabalho.visualizar'),
  ('CONSULTA', 'clientes.visualizar'), ('CONSULTA', 'centros_trabalho.visualizar')
) AS p(perfil, permissao)
WHERE EXISTS (SELECT 1 FROM perfis WHERE codigo = p.perfil);
