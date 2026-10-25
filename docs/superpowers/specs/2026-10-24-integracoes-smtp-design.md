# Integrações: Servidor de E-mail (SMTP) — Design (Fase 4, sub-entrega 5)

Referência: `docs/0_SUMARIO_EXECUTIVO.md` §4.7.7 (SMTP) e §4.7.6 (segredos de terceiros);
`docs/6_CRONOGRAMA_TECNICO.md` Fase 4, item 7 — "só SMTP + teste de envio". Spec decidida
de forma autônoma (decisão do usuário de 24/10/2026).

## 1. Escopo

- Configuração singleton do servidor SMTP: habilitado, host, porta, criptografia
  (`NENHUMA` / `STARTTLS` / `TLS`), usuário, senha, e-mail e nome do remetente.
- **Senha**: cifrada em repouso com **AES-256-GCM** (nonce aleatório por gravação), chave
  mestra fora do banco (`CHAVE_MESTRA_SEGREDOS`, 32 bytes em base64, variável de ambiente).
  Nunca volta pela API: o GET devolve só `senha_definida: true/false`. Também não aparece
  na trilha de auditoria (entra no mapa de campos sensíveis, como `senha_hash`).
- **Envio de teste** para um destinatário informado, com a configuração **salva**; erro do
  servidor SMTP devolvido de forma legível (sem credenciais), com timeout de 15 s.
- Ambiente de desenvolvimento: serviço **Mailpit** no `docker-compose.yml`, em perfil
  `dev` (não sobe por padrão), para testar envio real com caixa de entrada web.

Fora: WhatsApp/Telegram, webhooks, chaves de API, NF-e/ERP (cronograma). Ninguém consome o
SMTP ainda — a matriz de notificações (§4.6.10) é posterior à Fase 4.

## 2. Contrato (todas as rotas: Administrador)

`GET /api/v1/configuracoes/smtp`:

```json
{ "habilitado": true, "host": "smtp.empresa.com.br", "porta": 587, "criptografia": "STARTTLS",
  "usuario": "pcp@empresa.com.br", "senha_definida": true,
  "remetente_email": "pcp@empresa.com.br", "remetente_nome": "Sistema PCP",
  "updated_at": "...", "updated_by": "admin" }
```

`PUT /api/v1/configuracoes/smtp` — mesmos campos, mais:
- `senha` (opcional): não vazia = troca a senha; ausente ou vazia = mantém a atual.
- `remover_senha: true` = apaga a senha (servidor sem autenticação). Junto com `senha` → 400.

`POST /api/v1/configuracoes/smtp/testar` `{ "destinatario": "alguem@empresa.com.br" }` →
200 `{ "enviado": true }`; sem host configurado → 409; falha do servidor → 502
`FALHA_SERVICO_EXTERNO` com a mensagem do servidor SMTP.

Validação: porta 1–65535, criptografia no conjunto; com `habilitado`, host e e-mail do
remetente obrigatórios (e-mail válido). Gravar senha sem `CHAVE_MESTRA_SEGREDOS`
configurada → 409 explicando o que falta (configuração sem senha continua possível).

## 3. Decisões provisórias

- Chave mestra **opcional** na subida (o sistema funciona sem SMTP); se informada e
  inválida (não é base64 de 32 bytes), a API não sobe. **Sem valor padrão** no
  `docker-compose.yml` (revisão de código): cada ambiente gera a sua no `.env`.
- Autenticação PLAIN só sobre conexão cifrada (STARTTLS/TLS) — regra do próprio `net/smtp`
  do Go para hosts que não são locais; com `NENHUMA`, só servidor sem autenticação.
- Rotação da chave mestra: fora (procedimento de infraestrutura; trocar a chave exige
  regravar a senha pela tela).

## 3.1 Endurecimento após a revisão de código

- **Senha amarrada ao destino**: o host, a porta e o usuário entram como AAD do GCM (`v1:`
  + base64). Trocar o destino sem digitar a senha de novo → 400; um destino trocado
  direto no banco torna a senha ilegível. Sem isso, um admin (ou uma sessão
  sequestrada) trocaria só o host para um servidor próprio e usaria "testar" para
  receber a senha.
- **Trilha sem o texto cifrado**: trigger própria (`fn_auditoria_configuracao_smtp`)
  grava `senha_cifrada` como `ausente` / `definida` / `definida (trocada)`.
- **Sem chave mestra padrão no compose**: uma chave publicada no repositório cifraria
  as senhas de qualquer ambiente que esquecesse de definir a sua.
- **AUTH LOGIN** como alternativa a PLAIN, com a mesma exigência de TLS.
- **Erros por categoria** (conexão recusada, tempo esgotado, TLS, autenticação, resposta
  SMTP do servidor); IP resolvido, banner de outros serviços e nomes de certificado
  ficam só no log.
- Usuário/senha com criptografia `NENHUMA` → 400 (era a promessa da tela).

## 4. Plano (uma task = um commit)

- **B1** `platform/cripto` (AES-256-GCM) + config `CHAVE_MESTRA_SEGREDOS`.
- **B2** Migration 013 + domínio `email` + repositório + auditoria sem a senha cifrada.
- **B3** Enviador SMTP (`infra/smtp`) + handler/rotas + Mailpit no compose (perfil `dev`).
- **F1** Tela "Integrações" (SMTP + envio de teste) + rota/nav/ajuda.
- **F2** Verificação final (suítes, code-reviewer, Playwright com Mailpit, screenshot, manual,
  ledger).
