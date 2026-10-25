-- 014_criar_rbac.sql
-- Perfis e permissoes (Fase 2.2a, doc 0 secao 4.7.3). A matriz semeada aqui e a
-- PROPOSTA de docs/superpowers/specs/2026-10-24-rbac-design.md -- o
-- Administrador a ajusta pela tela "Perfis e permissoes" (validada com o Gestor
-- de Operacoes), sem migration nova. Textos com acento: vao direto para a tela.

CREATE TABLE perfis (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  nome VARCHAR(80) NOT NULL,
  descricao VARCHAR(255) NOT NULL DEFAULT '',
  -- Perfis do doc 0 (nao podem ser excluidos). ADMIN tem todas as permissoes
  -- por regra de codigo, nao por linhas em perfil_permissoes.
  sistema BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100)
);

-- Catalogo fixo, espelhado em internal/domain/acesso (um teste confere que os
-- dois batem). So entra permissao que algum endpoint aplica.
CREATE TABLE permissoes (
  codigo VARCHAR(60) PRIMARY KEY,
  modulo VARCHAR(30) NOT NULL,
  acao VARCHAR(30) NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  sensivel BOOLEAN NOT NULL DEFAULT FALSE,
  ordem INT NOT NULL
);

CREATE TABLE perfil_permissoes (
  id BIGSERIAL PRIMARY KEY,
  perfil_codigo VARCHAR(30) NOT NULL REFERENCES perfis(codigo) ON UPDATE CASCADE ON DELETE CASCADE,
  permissao_codigo VARCHAR(60) NOT NULL REFERENCES permissoes(codigo) ON DELETE CASCADE,
  UNIQUE (perfil_codigo, permissao_codigo)
);

INSERT INTO perfis (codigo, nome, descricao, sistema) VALUES
  ('ADMIN', 'Administrador', 'Acesso total, incluindo configurações e auditoria', TRUE),
  ('GESTOR', 'Gestor de Operações / PCP', 'Todos os módulos operacionais, sem acesso a credenciais técnicas', TRUE),
  ('COMPRADOR', 'Comprador', 'Cotações, pedidos de compra, fornecedores, visualização de estoque', TRUE),
  ('ALMOXARIFE', 'Almoxarife', 'Recebimento, movimentação e ajuste de estoque', TRUE),
  ('OPERADOR', 'Operador de Montagem', 'Consulta de produtos, peças, estrutura (BOM) e estoque', TRUE),
  ('QUALIDADE', 'Qualidade', 'Consulta de produtos, peças, estrutura, fornecedores e estoque', TRUE),
  ('VENDAS', 'Vendas', 'Consulta de produtos, estrutura e disponibilidade em estoque', TRUE),
  ('CONSULTA', 'Consulta', 'Somente leitura e exportação de relatórios', TRUE);

INSERT INTO permissoes (codigo, modulo, acao, descricao, sensivel, ordem) VALUES
  ('fornecedores.visualizar', 'fornecedores', 'visualizar', 'Ver fornecedores', FALSE, 10),
  ('fornecedores.incluir', 'fornecedores', 'incluir', 'Cadastrar fornecedor', FALSE, 11),
  ('fornecedores.editar', 'fornecedores', 'editar', 'Editar fornecedor', FALSE, 12),
  ('fornecedores.inativar', 'fornecedores', 'inativar', 'Inativar fornecedor', FALSE, 13),
  ('partes_pecas.visualizar', 'partes_pecas', 'visualizar', 'Ver partes e peças', FALSE, 20),
  ('partes_pecas.incluir', 'partes_pecas', 'incluir', 'Cadastrar parte/peça', FALSE, 21),
  ('partes_pecas.editar', 'partes_pecas', 'editar', 'Editar parte/peça', FALSE, 22),
  ('partes_pecas.inativar', 'partes_pecas', 'inativar', 'Inativar parte/peça', FALSE, 23),
  ('produtos.visualizar', 'produtos', 'visualizar', 'Ver produtos acabados', FALSE, 30),
  ('produtos.incluir', 'produtos', 'incluir', 'Cadastrar produto acabado', FALSE, 31),
  ('produtos.editar', 'produtos', 'editar', 'Editar produto acabado', FALSE, 32),
  ('produtos.inativar', 'produtos', 'inativar', 'Inativar produto acabado', FALSE, 33),
  ('estrutura.visualizar', 'estrutura', 'visualizar', 'Ver estrutura de produto (BOM)', FALSE, 40),
  ('estrutura.incluir', 'estrutura', 'incluir', 'Criar estrutura e nova versão', FALSE, 41),
  ('cotacoes.visualizar', 'cotacoes', 'visualizar', 'Ver cotações', FALSE, 50),
  ('cotacoes.incluir', 'cotacoes', 'incluir', 'Criar cotação', FALSE, 51),
  ('cotacoes.editar', 'cotacoes', 'editar', 'Editar, enviar e registrar resposta de cotação', FALSE, 52),
  ('cotacoes.cancelar', 'cotacoes', 'cancelar', 'Cancelar cotação', FALSE, 53),
  ('cotacoes.converter', 'cotacoes', 'converter', 'Converter cotação em pedido de compra', FALSE, 54),
  ('pedidos_compra.visualizar', 'pedidos_compra', 'visualizar', 'Ver pedidos de compra', FALSE, 60),
  ('pedidos_compra.incluir', 'pedidos_compra', 'incluir', 'Criar pedido de compra', FALSE, 61),
  ('pedidos_compra.editar', 'pedidos_compra', 'editar', 'Editar pedido de compra em rascunho', FALSE, 62),
  ('pedidos_compra.emitir', 'pedidos_compra', 'emitir', 'Emitir pedido de compra até a alçada', FALSE, 63),
  ('pedidos_compra.emitir_acima_alcada', 'pedidos_compra', 'emitir_acima_alcada', 'Emitir pedido de compra acima da alçada', TRUE, 64),
  ('pedidos_compra.cancelar', 'pedidos_compra', 'cancelar', 'Cancelar pedido de compra', FALSE, 65),
  ('pedidos_compra.receber', 'pedidos_compra', 'receber', 'Registrar recebimento', FALSE, 66),
  ('pedidos_compra.exportar', 'pedidos_compra', 'exportar', 'Exportar relatório de pedidos', FALSE, 67),
  ('estoque.visualizar', 'estoque', 'visualizar', 'Ver saldo e movimentações de estoque', FALSE, 70),
  ('estoque.ajustar', 'estoque', 'ajustar', 'Ajustar saldo de estoque manualmente', TRUE, 71),
  ('estoque.exportar', 'estoque', 'exportar', 'Exportar relatório de estoque', FALSE, 72),
  ('necessidade_compra.visualizar', 'necessidade_compra', 'visualizar', 'Ver necessidade de compra', FALSE, 80),
  ('configuracoes.empresa', 'configuracoes', 'empresa', 'Editar dados da empresa', FALSE, 90),
  ('configuracoes.regional', 'configuracoes', 'regional', 'Editar parâmetros regionais', FALSE, 91),
  ('configuracoes.negocio', 'configuracoes', 'negocio', 'Editar parâmetros de negócio', FALSE, 92),
  ('configuracoes.integracoes', 'configuracoes', 'integracoes', 'Configurar integrações (servidor de e-mail)', TRUE, 93),
  ('configuracoes.banco', 'configuracoes', 'banco', 'Ver diagnóstico do banco de dados', FALSE, 94),
  ('configuracoes.auditoria', 'configuracoes', 'auditoria', 'Consultar a trilha de auditoria', FALSE, 95),
  ('configuracoes.auditoria_exportar', 'configuracoes', 'auditoria_exportar', 'Exportar a trilha de auditoria', FALSE, 96),
  ('configuracoes.perfis', 'configuracoes', 'perfis', 'Editar perfis e permissões', TRUE, 97);

