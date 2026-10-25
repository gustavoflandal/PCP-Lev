-- 009_criar_preferencias_usuario.sql
-- Preferencias de aparencia por usuario (Fase 4.1, doc 0 secao 4.6.1).
--
-- densidade default 'compacta': antes desta fase a altura de linha da
-- tabela/navegacao era um valor fixo de 40px (o "padrao" de desktop do
-- design system, doc 7 -- "confortavel" ali e a densidade de tablet, 48px).
-- Todo usuario existente ganha esta coluna com ALTER TABLE ... DEFAULT, que
-- grava o default nas linhas ja existentes -- se o default fosse
-- 'confortavel', todo mundo teria as linhas 20% mais altas sem ter
-- escolhido nada. 'compacta' preserva o visual de antes; 'confortavel'
-- fica como opt-in.
ALTER TABLE usuarios
  ADD COLUMN tema VARCHAR(20) NOT NULL DEFAULT 'automatico',
  ADD COLUMN alto_contraste BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN densidade VARCHAR(20) NOT NULL DEFAULT 'compacta',
  ADD COLUMN tamanho_fonte VARCHAR(20) NOT NULL DEFAULT 'padrao';

ALTER TABLE usuarios
  ADD CONSTRAINT chk_usuario_tema CHECK (tema IN ('claro', 'escuro', 'automatico')),
  ADD CONSTRAINT chk_usuario_densidade CHECK (densidade IN ('compacta', 'confortavel')),
  ADD CONSTRAINT chk_usuario_tamanho_fonte CHECK (tamanho_fonte IN ('padrao', 'grande', 'extra-grande'));
