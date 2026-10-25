-- Volume para o teste de carga (ordem de grandeza de alguns anos de uso):
-- 300 fornecedores, 3.000 pecas com saldo, 1.000 pedidos de compra com 5
-- itens e 200.000 movimentacoes de estoque.
INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio)
SELECT 'Carga Fornecedor ' || g, lpad((70000000000000 + g)::text, 14, '0'), 5 + g % 20
FROM generate_series(1, 300) g ON CONFLICT DO NOTHING;

INSERT INTO partes_pecas (codigo, descricao, unidade_medida, estoque_minimo)
SELECT 'CARGA-' || lpad(g::text, 5, '0'), 'Peca de carga ' || g, 'UN', g % 50
FROM generate_series(1, 3000) g ON CONFLICT DO NOTHING;
INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, status)
SELECT id, (id * 7) % 500, CASE WHEN (id * 7) % 500 > 50 THEN 'OK' ELSE 'CRITICO' END
FROM partes_pecas WHERE codigo LIKE 'CARGA-%' ON CONFLICT DO NOTHING;

INSERT INTO pedidos_compra (numero_pc, fornecedor_id, data_pedido, data_entrega_prevista, valor_total, status)
SELECT 'PC-CARGA-' || g, f.id, CURRENT_DATE - (g % 300), CURRENT_DATE - (g % 300) + 15, 1000,
       (ARRAY['Rascunho', 'Aguardando Entrega', 'Recebido Parcial', 'Concluido'])[1 + g % 4]
FROM generate_series(1, 1000) g
JOIN LATERAL (SELECT id FROM fornecedores WHERE razao_social LIKE 'Carga%' ORDER BY id OFFSET g % 300 LIMIT 1) f ON TRUE
ON CONFLICT DO NOTHING;
INSERT INTO itens_pedido_compra (pedido_compra_id, parte_peca_id, quantidade_solicitada, preco_unitario, total)
SELECT pc.id, pp.id, 40, 5, 200
FROM pedidos_compra pc
JOIN LATERAL (SELECT id FROM partes_pecas WHERE codigo LIKE 'CARGA-%' ORDER BY id OFFSET (pc.id * 13) % 2990 LIMIT 5) pp ON TRUE
WHERE pc.numero_pc LIKE 'PC-CARGA-%';

INSERT INTO movimentacao_estoque (parte_peca_id, tipo, quantidade, motivo, data_hora)
SELECT pp.id, CASE WHEN g % 3 = 0 THEN 'Saida' ELSE 'Entrada' END, 1 + g % 20, 'Ajuste', NOW() - (g % 900) * INTERVAL '1 day'
FROM generate_series(1, 200000) g
JOIN LATERAL (SELECT id FROM partes_pecas WHERE codigo LIKE 'CARGA-%' ORDER BY id OFFSET g % 3000 LIMIT 1) pp ON TRUE;
ANALYZE;
