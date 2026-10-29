-- 023_demo_data.sql
-- Massa de dados para demonstração do sistema PCP-Lev.
-- Popula todas as telas: empresa, usuários, fornecedores, partes/peças,
-- produtos acabados, BOM, clientes, centros de trabalho, estoque, lotes,
-- cotações, pedidos de compra, notas fiscais de entrada, pedidos de venda,
-- ordens de produção, kanban, apontamentos, números de série, metrologia e
-- rastreabilidade.
--
-- Credenciais: todos os usuários demo usam senha  Admin@123
-- Prefixo DEM- evita conflito com scripts e2e/carga/demo-paineis.sql (DEMO-).

-- ===========================================================================
-- 1. DADOS DA EMPRESA
-- ===========================================================================
UPDATE configuracao_empresa SET
  razao_social         = 'Lev Eletrônica Indústria e Comércio Ltda',
  nome_fantasia        = 'Lev Eletrônica',
  cnpj                 = '12345678000195',
  inscricao_estadual   = '123.456.789/0001',
  cnae                 = '2610-8/01',
  cep                  = '30310090',
  logradouro           = 'Av. do Contorno',
  numero               = '6061',
  bairro               = 'Funcionários',
  cidade               = 'Belo Horizonte',
  uf                   = 'MG',
  telefone             = '3132714000',
  email                = 'contato@lev.com.br',
  site                 = 'www.lev.com.br',
  responsavel_tecnico  = 'Eng. Paulo Roberto Alves CREA-MG 123456/D',
  rodape_padrao        = 'Lev Eletrônica — CNPJ 12.345.678/0001-95 — www.lev.com.br',
  updated_by           = 'migration'
WHERE id = 1;

-- ===========================================================================
-- 2. PARÂMETROS DE NEGÓCIO
-- ===========================================================================
UPDATE configuracao_negocio SET
  lead_time_padrao_dias              = 14,
  limite_emissao_gestor              = 50000,
  cotacoes_minimas                   = 2,
  valor_exige_cotacoes               = 5000,
  tolerancia_excesso_recebimento_pct = 5,
  tolerancia_preco_pct               = 3,
  divergencia_preco_acao             = 'APROVAR',
  updated_by                         = 'migration'
WHERE id = 1;

-- ===========================================================================
-- 3. USUÁRIOS DEMO  (senha: Admin@123)
-- ===========================================================================
INSERT INTO usuarios (username, nome, email, senha_hash, perfil, situacao,
  matricula, setor, telefone, data_admissao, created_by)
VALUES
  ('gestor_demo',     'Carlos Andrade Silva',    'carlos.andrade@lev.com.br',
   '$2a$12$HuL6SkNU4/dqDDhOhO.i6u6pis2psp5fdtbL/OF7iaZExC0jA6P8y',
   'GESTOR',     'ATIVO', 'M-001', 'Planejamento', '31987650001', '2023-03-01', 'migration'),
  ('comprador_demo',  'Ana Beatriz Martins',     'ana.martins@lev.com.br',
   '$2a$12$HuL6SkNU4/dqDDhOhO.i6u6pis2psp5fdtbL/OF7iaZExC0jA6P8y',
   'COMPRADOR',  'ATIVO', 'M-002', 'Compras',      '31987650002', '2023-06-15', 'migration'),
  ('almoxarife_demo', 'Roberto Ferreira Costa',  'roberto.ferreira@lev.com.br',
   '$2a$12$HuL6SkNU4/dqDDhOhO.i6u6pis2psp5fdtbL/OF7iaZExC0jA6P8y',
   'ALMOXARIFE', 'ATIVO', 'M-003', 'Almoxarifado', '31987650003', '2022-09-01', 'migration'),
  ('operador_demo',   'Júlio César Pontes',      'julio.pontes@lev.com.br',
   '$2a$12$HuL6SkNU4/dqDDhOhO.i6u6pis2psp5fdtbL/OF7iaZExC0jA6P8y',
   'OPERADOR',   'ATIVO', 'M-004', 'Montagem',     '31987650004', '2024-01-10', 'migration'),
  ('qualidade_demo',  'Fernanda Oliveira Rocha', 'fernanda.oliveira@lev.com.br',
   '$2a$12$HuL6SkNU4/dqDDhOhO.i6u6pis2psp5fdtbL/OF7iaZExC0jA6P8y',
   'QUALIDADE',  'ATIVO', 'M-005', 'Qualidade',    '31987650005', '2023-11-20', 'migration'),
  ('vendas_demo',     'Marcelo Santos Borges',   'marcelo.santos@lev.com.br',
   '$2a$12$HuL6SkNU4/dqDDhOhO.i6u6pis2psp5fdtbL/OF7iaZExC0jA6P8y',
   'VENDAS',     'ATIVO', 'M-006', 'Vendas',       '31987650006', '2023-08-01', 'migration')
ON CONFLICT (username) DO NOTHING;

-- ===========================================================================
-- 4. FORNECEDORES
-- ===========================================================================
INSERT INTO fornecedores (razao_social, cnpj, contato_nome, contato_email,
  contato_telefone, endereco, lead_time_medio, condicao_pagamento, created_by)
VALUES
  ('Datasul Componentes Eletrônicos SA', '11223344000195',
   'Fernando Lopes',     'vendas@datasul.com.br',   '1133221100',
   'R. das Indústrias, 500 — São Paulo/SP', 21, '30/60 DDL', 'migration'),
  ('LED Plus Importadora Ltda',          '22334455000186',
   'Carla Mendes',       'carla@ledplus.com.br',     '1133009900',
   'Av. Paulista, 1200 — São Paulo/SP',     30, '30 DDL',    'migration'),
  ('Metalúrgica Centro-Oeste Ltda',      '33445566000177',
   'Marcos Alves',       'marcos@metalco.com.br',    '3499887766',
   'Rod. BR-050, km 120 — Uberlândia/MG',  14, '28 DDL',    'migration'),
  ('Tecnopeças do Brasil Ltda',          '44556677000168',
   'Renata Figueiredo',  'renata@tecnopecas.com.br', '1155443322',
   'R. Vergueiro, 3900 — São Paulo/SP',    10, '15 DDL',    'migration')
ON CONFLICT (cnpj) DO NOTHING;

-- ===========================================================================
-- 5. PARTES E PEÇAS  (20 itens)
-- ===========================================================================
INSERT INTO partes_pecas (
  codigo, descricao, unidade_medida, estoque_minimo, estoque_maximo,
  lead_time_compra, fornecedor_padrao_id,
  controla_lote, controla_numero_serie, item_critico,
  exige_certificado, controla_validade, validade_minima_dias, created_by)
SELECT
  p.codigo, p.descricao, p.um,
  p.emin::int, p.emax::int, p.lt::int,
  f.id,
  p.clote::boolean, p.cserie::boolean, p.critico::boolean,
  p.cert::boolean,  p.cvalid::boolean, p.valmin::int,
  'migration'
