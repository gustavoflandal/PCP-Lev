# Implantação — runbook

Este runbook é para quem instala e mantém o Sistema PCP no servidor da empresa. Tudo roda em Docker, a partir do `docker-compose.prod.yml` na raiz do projeto.

O arranjo foi validado de ponta a ponta numa stack de teste:
- HTTPS com HSTS;
- HTTP redirecionado para HTTPS;
- troca obrigatória da senha do admin;
- API com papel de banco sem superusuário;
- backup e restauração com o dono das tabelas preservado.

## Arquitetura

```
navegador ──HTTPS──> Caddy (80/443) ──> nginx do frontend ──> API (Go) ──> PostgreSQL
                                                                          ^
                                                     backup diário (pg_dump) ┘
```

- **Caddy** é o único serviço com porta publicada. Ele termina o HTTPS, envia HSTS e repassa o IP real do cliente. Esse IP é a base do limite de tentativas de login e da trilha de auditoria.
- **API** conecta ao banco com o papel `pcp_app`, dono do banco mas **sem superusuário**. O superusuário `pcp_admin` é usado só pelo backup e pela manutenção.
- **Migrations** são aplicadas automaticamente pela API ao subir.

## Requisitos

- Linux x86-64 com Docker Engine 24+ e Docker Compose v2.24+.
- 2 vCPU, 4 GB de RAM e 20 GB de disco, mais o espaço dos backups (cerca de 14 vezes o tamanho de um backup).
- Um nome na rede interna (DNS ou `hosts` das estações) para acessar o sistema, por exemplo `pcp.empresa.local`.
- Portas 80 e 443 livres no servidor, ou outras em `HTTP_PORT` e `HTTPS_PORT`.

## Primeira instalação

1. **Copie o projeto** para o servidor (por exemplo, `git clone` do repositório) e entre na pasta.
2. **Crie o arquivo de ambiente** a partir do modelo e gere os segredos **na própria máquina**:

   ```sh
   cp deploy/.env.prod.example deploy/.env.prod
   openssl rand -base64 24   # DB_ADMIN_PASSWORD
   openssl rand -base64 24   # DB_PASSWORD
   openssl rand -base64 48   # JWT_SECRET
   openssl rand -base64 32   # CHAVE_MESTRA_SEGREDOS
   ```

   Preencha `deploy/.env.prod`, com `PCP_DOMINIO` e `PCP_TLS`. Guarde uma cópia do arquivo em local seguro e separado do servidor. Sem a `CHAVE_MESTRA_SEGREDOS`, a senha do SMTP restaurada de um backup não decifra; nesse caso, basta digitá-la de novo.
3. **Escolha o certificado** (`PCP_TLS`):

   | Valor | Quando usar |
   |---|---|
   | `internal` | Rede interna sem certificado da empresa. O Caddy cria uma autoridade própria; instale a raiz dela nas estações (passo 6). |
   | um e-mail | O nome é público na internet; o Caddy obtém o certificado no Let's Encrypt. |
   | `/certs/cert.pem /certs/key.pem` | A empresa tem certificado; copie os arquivos para `deploy/certs/`. |

4. **Suba o sistema:**

   ```sh
   docker compose -f docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
   docker compose -f docker-compose.prod.yml --env-file deploy/.env.prod ps
   ```

   Todos os serviços devem ficar `healthy` (o backup não tem verificação de saúde).
   Sem algum segredo obrigatório, o Compose se recusa a subir e diz qual falta.
5. **Primeiro acesso:** abra `https://<PCP_DOMINIO>` e entre com `admin` / `Admin@123`. O sistema exige a troca da senha na hora. A nova precisa ter 10 caracteres ou mais, não pode conter o login nem ser uma senha óbvia.
   Em seguida, crie os usuários reais (Configurações → Usuários). Configure os dados da empresa, os parâmetros e o SMTP pelo menu de Configurações.
6. **Só com `PCP_TLS=internal`:** exporte a raiz do Caddy e instale nas estações como "Autoridade de certificação raiz confiável":

   ```sh
   docker compose -f docker-compose.prod.yml --env-file deploy/.env.prod \
     cp caddy:/data/caddy/pki/authorities/local/root.crt ./pcp-raiz.crt
   ```

