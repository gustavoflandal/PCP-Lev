DELETE FROM movimentacao_estoque WHERE parte_peca_id IN (SELECT id FROM partes_pecas WHERE codigo = 'PW-NEG-001');
DELETE FROM saldo_estoque WHERE parte_peca_id IN (SELECT id FROM partes_pecas WHERE codigo = 'PW-NEG-001');
DELETE FROM itens_pedido_compra WHERE pedido_compra_id IN (SELECT id FROM pedidos_compra WHERE numero_pc = 'PC-PW-NEG');
DELETE FROM pedidos_compra WHERE numero_pc = 'PC-PW-NEG';
DELETE FROM partes_pecas WHERE codigo = 'PW-NEG-001';
DELETE FROM fornecedores WHERE razao_social = 'PW-NEG Fornecedor de Teste';