FROM (VALUES
  ('DEM-PCB-PMV',      'Placa controladora PMV',               'UN',  5, 20, 21, 'Datasul Componentes Eletrônicos SA', 't','f','t','f','f', 0),
  ('DEM-LED-AM',       'Módulo LED âmbar 12V cx50',            'CX', 10, 50, 30, 'LED Plus Importadora Ltda',          't','f','f','f','f', 0),
  ('DEM-FONTE-48V',    'Fonte de alimentação 48V/10A',         'UN',  5, 20, 21, 'Datasul Componentes Eletrônicos SA', 'f','f','t','f','f', 0),
  ('DEM-GABINETE-PMV', 'Gabinete alumínio extrudado PMV',      'UN',  5, 15, 14, 'Metalúrgica Centro-Oeste Ltda',      'f','f','f','f','f', 0),
  ('DEM-DISPLAY-PMV',  'Módulo display alfanumérico LED',      'UN',  5, 20, 30, 'LED Plus Importadora Ltda',          'f','t','t','f','f', 0),
  ('DEM-SENSOR-RADAR', 'Sensor piezoelétrico bidirecional',    'UN',  8, 30, 21, 'Datasul Componentes Eletrônicos SA', 'f','t','t','t','f', 0),
  ('DEM-PCB-RADAR',    'Placa processadora FPGA radar',        'UN',  5, 20, 21, 'Datasul Componentes Eletrônicos SA', 't','f','t','f','f', 0),
  ('DEM-CAMERA-RADAR', 'Câmera digital 2MP IP65',              'UN',  4, 20, 30, 'Tecnopeças do Brasil Ltda',          'f','t','t','f','f', 0),
  ('DEM-GABINETE-RAD', 'Gabinete inox 304 radar IP67',         'UN',  4, 15, 14, 'Metalúrgica Centro-Oeste Ltda',      'f','f','f','f','f', 0),
  ('DEM-FONTE-12V',    'Fonte chaveada 12V/5A',                'UN',  8, 40, 14, 'Datasul Componentes Eletrônicos SA', 'f','f','f','f','f', 0),
  ('DEM-MOD-SEM-V',    'Módulo semafórico LED verde 300mm',    'UN', 10, 50, 30, 'LED Plus Importadora Ltda',          't','f','f','f','f', 0),
  ('DEM-MOD-SEM-A',    'Módulo semafórico LED amarelo 300mm',  'UN', 10, 50, 30, 'LED Plus Importadora Ltda',          't','f','f','f','f', 0),
  ('DEM-MOD-SEM-VM',   'Módulo semafórico LED vermelho 300mm', 'UN', 10, 50, 30, 'LED Plus Importadora Ltda',          't','f','f','f','f', 0),
  ('DEM-CTRL-SEM',     'Controlador semafórico FPGA',          'UN',  5, 20, 21, 'Datasul Componentes Eletrônicos SA', 'f','f','t','f','f', 0),
  ('DEM-FONTE-SEM',    'Fonte universal 85-265V AC 10A',       'UN',  5, 20, 14, 'Datasul Componentes Eletrônicos SA', 'f','f','f','f','f', 0),
  ('DEM-CABO-USB',     'Cabo USB-C 2m blindado',               'UN', 20,100, 10, 'Tecnopeças do Brasil Ltda',          'f','f','f','f','f', 0),
  ('DEM-PAR-M4X10',    'Parafuso inox M4x10 (cx100)',          'CX', 10, 40, 10, 'Metalúrgica Centro-Oeste Ltda',      'f','f','f','f','f', 0),
  ('DEM-VEDACAO-IP66', 'Kit vedação IP66',                     'KT', 10, 40, 14, 'Metalúrgica Centro-Oeste Ltda',      'f','f','f','f','f', 0),
  ('DEM-FUSIVEL-5A',   'Fusível cerâmico 5A',                  'UN', 20,100, 10, 'Tecnopeças do Brasil Ltda',          'f','f','f','f','f', 0),
  ('DEM-LABEL-INM',    'Etiqueta INMETRO lacre permanente',    'UN', 20,100, 14, 'Tecnopeças do Brasil Ltda',          't','f','f','t','t', 365)
) AS p(codigo, descricao, um, emin, emax, lt, fornecedor_nome,
       clote, cserie, critico, cert, cvalid, valmin)
JOIN fornecedores f ON f.razao_social = p.fornecedor_nome
ON CONFLICT (codigo) DO NOTHING;

-- ===========================================================================
-- 6. PRODUTOS ACABADOS
-- ===========================================================================
INSERT INTO produtos_acabados (codigo, descricao, unidade_medida, preco_venda,
  lead_time_producao, exige_metrologia, controla_numero_serie, created_by)
VALUES
  ('DEM-PMV',   'Painel de Mensagem Variável LED', 'UN', 48000.00, 5, FALSE, TRUE,  'migration'),
  ('DEM-RADAR', 'Radar Fixo de Velocidade',         'UN', 62000.00, 7, TRUE,  TRUE,  'migration'),
  ('DEM-SEMAF', 'Controlador Semafórico',           'UN', 21000.00, 4, FALSE, TRUE,  'migration')
ON CONFLICT (codigo) DO NOTHING;

-- ===========================================================================
-- 7. BOM — cabeçalhos (uma versão ativa por produto)
-- ===========================================================================
INSERT INTO estrutura_produto
  (produto_acabado_id, versao, data_vigencia_inicio, created_by)
SELECT pa.id, 1, CURRENT_DATE - 365, 'migration'
FROM   produtos_acabados pa
WHERE  pa.codigo IN ('DEM-PMV', 'DEM-RADAR', 'DEM-SEMAF')
  AND NOT EXISTS (
    SELECT 1 FROM estrutura_produto e
    WHERE  e.produto_acabado_id = pa.id AND e.ativo
  );

-- ===========================================================================
-- 8. BOM — itens
-- ===========================================================================
INSERT INTO itens_estrutura_produto (estrutura_produto_id, parte_peca_id, quantidade)
SELECT e.id, pp.id, i.qtd::int
FROM (VALUES
  ('DEM-PMV',   'DEM-PCB-PMV',      1),
  ('DEM-PMV',   'DEM-LED-AM',       8),
  ('DEM-PMV',   'DEM-FONTE-48V',    1),
  ('DEM-PMV',   'DEM-GABINETE-PMV', 1),
  ('DEM-PMV',   'DEM-DISPLAY-PMV',  2),
  ('DEM-PMV',   'DEM-CABO-USB',     1),
  ('DEM-PMV',   'DEM-PAR-M4X10',    2),
  ('DEM-PMV',   'DEM-LABEL-INM',    1),
  ('DEM-PMV',   'DEM-VEDACAO-IP66', 1),
  ('DEM-RADAR', 'DEM-SENSOR-RADAR', 4),
  ('DEM-RADAR', 'DEM-PCB-RADAR',    1),
  ('DEM-RADAR', 'DEM-CAMERA-RADAR', 2),
  ('DEM-RADAR', 'DEM-GABINETE-RAD', 1),
  ('DEM-RADAR', 'DEM-FONTE-12V',    1),
  ('DEM-RADAR', 'DEM-CABO-USB',     1),
  ('DEM-RADAR', 'DEM-PAR-M4X10',    2),
  ('DEM-RADAR', 'DEM-LABEL-INM',    1),
  ('DEM-RADAR', 'DEM-VEDACAO-IP66', 1),
  ('DEM-SEMAF', 'DEM-MOD-SEM-V',    2),
  ('DEM-SEMAF', 'DEM-MOD-SEM-A',    2),
  ('DEM-SEMAF', 'DEM-MOD-SEM-VM',   2),
  ('DEM-SEMAF', 'DEM-CTRL-SEM',     1),
  ('DEM-SEMAF', 'DEM-FONTE-SEM',    1),
  ('DEM-SEMAF', 'DEM-CABO-USB',     1),
  ('DEM-SEMAF', 'DEM-PAR-M4X10',    2),
  ('DEM-SEMAF', 'DEM-VEDACAO-IP66', 1),
  ('DEM-SEMAF', 'DEM-FUSIVEL-5A',   2)
) AS i(pa_cod, pp_cod, qtd)
JOIN produtos_acabados pa  ON pa.codigo = i.pa_cod
JOIN estrutura_produto  e  ON e.produto_acabado_id = pa.id AND e.ativo
JOIN partes_pecas       pp ON pp.codigo = i.pp_cod
ON CONFLICT (estrutura_produto_id, parte_peca_id) DO NOTHING;

-- ===========================================================================
-- 9. CLIENTES
-- ===========================================================================
INSERT INTO clientes (tipo, razao_social, nome_fantasia, cnpj,
  contato_nome, contato_email, cidade, uf, condicao_pagamento, created_by)
VALUES
  ('ORGAO_PUBLICO',  'Secretaria de Infraestrutura e Mobilidade de MG', 'SEINFRA-MG',
   '13208450000139', 'Dr. Paulo Machado',        'licitacoes@seinfra.mg.gov.br', 'Belo Horizonte','MG','30 DDL','migration'),
  ('ORGAO_PUBLICO',  'Companhia de Engenharia de Tráfego de São Paulo', 'CET-SP',
   '59339009000195', 'Eng. Mônica Andrade',      'contratos@cetsp.com.br',       'São Paulo',     'SP','30 DDL','migration'),
  ('ORGAO_PUBLICO',  'Departamento de Estradas e Rodagem de MG',        'DER-MG',
   '21974398000150', 'Eng. Henrique Braga',      'licitacoes@der.mg.gov.br',     'Belo Horizonte','MG','30 DDL','migration'),
  ('CONCESSIONARIA', 'Rodovias do Sul Concessões SA',                   'RodoSul',
   '14616042000108', 'Sr. Gustavo Peixoto',      'compras@rodosul.com.br',       'Curitiba',      'PR','28 DDL','migration'),
  ('INTEGRADOR',     'Soluções Inteligentes de Mobilidade Urbana Ltda', 'SIMU',
   '32048040000113', 'Sra. Patrícia Lima',       'contato@simu.com.br',          'Brasília',      'DF','21 DDL','migration')
ON CONFLICT (cnpj) DO NOTHING;

-- ===========================================================================
-- 10. CENTROS DE TRABALHO
-- ===========================================================================
INSERT INTO centros_trabalho
  (codigo, nome, etapa, capacidade_horas_dia, descricao, custo_hora, created_by)
VALUES
  ('DEM-SEP','Almoxarifado',          'SEPARACAO', 8.0,'Separação e conferência de materiais',  55.00,'migration'),
  ('DEM-MON','Bancada de Montagem',   'MONTAGEM',  8.0,'Montagem e soldagem de placas',         95.00,'migration'),
  ('DEM-TES','Laboratório de Testes', 'TESTES',    8.0,'Ensaios elétricos e funcionais',       120.00,'migration'),
  ('DEM-EXP','Expedição',             'EXPEDICAO', 8.0,'Embalagem, lacre e despacho',           55.00,'migration')
ON CONFLICT (codigo) DO NOTHING;

