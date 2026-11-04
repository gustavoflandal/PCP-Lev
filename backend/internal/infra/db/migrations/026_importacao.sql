-- Importacao de cadastros por planilha (Gabarito + Importar). Uma unica
-- permissao cobre baixar o gabarito e importar; e sensivel porque grava muitos
-- registros de uma vez. ADMIN a tem por regra; o GESTOR recebe pela matriz.
INSERT INTO permissoes (codigo, modulo, acao, descricao, sensivel, ordem) VALUES
  ('importacao.executar', 'importacao', 'executar', 'Baixar o gabarito e importar cadastros por planilha', TRUE, 998);

INSERT INTO perfil_permissoes (perfil_codigo, permissao_codigo)
SELECT 'GESTOR', 'importacao.executar'
WHERE EXISTS (SELECT 1 FROM perfis WHERE codigo = 'GESTOR');
