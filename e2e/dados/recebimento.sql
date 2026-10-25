-- Limpa uma execucao anterior do roteiro da v1.2 e semeia os dados.
DELETE FROM itens_nf_series WHERE item_nf_id IN (SELECT i.id FROM itens_nf_entrada i JOIN notas_fiscais_entrada n ON n.id = i.nota_id
  JOIN pedidos_compra pc ON pc.id = n.pedido_compra_id WHERE pc.numero_pc LIKE 'PW12-%');
DELETE FROM itens_nf_lotes WHERE item_nf_id IN (SELECT i.id FROM itens_nf_entrada i JOIN notas_fiscais_entrada n ON n.id = i.nota_id
  JOIN pedidos_compra pc ON pc.id = n.pedido_compra_id WHERE pc.numero_pc LIKE 'PW12-%');
DELETE FROM movimentacao_estoque WHERE parte_peca_id IN (SELECT id FROM partes_pecas WHERE codigo LIKE 'PW12-%');
DELETE FROM series_componente WHERE parte_peca_id IN (SELECT id FROM partes_pecas WHERE codigo LIKE 'PW12-%');
DELETE FROM lotes WHERE parte_peca_id IN (SELECT id FROM partes_pecas WHERE codigo LIKE 'PW12-%');
DELETE FROM anexos WHERE entidade = 'nota_entrada' AND entidade_id IN (SELECT n.id FROM notas_fiscais_entrada n
  JOIN pedidos_compra pc ON pc.id = n.pedido_compra_id WHERE pc.numero_pc LIKE 'PW12-%');
DELETE FROM itens_nf_entrada WHERE nota_id IN (SELECT n.id FROM notas_fiscais_entrada n
  JOIN pedidos_compra pc ON pc.id = n.pedido_compra_id WHERE pc.numero_pc LIKE 'PW12-%');
DELETE FROM notas_fiscais_entrada WHERE pedido_compra_id IN (SELECT id FROM pedidos_compra WHERE numero_pc LIKE 'PW12-%');
DELETE FROM itens_pedido_compra WHERE pedido_compra_id IN (SELECT id FROM pedidos_compra WHERE numero_pc LIKE 'PW12-%');
DELETE FROM pedidos_compra WHERE numero_pc LIKE 'PW12-%';
DELETE FROM fornecedor_itens WHERE fornecedor_id IN (SELECT id FROM fornecedores WHERE cnpj = '12012012000115');
DELETE FROM saldo_estoque WHERE parte_peca_id IN (SELECT id FROM partes_pecas WHERE codigo LIKE 'PW12-%');
DELETE FROM partes_pecas WHERE codigo LIKE 'PW12-%';
DELETE FROM fornecedores WHERE cnpj = '12012012000115';

INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio) VALUES ('Eletrônica PW12 Ltda', '12012012000115', 5);
INSERT INTO partes_pecas (codigo, descricao, unidade_medida, controla_lote, controla_validade, validade_minima_dias)
  VALUES ('PW12-PLACA', 'Placa controladora PW12', 'UN', TRUE, TRUE, 30);
INSERT INTO partes_pecas (codigo, descricao, unidade_medida, controla_numero_serie, mascara_serie)
  VALUES ('PW12-CON', 'Conector serial PW12', 'UN', TRUE, 'SN-\d{4}');
INSERT INTO partes_pecas (codigo, descricao, unidade_medida, estoque_minimo) VALUES ('PW12-PAR', 'Parafuso M3 PW12', 'UN', 10);
INSERT INTO saldo_estoque (parte_peca_id, status) SELECT id, 'CRITICO' FROM partes_pecas WHERE codigo LIKE 'PW12-%';

INSERT INTO pedidos_compra (numero_pc, fornecedor_id, data_pedido, data_entrega_prevista, valor_total, status)
  SELECT 'PW12-PC1', id, CURRENT_DATE - 7, CURRENT_DATE + 3, 260, 'Aguardando Entrega' FROM fornecedores WHERE cnpj = '12012012000115';
INSERT INTO itens_pedido_compra (pedido_compra_id, parte_peca_id, quantidade_solicitada, preco_unitario, total)
  SELECT pc.id, pp.id, v.q, v.p, v.q * v.p
  FROM pedidos_compra pc, partes_pecas pp,
       (VALUES ('PW12-PLACA', 4, 50.00), ('PW12-CON', 2, 20.00), ('PW12-PAR', 200, 0.10)) AS v(codigo, q, p)
  WHERE pc.numero_pc = 'PW12-PC1' AND pp.codigo = v.codigo;
-- O parafuso ja vem por caixa de 100 no de-para; placa e conector o roteiro vincula na previa.
INSERT INTO fornecedor_itens (fornecedor_id, parte_peca_id, codigo_fornecedor, unidade_fornecedor, fator_conversao)
  SELECT f.id, pp.id, 'CX-M3', 'CX', 100 FROM fornecedores f, partes_pecas pp WHERE f.cnpj = '12012012000115' AND pp.codigo = 'PW12-PAR';