-- ===========================================================================
-- 11. SALDO DE ESTOQUE — partes/peças
-- (quantidade_reservada = 0 agora; atualizado depois das reservas)
-- ===========================================================================
INSERT INTO saldo_estoque
  (parte_peca_id, quantidade_atual, quantidade_reservada,
   localizacao_armazem, status, custo_medio, updated_by)
SELECT pp.id, s.qtd::int, 0, s.loc, 'OK', s.custo::numeric, 'migration'
FROM (VALUES
  ('DEM-PCB-PMV',      38, 'A1-01',  185.00),
  ('DEM-LED-AM',       70, 'A1-02',   42.50),
  ('DEM-FONTE-48V',    28, 'A1-03',  320.00),
  ('DEM-GABINETE-PMV', 18, 'A1-04',  650.00),
  ('DEM-DISPLAY-PMV',  22, 'A1-05',  280.00),
  ('DEM-SENSOR-RADAR', 50, 'B1-01',  420.00),
  ('DEM-PCB-RADAR',    19, 'B1-02',  540.00),
  ('DEM-CAMERA-RADAR', 18, 'B1-03',  385.00),
  ('DEM-GABINETE-RAD', 15, 'B1-04',  920.00),
  ('DEM-FONTE-12V',    35, 'B1-05',   95.00),
  ('DEM-MOD-SEM-V',    60, 'C1-01',   85.00),
  ('DEM-MOD-SEM-A',    60, 'C1-02',   85.00),
  ('DEM-MOD-SEM-VM',   60, 'C1-03',   85.00),
  ('DEM-CTRL-SEM',     18, 'C1-04',  340.00),
  ('DEM-FONTE-SEM',    16, 'C1-05',  280.00),
  ('DEM-CABO-USB',    120, 'D1-01',   18.00),
  ('DEM-PAR-M4X10',    55, 'D1-02',   12.00),
  ('DEM-VEDACAO-IP66', 50, 'D1-03',   35.00),
  ('DEM-FUSIVEL-5A',   90, 'D1-04',    4.50),
  ('DEM-LABEL-INM',    70, 'D1-05',    8.00)
) AS s(codigo, qtd, loc, custo)
JOIN partes_pecas pp ON pp.codigo = s.codigo
ON CONFLICT (parte_peca_id) DO NOTHING;

-- ===========================================================================
-- 12. SALDO DE PRODUTOS ACABADOS
-- ===========================================================================
INSERT INTO saldo_produto_acabado (produto_acabado_id, quantidade_atual, updated_by)
SELECT pa.id, s.qtd::int, 'migration'
FROM (VALUES
  ('DEM-PMV',   2),
  ('DEM-RADAR', 1),
  ('DEM-SEMAF', 3)
) AS s(codigo, qtd)
JOIN produtos_acabados pa ON pa.codigo = s.codigo
ON CONFLICT (produto_acabado_id) DO NOTHING;

-- ===========================================================================
-- 13. LOTES
-- ===========================================================================
INSERT INTO lotes
  (parte_peca_id, fornecedor_id, numero_lote, data_fabricacao, validade,
   quantidade_atual)
SELECT pp.id, f.id,
       l.lote, l.fab::date,
       CASE WHEN l.val = '' THEN NULL ELSE l.val::date END,
       l.qtd::int
FROM (VALUES
  ('DEM-PCB-PMV',      'Datasul Componentes Eletrônicos SA', 'DS-PCB-2026-03-A', '2026-03-10', '',           12),
  ('DEM-PCB-PMV',      'Datasul Componentes Eletrônicos SA', 'DS-PCB-2026-07-A', '2026-07-05', '',           10),
  ('DEM-LED-AM',       'LED Plus Importadora Ltda',          'LP-LED-2026-04-B', '2026-04-15', '',           35),
  ('DEM-LED-AM',       'LED Plus Importadora Ltda',          'LP-LED-2026-09-C', '2026-09-20', '',           35),
  ('DEM-SENSOR-RADAR', 'Datasul Componentes Eletrônicos SA', 'DS-SNS-2026-05-A', '2026-05-20', '',           22),
  ('DEM-SENSOR-RADAR', 'Datasul Componentes Eletrônicos SA', 'DS-SNS-2026-09-B', '2026-09-10', '',           28),
  ('DEM-PCB-RADAR',    'Datasul Componentes Eletrônicos SA', 'DS-PCB-R-2026-06', '2026-06-18', '',           10),
  ('DEM-MOD-SEM-V',    'LED Plus Importadora Ltda',          'LP-SEM-2026-02-V', '2026-02-28', '',           30),
  ('DEM-MOD-SEM-A',    'LED Plus Importadora Ltda',          'LP-SEM-2026-02-A', '2026-02-28', '',           30),
  ('DEM-MOD-SEM-VM',   'LED Plus Importadora Ltda',          'LP-SEM-2026-02-VM','2026-02-28', '',           30),
  ('DEM-LABEL-INM',    'Tecnopeças do Brasil Ltda',          'TP-LBL-2026-01-A', '2026-01-15', '2028-01-15', 70)
) AS l(codigo, fornecedor_nome, lote, fab, val, qtd)
JOIN partes_pecas pp ON pp.codigo = l.codigo
JOIN fornecedores  f ON f.razao_social = l.fornecedor_nome
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- 14. MAPEAMENTO FORNECEDOR × ITEM  (de-para para importação de XML)
-- ===========================================================================
INSERT INTO fornecedor_itens
  (fornecedor_id, parte_peca_id, codigo_fornecedor, descricao_fornecedor,
   unidade_fornecedor, fator_conversao, created_by)
SELECT f.id, pp.id, m.cod_forn, m.desc_forn, m.un_forn, m.fator::numeric, 'migration'
FROM (VALUES
  ('Datasul Componentes Eletrônicos SA', 'DEM-PCB-PMV',      'DS-7100-PMV',  'PLACA CTR PMV REV3',          'UN', 1),
  ('Datasul Componentes Eletrônicos SA', 'DEM-FONTE-48V',    'DS-4810',      'FONTE 48V 10A CHAV',          'UN', 1),
  ('Datasul Componentes Eletrônicos SA', 'DEM-PCB-RADAR',    'DS-7200-RAD',  'PLACA PROC FPGA RADAR',       'UN', 1),
  ('Datasul Componentes Eletrônicos SA', 'DEM-SENSOR-RADAR', 'DS-8800-BPZT', 'SENSOR PIEZO BIDIRECIONAL',   'UN', 1),
  ('Datasul Componentes Eletrônicos SA', 'DEM-FONTE-12V',    'DS-1205',      'FONTE CHAV 12V 5A',           'UN', 1),
  ('Datasul Componentes Eletrônicos SA', 'DEM-CTRL-SEM',     'DS-7300-SEM',  'CTRL SEMAFOR FPGA',           'UN', 1),
  ('Datasul Componentes Eletrônicos SA', 'DEM-FONTE-SEM',    'DS-UNI10',     'FONTE UNIVERSAL 10A',         'UN', 1),
  ('LED Plus Importadora Ltda',          'DEM-LED-AM',       'LP-LA-50',     'MOD LED AMBAR CX50',          'CX', 1),
  ('LED Plus Importadora Ltda',          'DEM-DISPLAY-PMV',  'LP-DSP-AL',    'DISPLAY ALFANUM LED',         'UN', 1),
  ('LED Plus Importadora Ltda',          'DEM-MOD-SEM-V',    'LP-SV-300',    'MOD SEM LED VERDE 300MM',     'UN', 1),
  ('LED Plus Importadora Ltda',          'DEM-MOD-SEM-A',    'LP-SA-300',    'MOD SEM LED AMAR 300MM',      'UN', 1),
  ('LED Plus Importadora Ltda',          'DEM-MOD-SEM-VM',   'LP-SR-300',    'MOD SEM LED VERM 300MM',      'UN', 1),
  ('Metalúrgica Centro-Oeste Ltda',      'DEM-GABINETE-PMV', 'MC-GAB-PMV-A', 'GABINETE ALU EXTRUD PMV',     'UN', 1),
  ('Metalúrgica Centro-Oeste Ltda',      'DEM-GABINETE-RAD', 'MC-GAB-RAD-I', 'GABINETE INOX 304 RADAR',     'UN', 1),
  ('Metalúrgica Centro-Oeste Ltda',      'DEM-VEDACAO-IP66', 'MC-VED-IP66',  'KIT VEDACAO IP66',            'KT', 1),
  ('Metalúrgica Centro-Oeste Ltda',      'DEM-PAR-M4X10',    'MC-PAR-M4X10', 'PARAF INOX M4X10 CX100',      'CX', 1),
  ('Tecnopeças do Brasil Ltda',          'DEM-CAMERA-RADAR', 'TP-CAM-2MP',   'CAMERA DIGITAL 2MP IP65',     'UN', 1),
  ('Tecnopeças do Brasil Ltda',          'DEM-CABO-USB',     'TP-CUSBCM2',   'CABO USB-C 2M BLINDADO',      'UN', 1),
  ('Tecnopeças do Brasil Ltda',          'DEM-FUSIVEL-5A',   'TP-FUS5A',     'FUSIVEL CERAMICO 5A',         'UN', 1),
  ('Tecnopeças do Brasil Ltda',          'DEM-LABEL-INM',    'TP-ETQ-INM',   'ETIQUETA INMETRO LACRE',      'UN', 1)
) AS m(fornecedor_nome, peca_codigo, cod_forn, desc_forn, un_forn, fator)
JOIN fornecedores  f  ON f.razao_social  = m.fornecedor_nome
JOIN partes_pecas  pp ON pp.codigo       = m.peca_codigo
ON CONFLICT (fornecedor_id, codigo_fornecedor) DO NOTHING;

