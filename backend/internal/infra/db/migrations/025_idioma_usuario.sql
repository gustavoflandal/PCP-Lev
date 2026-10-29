-- 025_idioma_usuario.sql
-- Idioma da interface e das mensagens da API, por usuario (portugues ou
-- espanhol). Todo usuario existente continua em portugues; a escolha e feita
-- em Preferencias.
ALTER TABLE usuarios
  ADD COLUMN idioma VARCHAR(5) NOT NULL DEFAULT 'pt-BR';

ALTER TABLE usuarios
  ADD CONSTRAINT chk_usuario_idioma CHECK (idioma IN ('pt-BR', 'es'));
