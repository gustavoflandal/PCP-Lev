<div align="center">

# PCP-Lev

**Sistema de controle de produção para a montagem de painéis eletrônicos e radares de trânsito**

Do pedido de compra do componente à unidade entregue ao cliente: compras, recebimento fiscal, estoque com lote e série, ordens de produção, testes, metrologia, rastreabilidade e painéis de gestão.

![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

![Tela de entrada](docs/screenshots/01-login.png)

</div>

---

## Sumário

- [Por que existe](#por-que-existe)
- [O que o sistema faz](#o-que-o-sistema-faz)
- [Telas](#telas)
- [Perfis e permissões](#perfis-e-permissões)
- [Arquitetura](#arquitetura)
- [Como rodar](#como-rodar)
- [Testes](#testes)
- [Implantação em produção](#implantação-em-produção)
- [Segurança](#segurança)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Documentação](#documentação)
- [Situação do projeto](#situação-do-projeto)
- [Autoria](#autoria)

---

## Por que existe

A fábrica montava painéis de mensagem variável, radares e controladores semafóricos para órgãos públicos acompanhando tudo em planilhas: o que comprar, o que chegou, o que está em produção, qual componente foi para qual equipamento. O PCP-Lev substitui as planilhas por um sistema único, que responde perguntas que antes levavam horas:

- **O que falta comprar** para os pedidos em carteira?
- **De qual lote e de qual nota fiscal** veio a placa instalada no radar de série X, entregue ao cliente Y?
- **Quanto custou de verdade** produzir esta ordem de produção, comparado ao orçado?
- **Quais certificados, laudos e verificações metrológicas** vencem nos próximos 30 dias?
- **Onde está cada OP** agora, e quais estão atrasadas?

---

## O que o sistema faz

### Cadastros
- **Fornecedores e clientes:** CNPJ validado, busca de endereço pelo CEP e documentos anexados (contratos, certificados de qualidade com validade).
- **Partes e peças:**
  - controle por lote, validade e número de série (com máscara);
  - item crítico;
  - foto principal, galeria e documentos técnicos versionados (datasheet, desenho, esquema elétrico).
- **Produtos acabados:** indicação de quais exigem metrologia (Inmetro).
- **Estrutura de produto (BOM) versionada:** cada OP congela a versão vigente na sua criação.
- **Centros de trabalho:** etapa do processo e custo por hora.

### Compras
- **Cotações:** registro de respostas e conversão em pedido de compra.
- **Pedidos de compra:**
  - alçada de emissão por valor e exigência de cotações mínimas;
  - acompanhamento de atrasos;
  - encerramento com saldo pendente.
- **Necessidade de compra:** peças abaixo do estoque mínimo, agrupadas por fornecedor, com exportação em CSV.

### Recebimento fiscal
- **Nota fiscal de entrada:** passa por Rascunho, Conferida e Efetivada, com estorno controlado.
- **Importação do XML da NF-e:**
  - a prévia reconhece os itens pelo de-para por fornecedor (código e fator de conversão);
  - o vínculo feito à mão é memorizado para as próximas notas;
  - o CFOP de saída do fornecedor é convertido no de entrada.
- **Conferência com pendências** em três níveis: bloqueio, aprovação e aviso. Cobre:
  - chave de acesso e CNPJ;
  - CFOP e valores;
  - divergência de preço contra o pedido, com tolerância configurável;
  - lotes, validade mínima, e séries faltando ou fora da máscara;
  - saldo do pedido.
- **Custo:** frete, seguro, IPI e ST (menos o desconto) são rateados no custo de entrada, que entra no **custo médio ponderado**.
- **Leitura de séries com leitor de código de barras:** bipagem contínua, colar uma lista ou gerar uma faixa.

### Estoque e rastreabilidade
- **Consultas do saldo:** saldo e disponível (com reservas), ajuste de inventário justificado, **kardex** com o documento de origem e **origem do saldo** (quais notas o compõem).
- **Lotes com validade:** a reserva da OP segue **FEFO** (vence primeiro, sai primeiro) e lote vencido nunca é reservado.
- **Rastreio "do lote ao campo":** de um lote às OPs que o consumiram, às unidades produzidas e aos clientes.

### Produção
- **Pedidos de venda** ligados a clientes; uma OP por item, com **liberação tudo-ou-nada**. Sem material suficiente, mostra a lista do que falta e não reserva nada.
- **Kanban** de 4 etapas (Separação, Montagem, Testes, Expedição), com **apontamento** por centro de trabalho.
- **Teste por unidade** e **metrologia** (aprovação de modelo, lacre, validade).
- **Número de série** por unidade, com **ficha _as-built_ e QR Code**: componentes com série, lotes consumidos, notas e fornecedores de origem, apontamentos, teste, metrologia e laudos.
- **Custo real por OP:** material consumido mais horas apontadas vezes o custo por hora do centro, comparado ao orçado.

### Documentos e anexos
- Anexos em OPs, fornecedores, pedidos e clientes, com categorias por tipo de registro, versões e validade.
- Registro encerrado preserva os seus documentos. A tela **Documentos a vencer** reúne certificados, contratos e documentos técnicos.

### Painéis (dashboards)
- **Painel inicial** com o que pede atenção agora: OPs em atraso, compras a receber, insumos críticos, notas pendentes, lotes e metrologia vencendo, e OPs por etapa.
- **Painéis por setor** (Compras, Recebimento e estoque, Produção, Vendas e expedição, Qualidade), com indicadores como lead time real, entregas no prazo (OTD), taxa de aprovação e valor em estoque.
- **Controles:**
  - período de 30 a 365 dias;
  - atualização automática configurável;
  - **modo TV** para o chão de fábrica, em tela cheia e sem cair a sessão.
- Cada painel tem **permissão própria**, concedível por perfil ou por usuário.

### Em todas as telas
- **Imprimir / PDF:** leiaute de impressão limpo, com cabeçalho (tela, empresa, quem imprimiu, quando), em folha clara mesmo no tema escuro.
- **Ajuda contextual** em cada tela.
- **Português e espanhol:** cada usuário escolhe o idioma em *Preferências*; telas, ajuda e mensagens da API acompanham a escolha. Manual em espanhol em [docs/es/8_MANUAL_OPERACION.md](docs/es/8_MANUAL_OPERACION.md) e landing em `landing-page/es/`.
- **Temas claro e escuro**, alto contraste, densidade e tamanho de fonte por usuário.
- **Encerramento da sessão por inatividade.**

### Configurações
- Dados da empresa (logotipo claro e escuro, usados no sistema e nos impressos).
- Parâmetros regionais (formato de data e hora) e parâmetros de negócio (tolerâncias, alçadas, cotações mínimas).
- SMTP para envio de e-mails, com a senha cifrada em repouso.
- **Usuários, perfis e permissões (RBAC)**, com regras contra escalada de privilégio.
- **Auditoria** de toda alteração (quem, quando, de onde, antes e depois), com exportação.
- Diagnóstico do banco de dados.

---

## Telas

| | |
|---|---|
| ![Painel inicial](docs/screenshots/72-painel-inicial.png) **Painel inicial** | ![Painel de produção](docs/screenshots/75-painel-producao.png) **Painel de produção** |
| ![Importação do XML](docs/screenshots/59-importar-xml-previa.png) **Importação do XML da NF-e** | ![Nota conferida](docs/screenshots/60-nota-conferida.png) **Conferência da nota fiscal** |
| ![Kanban](docs/screenshots/54-kanban.png) **Kanban de produção** | ![Ficha as-built](docs/screenshots/69-ficha-laudos.png) **Ficha _as-built_ com QR Code** |
| ![Rastreio do lote](docs/screenshots/63-rastreio-lote.png) **Rastreio do lote ao campo** | ![Painel de vendas](docs/screenshots/76-painel-vendas.png) **Painel de vendas e expedição** |
| ![Painel de compras](docs/screenshots/73-painel-compras.png) **Painel de compras** | ![Modo TV](docs/screenshots/78-painel-modo-tv.png) **Modo TV** |

As capturas de todas as telas, com o passo a passo de uso, estão no [manual de operação](docs/8_MANUAL_OPERACAO.md).

---

## Perfis e permissões

O controle de acesso é por **permissão** (73, agrupadas por módulo), atribuída a **perfis** e ajustável **por usuário**: é possível conceder ou retirar uma permissão individual, sempre com justificativa. Os perfis que vêm com o sistema são:

| Perfil | Papel típico |
|---|---|
| **Administrador** | Tudo, inclusive configurações, usuários e auditoria |
| **Gestor de Operações / PCP** | Visão e decisão sobre compras, produção, vendas e custos |
| **Comprador** | Cotações, pedidos de compra, fornecedores |
| **Almoxarife** | Recebimento por nota fiscal, estoque, lotes |
| **Operador de Montagem** | Kanban e apontamento de produção |
| **Qualidade** | Testes, metrologia, laudos e rastreabilidade |
| **Vendas** | Clientes, pedidos de venda e entregas |
| **Consulta** | Somente leitura, incluindo os painéis |

A matriz é editável na tela **Perfis e permissões**. Quem edita só concede o que tem e só altera perfis cujas permissões também possui.

---

## Arquitetura

```
           navegador (React SPA)
                   │  HTTPS
                   ▼
   Caddy (TLS, HSTS) ──► nginx (frontend + proxy /api)
                                   │
                                   ▼
                     API Go (Echo) ── RBAC, auditoria, regras de negócio
                                   │  pgx
                                   ▼
                     PostgreSQL 16 ◄── backup diário (pg_dump)
```

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · TanStack Query · React Hook Form + Zod · Zustand · Recharts · Radix UI · Lucide |
| Backend | Go 1.26 · Echo v4 · pgx/v5 (SQL puro, sem ORM) · golang-jwt · bcrypt |
| Banco | PostgreSQL 16, com 22 migrations versionadas e aplicadas pela API na subida |
| Testes | `testify` com banco real · Vitest + Testing Library · Playwright (E2E) · k6 (carga) |
| Infra | Docker Compose · nginx · Caddy (HTTPS) · backup com `pg_dump` |

Decisões que valem saber:
- **Domínio separado da infraestrutura.** `internal/domain` tem as regras e os tipos; `internal/infra/repository` tem o SQL; `internal/api/handlers` só traduz HTTP.
- **Permissões resolvidas no banco a cada requisição**, não pelo token. Mudar um perfil vale na hora. Trocar a senha ou bloquear a conta derruba as sessões abertas, porque o token carrega uma versão de sessão.
- **Auditoria por _trigger_ no banco**, com o usuário e o IP da requisição, sem depender de cada tela lembrar de registrar.
- **Arquivos (fotos, PDFs, XML)** guardados no próprio PostgreSQL (`bytea`), deduplicados por SHA-256 e servidos só por URL assinada de curta duração.
- **Concorrência tratada no banco:** travas de linha e consultivas, ordem fixa de travamento e versão de documento contra edição simultânea.

---

## Como rodar

Pré-requisitos: **Docker** e **Docker Compose v2.24+**. Nada mais precisa estar instalado na máquina.

```bash
git clone https://github.com/gustavoflandal/PCP-Lev.git
cd PCP-Lev
cp .env.example .env
```

Edite o `.env` e defina os segredos (obrigatórios, sem valor padrão):

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 32   # CHAVE_MESTRA_SEGREDOS (cifra a senha do SMTP)
```

Suba tudo:

```bash
docker compose --profile dev up -d --build
```

> **Atualizações:** depois de baixar código novo, rode `./publicar.ps1` (Windows) ou `./publicar.sh`, que reconstrói as imagens e grava o commit e a data/hora da publicação na tela de entrada. Um `docker compose up` sem `--build` mantém o container no código da última construção.

| Serviço | Endereço |
|---|---|
| Sistema | http://localhost:3010 |
| API (só na própria máquina) | http://127.0.0.1:8000/api/v1/saude |
| PostgreSQL (só na própria máquina) | `127.0.0.1:5442` (porta `DB_PORT` do `.env`) |
| Mailpit (caixa de e-mails de teste, perfil `dev`) | http://127.0.0.1:8025 |

**Primeiro acesso:** usuário `admin`, senha `Admin@123`, criado pela migration de dados iniciais. Em produção, o sistema exige trocá-la no primeiro acesso. As senhas novas precisam ter 10 caracteres ou mais, sem conter o login nem ser uma senha óbvia.

> A API e o banco escutam só em `127.0.0.1`. De outras máquinas, o acesso é pelo frontend, que faz o proxy de `/api/`.

### Desenvolvimento do frontend com recarga automática

```bash
docker compose up -d postgres backend
cd frontend && npm install && npm run dev   # http://localhost:5173
```

---

## Testes

| Suíte | Cobertura | Como rodar |
|---|---|---|
| **Backend** (unidade + integração com PostgreSQL real) | ~75% dos statements | ver abaixo |
| **Frontend** (Vitest + Testing Library, ~690 testes) | ~95% das linhas | `cd frontend && npm test` · `npm run test:cobertura` |
| **E2E** (Playwright, 11 roteiros, ~150 passos) | fluxos de ponta a ponta por perfil | `sh e2e/run.sh` |
| **Carga** (k6, 30 usuários, 200 mil movimentações) | p95 < 10 ms, 0% de erros | `sh e2e/carga/run.sh` |

**Backend.** O banco de testes é criado uma vez, e cada teste roda num _schema_ próprio, de modo que a suíte pode rodar em paralelo:

```bash
docker exec pcp_postgres psql -U pcp_user -d postgres -c "CREATE DATABASE pcp_db_test OWNER pcp_user;"
cd backend && go test ./...
# ou, sem Go instalado:
docker run --rm --network pcp-lev_default -v "$PWD:/repo" -w /repo/backend \
  -e PCP_TEST_DSN="postgres://pcp_user:senha_segura@postgres:5432/pcp_db_test?sslmode=disable" \
  golang:1.26-alpine go test ./...
```

**E2E.** `e2e/run.sh` sobe uma **stack isolada** (projeto Compose próprio, banco novo a cada execução) e não toca nos seus dados. Mais detalhes em [`e2e/README.md`](e2e/README.md).

---

## Implantação em produção

O [`docker-compose.prod.yml`](docker-compose.prod.yml) com a pasta [`deploy/`](deploy/) monta:
- **HTTPS com Caddy:** certificado interno, Let's Encrypt ou certificado da empresa. É o único serviço com porta publicada.
- **Segredos obrigatórios:** o Compose se recusa a subir sem eles.
- **API com um papel de banco sem superusuário.**
- **Healthchecks e limite de logs.**
- **Backup diário** com retenção, e script de restauração.

```bash
cp deploy/.env.prod.example deploy/.env.prod   # preencha domínio e segredos
docker compose -f docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

O passo a passo está no [runbook de implantação](docs/10_IMPLANTACAO.md): instalação, atualização de versão, retorno à versão anterior, backup e restauração, monitoramento e problemas comuns.

---

## Segurança

O sistema passou por uma auditoria **OWASP Top 10 com RBAC**. Os achados críticos, altos e médios foram corrigidos e testados. Entre as proteções:
- **Contas:**
  - bloqueio da conta após 5 senhas erradas seguidas;
  - limite de tentativas de login por IP, sem condição de corrida;
  - tempo de resposta igual para login inexistente;
  - política de senha.
- **Sessões e tokens:** revogação de sessões ao trocar a senha ou bloquear a conta; JWT com algoritmo fixo; segredos sem valor padrão, e segredos de exemplo recusados em produção.
- **Acesso:** permissão conferida em toda rota; acesso a arquivos só para quem pode ver um registro que os usa.
- **Upload:** tipo detectado pelo conteúdo, limites de tamanho e de dimensão de imagem.
- **XML:** lido sem resolver entidades (sem XXE).
- **Cabeçalhos HTTP:** CSP restritiva, HSTS, `nosniff` e `frame-ancestors 'none'`.
- **Auditoria** de todas as alterações, sem guardar hashes de senha.

O relatório completo, a checklist OWASP e as pendências aceitas estão em [`docs/9_SEGURANCA.md`](docs/9_SEGURANCA.md).

---

## Estrutura do repositório

```
backend/
├── cmd/api/                  ponto de entrada da API
└── internal/
    ├── api/                  rotas, handlers HTTP e middlewares (auth, RBAC, auditoria, rate limit)
    ├── domain/               regras de negócio por módulo
    │                         (acesso, arquivo, cotacao, estoque, notaentrada,
    │                          painel, pedidocompra, pedidovenda, producao, rastreio, usuario…)
    ├── infra/
    │   ├── db/migrations/    001 a 022, aplicadas na subida
    │   └── repository/       acesso a dados (SQL com pgx)
    ├── platform/             utilitários (dinheiro, datas, documentos, cripto, http)
    └── testsupport/          banco de testes com schema por teste
frontend/src/
├── paginas/                  telas por módulo (cadastros, compras, recebimento,
│                             estoque, producao, vendas, paineis, configuracoes)
├── componentes/              ui (sistema de design), layout, paineis, arquivos, recebimento
├── servicos/ · tipos/        cliente da API e contratos
├── hooks/ · store/ · lib/    estado, sessão, permissões, formatação, impressão
└── estilos/tokens.css        tokens de cor (temas claro e escuro)
e2e/                          roteiros Playwright, dados de teste e teste de carga (k6)
deploy/                       Caddy, nginx, backup, restauração e papel do banco (produção)
docs/                         especificação, manual, implantação, segurança, homologação
```

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [Sumário executivo](docs/0_SUMARIO_EXECUTIVO.md) | Visão do produto, módulos e indicadores |
| [Especificação de requisitos](docs/1_ESPECIFICACAO_REQUISITOS.md) | Requisitos funcionais e não funcionais |
| [Arquitetura do banco](docs/2_ARQUITETURA_BANCO_DADOS.md) | Modelo de dados |
| [Especificação das APIs](docs/3_ESPECIFICACAO_APIS.md) | Contratos REST |
| [Fluxos de processo](docs/4_FLUXOS_PROCESSO.md) | Fluxos de negócio e estados |
| [Guia de implementação](docs/5_GUIA_IMPLEMENTACAO.md) | Convenções e padrões |
| [Cronograma técnico](docs/6_CRONOGRAMA_TECNICO.md) | Fases e situação de cada uma |
| [Padrões de design](docs/7_PADROES_DESIGN.md) | Sistema de design |
| [Manual de operação](docs/8_MANUAL_OPERACAO.md) | Uso de cada tela, com capturas |
| [Segurança](docs/9_SEGURANCA.md) | Auditoria OWASP e estado atual |
| [Implantação](docs/10_IMPLANTACAO.md) | Runbook de produção |
| [Roteiro de homologação](docs/11_ROTEIRO_HOMOLOGACAO.md) | 16 cenários de aceite por perfil |
| [Treinamento](docs/12_TREINAMENTO.md) | Trilhas por perfil |
| [Landing page](landing-page/index.html) | Apresentação do sistema: diferenciais e galeria de telas (abre direto no navegador) |
| [`docs/superpowers/specs/`](docs/superpowers/specs/) | Especificação de cada entrega |

---

## Situação do projeto

| Entrega | Situação |
|---|---|
| Fundação, autenticação, sistema de design | ✅ |
| Cadastros base e estrutura de produto (BOM) | ✅ |
| Cotações, pedidos de compra, necessidade de compra | ✅ |
| Configurações (empresa, regionais, negócio, SMTP, segurança, auditoria) | ✅ |
| RBAC: perfis, permissões e gestão de usuários | ✅ |
| Clientes e centros de trabalho | ✅ |
| Produção: pedidos de venda, OPs, Kanban, testes, metrologia, custo, _as-built_ | ✅ |
| Recebimento fiscal (NF-e, XML), lotes, séries e rastreabilidade de componentes | ✅ |
| Anexos e documentação técnica | ✅ |
| Painéis por setor e impressão em PDF | ✅ |
| Fase técnica de testes, segurança e implantação | ✅ |
| Homologação com usuários e treinamento | 🔜 roteiros prontos ([homologação](docs/11_ROTEIRO_HOMOLOGACAO.md), [treinamento](docs/12_TREINAMENTO.md)) |

Evoluções registradas para depois: PEPS e Kanban configurável, consulta à SEFAZ e validação da assinatura da NF-e, devolução (RMA), acesso de longa duração para TVs de chão de fábrica e indicadores avançados (OEE, giro de estoque).

---

## Autoria

**Projeto e desenvolvimento:** Gustavo Frederico Landal — [gustavoflandal@gmail.com](mailto:gustavoflandal@gmail.com)