-- ===========================================================================
-- 15. COTAÇÕES DE COMPRA
-- ===========================================================================
INSERT INTO cotacoes (numero_cotacao, fornecedor_id, data_emissao, data_validade,
  data_resposta, valor_total, status, observacoes, created_by)
SELECT c.num, f.id,
       c.emissao::date, c.validade::date,
       CASE WHEN c.resposta = '' THEN NULL ELSE c.resposta::date END,
       CASE WHEN c.total = '' THEN NULL ELSE c.total::numeric END,
       c.status, c.obs, 'migration'
FROM (VALUES
  ('COT-DEM-001','Datasul Componentes Eletrônicos SA','2026-08-01','2026-09-01','2026-08-15','28400.00','Respondida','Reposição de placas e fontes para Q3'),
  ('COT-DEM-002','LED Plus Importadora Ltda',         '2026-09-10','2026-10-10','',          '',        'Enviada',   'Módulos semafóricos — lote outono'),
  ('COT-DEM-003','Metalúrgica Centro-Oeste Ltda',     '2026-10-20','2026-11-20','',          '',        'Rascunho',  'Gabinetes e vedações para Q4')
) AS c(num, fornecedor_nome, emissao, validade, resposta, total, status, obs)
JOIN fornecedores f ON f.razao_social = c.fornecedor_nome
ON CONFLICT (numero_cotacao) DO NOTHING;

-- Itens da COT-DEM-001
INSERT INTO itens_cotacao (cotacao_id, parte_peca_id, quantidade, preco_unitario, total)
SELECT cot.id, pp.id, i.qtd::int, i.pu::numeric, i.qtd::int * i.pu::numeric
FROM cotacoes cot
CROSS JOIN (VALUES
  ('DEM-PCB-PMV',  10, 190.00),
  ('DEM-FONTE-48V', 8, 325.00),
  ('DEM-PCB-RADAR', 6, 550.00)
) AS i(cod, qtd, pu)
JOIN partes_pecas pp ON pp.codigo = i.cod
WHERE cot.numero_cotacao = 'COT-DEM-001';

-- Itens da COT-DEM-002
INSERT INTO itens_cotacao (cotacao_id, parte_peca_id, quantidade, preco_unitario, total)
SELECT cot.id, pp.id, i.qtd::int, i.pu::numeric, i.qtd::int * i.pu::numeric
FROM cotacoes cot
CROSS JOIN (VALUES
  ('DEM-MOD-SEM-V',  20, 88.00),
  ('DEM-MOD-SEM-A',  20, 88.00),
  ('DEM-MOD-SEM-VM', 20, 88.00)
) AS i(cod, qtd, pu)
JOIN partes_pecas pp ON pp.codigo = i.cod
WHERE cot.numero_cotacao = 'COT-DEM-002';

-- Itens da COT-DEM-003
INSERT INTO itens_cotacao (cotacao_id, parte_peca_id, quantidade, preco_unitario, total)
SELECT cot.id, pp.id, i.qtd::int, i.pu::numeric, i.qtd::int * i.pu::numeric
FROM cotacoes cot
CROSS JOIN (VALUES
  ('DEM-GABINETE-PMV', 8, 660.00),
  ('DEM-GABINETE-RAD', 6, 930.00),
  ('DEM-VEDACAO-IP66', 15, 36.00)
) AS i(cod, qtd, pu)
JOIN partes_pecas pp ON pp.codigo = i.cod
WHERE cot.numero_cotacao = 'COT-DEM-003';

-- ===========================================================================
-- 16. PEDIDOS DE COMPRA
-- ===========================================================================
INSERT INTO pedidos_compra (numero_pc, cotacao_id, fornecedor_id, data_pedido,
  data_entrega_prevista, data_entrega_real, valor_total,
  condicao_pagamento, status, created_by)
SELECT p.num, cot.id, f.id,
       p.pedido::date, p.prev::date,
       CASE WHEN p.real = '' THEN NULL ELSE p.real::date END,
       p.total::numeric, p.cond, p.status, 'migration'
FROM (VALUES
  ('PC-DEM-001','COT-DEM-001','Datasul Componentes Eletrônicos SA','2026-08-18','2026-09-08','2026-09-06',28400.00,'30/60 DDL','Concluido'),
  ('PC-DEM-002',NULL,         'LED Plus Importadora Ltda',         '2026-09-15','2026-10-15','',          15840.00,'30 DDL',   'Aguardando Entrega'),
  ('PC-DEM-003',NULL,         'Metalúrgica Centro-Oeste Ltda',     '2026-10-01','2026-10-22','',           9630.00,'28 DDL',   'Emitido'),
  ('PC-DEM-004',NULL,         'Tecnopeças do Brasil Ltda',         '2026-10-22','2026-11-05','',           3800.00,'15 DDL',   'Rascunho'),
  ('PC-DEM-005',NULL,         'Datasul Componentes Eletrônicos SA','2026-09-20','2026-10-11','',          18200.00,'30/60 DDL','Recebido Parcial')
) AS p(num, cot_num, fornecedor_nome, pedido, prev, real, total, cond, status)
LEFT JOIN cotacoes   cot ON cot.numero_cotacao = p.cot_num
JOIN       fornecedores f ON f.razao_social    = p.fornecedor_nome
ON CONFLICT (numero_pc) DO NOTHING;

-- Itens dos pedidos de compra
INSERT INTO itens_pedido_compra
  (pedido_compra_id, parte_peca_id, quantidade_solicitada, quantidade_recebida,
   preco_unitario, total)
SELECT pc.id, pp.id, i.qs::int, i.qr::int, i.pu::numeric, i.qs::int * i.pu::numeric
FROM pedidos_compra pc
JOIN (VALUES
  ('PC-DEM-001','DEM-PCB-PMV',   10, 10, 190.00),
  ('PC-DEM-001','DEM-FONTE-48V',  8,  8, 325.00),
  ('PC-DEM-001','DEM-PCB-RADAR',  6,  6, 550.00),
  ('PC-DEM-002','DEM-MOD-SEM-V',  20, 0,  88.00),
  ('PC-DEM-002','DEM-MOD-SEM-A',  20, 0,  88.00),
  ('PC-DEM-002','DEM-MOD-SEM-VM', 20, 0,  88.00),
  ('PC-DEM-003','DEM-GABINETE-PMV', 8, 0, 660.00),
  ('PC-DEM-003','DEM-GABINETE-RAD', 6, 0, 930.00),
  ('PC-DEM-003','DEM-VEDACAO-IP66',15, 0,  36.00),
  ('PC-DEM-004','DEM-CABO-USB',    80, 0,  18.50),
  ('PC-DEM-004','DEM-FUSIVEL-5A', 100, 0,   4.80),
  ('PC-DEM-005','DEM-SENSOR-RADAR',20,10, 425.00),
  ('PC-DEM-005','DEM-CAMERA-RADAR',12, 4, 385.00)
) AS i(pc_num, peca_cod, qs, qr, pu) ON pc.numero_pc = i.pc_num
JOIN partes_pecas pp ON pp.codigo = i.peca_cod;

-- ===========================================================================
-- 17. NOTAS FISCAIS DE ENTRADA
-- ===========================================================================
INSERT INTO notas_fiscais_entrada
  (pedido_compra_id, fornecedor_id, cnpj_emitente, modelo, serie, numero,
   chave_acesso, data_emissao, data_entrada, cfop,
   valor_produtos, valor_total, status, efetivada_em, efetivada_por, created_by)
SELECT pc.id, f.id, f.cnpj,
       n.modelo, n.serie, n.numero, n.chave,
       n.emissao::date, n.entrada::date, n.cfop,
       n.valor::numeric, n.valor::numeric,
       n.status,
       CASE WHEN n.status = 'Efetivada' THEN n.entrada::timestamp ELSE NULL END,
       CASE WHEN n.status = 'Efetivada' THEN 'migration'            ELSE NULL END,
       'migration'