-- Matriz proposta (spec secao 3). ADMIN nao tem linhas: tem tudo por regra.
INSERT INTO perfil_permissoes (perfil_codigo, permissao_codigo)
SELECT 'GESTOR', codigo FROM permissoes
WHERE modulo <> 'configuracoes' AND codigo <> 'pedidos_compra.emitir_acima_alcada'
UNION ALL
SELECT 'GESTOR', codigo FROM permissoes WHERE codigo IN ('configuracoes.auditoria', 'configuracoes.auditoria_exportar')
UNION ALL
SELECT 'COMPRADOR', codigo FROM permissoes
WHERE modulo IN ('fornecedores', 'cotacoes')
   OR codigo IN ('pedidos_compra.visualizar', 'pedidos_compra.incluir', 'pedidos_compra.editar',
                 'pedidos_compra.emitir', 'pedidos_compra.cancelar', 'pedidos_compra.exportar',
                 'necessidade_compra.visualizar', 'partes_pecas.visualizar', 'produtos.visualizar',
                 'estoque.visualizar')
UNION ALL
SELECT 'ALMOXARIFE', codigo FROM permissoes
WHERE codigo IN ('pedidos_compra.visualizar', 'pedidos_compra.receber', 'estoque.visualizar',
                 'estoque.ajustar', 'estoque.exportar', 'fornecedores.visualizar',
                 'partes_pecas.visualizar', 'produtos.visualizar', 'necessidade_compra.visualizar')
UNION ALL
SELECT 'OPERADOR', codigo FROM permissoes
WHERE codigo IN ('produtos.visualizar', 'partes_pecas.visualizar', 'estrutura.visualizar', 'estoque.visualizar')
UNION ALL
SELECT 'QUALIDADE', codigo FROM permissoes
WHERE codigo IN ('produtos.visualizar', 'partes_pecas.visualizar', 'estrutura.visualizar',
                 'fornecedores.visualizar', 'estoque.visualizar')
UNION ALL
-- partes_pecas.visualizar: a tela da estrutura (BOM) mostra os nomes das pecas.
SELECT 'VENDAS', codigo FROM permissoes
WHERE codigo IN ('produtos.visualizar', 'partes_pecas.visualizar', 'estrutura.visualizar', 'estoque.visualizar')
UNION ALL
SELECT 'CONSULTA', codigo FROM permissoes
WHERE (acao = 'visualizar' AND modulo <> 'configuracoes')
   OR codigo IN ('pedidos_compra.exportar', 'estoque.exportar');

-- usuarios.perfil passa a apontar para a tabela de perfis (sai o CHECK dos 3
-- perfis fixos da migration 001).
ALTER TABLE usuarios DROP CONSTRAINT chk_perfil;
ALTER TABLE usuarios ALTER COLUMN perfil TYPE VARCHAR(30);
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_perfil
  FOREIGN KEY (perfil) REFERENCES perfis(codigo) ON UPDATE CASCADE;

CREATE TRIGGER trg_perfis_auditoria AFTER INSERT OR UPDATE OR DELETE ON perfis
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_perfil_permissoes_auditoria AFTER INSERT OR UPDATE OR DELETE ON perfil_permissoes
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_perfis_updated_at BEFORE UPDATE ON perfis
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_updated_at();
