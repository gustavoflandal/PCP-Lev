-- Paineis por setor (dashboards): uma permissao de visualizacao por painel,
-- atribuida na matriz de perfis e concedivel/retiravel por usuario. O Painel
-- inicial nao tem permissao propria (cada bloco segue a do modulo).
INSERT INTO permissoes (codigo, modulo, acao, descricao, sensivel, ordem) VALUES
  ('paineis.compras', 'paineis', 'compras', 'Ver o painel de Compras', FALSE, 891),
  ('paineis.estoque', 'paineis', 'estoque', 'Ver o painel de Recebimento e estoque', FALSE, 892),
  ('paineis.producao', 'paineis', 'producao', 'Ver o painel de Producao', FALSE, 893),
  ('paineis.vendas', 'paineis', 'vendas', 'Ver o painel de Vendas e expedicao', FALSE, 894),
  ('paineis.qualidade', 'paineis', 'qualidade', 'Ver o painel de Qualidade', FALSE, 895);

INSERT INTO perfil_permissoes (perfil_codigo, permissao_codigo)
SELECT p.perfil, p.permissao FROM (VALUES
  ('GESTOR', 'paineis.compras'), ('GESTOR', 'paineis.estoque'), ('GESTOR', 'paineis.producao'),
  ('GESTOR', 'paineis.vendas'), ('GESTOR', 'paineis.qualidade'),
  ('CONSULTA', 'paineis.compras'), ('CONSULTA', 'paineis.estoque'), ('CONSULTA', 'paineis.producao'),
  ('CONSULTA', 'paineis.vendas'), ('CONSULTA', 'paineis.qualidade'),
  ('COMPRADOR', 'paineis.compras'), ('COMPRADOR', 'paineis.estoque'),
  ('ALMOXARIFE', 'paineis.estoque'),
  ('OPERADOR', 'paineis.producao'),
  ('QUALIDADE', 'paineis.producao'), ('QUALIDADE', 'paineis.qualidade'),
  ('VENDAS', 'paineis.vendas')
) AS p(perfil, permissao)
WHERE EXISTS (SELECT 1 FROM perfis WHERE codigo = p.perfil);