FROM (VALUES
  ('PC-DEM-001','55','1','000000101','35260811223344000195550010000001019187654301','2026-09-05','2026-09-06','1102',28400.00,'Efetivada'),
  ('PC-DEM-005','55','1','000000102','35261011223344000195550010000001029187654302','2026-10-09','2026-10-10','1102', 9200.00,'Conferida')
) AS n(pc_num, modelo, serie, numero, chave, emissao, entrada, cfop, valor, status)
JOIN pedidos_compra pc ON pc.numero_pc = n.pc_num
JOIN fornecedores    f ON f.id         = pc.fornecedor_id
ON CONFLICT DO NOTHING;

-- Itens da NF efetivada (PC-DEM-001)
INSERT INTO itens_nf_entrada
  (nota_id, ordem, item_pedido_compra_id, parte_peca_id,
   codigo_fornecedor, descricao_nf, unidade_nf,
   quantidade_nf, valor_unitario, valor_total,
   fator_conversao, quantidade_recebida, custo_unitario_entrada)
SELECT nf.id, i.ordem::int, ipc.id, pp.id,
       COALESCE(fi.codigo_fornecedor, ''), pp.descricao, pp.unidade_medida,
       i.qtd::numeric, i.pu::numeric, i.qtd::numeric * i.pu::numeric,
       1, i.qtd::int, i.pu::numeric
FROM notas_fiscais_entrada nf
JOIN pedidos_compra pc ON pc.id = nf.pedido_compra_id
JOIN (VALUES
  (1, 'DEM-PCB-PMV',   10, 190.00),
  (2, 'DEM-FONTE-48V',  8, 325.00),
  (3, 'DEM-PCB-RADAR',  6, 550.00)
) AS i(ordem, peca_cod, qtd, pu) ON TRUE
JOIN partes_pecas      pp  ON pp.codigo           = i.peca_cod
JOIN itens_pedido_compra ipc ON ipc.pedido_compra_id = pc.id AND ipc.parte_peca_id = pp.id
LEFT JOIN fornecedor_itens fi ON fi.fornecedor_id = nf.fornecedor_id AND fi.parte_peca_id = pp.id
WHERE pc.numero_pc = 'PC-DEM-001';

-- Itens da NF conferida (PC-DEM-005 — recebimento parcial)
INSERT INTO itens_nf_entrada
  (nota_id, ordem, item_pedido_compra_id, parte_peca_id,
   codigo_fornecedor, descricao_nf, unidade_nf,
   quantidade_nf, valor_unitario, valor_total,
   fator_conversao, quantidade_recebida, custo_unitario_entrada)
SELECT nf.id, i.ordem::int, ipc.id, pp.id,
       COALESCE(fi.codigo_fornecedor, ''), pp.descricao, pp.unidade_medida,
       i.qtd::numeric, i.pu::numeric, i.qtd::numeric * i.pu::numeric,
       1, i.qtd::int, i.pu::numeric
FROM notas_fiscais_entrada nf
JOIN pedidos_compra pc ON pc.id = nf.pedido_compra_id
JOIN (VALUES
  (1, 'DEM-SENSOR-RADAR', 10, 425.00),
  (2, 'DEM-CAMERA-RADAR',  4, 385.00)
) AS i(ordem, peca_cod, qtd, pu) ON TRUE
JOIN partes_pecas      pp  ON pp.codigo             = i.peca_cod
JOIN itens_pedido_compra ipc ON ipc.pedido_compra_id = pc.id AND ipc.parte_peca_id = pp.id
LEFT JOIN fornecedor_itens fi ON fi.fornecedor_id = nf.fornecedor_id AND fi.parte_peca_id = pp.id
WHERE pc.numero_pc = 'PC-DEM-005';

-- Lotes vinculados à NF efetivada (itens_nf_lotes)
INSERT INTO itens_nf_lotes (item_nf_id, numero_lote, data_fabricacao, quantidade, lote_id)
SELECT inf.id, l.numero_lote, l.data_fabricacao, inf.quantidade_recebida, l.id
FROM notas_fiscais_entrada nf
JOIN itens_nf_entrada inf ON inf.nota_id = nf.id
JOIN partes_pecas     pp  ON pp.id       = inf.parte_peca_id
JOIN lotes            l   ON l.parte_peca_id = pp.id
WHERE nf.status = 'Efetivada'
  AND pp.controla_lote = TRUE
  AND l.numero_lote IN ('DS-PCB-2026-07-A')  -- lote mais recente do PCB-PMV
  AND pp.codigo = 'DEM-PCB-PMV';

-- ===========================================================================
-- 18. MOVIMENTAÇÕES DE ESTOQUE
-- ===========================================================================
-- Entradas por NF-e (PC-DEM-001, efetivada em 2026-09-06)
INSERT INTO movimentacao_estoque
  (parte_peca_id, tipo, quantidade, data_hora, motivo, referencia_numero,
   custo_unitario, documento_tipo)
SELECT pp.id, 'Entrada', m.qtd::int, m.dh::timestamp, 'Compra', m.ref,
       m.custo::numeric, 'NOTA_ENTRADA'
FROM (VALUES
  ('DEM-PCB-PMV',   10, '2026-09-06 09:30:00', 'NF-000000101', 190.00),
  ('DEM-FONTE-48V',  8, '2026-09-06 09:30:00', 'NF-000000101', 325.00),
  ('DEM-PCB-RADAR',  6, '2026-09-06 09:30:00', 'NF-000000101', 550.00)
) AS m(codigo, qtd, dh, ref, custo)
JOIN partes_pecas pp ON pp.codigo = m.codigo;

-- Entradas por NF-e (PC-DEM-005, recebimento parcial em 2026-10-10)
INSERT INTO movimentacao_estoque
  (parte_peca_id, tipo, quantidade, data_hora, motivo, referencia_numero,
   custo_unitario, documento_tipo)
SELECT pp.id, 'Entrada', m.qtd::int, m.dh::timestamp, 'Compra', m.ref,
       m.custo::numeric, 'NOTA_ENTRADA'
FROM (VALUES
  ('DEM-SENSOR-RADAR', 10, '2026-10-10 10:15:00', 'NF-000000102', 425.00),
  ('DEM-CAMERA-RADAR',  4, '2026-10-10 10:15:00', 'NF-000000102', 385.00)
) AS m(codigo, qtd, dh, ref, custo)
JOIN partes_pecas pp ON pp.codigo = m.codigo;

-- Saídas por OPs concluídas (registradas como "OP")
-- OP-DEM-001: 1x PMV
INSERT INTO movimentacao_estoque
  (parte_peca_id, tipo, quantidade, data_hora, motivo, referencia_numero, custo_unitario, documento_tipo)
SELECT pp.id, 'Saida', m.qtd::int, '2026-05-09 08:00:00', 'OP', 'OP-DEM-001', se.custo_medio, 'ORDEM_PRODUCAO'
FROM (VALUES
  ('DEM-PCB-PMV',1),('DEM-LED-AM',8),('DEM-FONTE-48V',1),('DEM-GABINETE-PMV',1),
  ('DEM-DISPLAY-PMV',2),('DEM-CABO-USB',1),('DEM-PAR-M4X10',2),
  ('DEM-LABEL-INM',1),('DEM-VEDACAO-IP66',1)
) AS m(codigo, qtd)
JOIN partes_pecas pp ON pp.codigo = m.codigo
JOIN saldo_estoque se ON se.parte_peca_id = pp.id;

-- OP-DEM-002: 2x RADAR
INSERT INTO movimentacao_estoque
  (parte_peca_id, tipo, quantidade, data_hora, motivo, referencia_numero, custo_unitario, documento_tipo)
SELECT pp.id, 'Saida', m.qtd::int, '2026-06-11 08:00:00', 'OP', 'OP-DEM-002', se.custo_medio, 'ORDEM_PRODUCAO'
FROM (VALUES
  ('DEM-SENSOR-RADAR',8),('DEM-PCB-RADAR',2),('DEM-CAMERA-RADAR',4),('DEM-GABINETE-RAD',2),
  ('DEM-FONTE-12V',2),('DEM-CABO-USB',2),('DEM-PAR-M4X10',4),
  ('DEM-LABEL-INM',2),('DEM-VEDACAO-IP66',2)
) AS m(codigo, qtd)
JOIN partes_pecas pp ON pp.codigo = m.codigo
JOIN saldo_estoque se ON se.parte_peca_id = pp.id;

-- OP-DEM-003: 1x RADAR
INSERT INTO movimentacao_estoque
  (parte_peca_id, tipo, quantidade, data_hora, motivo, referencia_numero, custo_unitario, documento_tipo)
SELECT pp.id, 'Saida', m.qtd::int, '2026-07-02 08:00:00', 'OP', 'OP-DEM-003', se.custo_medio, 'ORDEM_PRODUCAO'
FROM (VALUES
  ('DEM-SENSOR-RADAR',4),('DEM-PCB-RADAR',1),('DEM-CAMERA-RADAR',2),('DEM-GABINETE-RAD',1),
  ('DEM-FONTE-12V',1),('DEM-CABO-USB',1),('DEM-PAR-M4X10',2),
  ('DEM-LABEL-INM',1),('DEM-VEDACAO-IP66',1)
) AS m(codigo, qtd)
JOIN partes_pecas pp ON pp.codigo = m.codigo
JOIN saldo_estoque se ON se.parte_peca_id = pp.id;

