-- 011_criar_configuracao_regional.sql
-- Parametros regionais e de formatacao (Fase 4, doc 0 secao 4.6.4). Singleton,
-- mesmo padrao de configuracao_empresa (010): PK fixa + CHECK garantem uma
-- unica linha. Diferente de empresa, a linha ja nasce com os defaults
-- funcionais (DD/MM/AAAA, 24H) -- nao ha "primeira configuracao pelo admin"
-- aqui, o sistema ja funciona sem nenhuma acao.
CREATE TABLE configuracao_regional (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  formato_data VARCHAR(10) NOT NULL DEFAULT 'DD/MM/AAAA'
    CHECK (formato_data IN ('DD/MM/AAAA', 'DD-MM-AAAA', 'AAAA-MM-DD')),
  formato_hora VARCHAR(3) NOT NULL DEFAULT '24H'
    CHECK (formato_hora IN ('24H', '12H')),

  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50)
);

INSERT INTO configuracao_regional (id) VALUES (1);
