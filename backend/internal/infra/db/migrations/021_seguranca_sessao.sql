-- Fase 5 (auditoria de seguranca): bloqueio temporario por conta, versao de
-- sessao (revoga tokens) e trilha de auditoria sem hash de senha.

-- Falhas seguidas de senha: a partir de 5, a conta fica bloqueada por um
-- tempo que dobra a cada nova falha (15, 30, 60 min). Zera no login certo e
-- na senha redefinida pelo Administrador.
ALTER TABLE usuarios
  ADD COLUMN tentativas_falhas INT NOT NULL DEFAULT 0,
  ADD COLUMN bloqueado_ate TIMESTAMP,
  -- Vai no token (claim "sv"): sobe na troca/redefinicao de senha e na
  -- inativacao/bloqueio, e todo token emitido antes deixa de valer.
  ADD COLUMN versao_sessao INT NOT NULL DEFAULT 0;

-- A trilha guardava a linha inteira de usuarios, com o hash da senha: quem
-- le a auditoria nao precisa dele. Fica so o fato de a senha ter mudado.
CREATE OR REPLACE FUNCTION fn_registrar_auditoria()
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
    v_antigos := to_jsonb(OLD) - 'senha_hash';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_novos := to_jsonb(NEW) - 'senha_hash';
  END IF;
  -- Via JSON: OLD.senha_hash nem compila nas tabelas que nao tem a coluna.
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'usuarios' THEN
    IF to_jsonb(OLD) ->> 'senha_hash' IS DISTINCT FROM to_jsonb(NEW) ->> 'senha_hash' THEN
      v_novos := v_novos || '{"senha_alterada": true}'::jsonb;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO auditoria (tabela, operacao, registro_id, dados_antigos, dados_novos, usuario_id, endereco_ip)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.id, v_antigos, NULL, v_usuario_id, v_ip);
    RETURN OLD;
  END IF;

  INSERT INTO auditoria (tabela, operacao, registro_id, dados_antigos, dados_novos, usuario_id, endereco_ip)
  VALUES (TG_TABLE_NAME, TG_OP, NEW.id, v_antigos, v_novos, v_usuario_id, v_ip);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE auditoria SET dados_antigos = dados_antigos - 'senha_hash', dados_novos = dados_novos - 'senha_hash'
WHERE tabela = 'usuarios' AND (dados_antigos ? 'senha_hash' OR dados_novos ? 'senha_hash');