-- OP-DEM-004: 2x SEMAF
INSERT INTO movimentacao_estoque
  (parte_peca_id, tipo, quantidade, data_hora, motivo, referencia_numero, custo_unitario, documento_tipo)
SELECT pp.id, 'Saida', m.qtd::int, '2026-08-17 08:00:00', 'OP', 'OP-DEM-004', se.custo_medio, 'ORDEM_PRODUCAO'
FROM (VALUES
  ('DEM-MOD-SEM-V',4),('DEM-MOD-SEM-A',4),('DEM-MOD-SEM-VM',4),('DEM-CTRL-SEM',2),
  ('DEM-FONTE-SEM',2),('DEM-CABO-USB',2),('DEM-PAR-M4X10',4),
  ('DEM-VEDACAO-IP66',2),('DEM-FUSIVEL-5A',4)
) AS m(codigo, qtd)
JOIN partes_pecas pp ON pp.codigo = m.codigo
JOIN saldo_estoque se ON se.parte_peca_id = pp.id;

-- Entrada de produtos acabados concluídos
INSERT INTO movimentacao_estoque
  (produto_acabado_id, tipo, quantidade, data_hora, motivo, referencia_numero, documento_tipo)
SELECT pa.id, 'Entrada', m.qtd::int, m.dh::timestamp, 'OP', m.op_num, 'ORDEM_PRODUCAO'
FROM (VALUES
  ('DEM-PMV',  1, '2026-05-10 16:00:00', 'OP-DEM-001'),
  ('DEM-RADAR',2, '2026-06-12 16:00:00', 'OP-DEM-002'),
  ('DEM-RADAR',1, '2026-07-03 16:00:00', 'OP-DEM-003'),
  ('DEM-SEMAF',2, '2026-08-18 16:00:00', 'OP-DEM-004')
) AS m(codigo, qtd, dh, op_num)
JOIN produtos_acabados pa ON pa.codigo = m.codigo;

-- Ajuste manual de estoque (exemplo para a tela de Ajuste)
INSERT INTO movimentacao_estoque
  (parte_peca_id, tipo, quantidade, data_hora, motivo, observacoes, custo_unitario, documento_tipo)
SELECT pp.id, 'Ajuste', 3, '2026-07-15 14:00:00', 'Ajuste',
       'Diferença encontrada no inventário rotativo — outubro/2026',
       42.50, 'AJUSTE'
FROM partes_pecas pp WHERE pp.codigo = 'DEM-LED-AM';

-- ===========================================================================
-- 19. PEDIDOS DE VENDA
-- ===========================================================================
INSERT INTO pedidos_venda
  (numero_pedido, cliente_id, cliente_nome, data_pedido,
   data_entrega_prometida, data_entrega_real, valor_total, status, created_by)
SELECT v.num, cl.id, cl.nome_fantasia,
       v.pedido::date, v.prometida::date,
       CASE WHEN v.real = '' THEN NULL ELSE v.real::date END,
       v.total::numeric, v.status, 'migration'
FROM (VALUES
  ('PV-DEM-001','DER-MG',    '2026-04-10','2026-05-15','2026-05-12', 48000.00,'Entregue'),
  ('PV-DEM-002','CET-SP',    '2026-05-03','2026-06-10','2026-06-15',124000.00,'Entregue'),
  ('PV-DEM-003','SIMU',      '2026-06-01','2026-07-05','2026-07-03', 62000.00,'Entregue'),
  ('PV-DEM-004','RodoSul',   '2026-07-15','2026-08-20','2026-08-20', 42000.00,'Pronto para Envio'),
  ('PV-DEM-005','SIMU',      '2026-08-10','2026-09-15','',           62000.00,'Em Producao'),
  ('PV-DEM-006','DER-MG',    '2026-09-05','2026-10-10','',           48000.00,'Em Producao'),
  ('PV-DEM-007','CET-SP',    '2026-10-01','2026-11-15','',           21000.00,'Aberto'),
  ('PV-DEM-008','SEINFRA-MG','2026-10-20','2026-11-30','',           96000.00,'Aberto')
) AS v(num, cliente_fantasia, pedido, prometida, real, total, status)
JOIN clientes cl ON cl.nome_fantasia = v.cliente_fantasia
ON CONFLICT (numero_pedido) DO NOTHING;

-- Itens dos pedidos de venda
INSERT INTO itens_pedido_venda
  (pedido_venda_id, produto_acabado_id, quantidade, preco_unitario, total)
SELECT pv.id, pa.id, i.qtd::int, pa.preco_venda, i.qtd::int * pa.preco_venda
FROM pedidos_venda pv
JOIN (VALUES
  ('PV-DEM-001','DEM-PMV',   1),
  ('PV-DEM-002','DEM-RADAR', 2),
  ('PV-DEM-003','DEM-RADAR', 1),
  ('PV-DEM-004','DEM-SEMAF', 2),
  ('PV-DEM-005','DEM-RADAR', 1),
  ('PV-DEM-006','DEM-PMV',   1),
  ('PV-DEM-007','DEM-SEMAF', 1),
  ('PV-DEM-008','DEM-PMV',   2)
) AS i(pv_num, pa_cod, qtd) ON pv.numero_pedido = i.pv_num
JOIN produtos_acabados pa ON pa.codigo = i.pa_cod;

-- ===========================================================================
-- 20. ORDENS DE PRODUÇÃO
-- ===========================================================================
-- Concluídas (PVs 001-004)
INSERT INTO ordens_producao
  (numero_op, item_pedido_venda_id, produto_acabado_id, quantidade,
   estrutura_produto_id, data_conclusao_prevista, status, etapa_atual,
   data_liberacao, data_conclusao_real, observacoes, created_by)
SELECT 'OP-DEM-00' || o.n, i.id, pa.id, i.quantidade, e.id,
       pv.data_entrega_prometida - 5,
       'Concluida', 'Expedicao',
       (pv.data_pedido + o.lt_dias::int)::timestamp,
       o.conclusao::date,
       o.obs, 'migration'
FROM (VALUES
  (1, 3, '2026-05-10', 'Entregue — prazo cumprido.'),
  (2, 3, '2026-06-12', 'Entregue com 2 dias de atraso por retrabalho em 1 unidade.'),
  (3, 3, '2026-07-03', 'Concluída 2 dias antes do previsto.'),
  (4, 3, '2026-08-18', 'Aguardando coleta do cliente.')
) AS o(n, lt_dias, conclusao, obs)
JOIN pedidos_venda        pv ON pv.numero_pedido           = 'PV-DEM-00' || o.n
JOIN itens_pedido_venda    i ON i.pedido_venda_id           = pv.id
JOIN produtos_acabados    pa ON pa.id                       = i.produto_acabado_id
JOIN estrutura_produto      e ON e.produto_acabado_id        = pa.id AND e.ativo
ON CONFLICT (numero_op) DO NOTHING;

-- Liberadas (PVs 005-006)
INSERT INTO ordens_producao
  (numero_op, item_pedido_venda_id, produto_acabado_id, quantidade,
   estrutura_produto_id, data_conclusao_prevista, status, etapa_atual,
   data_liberacao, observacoes, created_by)
SELECT 'OP-DEM-00' || o.n, i.id, pa.id, i.quantidade, e.id,
       pv.data_entrega_prometida - 5,
       'Liberada', o.etapa,
       (pv.data_pedido + o.lt_dias::int)::timestamp,
       o.obs, 'migration'
FROM (VALUES
  (5, 4, 'Montagem',  'Material separado; em montagem desde 25/10.'),
  (6, 4, 'Separacao', 'Liberada hoje; separação em andamento.')
) AS o(n, lt_dias, etapa, obs)
JOIN pedidos_venda        pv ON pv.numero_pedido           = 'PV-DEM-00' || o.n
JOIN itens_pedido_venda    i ON i.pedido_venda_id           = pv.id
JOIN produtos_acabados    pa ON pa.id                       = i.produto_acabado_id
JOIN estrutura_produto      e ON e.produto_acabado_id        = pa.id AND e.ativo
ON CONFLICT (numero_op) DO NOTHING;

-- Aberta (PV 007)
INSERT INTO ordens_producao
  (numero_op, item_pedido_venda_id, produto_acabado_id, quantidade,
   estrutura_produto_id, data_conclusao_prevista, status, etapa_atual,
   observacoes, created_by)
SELECT 'OP-DEM-007', i.id, pa.id, i.quantidade, e.id,
       pv.data_entrega_prometida - 5,
       'Aberta', 'Separacao', '', 'migration'
FROM pedidos_venda        pv
JOIN itens_pedido_venda    i ON i.pedido_venda_id           = pv.id
JOIN produtos_acabados    pa ON pa.id                       = i.produto_acabado_id
JOIN estrutura_produto      e ON e.produto_acabado_id        = pa.id AND e.ativo
WHERE pv.numero_pedido = 'PV-DEM-007'
ON CONFLICT (numero_op) DO NOTHING;

