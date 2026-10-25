# Segurança e Banco de Dados — Design (Fase 4, sub-entrega 3)

Referência: `docs/0_SUMARIO_EXECUTIVO.md` §4.7.6 e `docs/6_CRONOGRAMA_TECNICO.md`
(Fase 4, item 5 — "Fatia de Segurança/Banco de Dados"). Spec decidida de forma autônoma
(decisão do usuário de 24/10/2026); decisões provisórias marcadas como tal.

## 1. Escopo

1. **Tela somente-leitura "Banco de dados"** (Administrador): status da conexão, host
   mascarado, nome do banco, versão do PostgreSQL, tamanho do banco e das 10 maiores
   tabelas, uso do pool (em uso / ociosas / máximo), conexões ativas no servidor,
   latência do ping, e o bloco "Último backup". Botão **Testar conexão** (`SELECT 1`).
   Nunca expõe usuário, senha ou string de conexão.
2. **Cabeçalhos de segurança**
   - API (Echo `Secure`): `X-Content-Type-Options`, `X-Frame-Options: DENY`,
     `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (a API só
     devolve JSON/CSV/imagens), `Referrer-Policy: same-origin`, HSTS quando a requisição
     chega por HTTPS.
   - SPA (nginx): CSP restritiva + HSTS + os cabeçalhos que já existiam, repetidos no
     `location /assets/` (o `add_header` de um `location` anula os herdados do `server`
     — os assets hoje saem sem nenhum cabeçalho de segurança).
   - O script inline de tema do `index.html` sai para `public/tema-inicial.js`, para a CSP
     poder usar `script-src 'self'` sem `'unsafe-inline'` nem hash a manter em sincronia.
3. **Rate limiting** (memória do processo, `golang.org/x/time/rate`, já dependência
   indireta via Echo):
   - Global por cliente: 20 req/s, rajada de 60.
   - `POST /auth/login`: 5 tentativas/min por IP, rajada de 5 — o vetor de força bruta,
     já que ainda não há bloqueio de conta por tentativas (§4.7.3, fica para a Fase 2.2).
   - Identificador: usuário do token quando há `Authorization` válido, senão o IP
     (`c.RealIP()`, que só confia em `X-Forwarded-For` vindo de rede privada).
   - Resposta: 429 no envelope padrão (`LIMITE_EXCEDIDO`) com `Retry-After`.
   - Configurável por variável de ambiente (`RATE_LIMIT_RPS`, `RATE_LIMIT_RAJADA`,
     `RATE_LIMIT_LOGIN_POR_MINUTO`); `RATE_LIMIT_RPS=0` desliga o global.

## 2. Fora de escopo (e por quê)

- Vault / Docker Secrets / rotação de credenciais / TLS Postgres / usuário de migração
  separado: decisão e operação de infraestrutura, não código de aplicação.
- Política de sessão, IPs autorizados, exportação por perfil, dispositivos de PIN:
  dependem do RBAC novo (Fase 2.2) ou do login por PIN (não previsto ainda).
- Criptografia AES-256-GCM de segredos de terceiros: entra junto com o primeiro segredo
  real (senha SMTP, sub-entrega 5).
- Backup real: §4.6.8, adiado para depois da Fase 4. **Decisão provisória**: o bloco
  "Último backup" mostra "Nenhum backup registrado" com a explicação, em vez de sumir —
  o lugar já fica pronto para quando o registro de backup existir.

## 3. Contrato da API

`GET /api/v1/configuracoes/banco` (Administrador):

```json
{
  "conectado": true,
  "latencia_ms": 1.2,
  "host": "po*****es:5432",
  "banco": "pcp_db",
  "versao": "16.4",
  "tamanho_bytes": 12345678,
  "maiores_tabelas": [{ "tabela": "auditoria", "tamanho_bytes": 81920, "linhas_estimadas": 120 }],
  "pool": { "em_uso": 1, "ociosas": 3, "total": 4, "maximo": 20 },
  "conexoes_ativas": 5,
  "ultimo_backup": null
}
```

`POST /api/v1/configuracoes/banco/testar` (Administrador): `{ "ok": true, "latencia_ms": 0.8 }`;
falha de conexão → 503 `INDISPONIVEL`, sem detalhe do driver na mensagem (pode conter o
host/usuário).

Mascaramento do host: primeiros 2 caracteres + `*****` + últimos 2 (hosts com até 4
caracteres viram `****`), porta mantida. O nome do banco é exibido (o §4.7.6 pede).

## 4. Frontend

Rota `/configuracoes/banco`, item "Banco de dados" (ícone `database`) na seção
Configurações, só para Administrador; conteúdo de ajuda; acesso restrito na URL direta.
Cartões: Conexão (status + latência + Testar conexão), Identificação, Armazenamento
(tamanho + tabela das maiores), Pool de conexões, Último backup. Botão "Atualizar"
refaz a consulta. Tamanhos com `formatarBytes` (novo, em `lib/formato.ts`).

## 5. Plano de implementação (uma task = um commit)

- **B1** Domínio `internal/domain/banco` (tipos + `MascararHost`) e repositório que lê
  `pg_stat_user_tables`/`pg_database_size`/`pg_stat_activity`/`SHOW server_version` e
  `pool.Stat()`. Testes de repositório contra o Postgres de testes.
- **B2** Handler + rotas (`GET`, `POST /testar`), 401/403/200, sem vazamento de
  credencial no JSON (teste procura usuário e senha da DSN no corpo).
- **B3** Rate limiting (middleware + config + testes de 429 e de `Retry-After`) e
  cabeçalhos de segurança na API (teste dos cabeçalhos).
- **F1** Tipos/serviço/`formatarBytes` + tela + testes.
- **F2** Rota, navegação, ícone, ajuda + testes.
- **F3** nginx (CSP, HSTS, cabeçalhos no `/assets/`) + `public/tema-inicial.js`.
- **F4** Verificação final: suítes via Docker, `code-reviewer`, Playwright (incluindo
  zero violações de CSP no console navegando pelas telas, ViaCEP funcionando, 429 no
  login após 5 tentativas), screenshot 44, manual seção 16 (renumerando as seguintes),
  ledger.
