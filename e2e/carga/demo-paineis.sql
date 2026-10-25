-- Demonstracao dos paineis (screenshots e apresentacao): ~6 meses de operacao
-- ficticia sobre o volume de carga (volume.sql). Rode DEPOIS de volume.sql,
-- num banco descartavel (stack pcp-e2e), nunca em producao.

-- Custo nas pecas de carga (valor em estoque) e lotes com validades variadas.
UPDATE saldo_estoque se SET custo_medio = 2 + (se.parte_peca_id % 60)
FROM partes_pecas pp WHERE pp.id = se.parte_peca_id AND pp.codigo LIKE 'CARGA-%';
INSERT INTO lotes (parte_peca_id, numero_lote, validade, quantidade_atual)
SELECT pp.id, 'DEMO-L' || g, CURRENT_DATE + (g * 7 % 130) - 15, 5 + g % 40
FROM generate_series(1, 120) g
JOIN LATERAL (SELECT id FROM partes_pecas WHERE codigo LIKE 'CARGA-%' ORDER BY id OFFSET g * 17 % 2990 LIMIT 1) pp ON TRUE
ON CONFLICT DO NOTHING;

-- Notas efetivadas para os PCs concluidos (lead time e entradas por mes) e
-- algumas em aberto.
INSERT INTO notas_fiscais_entrada (pedido_compra_id, fornecedor_id, cnpj_emitente, modelo, serie, numero, data_emissao,
  data_entrada, cfop, status, valor_total, efetivada_em)
SELECT pc.id, pc.fornecedor_id, f.cnpj, '01', '1', 'D' || pc.id,
       LEAST(pc.data_pedido + 4 + (pc.id % 22)::int, CURRENT_DATE), LEAST(pc.data_pedido + 5 + (pc.id % 22)::int, CURRENT_DATE), '1102',
       'Efetivada', pc.valor_total, LEAST(pc.data_pedido + 5 + (pc.id % 22)::int, CURRENT_DATE)
FROM pedidos_compra pc JOIN fornecedores f ON f.id = pc.fornecedor_id
WHERE pc.numero_pc LIKE 'PC-CARGA-%' AND pc.status = 'Concluido';
INSERT INTO notas_fiscais_entrada (pedido_compra_id, fornecedor_id, cnpj_emitente, modelo, serie, numero, data_emissao,
  data_entrada, cfop, status, valor_total)
SELECT pc.id, pc.fornecedor_id, f.cnpj, '01', '1', 'A' || pc.id, CURRENT_DATE - 1, CURRENT_DATE, '1102',
       (ARRAY['Rascunho', 'Conferida'])[1 + pc.id % 2], pc.valor_total
FROM pedidos_compra pc JOIN fornecedores f ON f.id = pc.fornecedor_id
WHERE pc.numero_pc LIKE 'PC-CARGA-%' AND pc.status = 'Recebido Parcial' AND pc.id % 9 = 0;

-- Produto, estrutura, clientes e centros da demonstracao.
INSERT INTO produtos_acabados (codigo, descricao, unidade_medida, preco_venda) VALUES
  ('DEMO-PMV', 'Painel de mensagem variavel', 'UN', 48000),
  ('DEMO-RADAR', 'Radar fixo de velocidade', 'UN', 62000),
  ('DEMO-SEMAF', 'Controlador semaforico', 'UN', 21000);
INSERT INTO estrutura_produto (produto_acabado_id, versao, data_vigencia_inicio)
SELECT id, 1, CURRENT_DATE - 400 FROM produtos_acabados WHERE codigo LIKE 'DEMO-%';
INSERT INTO clientes (tipo, razao_social, cnpj)
SELECT 'ORGAO_PUBLICO', c.nome, lpad((80000000000000 + c.n)::text, 14, '0')
FROM (VALUES (1, 'DER Minas Gerais'), (2, 'Prefeitura de Belo Horizonte'), (3, 'DNIT Superintendencia MG'),
             (4, 'Prefeitura de Contagem'), (5, 'Concessionaria Via Sul')) AS c(n, nome);
INSERT INTO centros_trabalho (codigo, nome, etapa, custo_hora) VALUES
  ('DEMO-SEP', 'Almoxarifado', 'SEPARACAO', 60), ('DEMO-MON', 'Bancada de montagem', 'MONTAGEM', 95),
  ('DEMO-TES', 'Laboratorio de testes', 'TESTES', 120), ('DEMO-EXP', 'Expedicao', 'EXPEDICAO', 55);

-- 90 pedidos de venda em ~6 meses: 64 entregues (alguns atrasados), o resto
-- na fabrica. Um item por pedido; quantidade de 1 a 3.
CREATE TEMP TABLE demo_pv AS
SELECT g,
       CURRENT_DATE - 190 + g * 2 AS data_pedido,
       CURRENT_DATE - 190 + g * 2 + 30 AS prometida,
       CASE WHEN g <= 64 THEN 'Entregue' WHEN g <= 72 THEN 'Pronto para Envio' WHEN g <= 84 THEN 'Em Producao' ELSE 'Aberto' END AS status,
       1 + g % 3 AS qtd,
       (SELECT id FROM produtos_acabados WHERE codigo = (ARRAY['DEMO-PMV', 'DEMO-RADAR', 'DEMO-SEMAF'])[1 + g % 3]) AS produto,
       (SELECT id FROM clientes WHERE razao_social = (ARRAY['DER Minas Gerais', 'Prefeitura de Belo Horizonte',
          'DNIT Superintendencia MG', 'Prefeitura de Contagem', 'Concessionaria Via Sul'])[1 + g % 5]) AS cliente