-- ===========================================================================
-- 21. RESERVAS DE ESTOQUE  (OPs liberadas)
-- ===========================================================================
-- OP-DEM-005: 1x RADAR
INSERT INTO reserva_estoque
  (ordem_producao_id, parte_peca_id, quantidade_reservada,
   custo_unitario_orcado, status)
SELECT op.id, pp.id, (i.qtd * 1)::int, se.custo_medio, 'Reservada'
FROM ordens_producao op
CROSS JOIN (VALUES
  ('DEM-SENSOR-RADAR',4),('DEM-PCB-RADAR',1),('DEM-CAMERA-RADAR',2),
  ('DEM-GABINETE-RAD',1),('DEM-FONTE-12V',1),('DEM-CABO-USB',1),
  ('DEM-PAR-M4X10',2),('DEM-LABEL-INM',1),('DEM-VEDACAO-IP66',1)
) AS i(cod, qtd)
JOIN partes_pecas   pp ON pp.codigo          = i.cod
JOIN saldo_estoque  se ON se.parte_peca_id   = pp.id
WHERE op.numero_op = 'OP-DEM-005'
ON CONFLICT (ordem_producao_id, parte_peca_id) DO NOTHING;

-- OP-DEM-006: 1x PMV
INSERT INTO reserva_estoque
  (ordem_producao_id, parte_peca_id, quantidade_reservada,
   custo_unitario_orcado, status)
SELECT op.id, pp.id, (i.qtd * 1)::int, se.custo_medio, 'Reservada'
FROM ordens_producao op
CROSS JOIN (VALUES
  ('DEM-PCB-PMV',1),('DEM-LED-AM',8),('DEM-FONTE-48V',1),
  ('DEM-GABINETE-PMV',1),('DEM-DISPLAY-PMV',2),('DEM-CABO-USB',1),
  ('DEM-PAR-M4X10',2),('DEM-LABEL-INM',1),('DEM-VEDACAO-IP66',1)
) AS i(cod, qtd)
JOIN partes_pecas   pp ON pp.codigo          = i.cod
JOIN saldo_estoque  se ON se.parte_peca_id   = pp.id
WHERE op.numero_op = 'OP-DEM-006'
ON CONFLICT (ordem_producao_id, parte_peca_id) DO NOTHING;

-- Atualiza quantidade_reservada no saldo (soma de todas as reservas ativas)
UPDATE saldo_estoque se
SET quantidade_reservada = (
  SELECT COALESCE(SUM(r.quantidade_reservada), 0)
  FROM reserva_estoque r
  WHERE r.parte_peca_id = se.parte_peca_id
    AND r.status = 'Reservada'
)
WHERE se.parte_peca_id IN (
  SELECT DISTINCT parte_peca_id FROM reserva_estoque WHERE status = 'Reservada'
);

-- ===========================================================================
-- 22. HISTÓRICO KANBAN  (transições das OPs)
-- ===========================================================================
INSERT INTO historico_kanban
  (ordem_producao_id, etapa_anterior, etapa_nova, data_hora_transicao, observacoes)
-- OP-DEM-001: percurso completo
SELECT op.id, t.ant, t.nov, t.dh::timestamp, t.obs
FROM ordens_producao op
CROSS JOIN (VALUES
  (NULL,          'Separacao', '2026-04-14 08:00:00', 'OP liberada'),
  ('Separacao',   'Montagem',  '2026-04-15 11:30:00', ''),
  ('Montagem',    'Testes',    '2026-04-22 17:00:00', ''),
  ('Testes',      'Expedicao', '2026-04-25 15:00:00', ''),
  ('Expedicao',   'Expedicao', '2026-05-10 10:00:00', 'Concluída')
) AS t(ant, nov, dh, obs)
WHERE op.numero_op = 'OP-DEM-001'
UNION ALL
-- OP-DEM-002: percurso completo (2x RADAR)
SELECT op.id, t.ant, t.nov, t.dh::timestamp, t.obs
FROM ordens_producao op
CROSS JOIN (VALUES
  (NULL,          'Separacao', '2026-05-07 08:00:00', 'OP liberada'),
  ('Separacao',   'Montagem',  '2026-05-08 14:00:00', ''),
  ('Montagem',    'Testes',    '2026-06-01 17:00:00', ''),
  ('Testes',      'Expedicao', '2026-06-10 16:00:00', 'Retrabalho em 1 unidade antes de aprovar'),
  ('Expedicao',   'Expedicao', '2026-06-12 10:00:00', 'Concluída')
) AS t(ant, nov, dh, obs)
WHERE op.numero_op = 'OP-DEM-002'
UNION ALL
-- OP-DEM-005: liberada, em Montagem
SELECT op.id, t.ant, t.nov, t.dh::timestamp, ''
FROM ordens_producao op
CROSS JOIN (VALUES
  (NULL,        'Separacao', '2026-08-14 08:00:00'),
  ('Separacao', 'Montagem',  '2026-08-14 16:30:00')
) AS t(ant, nov, dh)
WHERE op.numero_op = 'OP-DEM-005'
UNION ALL
-- OP-DEM-006: liberada, em Separação
SELECT op.id, NULL::varchar, 'Separacao', '2026-09-09 08:00:00', 'OP liberada'
FROM ordens_producao op
WHERE op.numero_op = 'OP-DEM-006';

-- ===========================================================================
-- 23. APONTAMENTOS DE PRODUÇÃO
-- ===========================================================================
-- OPs concluídas: 4 apontamentos fechados (uma por etapa)
INSERT INTO apontamento_producao
  (ordem_producao_id, etapa, tempo_inicio, tempo_fim, duracao_minutos,
   centro_trabalho_id, custo_hora, operador_id)
SELECT op.id, ct.etapa_op,
       op.data_conclusao_real - (ct.ord * INTERVAL '2 days') + INTERVAL '8 hours',
       op.data_conclusao_real - (ct.ord * INTERVAL '2 days') + INTERVAL '8 hours'
         + make_interval(mins => ct.minutos * op.quantidade),
       ct.minutos * op.quantidade,
       c.id, c.custo_hora,
       u.id
FROM ordens_producao op
CROSS JOIN (VALUES
  (4,'Separacao','DEM-SEP', 30),
  (3,'Montagem', 'DEM-MON',360),
  (2,'Testes',   'DEM-TES',120),
  (1,'Expedicao','DEM-EXP', 30)
) AS ct(ord, etapa_op, ct_cod, minutos)
JOIN centros_trabalho c ON c.codigo = ct.ct_cod
JOIN usuarios         u ON u.username = 'operador_demo'
WHERE op.numero_op IN ('OP-DEM-001','OP-DEM-002','OP-DEM-003','OP-DEM-004')
  AND NOT EXISTS (
    SELECT 1 FROM apontamento_producao ap
    WHERE ap.ordem_producao_id = op.id AND ap.etapa = ct.etapa_op
  );

-- OP-DEM-005: apontamento aberto (em Montagem)
INSERT INTO apontamento_producao
  (ordem_producao_id, etapa, tempo_inicio, centro_trabalho_id, custo_hora, operador_id)
SELECT op.id, 'Montagem',
       CURRENT_DATE - 3 + INTERVAL '8 hours',
       c.id, c.custo_hora, u.id
FROM ordens_producao op
JOIN centros_trabalho c ON c.codigo = 'DEM-MON'
JOIN usuarios         u ON u.username = 'operador_demo'
WHERE op.numero_op = 'OP-DEM-005'
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- 24. NÚMEROS DE SÉRIE
-- ===========================================================================
-- OP-DEM-001: 1x PMV — Expedido
INSERT INTO numeros_serie
  (numero, ordem_producao_id, produto_acabado_id, status,
   resultado_teste, testado_por, testado_em, pedido_venda_entrega_id, expedido_em)
SELECT 'DEM-PMV-000101', op.id, pa.id, 'Expedido',
       'Aprovado em todos os ensaios elétricos e funcionais.',
       u.id, op.data_conclusao_real - 2 + INTERVAL '14 hours',
       pv.id, op.data_conclusao_real + INTERVAL '9 hours'
FROM ordens_producao op
JOIN produtos_acabados pa ON pa.codigo = 'DEM-PMV'
JOIN pedidos_venda     pv ON pv.numero_pedido = 'PV-DEM-001'
JOIN usuarios           u ON u.username = 'qualidade_demo'
WHERE op.numero_op = 'OP-DEM-001'
ON CONFLICT (numero) DO NOTHING;

-- OP-DEM-002: 2x RADAR — Expedido + Metrologia
INSERT INTO numeros_serie
  (numero, ordem_producao_id, produto_acabado_id, status,
   resultado_teste, testado_por, testado_em, pedido_venda_entrega_id, expedido_em)
SELECT 'DEM-RADAR-000' || n.s, op.id, pa.id, 'Expedido',
       'Aprovado: velocidade detectada com ±1% de precisão.',
       u.id, op.data_conclusao_real - 2 + INTERVAL '14 hours',
       pv.id, op.data_conclusao_real + INTERVAL '9 hours'