## Atualização de versão

1. **Faça um backup antes** (veja abaixo) e anote a versão atual do schema:
   `docker compose ... exec backup psql -tAc "SELECT max(id) FROM schema_version"`.
2. Atualize o código (`git pull` ou novo pacote) e ajuste `PCP_VERSAO` no `.env.prod`.
3. Reconstrua e suba: `docker compose -f docker-compose.prod.yml --env-file deploy/.env.prod up -d --build`.
   A API aplica as migrations novas sozinha. Acompanhe com `docker compose ... logs -f backend` até aparecer `API no ar`.
4. Confira `https://<PCP_DOMINIO>/api/v1/saude` (`"ambiente":"production"`) e entre no sistema.

### Voltar à versão anterior

As migrations só avançam. Para voltar, **restaure o backup feito antes** da atualização e suba as imagens da versão anterior:

1. Volte o código: `git checkout <versão anterior>`.
2. Rode `up -d --build`.
3. Restaure o backup com `sh deploy/restaurar.sh`.

## Backup e restauração

- O serviço `backup` faz um `pg_dump` (formato custom) todo dia em `BACKUP_HORA` e grava em `BACKUP_DIR` (padrão `./backups`). Os arquivos com mais de `BACKUP_RETENCAO_DIAS` são apagados.
- **Copie `BACKUP_DIR` para fora do servidor** (outro disco, NAS ou nuvem). Um backup que fica só na mesma máquina não protege contra perda do disco.
- Backup imediato:

  ```sh
  docker compose -f docker-compose.prod.yml --env-file deploy/.env.prod exec backup sh /backup.sh agora
  ```

- Restauração. O script para a API, substitui o conteúdo do banco e sobe a API de novo:

  ```sh
  sh deploy/restaurar.sh backups/pcp_20261024_020000.dump
  ```

  Ele pede para digitar `RESTAURAR` como confirmação.
- **Teste a restauração periodicamente** (uma vez por trimestre) numa máquina separada. Um backup que nunca foi restaurado não é garantia.

## Monitoramento

| O quê | Como |
|---|---|
| A API está no ar? | `GET https://<PCP_DOMINIO>/api/v1/saude` responde `200` com `"status":"ok"`. Ela também consulta o banco: `503` indica banco indisponível. |
| Estado dos serviços | `docker compose ... ps` mostra `healthy` ou `unhealthy`. |
| Logs | `docker compose ... logs --tail 200 backend`. A API escreve uma linha JSON por requisição (método, rota, status, duração, IP). Os logs giram a cada 20 MB, com 5 arquivos por serviço. |
| Backups | `docker compose ... logs backup` mostra `backup ok` com o tamanho, uma vez por dia. |
| Segurança | O que já foi verificado e o que ficou pendente está em `docs/9_SEGURANCA.md`. |

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `up` falha com "defina DB_PASSWORD…" | Falta um segredo obrigatório em `deploy/.env.prod`. |
| A API reinicia em loop com "JWT_SECRET e um valor de exemplo" | O segredo copiado é um exemplo do repositório; gere um próprio. |
| Navegador alerta que o certificado não é confiável | Com `PCP_TLS=internal`, falta instalar a raiz do Caddy nas estações. |
| "Muitas tentativas de senha para este usuário" | A conta foi bloqueada por 15 a 60 minutos após 5 senhas erradas. O administrador libera na hora redefinindo a senha. |
| "Sua sessão foi encerrada" | A senha foi trocada ou redefinida, ou a conta foi bloqueada e reativada; basta entrar de novo. |
| Todos os usuários aparecem com o mesmo IP na auditoria | Há outro proxy ou NAT na frente do Caddy. No Docker Desktop (Windows/Mac), o IP visto é sempre o do gateway; em servidor Linux, aparece o IP real da estação. |

## Ambiente de desenvolvimento (referência)

O `docker-compose.yml` da raiz é para desenvolvimento:
- HTTP na porta 3010;
- banco publicado só em `127.0.0.1`;
- `JWT_SECRET` obrigatório no `.env` local.

Não use esse arquivo em produção.