FROM generate_series(1, 90) g;

INSERT INTO pedidos_venda (numero_pedido, cliente_id, data_pedido, data_entrega_prometida, data_entrega_real, valor_total, status)
SELECT 'PV-DEMO-' || lpad(g::text, 3, '0'), cliente, data_pedido, prometida,
       CASE WHEN status = 'Entregue' THEN LEAST(prometida + (CASE WHEN g % 6 = 0 THEN 4 + g % 5 ELSE -(g % 4) END), CURRENT_DATE) END,
       qtd * pa.preco_venda, status
FROM demo_pv d JOIN produtos_acabados pa ON pa.id = d.produto;

INSERT INTO itens_pedido_venda (pedido_venda_id, produto_acabado_id, quantidade, preco_unitario, total)
SELECT pv.id, d.produto, d.qtd, pa.preco_venda, d.qtd * pa.preco_venda
FROM demo_pv d JOIN pedidos_venda pv ON pv.numero_pedido = 'PV-DEMO-' || lpad(d.g::text, 3, '0')
JOIN produtos_acabados pa ON pa.id = d.produto;

-- Uma OP por item: concluida (entregues e prontos), liberada em alguma
-- etapa (em producao) ou aberta (pedidos abertos).
INSERT INTO ordens_producao (numero_op, item_pedido_venda_id, produto_acabado_id, quantidade, estrutura_produto_id,
  data_conclusao_prevista, status, etapa_atual, data_liberacao, data_conclusao_real)
SELECT 'OP-DEMO-' || lpad(d.g::text, 3, '0'), i.id, d.produto, d.qtd, e.id, d.prometida - 3,
       CASE WHEN d.g <= 72 THEN 'Concluida' WHEN d.g <= 84 THEN 'Liberada' ELSE 'Aberta' END,
       CASE WHEN d.g <= 72 THEN 'Expedicao' WHEN d.g <= 84 THEN (ARRAY['Separacao', 'Montagem', 'Montagem', 'Testes'])[1 + d.g % 4]
            ELSE 'Separacao' END,
       CASE WHEN d.g <= 84 THEN d.data_pedido + 3 + d.g % 4 END,
       CASE WHEN d.g <= 72 THEN LEAST(d.prometida - 6 + (CASE WHEN d.g % 6 = 0 THEN 8 ELSE d.g % 5 END), CURRENT_DATE) END
FROM demo_pv d
JOIN pedidos_venda pv ON pv.numero_pedido = 'PV-DEMO-' || lpad(d.g::text, 3, '0')
JOIN itens_pedido_venda i ON i.pedido_venda_id = pv.id
JOIN estrutura_produto e ON e.produto_acabado_id = d.produto;

-- Apontamentos das OPs concluidas nos ultimos 90 dias, uma por etapa.
INSERT INTO apontamento_producao (ordem_producao_id, etapa, tempo_inicio, tempo_fim, duracao_minutos, centro_trabalho_id, custo_hora)
SELECT o.id, ct.etapa_op, o.data_conclusao_real - (ct.ordem * 2) + interval '8 hours',
       o.data_conclusao_real - (ct.ordem * 2) + interval '8 hours' + make_interval(mins => ct.minutos * o.quantidade),
       ct.minutos * o.quantidade, c.id, c.custo_hora
FROM ordens_producao o
CROSS JOIN (VALUES (4, 'Separacao', 'DEMO-SEP', 45), (3, 'Montagem', 'DEMO-MON', 380), (2, 'Testes', 'DEMO-TES', 150),
                   (1, 'Expedicao', 'DEMO-EXP', 40)) AS ct(ordem, etapa_op, codigo, minutos)
JOIN centros_trabalho c ON c.codigo = ct.codigo
WHERE o.numero_op LIKE 'OP-DEMO-%' AND o.status = 'Concluida' AND o.data_conclusao_real >= CURRENT_DATE - 90;

-- Unidades das OPs concluidas: testadas, ~7% reprovadas; as do radar com
-- metrologia (validades espalhadas).
INSERT INTO numeros_serie (numero, ordem_producao_id, produto_acabado_id, status, resultado_teste, testado_em)
SELECT pa.codigo || '-' || lpad((o.id * 10 + u)::text, 6, '0'), o.id, o.produto_acabado_id,
       CASE WHEN (o.id * 10 + u) % 14 = 0 THEN 'Reprovado' ELSE 'Expedido' END,
       CASE WHEN (o.id * 10 + u) % 14 = 0 THEN 'Falha no teste de comunicacao' ELSE 'Aprovado em todos os ensaios' END,
       o.data_conclusao_real - 2 + interval '14 hours'
FROM ordens_producao o JOIN produtos_acabados pa ON pa.id = o.produto_acabado_id
CROSS JOIN generate_series(1, 3) u
WHERE o.numero_op LIKE 'OP-DEMO-%' AND o.status = 'Concluida' AND u <= o.quantidade;

INSERT INTO metrologia_serie (numero_serie_id, numero_aprovacao_modelo, data_verificacao, numero_lacre, validade)
SELECT ns.id, 'INMETRO-0042/2026', ns.testado_em::date, 'LCR-' || ns.id,
       ns.testado_em::date + 365 - (ns.id * 37 % 300)::int
FROM numeros_serie ns JOIN produtos_acabados pa ON pa.id = ns.produto_acabado_id
WHERE pa.codigo = 'DEMO-RADAR' AND ns.status <> 'Reprovado';

ANALYZE;
