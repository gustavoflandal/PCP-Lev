-- 009_criar_preferencias_usuario.sql
-- Preferencias de aparencia por usuario (Fase 4.1, doc 0 secao 4.6.1).

ALTER TABLE usuarios
  ADD COLUMN tema VARCHAR(20) NOT NULL DEFAULT 'automatico',
  ADD COLUMN alto_contraste BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN densidade VARCHAR(20) NOT NULL DEFAULT 'confortavel',
  ADD COLUMN tamanho_fonte VARCHAR(20) NOT NULL DEFAULT 'padrao';

ALTER TABLE usuarios
  ADD CONSTRAINT chk_usuario_tema CHECK (tema IN ('claro', 'escuro', 'automatico')),
  ADD CONSTRAINT chk_usuario_densidade CHECK (densidade IN ('compacta', 'confortavel')),
  ADD CONSTRAINT chk_usuario_tamanho_fonte CHECK (tamanho_fonte IN ('padrao', 'grande', 'extra-grande'));
