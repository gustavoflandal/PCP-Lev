-- Uma cotacao para a tela de Cotacoes ter datas a formatar.
INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio)
VALUES ('E2E Fornecedor Regional', '45723174000110', 5) ON CONFLICT DO NOTHING;
INSERT INTO cotacoes (numero_cotacao, fornecedor_id, data_emissao, data_validade, status)
SELECT 'COT-E2E-001', id, CURRENT_DATE, CURRENT_DATE + 15, 'Rascunho' FROM fornecedores WHERE cnpj = '45723174000110'
ON CONFLICT (numero_cotacao) DO NOTHING;
