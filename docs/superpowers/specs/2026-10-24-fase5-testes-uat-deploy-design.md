# Fase 5 — Testes, UAT e Deploy (design)

Data: 24/10/2026. Pedido do usuário: "ok continue", depois do roteiro até a 3.1. Decisões
tomadas de forma autônoma (decisão "Autônomo até o fim"), registradas no ledger.

## Objetivo

Deixar o sistema pronto para ir a produção num servidor da empresa. O trabalho se divide em
cinco frentes. As três primeiras são técnicas e eu executo. As duas últimas dependem de
pessoas: eu preparo o material, e a execução fica com o Gestor de Operações.

## 5a. Segurança (OWASP Top 10 + RBAC)

- Auditoria por um agente `security-auditor`, sobre o código atual, cobrindo:
  - controle de acesso: RBAC por permissão, anti-escalada na gestão de usuários e acesso a
    arquivos por URL assinada;
  - injeção: SQL e XML da NF-e (XXE e bomba de entidades);
  - autenticação: JWT, bloqueio, troca de senha e rate limit;
  - upload: tipos, tamanhos e dimensões de imagem;
  - cabeçalhos HTTP: nginx e CSP;
  - segredos, logs e dependências: `govulncheck` e `npm audit` (dependências de produção
    em separado das de desenvolvimento).
- Correção de todo achado Crítico, Alto e Médio. Os Baixos são corrigidos quando custam
  pouco; os demais ficam registrados.
- Resultado em `docs/9_SEGURANCA.md`, com a checklist OWASP item a item, o estado de cada
  um e o que fica para depois.

## 5b. Testes

- **E2E versionado**: os roteiros Playwright das fases ficam hoje na pasta temporária da
  sessão e passam para o repositório em `e2e/`. A pasta terá:
  - roteiros;
  - SQL de dados;
  - um `run.sh` que sobe tudo via Docker e roda a suíte inteira contra a stack.

  Assim qualquer pessoa repete a verificação.
- **Cobertura**: medir backend (`go test -cover`) e frontend (`vitest --coverage`).
  Registrar os números e cobrir lacunas óbvias em pacotes de domínio críticos (nota fiscal,
  produção, acesso), sem perseguir porcentagem.
- **Carga (k6, via Docker)**: cenários de leitura (listas, Kanban, estoque) e de escrita
  (apontamento) com usuários simultâneos realistas para uma fábrica (20 a 50). Metas:
  - p95 abaixo de 300 ms em leitura e abaixo de 800 ms em escrita;
  - zero erros 5xx.

  O rate limit é ajustado para o teste e o motivo fica documentado.

## 5c. Deploy

- `docker-compose.prod.yml`:
  - Postgres sem porta publicada;
  - variáveis obrigatórias (o Compose falha sem `DB_PASSWORD`, `JWT_SECRET` e
    `CHAVE_MESTRA_SEGREDOS`);
  - `API_ENV=production`;
  - healthchecks nos três serviços e limites de log;
  - serviço de **backup diário** (`pg_dump` com retenção de 14 dias) num volume próprio.
- HTTPS: documentado com um proxy reverso na frente, por exemplo Caddy com certificado
  interno ou o da empresa. Não fica embutido, porque depende da rede do cliente.
- `docs/10_IMPLANTACAO.md` — runbook com:
  - requisitos;
  - primeira instalação (gerar segredos e criar o admin);
  - atualização de versão (migrations automáticas e backup antes);
  - backup e restauração testados de verdade;
  - rollback;
  - monitoramento (`/api/v1/saude` e logs).
- CI: manter `.github/workflows/ci.yml`, acrescentar o `govulncheck` e documentar que no
  Gitea ele roda se houver um runner do Gitea Actions.

## 5d. Homologação (UAT)

- `docs/11_ROTEIRO_HOMOLOGACAO.md` — cenários de ponta a ponta para o Gestor executar, cada
  um com:
  - pré-condição;
  - passos;
  - resultado esperado;
  - campo de aceite/observação.

  Os cenários cobrem cadastros, compras, recebimento por nota, produção, expedição,
  rastreabilidade, documentos e configurações, por perfil.

## 5e. Treinamento

- O manual de operação já cobre as telas. Acrescento `docs/12_TREINAMENTO.md`, com:
  - trilhas por perfil (Almoxarife, Comprador, Operador, Qualidade, Vendas, Gestor);
  - a ordem de leitura das seções do manual;
  - os exercícios práticos de cada trilha.

## Fora do escopo

- Executar a homologação e o treinamento com pessoas.
- Provisionar o servidor de produção.
- Comprar ou emitir certificado.
- Monitoramento com Prometheus/Grafana (registrado como evolução).

## Ordem

1. 5a (auditoria em paralelo com 5b-E2E).
2. 5b.
3. 5c.
4. 5d e 5e.
5. Ledger, push e PR.

Branch `feat/fase5`, empilhado sobre `release/v1.2`.
