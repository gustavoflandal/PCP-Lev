-- Limpa uma execucao anterior do roteiro da Fase 3 e semeia os dados.
DELETE FROM metrologia_serie WHERE numero_serie_id IN (SELECT id FROM numeros_serie WHERE numero LIKE 'PW3-%');
DELETE FROM numeros_serie WHERE numero LIKE 'PW3-%';
DELETE FROM ordens_producao WHERE item_pedido_venda_id IN (
  SELECT i.id FROM itens_pedido_venda i JOIN pedidos_venda pv ON pv.id = i.pedido_venda_id WHERE pv.numero_pedido LIKE 'PW3-%');
DELETE FROM pedidos_venda WHERE numero_pedido LIKE 'PW3-%';
DELETE FROM movimentacao_estoque WHERE parte_peca_id IN (SELECT id FROM partes_pecas WHERE codigo LIKE 'PW3-%')
  OR produto_acabado_id IN (SELECT id FROM produtos_acabados WHERE codigo LIKE 'PW3-%');
DELETE FROM saldo_produto_acabado WHERE produto_acabado_id IN (SELECT id FROM produtos_acabados WHERE codigo LIKE 'PW3-%');
DELETE FROM itens_estrutura_produto WHERE estrutura_produto_id IN (
  SELECT e.id FROM estrutura_produto e JOIN produtos_acabados pa ON pa.id = e.produto_acabado_id WHERE pa.codigo LIKE 'PW3-%');
DELETE FROM estrutura_produto WHERE produto_acabado_id IN (SELECT id FROM produtos_acabados WHERE codigo LIKE 'PW3-%');
DELETE FROM saldo_estoque WHERE parte_peca_id IN (SELECT id FROM partes_pecas WHERE codigo LIKE 'PW3-%');
DELETE FROM partes_pecas WHERE codigo LIKE 'PW3-%';
DELETE FROM produtos_acabados WHERE codigo LIKE 'PW3-%';
DELETE FROM centros_trabalho WHERE codigo LIKE 'PW3-%';
DELETE FROM clientes WHERE cnpj = '45723174000110';

INSERT INTO clientes (tipo, razao_social, cnpj, cidade, uf) VALUES ('ORGAO_PUBLICO', 'Prefeitura PW3', '45723174000110', 'Contagem', 'MG');
INSERT INTO produtos_acabados (codigo, descricao, unidade_medida, preco_venda, exige_metrologia)
  VALUES ('PW3-RADAR', 'Radar fixo PW3', 'UN', 18500, TRUE);
INSERT INTO partes_pecas (codigo, descricao, unidade_medida, estoque_minimo) VALUES
  ('PW3-PLACA', 'Placa controladora PW3', 'UN', 2), ('PW3-GAB', 'Gabinete PW3', 'UN', 1);
INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, status, custo_medio)
  SELECT id, CASE codigo WHEN 'PW3-PLACA' THEN 20 ELSE 10 END, 'OK', CASE codigo WHEN 'PW3-PLACA' THEN 120 ELSE 45 END
  FROM partes_pecas WHERE codigo LIKE 'PW3-%';
INSERT INTO estrutura_produto (produto_acabado_id, versao, data_vigencia_inicio)
  SELECT id, 1, CURRENT_DATE FROM produtos_acabados WHERE codigo = 'PW3-RADAR';
INSERT INTO itens_estrutura_produto (estrutura_produto_id, parte_peca_id, quantidade)
  SELECT e.id, pp.id, CASE pp.codigo WHEN 'PW3-PLACA' THEN 2 ELSE 1 END
  FROM estrutura_produto e JOIN produtos_acabados pa ON pa.id = e.produto_acabado_id AND pa.codigo = 'PW3-RADAR'
  CROSS JOIN partes_pecas pp WHERE pp.codigo LIKE 'PW3-%';
INSERT INTO centros_trabalho (codigo, nome, etapa, custo_hora) VALUES
  ('PW3-SEP', 'Almoxarifado PW3', 'SEPARACAO', 60), ('PW3-MON', 'Bancada de montagem PW3', 'MONTAGEM', 90),
  ('PW3-TES', 'Bancada de testes PW3', 'TESTES', 110), ('PW3-EXP', 'Expedição PW3', 'EXPEDICAO', 50);
