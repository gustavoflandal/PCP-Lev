-- Usuarios de teste por perfil, com a mesma senha do admin inicial (Admin@123).
INSERT INTO usuarios (username, nome, email, senha_hash, perfil)
SELECT u.username, u.username, u.username || '@e2e.local', a.senha_hash, u.perfil
FROM (VALUES ('almox_teste', 'Almoxarife de Teste', 'ALMOXARIFE'),
             ('comprador_teste', 'Comprador de Teste', 'COMPRADOR'),
             ('operador_teste', 'Operador de Teste', 'OPERADOR'),
             ('gestor_teste', 'Gestor de Teste', 'GESTOR')) AS u(username, nome, perfil),
     usuarios a
WHERE a.username = 'admin'
ON CONFLICT (username) DO NOTHING;
