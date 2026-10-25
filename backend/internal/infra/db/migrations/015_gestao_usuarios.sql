-- 015_gestao_usuarios.sql
-- Gestao de usuarios (Fase 2.2b, doc 0 secao 4.7.3). Spec:
-- docs/superpowers/specs/2026-10-24-usuarios-design.md.

ALTER TABLE usuarios
  ADD COLUMN matricula VARCHAR(30),
  ADD COLUMN telefone VARCHAR(30) NOT NULL DEFAULT '',
  ADD COLUMN setor VARCHAR(60) NOT NULL DEFAULT '',
  ADD COLUMN situacao VARCHAR(10) NOT NULL DEFAULT 'ATIVO'
    CHECK (situacao IN ('ATIVO', 'INATIVO', 'BLOQUEADO')),
  ADD COLUMN data_admissao DATE,
  ADD COLUMN data_desligamento DATE,
  -- Senha inicial/redefinida pelo Administrador: o usuario troca no proximo
  -- acesso antes de qualquer outra coisa.
  ADD COLUMN deve_trocar_senha BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE usuarios SET situacao = CASE WHEN ativo THEN 'ATIVO' ELSE 'INATIVO' END;

-- `ativo` passa a ser derivado da situacao: o codigo que ja o le (login,
-- listagens) segue valendo, e nao ha como os dois divergirem.
ALTER TABLE usuarios DROP COLUMN ativo;
ALTER TABLE usuarios ADD COLUMN ativo BOOLEAN GENERATED ALWAYS AS (situacao = 'ATIVO') STORED;

CREATE UNIQUE INDEX uq_usuarios_matricula ON usuarios (matricula) WHERE matricula IS NOT NULL;

-- Permissoes individuais (doc 0: "concedidas ou revogadas individualmente,
-- sobrepondo o perfil, com justificativa registrada").
CREATE TABLE usuario_permissoes (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  permissao_codigo VARCHAR(60) NOT NULL REFERENCES permissoes(codigo) ON DELETE CASCADE,
  -- TRUE concede algo que o perfil nao da; FALSE retira algo que o perfil da.
  concedida BOOLEAN NOT NULL,
  justificativa VARCHAR(255) NOT NULL CHECK (length(trim(justificativa)) >= 10),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  UNIQUE (usuario_id, permissao_codigo)
);

CREATE TRIGGER trg_usuario_permissoes_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON usuario_permissoes
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

INSERT INTO permissoes (codigo, modulo, acao, descricao, sensivel, ordem) VALUES
  ('configuracoes.usuarios', 'configuracoes', 'usuarios', 'Gerenciar usuários e permissões individuais', TRUE, 98);
