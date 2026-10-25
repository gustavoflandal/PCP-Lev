-- 013_criar_configuracao_smtp.sql
-- Servidor de e-mail (Fase 4, doc 0 secao 4.7.7). Singleton, mesmo padrao das
-- demais configuracoes (010-012). A senha so existe cifrada (AES-256-GCM,
-- chave mestra fora do banco -- secao 4.7.6); nunca em texto claro.
CREATE TABLE configuracao_smtp (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  host VARCHAR(255) NOT NULL DEFAULT '',
  porta INT NOT NULL DEFAULT 587 CHECK (porta BETWEEN 1 AND 65535),
  criptografia VARCHAR(8) NOT NULL DEFAULT 'STARTTLS'
    CHECK (criptografia IN ('NENHUMA', 'STARTTLS', 'TLS')),
  usuario VARCHAR(255) NOT NULL DEFAULT '',
  senha_cifrada TEXT,
  remetente_email VARCHAR(255) NOT NULL DEFAULT '',
  remetente_nome VARCHAR(100) NOT NULL DEFAULT '',

  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50)
);

INSERT INTO configuracao_smtp (id) VALUES (1);

-- Trilha propria, e nao fn_registrar_auditoria (007): a generica grava a linha
-- inteira (to_jsonb), e o texto cifrado da senha ficaria para sempre na tabela
-- de auditoria -- "remover senha" nao apagaria as copias, decifraveis por quem
-- tivesse um dump do banco e a chave mestra. Aqui a senha vira so um marcador
-- ("definida"/"ausente"): a troca continua visivel na trilha, o segredo nao.
CREATE OR REPLACE FUNCTION fn_auditoria_configuracao_smtp()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id BIGINT;
  v_ip         VARCHAR(45);
  v_antigos    JSONB;
  v_novos      JSONB;
BEGIN
  v_usuario_id := NULLIF(current_setting('pcp.usuario_id', true), '')::BIGINT;
  v_ip         := NULLIF(current_setting('pcp.endereco_ip', true), '');

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_antigos := jsonb_set(to_jsonb(OLD), '{senha_cifrada}',
      to_jsonb(CASE WHEN OLD.senha_cifrada IS NULL THEN 'ausente' ELSE 'definida' END));
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_novos := jsonb_set(to_jsonb(NEW), '{senha_cifrada}',
      to_jsonb(CASE WHEN NEW.senha_cifrada IS NULL THEN 'ausente'
                    WHEN TG_OP = 'UPDATE' AND NEW.senha_cifrada IS DISTINCT FROM OLD.senha_cifrada THEN 'definida (trocada)'
                    ELSE 'definida' END));
  END IF;

  INSERT INTO auditoria (tabela, operacao, registro_id, dados_antigos, dados_novos, usuario_id, endereco_ip)
  VALUES (TG_TABLE_NAME, TG_OP, CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END, v_antigos, v_novos, v_usuario_id, v_ip);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_configuracao_smtp_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON configuracao_smtp
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria_configuracao_smtp();
