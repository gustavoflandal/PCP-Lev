# Cronograma Técnico - Sistema PCP 3PL

**Versão**: 2.0 (revisado)
**Data**: 30 de agosto de 2026
**Modelo**: Agile (Sprints de 2 semanas, mas o texto abaixo reflete o real avanço por
funcionalidade entregue, não por calendário)

---

## Nota de revisão (versão 2.0)

Esta revisão reconcilia o cronograma original (v1.0) com o `docs/0_SUMARIO_EXECUTIVO.md`
v1.1, que incorporou dois blocos novos ao escopo do projeto depois que as Fases 1-2 já
estavam em andamento: o **Módulo de Configurações do Sistema** (§4.6) e as **Melhorias
Propostas** (§5). O sumário executivo já avisa (§12) que essas mudanças ainda dependem
de aprovação e detalhamento junto ao stakeholder — este documento assume que a
implementação é obrigatória para a entrega (confirmado pelo Proprietário do projeto em
30/08/2026) e organiza a ordem de execução, não o detalhe tarefa a tarefa de cada item
(isso é responsabilidade do ciclo brainstorm → spec → plano de cada sprint, quando ela
começar).

**Princípio de ordenação usado nesta revisão**: o v1.1 recomenda uma "Fase 0" (auth,
permissões, parâmetros, auditoria, temas) *antes* de qualquer módulo de negócio — correto
para um projeto greenfield, mas o projeto já está 4 sprints dentro de um modelo mais
simples que funciona. Em vez de parar tudo para uma reconstrução completa, esta revisão:
1. Prioriza primeiro a peça de maior raio de impacto e que bloqueia menos trabalho já
   pronto (RBAC/permissões — toca todo handler existente, mas nenhuma tela de negócio
   nova depende dela para funcionar hoje).
2. Aproveita o trabalho já planejado (Estrutura de Produto / BOM já tem spec e plano
   aprovados) antes de reconstruir a camada de autorização por cima dele.
3. Empurra o restante da Configuração (temas, dados da empresa, parâmetros regionais,
   integrações, backup, notificações) para depois — nenhum outro módulo depende
   funcionalmente dela.
