# Segurança — auditoria OWASP e estado atual

**Versão:** Fase 5, 24/10/2026
**Escopo:** backend Go, frontend React servido por nginx, Compose de desenvolvimento e de produção.
**Método:** revisão de código por um agente de auditoria (somente leitura), `govulncheck` e `npm audit`; depois, correção e teste de cada achado.

## Resumo

A auditoria encontrou:

| Gravidade | Achados |
|---|---|
| Crítico | 2 |
| Alto | 4 |
| Médio | 5 |
| Baixo | 9 |
| Informativo | 8 |

Os críticos, os altos e os médios foram corrigidos, com teste automatizado quando o comportamento é testável. Dos baixos, ficaram pendentes três itens de risco pequeno, com o motivo registrado na seção [Pendências aceitas](#pendências-aceitas).

O que já estava bom e continua valendo:

- **Permissões:** são resolvidas no banco a cada requisição, não pelo token.
- **Gestão de usuários:** regras anti-escalada (ninguém altera a si mesmo, só ADMIN altera ADMIN, o editor precisa ter todas as permissões do alvo).
- **Banco:** SQL sempre parametrizado e ordenação por lista fechada.
- **XML da NF-e:** sem XXE (`encoding/xml` não resolve entidades).
- **Arquivos:** URL assinada com HMAC e comparação em tempo constante, tipo detectado pelo conteúdo, CSP restritiva.

## Achados e correções

| # | Achado | Correção |
|---|---|---|
| C1 | Segredo JWT de exemplo, publicado no repositório, aceito e em uso: forjava token de ADMIN e URL de arquivo. | O Compose não tem mais valor padrão (`${JWT_SECRET:?}`); o `.env` local ganhou um segredo aleatório. Em produção, a API se recusa a subir com segredo conhecido. Teste: `TestProducaoRecusaSegredoJWTDeExemplo`. |
| C2 | Postgres publicado em todas as interfaces, com superusuário e senha padrão. | Desenvolvimento: a porta ficou só em `127.0.0.1`. Produção: o banco não tem porta publicada, a API conecta com um papel **sem superusuário** (dono do banco, criado por `deploy/initdb/`) e as senhas são obrigatórias. |
| A1 | Admin semeado com `Admin@123`, sem troca obrigatória. | Em produção, a API marca troca obrigatória no boot enquanto o admin tiver a senha de instalação. |
| A2 | Limite de login contornável por concorrência; sem bloqueio por conta. | A ficha passou a ser reservada antes do handler, sem corrida. Teste: `TestLimiteDeLoginNaoDeixaTentativasSimultaneasPassarem`. A conta é bloqueada após 5 falhas seguidas, por 15, depois 30 e depois 60 minutos (`TestLoginBloqueiaAContaDepoisDeFalhasSeguidas`). |
| A3 | JWT sem revogação: um token roubado sobrevivia à troca de senha. | Versão de sessão no token (`sv`). Ela sobe na troca e na redefinição de senha e na inativação ou bloqueio, e os tokens anteriores recebem 401 `SESSAO_ENCERRADA`. Quem trocou a senha recebe um token novo. Teste: `TestTrocarSenhaRevogaTokensAnteriores`. |
| A4 | Go 1.25 sem suporte e 16 vulnerabilidades alcançáveis (`net/http`, `x/image`, `golang-jwt`…); axios e outras no npm. | Go 1.26.10 e módulos atualizados: o `govulncheck` acusa **0 vulnerabilidades alcançáveis**. `npm audit fix` aplicado. O CI agora roda `govulncheck` e `npm audit`. |
| M1 | IDOR em arquivos: quem conhecia o UUID vinculava o arquivo a um registro seu e o lia. | Para vincular (anexo ou certificado de nota), vale a mesma regra de abrir: ter enviado o arquivo ou poder ver um registro que já o usa. Teste: `TestAnexarArquivoAlheioERecusado`. |
| M2 | Credenciais em HTTP puro. | Produção com HTTPS obrigatório (Caddy na frente, HSTS). Ver `docs/10_IMPLANTACAO.md`. |
| M3 | Todos os usuários com o mesmo IP visto pela API, de modo que o bloqueio de um bloqueava todos. | Em produção, o nginx recebe o IP real do cliente pelo Caddy (`deploy/nginx-proxy.conf`), e o bloqueio por conta não depende de IP. |
| M4 | Política de senha fraca (8 caracteres). | Mínimo de 10 caracteres e máximo de 72 bytes. Recusa senhas comuns, senhas que contêm o login e um único caractere repetido. Teste: `TestPoliticaDeSenha`. |
| M5 | Trocar senha como oráculo de senha sem limite. | A senha atual errada conta para o bloqueio da conta. |
| B1 | Enumeração de usuários pelo tempo de resposta. | Login inexistente compara contra um hash fictício e leva o mesmo tempo. |
| B2 | Rotas autenticadas sem conferir usuário ativo. | Toda rota autenticada confere a sessão (versão e situação), não só as que exigem permissão. |
| B3 | Quem configura perfis podia esvaziar um perfil mais poderoso. | Só edita um perfil quem tem todas as permissões dele (`ErrPerfilAcimaDoEditor`). |
| B4 | Upload: memória na decodificação e metadados de outro usuário na deduplicação. | Teto de 25 MP, no máximo 2 decodificações simultâneas, e o nome do arquivo devolvido é o de quem enviou. |
| B5 | nginx expondo a versão; imagens base antigas. | `server_tokens off`; `alpine:3.22` e `nginx:1.28-alpine`. |
| B6 | Servidor HTTP sem timeouts (slowloris). | `ReadHeaderTimeout` de 10 s e limites de leitura, escrita e conexão ociosa. |
| B7 | Hash de senha guardado na trilha de auditoria; exportação sem limite. | O trigger de auditoria não grava mais `senha_hash` (fica só `senha_alterada: true`), e o histórico antigo foi limpo pela migration 021. A exportação está limitada a 100 mil linhas. As falhas de login aparecem na trilha (contador da conta). |
| B9 | CI sem verificação de segurança. | `govulncheck` e `npm audit --omit=dev` no CI. |

## Checklist OWASP Top 10 (2021) depois das correções

| Item | Estado | Observação |
|---|---|---|
| A01 Controle de acesso | Atendido | RBAC no banco, IDOR de arquivos fechado, edição de perfis sob domínio do editor, sessão conferida em toda rota. |
| A02 Falhas criptográficas | Atendido em produção | HTTPS obrigatório, segredos obrigatórios e sem exemplo. Em desenvolvimento roda HTTP local. |
| A03 Injeção | Atendido | SQL parametrizado, sem XXE, sem sinks de XSS no SPA. |
| A04 Design inseguro | Atendido | Bloqueio por conta, limite sem corrida, troca obrigatória do admin, revogação de sessão. |
| A05 Configuração | Atendido em produção | Banco sem porta e sem superusuário, nginx sem versão, timeouts. |
| A06 Componentes vulneráveis | Parcial | Go limpo. No frontend, zod 3 e react-router 6 têm avisos que exigem troca de versão maior (ver abaixo). |
| A07 Autenticação | Atendido | Política de senha, bloqueio, revogação, sem enumeração. |
| A08 Integridade | Parcial | Lockfiles no CI. Faltam actions fixadas por SHA e a validação da assinatura do XML da NF-e. |
| A09 Registro e monitoramento | Parcial | Trilha por trigger sem hashes e falhas de login registradas. Respostas 403 vão só para o log da API. |
| A10 SSRF | Parcial | Única saída controlada pelo usuário: o teste de SMTP (exige `configuracoes.integracoes`). |

## Pendências aceitas

| Item | Risco | Por que fica |
|---|---|---|
| zod < 4.6.6 (alto) | Exaustão de memória ao validar coleções enormes, **no navegador** de quem digita. | Zod 4 é mudança de versão maior, com impacto em todos os formulários. Planejar junto com a próxima evolução do frontend. |
| react-router 6 (moderado) | Open redirect por barra invertida. | O SPA não navega para URL vinda do usuário. |
| Teste de SMTP revela portas internas (B8) | Quem tem `configuracoes.integracoes` (administrador) distingue porta fechada de timeout. | A mensagem detalhada é o que permite configurar o SMTP. |
| Chave das URLs de arquivo derivada do segredo JWT | Comprometer um compromete o outro. | Com o segredo obrigatório e aleatório, o risco é o mesmo de vazar o segredo JWT. |
| Assinatura digital do XML da NF-e não validada (I5) | XML forjado passaria na prévia. | A conferência manual da nota (chave, valores, pedido) continua obrigatória. |
| URL assinada no access log do nginx (I7) | Link válido por 5 minutos fica no log do servidor. | O log é acessível só a quem administra o servidor. |
| Arquivos órfãos sem limpeza nem cota (B4) | Ocupação de disco por quem tem permissão de envio. | Baixo volume esperado. Fica registrado para evolução. |

## Como verificar de novo

```sh
# Vulnerabilidades do backend (Docker, Go 1.26)
docker run --rm -v "$PWD/backend:/src" -w /src golang:1.26-alpine go run golang.org/x/vuln/cmd/govulncheck@latest ./...
# Dependências do frontend que vão para o navegador
docker run --rm -v "$PWD/frontend:/app" -w /app node:22-alpine npm audit --omit=dev
```