FROM ordens_producao op
CROSS JOIN (VALUES ('201'), ('202')) AS n(s)
JOIN produtos_acabados pa ON pa.codigo        = 'DEM-RADAR'
JOIN pedidos_venda     pv ON pv.numero_pedido = 'PV-DEM-002'
JOIN usuarios           u ON u.username       = 'qualidade_demo'
WHERE op.numero_op = 'OP-DEM-002'
ON CONFLICT (numero) DO NOTHING;

-- OP-DEM-003: 1x RADAR — 1 Reprovado, 1 relançado como Expedido
INSERT INTO numeros_serie
  (numero, ordem_producao_id, produto_acabado_id, status,
   resultado_teste, testado_por, testado_em)
SELECT 'DEM-RADAR-000301-REP', op.id, pa.id, 'Reprovado',
       'Falha: erro na calibração do sensor 3 — encaminhado para retrabalho.',
       u.id, op.data_conclusao_real - 4 + INTERVAL '14 hours'
FROM ordens_producao op
JOIN produtos_acabados pa ON pa.codigo        = 'DEM-RADAR'
JOIN usuarios           u ON u.username       = 'qualidade_demo'
WHERE op.numero_op = 'OP-DEM-003'
ON CONFLICT (numero) DO NOTHING;

INSERT INTO numeros_serie
  (numero, ordem_producao_id, produto_acabado_id, status,
   resultado_teste, testado_por, testado_em, pedido_venda_entrega_id, expedido_em)
SELECT 'DEM-RADAR-000302', op.id, pa.id, 'Expedido',
       'Aprovado após retrabalho: detecção bidirecional OK.',
       u.id, op.data_conclusao_real - 2 + INTERVAL '14 hours',
       pv.id, op.data_conclusao_real + INTERVAL '9 hours'
FROM ordens_producao op
JOIN produtos_acabados pa ON pa.codigo        = 'DEM-RADAR'
JOIN pedidos_venda     pv ON pv.numero_pedido = 'PV-DEM-003'
JOIN usuarios           u ON u.username       = 'qualidade_demo'
WHERE op.numero_op = 'OP-DEM-003'
ON CONFLICT (numero) DO NOTHING;

-- OP-DEM-004: 2x SEMAF — Pronto para Envio (Em Estoque)
INSERT INTO numeros_serie
  (numero, ordem_producao_id, produto_acabado_id, status,
   resultado_teste, testado_por, testado_em)
SELECT 'DEM-SEMAF-000' || n.s, op.id, pa.id, 'Em Estoque',
       'Aprovado: ciclos semafóricos sincronizados.',
       u.id, op.data_conclusao_real - 2 + INTERVAL '14 hours'
FROM ordens_producao op
CROSS JOIN (VALUES ('401'), ('402')) AS n(s)
JOIN produtos_acabados pa ON pa.codigo        = 'DEM-SEMAF'
JOIN usuarios           u ON u.username       = 'qualidade_demo'
WHERE op.numero_op = 'OP-DEM-004'
ON CONFLICT (numero) DO NOTHING;

-- OP-DEM-005: 1x RADAR em Produção
INSERT INTO numeros_serie
  (numero, ordem_producao_id, produto_acabado_id, status)
SELECT 'DEM-RADAR-000501', op.id, pa.id, 'Em Producao'
FROM ordens_producao op
JOIN produtos_acabados pa ON pa.codigo = 'DEM-RADAR'
WHERE op.numero_op = 'OP-DEM-005'
ON CONFLICT (numero) DO NOTHING;

-- ===========================================================================
-- 25. METROLOGIA  (RADARs aprovados — exige_metrologia = TRUE)
-- ===========================================================================
INSERT INTO metrologia_serie
  (numero_serie_id, numero_aprovacao_modelo, data_verificacao,
   numero_lacre, validade, observacoes, created_by)
SELECT ns.id,
       'INMETRO-RTQ-048/2025',
       ns.testado_em::date,
       'LCR-' || ns.id,
       ns.testado_em::date + 365 - (ns.id * 37 % 120)::int,
       'Verificação realizada no IPEM-MG conforme portaria INMETRO nº 680/2025.',
       'migration'
FROM numeros_serie ns
JOIN produtos_acabados pa ON pa.id = ns.produto_acabado_id
WHERE pa.codigo = 'DEM-RADAR'
  AND ns.status IN ('Expedido')
ON CONFLICT (numero_serie_id) DO NOTHING;

-- ===========================================================================
-- 26. SÉRIES DE COMPONENTE  (rastreabilidade: peça → lote → NF → fornecedor)
-- ===========================================================================
-- Sensores usados na OP-DEM-002 (4 por RADAR × 2 = 8 sensores)
INSERT INTO series_componente
  (parte_peca_id, numero, lote_id, item_nf_id, status,
   ordem_producao_id, numero_serie_pai_id)
SELECT pp.id,
       'DS-SNS-2026-09-' || lpad(n::text, 4, '0'),
       l.id, NULL,
       'Instalado',
       op.id, ns.id
FROM partes_pecas    pp
JOIN lotes            l ON l.parte_peca_id = pp.id AND l.numero_lote = 'DS-SNS-2026-05-A'
JOIN ordens_producao op ON op.numero_op = 'OP-DEM-002'
CROSS JOIN generate_series(1, 4) AS n
JOIN numeros_serie   ns ON ns.numero = CASE WHEN n <= 4 THEN 'DEM-RADAR-000201' ELSE 'DEM-RADAR-000202' END
  AND ns.ordem_producao_id = op.id
WHERE pp.codigo = 'DEM-SENSOR-RADAR'
ON CONFLICT (parte_peca_id, numero) DO NOTHING;

-- Câmeras usadas na OP-DEM-002
INSERT INTO series_componente
  (parte_peca_id, numero, status, ordem_producao_id, numero_serie_pai_id)
SELECT pp.id,
       'TP-CAM-2026-' || lpad(n::text, 4, '0'),
       'Instalado', op.id, ns.id
FROM partes_pecas    pp
JOIN ordens_producao op ON op.numero_op = 'OP-DEM-002'
CROSS JOIN generate_series(1, 2) AS n
JOIN numeros_serie   ns ON ns.numero = CASE WHEN n = 1 THEN 'DEM-RADAR-000201' ELSE 'DEM-RADAR-000202' END
  AND ns.ordem_producao_id = op.id
WHERE pp.codigo = 'DEM-CAMERA-RADAR'
ON CONFLICT (parte_peca_id, numero) DO NOTHING;

-- Sensores em estoque (aguardando uso — Em Estoque)
INSERT INTO series_componente (parte_peca_id, numero, lote_id, status)
SELECT pp.id,
       'DS-SNS-2026-09-' || lpad((100 + n)::text, 4, '0'),
       l.id, 'Em Estoque'
FROM partes_pecas pp
JOIN lotes         l ON l.parte_peca_id = pp.id AND l.numero_lote = 'DS-SNS-2026-09-B'
CROSS JOIN generate_series(1, 6) AS n
WHERE pp.codigo = 'DEM-SENSOR-RADAR'
ON CONFLICT (parte_peca_id, numero) DO NOTHING;

-- Câmeras em estoque
INSERT INTO series_componente (parte_peca_id, numero, status)
SELECT pp.id, 'TP-CAM-2026-' || lpad((100 + n)::text, 4, '0'), 'Em Estoque'
FROM partes_pecas pp
CROSS JOIN generate_series(1, 4) AS n
WHERE pp.codigo = 'DEM-CAMERA-RADAR'
ON CONFLICT (parte_peca_id, numero) DO NOTHING;

-- Displays em estoque (DEM-DISPLAY-PMV, controla_numero_serie=TRUE)
INSERT INTO series_componente (parte_peca_id, numero, status)
SELECT pp.id, 'LP-DSP-' || lpad(n::text, 4, '0'), 'Em Estoque'
FROM partes_pecas pp
CROSS JOIN generate_series(1, 8) AS n
WHERE pp.codigo = 'DEM-DISPLAY-PMV'
ON CONFLICT (parte_peca_id, numero) DO NOTHING;

-- ===========================================================================
-- 27. RESERVAS DE LOTE  (OP-DEM-005: RADAR — lotes FEFO)
-- ===========================================================================
INSERT INTO reservas_lote (ordem_producao_id, parte_peca_id, lote_id, quantidade)
SELECT op.id, l.parte_peca_id, l.id, r.qtd_reservada
FROM ordens_producao op
CROSS JOIN (VALUES
  ('DS-SNS-2026-05-A', 4),
  ('DS-PCB-R-2026-06', 1)
) AS r(lote_num, qtd_reservada)
JOIN lotes l ON l.numero_lote = r.lote_num
WHERE op.numero_op = 'OP-DEM-005'
ON CONFLICT (ordem_producao_id, lote_id) DO NOTHING;

ANALYZE;