4. Incorpora as melhorias de rastreabilidade/metrologia/custo real **dentro** do desenho
   da Fase de Produção, que ainda não foi construída — é o único ponto do cronograma em
   que isso não vira retrabalho caro depois (o próprio `0_SUMARIO_EXECUTIVO.md`, §11,
   já alertava sobre isso para a BOM; o mesmo raciocínio vale aqui).

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Fase 1: Fundação](#fase-1-fundação-entregue)
3. [Fase 2: Compras](#fase-2-compras-entregue-prs-abertos)
4. [Fase 2.1: Estrutura de Produto — BOM](#fase-21-estrutura-de-produto--bom-próxima)
5. [Fase 2.2: RBAC e Permissões](#fase-22-rbac-e-permissões-novo-do-v11)
6. [Fase 2.3: Cadastros de Clientes e Centros de Trabalho](#fase-23-cadastros-de-clientes-e-centros-de-trabalho-novo)
7. [Fase 2.4: Necessidade de Compra e Relatórios](#fase-24-necessidade-de-compra-e-relatórios-retomada-do-v10)
8. [Fase 3: Produção (com rastreabilidade, metrologia e custo real)](#fase-3-produção-ampliada-pelo-v11)
9. [Fase 3.1: Anexos e Documentação Técnica](#fase-31-anexos-e-documentação-técnica-novo-do-v11-item-e)
10. [Fase 4: Restante do Módulo de Configurações](#fase-4-restante-do-módulo-de-configurações-novo-do-v11)
11. [Fase 5: Testes, UAT e Deploy](#fase-5-testes-uat-e-deploy)
12. [Dependências e Riscos](#dependências-e-riscos)

---

## Visão Geral

```
Entregue:        Fundação -> Cadastros base -> Cotacoes/PC -> Recebimento/Estoque
                                                                        │
Próximo:         Estrutura de Produto (BOM) -> RBAC/Permissões -> Clientes/Centros
                                                                        │
Retomada v1.0:   Necessidade de Compra + Relatórios
                                                                        │
Ampliado v1.1:   Produção (OPs, Kanban, Apontamento, série, metrologia, custo real)
                                                                        │
Novo v1.1:       Anexos técnicos  ⇄  Restante da Configuração (paralelo, baixa urgência)
                                                                        │
Final:           Testes, UAT, Deploy
```

---

## Fase 1: Fundação (entregue)

**Status**: ✅ Concluída — `feat/telas-de-cadastro` (PR #1, base `main`).

- Setup do projeto, Docker Compose, migrations completas (`001`-`008`, incluindo as
  tabelas de Estrutura de Produto, Estoque, Compras, Vendas e Produção — o schema
  inteiro já existe desde o Sprint 1, mesmo que vários domínios ainda não tenham
  código de aplicação por cima).
- Autenticação JWT, RBAC simples de 3 perfis (`Admin`/`Gestor`/`Operador`) via
  `middleware.ExigirPerfil` — **será substituído na Fase 2.2**.
- Cadastros de Fornecedores, Partes/Peças, Produtos Acabados (CRUD completo,
  frontend+backend, TDD).
- Painel inicial, componentes de UI compartilhados (Tabela, Modal, Badge, Toast, etc.).

**Pendência conhecida**: a Estrutura de Produto (BOM), que o cronograma v1.0 já previa
para o Sprint 2 (Semana 4), não foi implementada nessa janela — ver Fase 2.1.

---

## Fase 2: Compras (entregue, PRs abertos)

**Status**: ✅ Concluída — `feat/sprint3-cotacoes-pedidos-compra` (PR #2) e
`feat/sprint4-recebimento-estoque` (base do trabalho atual).

- Cotações: criar, enviar, registrar resposta, cancelar, converter em Pedido de Compra.
- Pedidos de Compra: criar, emitir, cancelar, alerta de atraso.
- Estoque: saldo, ajuste manual, registrar recebimento de PC (parcial/total), alerta de
  crítico no Painel.

---

## Fase 2.1: Estrutura de Produto — BOM (próxima)

**Status**: 📋 Spec e plano aprovados e commitados, pronta para execução.
**Depende de**: Fase 1 (Produtos Acabados, Partes/Peças) ✅
**Bloqueia**: Fase 3 (toda Ordem de Produção exige uma Estrutura de Produto por FK)

Referências: `docs/superpowers/specs/2026-08-30-estrutura-produto-bom-design.md`,
`docs/superpowers/plans/2026-08-30-estrutura-produto-bom.md`.

- Fecha a pendência da Fase 1 e satisfaz diretamente a melhoria **5.1.C** do
  `0_SUMARIO_EXECUTIVO.md` ("Versionamento de BOM com Controle de Alteração de
  Engenharia"): criar, versionar (substitui a ativa, preserva histórico com vigência
  fechada), consultar histórico. A Ordem de Produção referencia uma versão específica
  por chave estrangeira (não "a que estiver ativa agora"), o que já satisfaz "a OP fica
  congelada na revisão vigente na data de abertura".
- **Pendência a confirmar com o stakeholder antes ou durante a execução**: o item 5.1.C
  fala em "Controle de Alteração de Engenharia (ECO)" — o plano atual não tem um campo
  de motivo/justificativa da mudança nem um fluxo de aprovação da nova versão. Se isso
  for exigido literalmente, é um adendo pequeno ao plano já escrito (um campo
  `motivo_alteracao` opcional na versão nova), não um replanejamento.
- Roda contra o RBAC **atual** (simples) — a Fase 2.2 fará a migração de todos os
  handlers, incluindo o de Estrutura de Produto, num único passo consistente.

---

## Fase 2.2: RBAC e Permissões (novo, do v1.1)

**Status**: 🔵 Não iniciada — precisa de brainstorm/spec próprios antes de virar plano.
**Depende de**: nada tecnicamente, mas executada depois da Fase 2.1 para não retrabalhar
o handler de Estrutura de Produto duas vezes.
**Bloqueia**: nenhum módulo de negócio novo — é uma substituição da camada de
autorização por baixo dos módulos já existentes.

Cobre o `0_SUMARIO_EXECUTIVO.md` §4.6.3 (Usuários, Perfis e Permissões) e o essencial
do §4.6.9 (Auditoria) que ainda faltar — **achado importante**: a migration
`007_criar_triggers_auditoria.sql` já grava uma trilha de auditoria *append-only* com
usuário, IP, valores antigo/novo em JSONB para as tabelas principais. Uma fatia
relevante do §4.6.9 já existe no banco; falta só a tela de consulta/exportação.

Escopo esperado (a detalhar em spec própria):
- Tabelas novas: `perfil`, `permissao`, `perfil_permissao`, `usuario_permissao`; extensão
  de `usuario` (matrícula, foto, setor, situação Ativo/Inativo/Bloqueado, datas de
  admissão/desligamento).
- Seed dos 8 perfis do `0_SUMARIO_EXECUTIVO.md` (§4.6.3), mapeando os 3 perfis atuais
  para os equivalentes novos (`Admin`→Administrador, `Gestor`→Gestor de Operações,
  `Operador`→um ponto de partida para Operador de Montagem/Almoxarife/Comprador, a
  desambiguar com o Gestor de Operações real).
- Tela de matriz de permissões (módulo × ação) para o Administrador.
- Migração de **todo** handler existente (`fornecedores.go`, `pecas.go`, `produtos.go`,
  `cotacoes.go`, `pedidos_compra.go`, `estoque.go`, `estrutura.go`) de
  `middleware.ExigirPerfil(enum...)` para uma checagem de permissão granular — o maior
  item de esforço desta fase, precisamente porque toca tudo que já existe.
- **Decisão pendente do stakeholder** (o próprio `0_SUMARIO_EXECUTIVO.md` §12.4 já
  registra isso): a matriz de permissões definitiva depende de uma sessão com o Gestor
  de Operações antes de virar spec.

---

## Fase 2.3: Cadastros de Clientes e Centros de Trabalho (novo)

**Status**: 🔵 Não iniciada.
**Depende de**: Fase 2.2 (nasce já com o RBAC novo, sem retrabalho).
**Bloqueia**: Pedidos de Venda (precisa de Cliente) e Produção/Kanban (Ordem de Produção
referencia um Centro de Trabalho/Bancada).

Dois CRUDs simples, no mesmo molde de Fornecedores/Partes-Peças (RF do
`0_SUMARIO_EXECUTIVO.md` §4.1): Clientes (órgãos públicos, concessionárias,
integradores, dados contratuais) e Centros de Trabalho/Bancadas (vínculo com etapas
produtivas). Nenhuma regra de negócio nova além de CRUD + validação de forma.

---

## Fase 2.4: Necessidade de Compra e Relatórios (retomada do v1.0)

**Status**: 🔵 Não iniciada — corresponde ao Sprint 5 do cronograma v1.0, sem mudança de
escopo pelo v1.1.
**Depende de**: Fase 2.1 (a sugestão de compra cruza BOM real, não mais um placeholder).

- Geração automática de sugestão de compra (BOM × estoque mínimo × saldo atual) — sem
  OPs ainda, então o cálculo desta fase é o mais simples já previsto na doc 1 (RF3.2,
  sem o termo "OPs Pendentes" da fórmula completa, que só entra na Fase 3).
- Relatórios de compras/estoque (PDF/CSV) — pode ser adiada para depois da Fase 3 sem
  prejuízo, já que nenhum outro módulo depende de relatório para funcionar; mantida
  aqui por ser a ordem já validada no v1.0 e não conflitar com nada do v1.1.

---

## Fase 3: Produção, ampliada pelo v1.1

**Status**: 🔵 Não iniciada.
**Depende de**: Fase 1 ✅, Fase 2 ✅, Fase 2.1 (BOM real), Fase 2.3 (Centros de Trabalho).

Mantém o escopo original do v1.0 (Pedidos de Venda, geração de OP, reserva de estoque,
Kanban configurável, apontamento, finalização) **mais** as melhorias de prioridade alta
do `0_SUMARIO_EXECUTIVO.md` §5.1, incorporadas desde o desenho inicial — é o único ponto
do cronograma em que isso não é retrabalho, porque o módulo ainda não existe:

- **5.1.A — Rastreabilidade unitária por número de série**: cada unidade produzida
  ganha série própria com QR Code; registro *as-built* vinculando série → OP → lote de
  componente crítico → operador de cada etapa → resultado de teste.
- **5.1.B — Controle metrológico**: por ser específico de radares (item sujeito a
  regulamentação do Inmetro), aplicado como um módulo opcional por família de produto,
  não a todo Produto Acabado — número de aprovação de modelo, data de verificação,
  lacre, validade, alerta de vencimento.
- **5.1.D — Custo real por OP**: material consumido (valorizado pelo método de custeio
  configurado — depende de um parâmetro que só existe de verdade após a Fase 4, então
  aqui usa Custo Médio Ponderado como padrão fixo até a Fase 4 chegar) + horas apontadas
  × custo/hora do centro de trabalho. Comparativo orçado × realizado.
- Etapas do Kanban configuráveis por família de produto (§4.6.5) ficam com uma versão
  fixa (4 etapas, como o v1.0 já previa) nesta fase; a configurabilidade plena migra
  para a Fase 4 (depende do parâmetro de negócio existir).

---

## Fase 3.1: Anexos e Documentação Técnica (novo do v1.1, item E)

**Status**: 🔵 Não iniciada.
**Depende de**: um mecanismo de armazenamento de arquivo (object storage — MinIO ou S3
compatível, ainda não decidido/instalado no projeto) e, preferencialmente, da Fase 3
(anexos em OPs fazem mais sentido com OPs já existindo).

Vinculação de arquivos a produtos, OPs, fornecedores e pedidos — datasheets, desenhos,
esquemas elétricos, certificados, fotos de recebimento, laudos de teste. Pequena em
esforço de aplicação, mas depende de uma decisão de infraestrutura (onde os arquivos
ficam) que ainda não foi tomada.

---

## Fase 4: Restante do Módulo de Configurações (novo do v1.1)

**Status**: 🔵 Não iniciada. Pode rodar em paralelo com as Fases 2.3-3.1 se houver
capacidade — nada nelas depende funcionalmente desta fase.

Tudo do `0_SUMARIO_EXECUTIVO.md` §4.6 que não é RBAC/permissões (isso já foi para a Fase
2.2). Sugestão de fatiamento em sub-entregas independentes, pela ordem de valor/esforço:

1. **Aparência e preferências** (§4.6.1): tema claro/escuro/automático, alto contraste,
   densidade, tamanho de fonte — puramente frontend, design tokens já existem em
   `7_PADROES_DESIGN.md`, esforço baixo.
2. **Dados da empresa** (§4.6.2) + **numeração de documentos** (§4.6.5): cadastro único
   (razão social, CNPJ, logo com variante clara/escura, aplicação em cabeçalho e
   documentos impressos) e máscara configurável de numeração — hoje `numero_cotacao`/
   `numero_pc` são digitados à mão; essa fase pode (opcionalmente) automatizar a
   sequência, mas isso é uma mudança de comportamento em telas já entregues, não
   silenciosa — decidir com o stakeholder antes.
3. **Parâmetros regionais e de negócio** (§4.6.4, §4.6.5 restante): formatos de
   data/hora/moeda, casas decimais, método de custeio (**usado pela Fase 3, item
   5.1.D** — se esta sub-fase andar em paralelo com a Fase 3, coordenar para não
   duplicar a definição do método de custeio nos dois lugares).
4. **Segurança avançada, integrações, backup, notificações** (§4.6.6-§4.6.8, §4.6.10):
   maior parte já é operação de infraestrutura (gestão de segredos fora da aplicação,
   backup automatizado) mais do que código de aplicação — a tela administrativa é
   somente leitura para os dados sensíveis (§4.6.6 já deixa isso explícito). Menor
   prioridade de código novo, mais prioridade de decisão operacional/DevOps.

---

## Fase 5: Testes, UAT e Deploy

Mantém o espírito do Sprint 9-10 do cronograma v1.0 (cobertura de testes, testes de
carga, OWASP, staging, UAT com o Gestor, treinamento, deploy) — sem mudança de escopo
pelo v1.1, exceto que a lista de verificação de segurança (OWASP + auditoria) já deve
cobrir o RBAC novo da Fase 2.2, não o modelo simples original.

---

## Dependências e Riscos

### Dependências críticas (atualizadas)

1. **Estrutura de Produto ↦ Produção**: sem BOM real, nenhuma OP sai (FK obrigatória
   desde a migration 005).
2. **RBAC novo ↦ nenhum módulo de negócio, mas ↦ todo handler existente**: é uma
   dependência "horizontal", não vertical — o risco não é bloquear o próximo módulo, é
   que o retrofit demore mais do que o previsto por tocar tudo.
3. **Centros de Trabalho ↦ Produção**: Ordem de Produção não existe sem um centro de
   trabalho válido.
4. **Clientes ↦ Pedidos de Venda ↦ Produção**: a cadeia de geração de OP começa em um
   pedido de venda, que precisa de um cliente.
5. **Método de custeio (Fase 4.3) ↦ Custo real por OP (Fase 3, item 5.1.D)**: se as
   duas fases rodarem em paralelo, definir o parâmetro uma vez só.

### Riscos específicos desta revisão

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Retrofit de RBAC subestimado (toca todo handler) | Alto | Tratar como sprint própria, dedicada, sem misturar com nenhum módulo de negócio novo no mesmo período |
| "ECO" da BOM exigir mais do que o plano atual cobre | Médio | Confirmar com o stakeholder antes de fechar a Fase 2.1; adendo pequeno se necessário |
| Matriz de permissões definitiva não estar pronta a tempo | Alto | Sessão com o Gestor de Operações antes de iniciar a Fase 2.2 (já listado como próximo passo no `0_SUMARIO_EXECUTIVO.md` §12.4) |
| Excesso de parametrização (Fase 4) atrasando módulos que não dependem dela | Médio | Fase 4 roda em paralelo, sem prioridade sobre 2.3/3/3.1 |
| Migração de RBAC introduzir regressão de acesso em tela já entregue | Alto | Suíte de testes de handler já cobre 403/200 por perfil em todos os módulos — rodar a suíte inteira a cada handler migrado, não só no final |

---

**Histórico de versões**
- v1.0 (agosto 2026): cronograma original, 10 sprints, sem módulo de configurações.
- v2.0 (30/08/2026): reconciliação com `0_SUMARIO_EXECUTIVO.md` v1.1 — inserção das
  Fases 2.1 (BOM), 2.2 (RBAC), 2.3 (Clientes/Centros de Trabalho), 3.1 (Anexos) e 4
  (restante da Configuração); Fase 3 (Produção) ampliada com rastreabilidade, metrologia
  e custo real.
