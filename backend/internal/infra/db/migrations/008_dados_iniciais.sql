-- 008_dados_iniciais.sql
-- Usuario administrador inicial.
-- Credenciais de bootstrap: admin / Admin@123
-- ATENCAO: trocar a senha no primeiro acesso em qualquer ambiente nao-local.

INSERT INTO usuarios (username, nome, email, senha_hash, perfil, ativo, created_by)
VALUES (
  'admin',
  'Administrador do Sistema',
  'admin@pcp.local',
  '$2a$12$HuL6SkNU4/dqDDhOhO.i6u6pis2psp5fdtbL/OF7iaZExC0jA6P8y',
  'ADMIN',
  true,
  'migration'
)
ON CONFLICT (username) DO NOTHING;
