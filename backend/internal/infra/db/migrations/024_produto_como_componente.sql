-- Produto acabado pode compor a estrutura de outro produto (ex.: placa de relés
-- vendida sozinha ou instalada como submontagem). Ao habilitar o flag, o sistema
-- cria automaticamente um registro espelho em partes_pecas para que o produto
-- apareça nas seleções da BOM sem alterar o schema de itens_estrutura_produto.
ALTER TABLE produtos_acabados
  ADD COLUMN pode_ser_componente BOOLEAN NOT NULL DEFAULT FALSE;

-- Vínculo inverso: parte/peça gerenciada pelo sistema como espelho de um produto.
-- UNIQUE garante no máximo um espelho por produto; ON DELETE RESTRICT impede
-- apagar o produto enquanto o espelho existir (a aplicação remove antes).
ALTER TABLE partes_pecas
  ADD COLUMN produto_acabado_id BIGINT UNIQUE
    REFERENCES produtos_acabados(id) ON DELETE RESTRICT;
