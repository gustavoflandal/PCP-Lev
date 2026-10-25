# Suíte E2E (Playwright)

Roteiros de navegador real que percorrem o sistema como um usuário: telas, permissões, regras de negócio e integrações. A suíte roda numa **stack isolada**: projeto Compose `pcp-e2e`, com banco novo a cada execução e portas próprias. Por isso não toca nos dados do ambiente de desenvolvimento.

## Como rodar

```sh
sh e2e/run.sh                         # suíte inteira (~6 min)
sh e2e/run.sh producao recebimento    # só alguns roteiros (nome sem "roteiro-")
MANTER=1 sh e2e/run.sh                # não derruba a stack no fim
```

É preciso ter só Docker e Docker Compose v2.24 ou mais novo. O script:

1. sobe o Postgres, o backend, o frontend e o Mailpit com `docker-compose.yml` mais `e2e/docker-compose.e2e.yml`;
2. espera a API responder e cria os usuários de teste (`dados/usuarios-teste.sql`, senha `Admin@123`);
3. roda cada roteiro num container `mcr.microsoft.com/playwright:v1.49.1-noble` na mesma rede, antes aplicando o SQL de preparo que o roteiro pedir;
4. grava os logs, os screenshots e o `resumo.txt` em `e2e/saida/`;
5. derruba a stack e apaga o volume.

O resultado de saída é diferente de zero se algum roteiro falhar.

Com `MANTER=1`, a stack fica no ar para inspeção:

| Serviço | Endereço |
|---|---|
| Frontend | http://localhost:3110 |
| API | http://localhost:8100 |
| Banco | localhost:5543 |
| Mailpit | http://localhost:8125 |

## Roteiros (em ordem)

| Roteiro | Fase | Cobre |
|---|---|---|
| `regional` | 4 | formatos de data e hora aplicados sem recarregar, por perfil |
| `seguranca` | 4 | CSP sem violações em todas as telas, ViaCEP liberado, tela de Banco de dados sem credenciais, acesso do Gestor e limite de tentativas de login |
| `negocio` | 4 | alçada do Gestor, cotações mínimas e tolerância de recebimento por nota fiscal |
| `smtp` | 4 | configuração e envio real de e-mail para o Mailpit |
| `rbac` | 2.2a | matriz de perfis, menu e acesso por permissão |
| `usuarios` | 2.2b | gestão de usuários, troca de senha obrigatória e permissões individuais |
| `clientes` | 2.3 | clientes e centros de trabalho |
| `producao` | 3 | pedido de venda até a OP, Kanban, teste, metrologia, custo, entrega e ficha *as-built* |
| `recebimento` | v1.2 | importar XML, de-para, lote, séries, conferir, efetivar, kardex e estorno |
| `anexos` | 3.1 | mídia de peça, laudo na OP e na ficha, documento de fornecedor e vencimentos |

O roteiro `anexos` usa a OP concluída pelo roteiro `producao` e o fornecedor do `recebimento`. Rode os três juntos.

## Ambiente com inspeção TLS

Num ambiente com inspeção TLS (antivírus ou proxy corporativo), coloque o certificado da autoridade em `backend/.docker-ca/*.crt`. O script o repassa ao `npm` na primeira instalação do Playwright, e os Dockerfiles já o usam no build.

## Teste de carga (k6)

```sh
sh e2e/carga/run.sh
```

O script sobe a mesma stack isolada e semeia volume de alguns anos de uso (`carga/volume.sql`: 300 fornecedores, 3 mil peças, mil pedidos e 200 mil movimentações). Em seguida roda `carga/carga.js` com até 30 usuários simultâneos por cerca de 3 minutos. A carga mistura as listas mais usadas com uma escrita a cada 10 iterações, que passa pela trilha de auditoria.

As metas reprovam a execução se falharem:

| Medida | Meta |
|---|---|
| p95 de leitura | abaixo de 300 ms |
| p95 de escrita | abaixo de 800 ms |
| Erros | abaixo de 1% |

O resultado completo fica em `e2e/saida/carga.txt`.

Resultado de referência (24/10/2026, notebook de desenvolvimento, Docker Desktop):

| Medida | Resultado |
|---|---|
| p95 de leitura | 9,3 ms |
| p95 de escrita | 6,0 ms |
| Erros | 0% em 4.784 requisições |

A suíte isolada sobe o limite de requisições (`RATE_LIMIT_RPS=200`). Sem isso, os 30 usuários virtuais, que compartilham um único login e um único IP, esbarrariam no limite por usuário, que em produção vale para cada pessoa.
