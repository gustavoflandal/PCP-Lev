-- 027_integracao_api.sql
-- Chaves de API para a integracao com o ERP: o ERP consome (somente leitura)
-- a API publica /api/integracao/v1 autenticando-se com o cabecalho X-API-Key.
-- Guardamos so o hash SHA-256 da chave; o segredo completo aparece uma unica
-- vez, na criacao. O prefixo (primeiros caracteres) serve para identificar a
-- chave na tela sem revelar o segredo.

CREATE TABLE chaves_api (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  descricao VARCHAR(255) NOT NULL DEFAULT '',
  prefixo VARCHAR(16) NOT NULL,
  hash_chave CHAR(64) NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por VARCHAR(100) NOT NULL,
  ultimo_uso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revogada_em TIMESTAMPTZ,
  revogada_por VARCHAR(100),

  CONSTRAINT chk_chaves_api_revogacao CHECK (ativo OR revogada_em IS NOT NULL)
);

CREATE INDEX idx_chaves_api_ativo ON chaves_api (ativo);

-- Trilha de auditoria da criacao e da revogacao (o segredo nunca e gravado).
-- UPDATE OF: a atualizacao de ultimo_uso, a cada uso da chave, nao gera linha.
CREATE TRIGGER trg_chaves_api_auditoria AFTER INSERT OR DELETE OR UPDATE OF nome, descricao, ativo ON chaves_api
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

-- Uma permissao so: quem gerencia as chaves tambem ve a documentacao. Sensivel
-- e sem linhas em perfil_permissoes: so o ADMIN tem (por regra); outros perfis
-- recebem pela matriz de perfis ou como permissao individual.
INSERT INTO permissoes (codigo, modulo, acao, descricao, sensivel, ordem) VALUES
  ('integracao.gerenciar', 'integracao', 'gerenciar', 'Gerenciar chaves e consultar as APIs de integração com o ERP', TRUE, 999);
