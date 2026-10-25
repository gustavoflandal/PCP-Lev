# Especificação de Requisitos - Sistema PCP 3PL

**Versão**: 1.0  
**Data**: Agosto 2026  
**Proprietário**: Gustavo Landal  
**Status**: Pronto para Desenvolvimento

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Requisitos Funcionais](#requisitos-funcionais)
3. [Requisitos Não-Funcionais](#requisitos-não-funcionais)
4. [Casos de Uso](#casos-de-uso)
5. [Regras de Negócio](#regras-de-negócio)
6. [Prioridades e Fases](#prioridades-e-fases)

---

## Visão Geral

Sistema centralizado e intuitivo para substituir o acompanhamento manual via Excel, organizando a produção de painéis de velocidade e radares de trânsito, integrando compras, estoques, produção e expedição.

### Objetivo Principal

Eliminar erros manuais, garantir rastreabilidade completa de custos e componentes, dominar o ciclo de suprimentos e cumprir prazos de entrega com precisão.

---

## Requisitos Funcionais

### RF1 - Cadastros Base

#### RF1.1 - Cadastro de Produtos Acabados (PA)

- **Descrição**: Registro de produtos finais (painéis VMS, radares, etc.)
- **Dados Obrigatórios**:
  - Código único (ex: VMS-01, R-200)
  - Descrição
  - Unidade de medida (und, metro, kg)
  - Preço de venda
  - Lead time de produção (dias)
  - Status (Ativo/Inativo)
- **Operações**: CRUD completo
- **Validações**:
  - Código deve ser único e não vazio
  - Descrição deve ter no mínimo 5 caracteres
  - Lead time deve ser > 0
- **Regra**: Não permitir exclusão de PA com histórico de vendas

#### RF1.2 - Cadastro de Partes/Peças (PP)

- **Descrição**: Registro de componentes (conectores, placas, gabinetes, displays)
- **Dados Obrigatórios**:
  - Código único (ex: CON-001, PLC-100)
  - Descrição
  - Unidade de medida
  - Estoque mínimo
  - Estoque máximo
  - Fornecedor padrão
  - Lead time de compra (dias)
  - Status (Ativo/Inativo)
- **Operações**: CRUD completo
- **Validações**:
  - Código único e não vazio
  - Estoque mínimo < Estoque máximo
  - Lead time > 0
- **Regra**: Não permitir exclusão de PP com histórico de movimentação

#### RF1.3 - Estrutura de Produto (BOM - Bill of Materials)

- **Descrição**: Mapeamento multinível dos componentes necessários para 1 unidade de PA
- **Dados Obrigatórios**:
  - Produto Acabado (PA)
  - Versão BOM (para histórico)
  - Lista de Partes/Peças com quantidade
  - Data de vigência
  - Status (Ativo/Histórico)
- **Operações**: 
  - Criar nova BOM
  - Versionar BOM (quando houver mudanças)
  - Visualizar histórico
- **Validações**:
  - PA deve existir
  - Todos os itens de PP devem existir
  - Quantidades devem ser > 0
  - Data de vigência deve ser válida
- **Regra**: BOM não pode ser deletada, apenas inativada

#### RF1.4 - Cadastro de Fornecedores

- **Descrição**: Registro de fornecedores com contatos e condições comerciais
- **Dados Obrigatórios**:
  - Razão social
  - CNPJ
  - Contato (nome, email, telefone)
  - Endereço
  - Lead time médio (dias)
  - Condição de pagamento padrão
  - Status (Ativo/Inativo)
- **Operações**: CRUD completo
- **Validações**:
  - CNPJ deve ser válido e único
  - Lead time > 0
  - Email válido
  - Telefone com formato válido
- **Regra**: Não permitir exclusão de fornecedor com PCs pendentes

---

### RF2 - Controle de Estoque

#### RF2.1 - Estoque de Insumos (PP)

- **Descrição**: Controle de quantidade física de componentes em armazém
- **Dados Obrigatórios**:
  - Código da PP
  - Quantidade atual
  - Data da última movimentação
  - Localização no armazém
  - Status (OK, Crítico, Bloqueado)
- **Operações**:
  - Entrada por recebimento de PC
  - Saída por abertura de OP
  - Ajuste manual (com justificativa)
  - Consulta saldo
- **Validações**:
  - Não permitir saldo negativo (exceto ajuste)
  - Quantidade deve ser número inteiro
- **Regra**: Gerar alerta quando saldo ≤ estoque mínimo
- **Regra**: Bloquear saída se saldo insuficiente (reserva de OP)

#### RF2.2 - Estoque de Produtos Acabados (PA)

- **Descrição**: Controle de painéis/radares prontos para venda
- **Dados Obrigatórios**:
  - Código PA
  - Quantidade
  - Data de produção
  - Status (Teste Pendente, Pronto, Expedido)
  - OP de origem
- **Operações**:
  - Entrada por conclusão de OP
  - Saída por expedição
  - Transferência para testes
  - Consulta saldo
- **Validações**:
  - OP deve estar associado
  - Quantidade > 0

#### RF2.3 - Movimentação de Estoque

- **Descrição**: Registro de todas as entradas e saídas
- **Dados Obrigatórios**:
  - Item (PA ou PP)
  - Tipo (Entrada, Saída, Ajuste)
  - Quantidade
  - Data/Hora
  - Motivo (Compra, OP, Ajuste, Devolução)
  - Referência (Nº PC, Nº OP, etc)
  - Usuário responsável
- **Operações**:
  - Registrar movimentação
  - Consultar histórico
  - Gerar relatório de movimentações
- **Validações**:
  - Quantidade > 0
  - Motivo deve ser válido
  - Referência deve ser válida

---

### RF3 - Orçamentos e Pedidos de Compra

#### RF3.1 - Gestão de Cotações

- **Descrição**: Emissão e registro de cotações para fornecedores
- **Dados Obrigatórios**:
  - Número da cotação
  - Fornecedor
  - Data de emissão
  - Data de validade
  - Itens (PP com quantidade e preço unitário)
  - Quantidade total
  - Valor total
  - Status (Rascunho, Enviada, Respondida, Cancelada)
- **Operações**:
  - Criar cotação
  - Enviar para fornecedor
  - Registrar resposta (preço, prazos)
  - Comparar múltiplas cotações
  - Cancelar cotação
- **Validações**:
  - Data validade > data emissão
  - Preço > 0
  - Fornecedor deve existir
- **Regra**: Manter histórico de todas as cotações

#### RF3.2 - Geração Automática de Necessidade

- **Descrição**: Sugestão automática de compras baseada em BOM e estoques
- **Fluxo**:
  1. Analisar todos os OPs abertos
  2. Cruzar com BOM de cada PA
  3. Calcular quantidade necessária de cada PP
  4. Subtrair saldo atual em estoque
  5. Considerar estoque mínimo de segurança
  6. Gerar lista de itens a comprar
- **Cálculo**:
  ```
  Necessário = (OPs Pendentes × BOM) + Estoque Mínimo - Saldo Atual
  ```
- **Operações**:
  - Executar análise
  - Revisar sugestões
  - Gerar cotação automática
  - Converter em PC
- **Validações**:
  - OPs devem estar abertas
  - BOM deve estar ativa
  - Fornecedor padrão deve existir

#### RF3.3 - Emissão de Pedidos de Compra

- **Descrição**: Conversão de cotações aprovadas em PCs oficiais
- **Dados Obrigatórios**:
  - Número do PC
  - Cotação de referência
  - Fornecedor
  - Data do pedido
  - Data prevista de entrega
  - Itens com quantidade e preço
  - Valor total
  - Condição de pagamento
  - Status (Rascunho, Emitido, Aceito, Entrega, Concluído, Cancelado)
- **Operações**:
  - Criar a partir de cotação
  - Editar (se não emitido)
  - Emitir PC
  - Registrar recebimento
  - Cancelar PC
- **Validações**:
  - Cotação deve existir
  - Data entrega > data pedido
  - Preço deve estar conforme cotação
- **Regra**: Gerar sequência automática de números (PC-2026-001, etc)
- **Regra**: Notificar quando atingir data de entrega

#### RF3.4 - Acompanhamento de Status de Compras

- **Descrição**: Painel visual do ciclo de suprimentos
- **Estados possíveis**:
  - Orçado: Cotação criada
  - Aprovado: PC emitido
  - Aguardando Entrega: Após emissão do PC
  - Recebido Parcial: Parte dos itens recebidos
  - Concluído: Todos os itens recebidos
  - Cancelado: PC cancelado
- **Operações**:
  - Visualizar status de todos os PCs
  - Filtrar por fornecedor, datas, status
  - Gerar alerta de atrasos
  - Visualizar histórico de transições
- **Dashboard PC**:
  - Quantidade de PCs por status
  - PCs em atraso (5+ dias)
  - Valor total em aberto
  - Fornecedores com atrasos

#### RF3.5 - Recebimento de Insumos

- **Descrição**: Entrada simplificada no estoque ao confirmar recebimento de PC
- **Operações**:
  1. Selecionar PC
  2. Registrar quantidade recebida
  3. Verificar discrepâncias
  4. Atualizar estoque
  5. Registrar entrada
- **Dados Registrados**:
  - Número PC
  - Data/Hora recebimento
  - Quantidade por item
  - Observações
  - Usuário responsável
- **Validações**:
  - PC deve estar em "Aguardando Entrega" ou "Recebido Parcial"
  - Quantidade não pode exceder PC
  - Item deve existir
- **Regra**: Permitir recebimento parcial (até 100% do PC)
- **Regra**: Atualizar automaticamente status de estoque (alerta crítico)

---

### RF4 - Gestão de Pedidos de Venda

#### RF4.1 - Registro de Pedidos de Venda

- **Descrição**: Registro de ordens de venda com rastreamento
- **Dados Obrigatórios**:
  - Número do pedido
  - Cliente (nome, contato)
  - Data do pedido
  - Data prometida de entrega
  - Itens (PA com quantidade)
  - Valor unitário e total
  - Status inicial: "Aguardando Insumos"
- **Operações**:
  - Criar pedido
  - Editar (se não convertido em OP)
  - Visualizar detalhes
  - Cancelar pedido
- **Validações**:
  - PA deve existir
  - Quantidade > 0
  - Data entrega > data pedido
  - Cliente deve ter dados válidos

#### RF4.2 - Acompanhamento de Pedidos

- **Descrição**: Rastreamento completo do pedido até entrega
- **Estados possíveis**:
  - Aguardando Insumos: Faltam componentes
  - Em Produção: OP aberta
  - Pronto para Envio: OP concluída, passa testes
  - Entregue: Enviado ao cliente
  - Cancelado: Pedido cancelado
- **Operações**:
  - Consultar status em tempo real
  - Visualizar OP vinculada
  - Registrar entrega
  - Gerar histórico
- **Dashboard Pedidos**:
  - Pedidos por status
  - Pedidos em atraso (vs. data prometida)
  - Valor total em vendas
  - Previsão de receita

---

### RF5 - Controle de Produção (PCP)

#### RF5.1 - Geração de Ordens de Produção

- **Descrição**: Emissão de OPs vinculadas aos pedidos de venda
- **Dados Obrigatórios**:
  - Número da OP
  - Pedido de venda (referência)
  - PA a produzir
  - Quantidade
  - Data prevista de conclusão
  - BOM ativa associada
  - Status: "Aberta"
- **Operações**:
  - Criar OP a partir de pedido de venda
  - Visualizar detalhes
  - Consultar BOM
  - Cancelar OP (se não iniciada)
- **Validações**:
  - Pedido deve existir
  - PA deve existir
  - BOM deve estar ativa
  - Quantidade > 0
- **Regra**: Gerar sequência automática de números (OP-2026-001, etc)
- **Regra**: Atualizar status do pedido para "Em Produção"

#### RF5.2 - Reserva Automática de Componentes

- **Descrição**: Trava automática de insumos no estoque ao abrir OP
- **Fluxo**:
  1. OP é aberta
  2. Sistema calcula necessário: Quantidade OP × Quantidades BOM
  3. Sistema bloqueia esta quantidade no estoque
  4. Status de estoque muda para "Bloqueado" (visível no Kanban)
- **Validações**:
  - Estoque deve ter saldo suficiente
  - Se insuficiente: gerar alerta e bloquear abertura da OP
- **Operações**:
  - Visualizar componentes reservados
  - Liberar reserva (em caso de cancelamento de OP)
  - Consultar disponibilidade antes de abrir OP
- **Regra**: Se estoque insuficiente → Sugerir geração de compra automática

#### RF5.3 - Quadro Kanban Visual

- **Descrição**: Visualização de OPs em cada etapa de produção
- **Etapas (Colunas)**:
  1. **Separação de Componentes**: OP aberta, componentes sendo separados
  2. **Montagem Eletrônica**: Montagem em progresso
  3. **Testes/Calibração**: Testes sendo executados
  4. **Expedição**: Pronto para envio
- **Dados por Cartão (OP)**:
  - Número OP
  - PA (código e descrição)
  - Quantidade
  - Data prevista conclusão
  - Status (On-time / Atrasado)
  - Responsável
- **Operações**:
  1. Arrasta cartão entre etapas (atualiza status)
  2. Clica no cartão → Abre detalhes
  3. Registra apontamento de tempo (opcional)
  4. Visualiza histórico de movimentação
- **Validações**:
  - Não permitir passar para próxima etapa sem estar concluída
  - Validar conclusão de testes antes de Expedição
- **Visual**:
  - Cartão verde = On-time
  - Cartão amarelo = Próximo de atrasar (< 1 dia)
  - Cartão vermelho = Atrasado

#### RF5.4 - Apontamento de Produção

- **Descrição**: Registro de tempo gasto em cada etapa (opcional, para otimização)
- **Dados**:
  - Número OP
  - Etapa
  - Tempo inicial / Tempo final
  - Operador responsável
  - Observações
- **Operações**:
  - Iniciar/Encerrar etapa
  - Registrar pausa/retorno
  - Visualizar total de tempo por OP
- **Relatório**:
  - Tempo médio por etapa
  - Gargalos identificados

#### RF5.5 - Conclusão de OP

- **Descrição**: Finalização de OP e atualização de estoques
- **Fluxo**:
  1. OP passa por todas as etapas do Kanban
  2. Operador clica "Finalizar OP" em Expedição
  3. Sistema valida:
     - Todas as etapas concluídas?
     - Testes passaram?
  4. Sistema libera componentes reservados (baixa automática)
  5. Sistema cria entrada de PA no estoque
  6. Status do pedido muda para "Pronto para Envio"
- **Operações**:
  - Finalizar OP
  - Visualizar componentes consumidos
  - Visualizar custo da OP
  - Gerar relatório de custo
- **Regra**: Não permitir finalizar sem passar por todas as etapas

---

### RF6 - Dashboard e Relatórios

#### RF6.1 - Painel de Controle Principal

- **Tela Inicial (Dashboard)**
- **Widgets**:
  1. **OPs em Atraso**
     - Quantidade de OPs com prazo vencido
     - Lista com números e dias de atraso
     - Link para abrir OP
  2. **Pedidos de Compra a Receber**
     - Quantidade de PCs não concluídos
     - PCs com data de entrega vencida
     - Alertas de atrasos
  3. **Alerta de Insumos Críticos**
     - Itens com estoque ≤ mínimo
     - Itens em falta total
     - Sugestões de compra
  4. **Status Geral da Fábrica**
     - Total de OPs abertas
     - OPs por etapa Kanban
     - Taxa de conclusão (%)
  5. **Indicadores Operacionais** (resumo)
     - Pedidos em produção: X
     - Pedidos prontos: Y
     - Pedidos entregues (dia): Z

#### RF6.2 - Relatórios

- **Relatório de Estoque**
  - Posição de saldo por item (PA/PP)
  - Valores em R$
  - Itens em alerta crítico
  - Histórico de movimentações

- **Relatório de Compras**
  - PCs emitidas (período)
  - PCs por status
  - Comparação preço vs orçado
  - Fornecedores mais usados
  - Lead time médio por fornecedor

- **Relatório de Produção**
  - OPs concluídas (período)
  - OPs em atraso
  - Tempo médio de produção
  - Custo médio por OP
  - Consumo de componentes

- **Relatório de Vendas**
  - Pedidos registrados (período)
  - Pedidos entregues
  - Pedidos atrasados
  - Taxa de cumprimento de prazos (%)
  - Receita total

---

## Requisitos Não-Funcionais

### RNF1 - Usabilidade

- Interface intuitiva e amigável
- Máximo 3 cliques para ações comuns
- Botões de ação bem visíveis
- Feedback imediato de operações (mensagens de sucesso/erro)
- Suportar atalhos de teclado (Tab, Enter, Esc)
- Responsivo em desktop e tablets (min 768px)

### RNF2 - Performance

- Tempo de resposta < 2 segundos para operações padrão
- Dashboard carregar em < 3 segundos
- Kanban atualizar em tempo real (< 1s)
- Suportar 20 usuários simultâneos
- Relatórios gerar em < 10 segundos

### RNF3 - Segurança

- Autenticação obrigatória (username/password)
- Senhas com min. 8 caracteres
- Sessão expirar após 30 min inatividade
- Auditoria de todas as operações críticas (criar/editar/deletar)
- Criptografia de dados sensíveis (senha, CNPJ, etc)
- Controle de acesso por perfil (Gestor, Operador, Admin)

### RNF4 - Confiabilidade

- Uptime mínimo 99%
- RTO (Recovery Time Objective): < 1 hora
- RPO (Recovery Point Objective): < 15 minutos
- Backup automático diário
- Validação de integridade referencial

### RNF5 - Escalabilidade

- Estrutura preparada para crescimento
- Índices otimizados para até 100k OPs
- Cache para consultas frequentes
- Preparado para multi-banco (PostgreSQL + Replica)

### RNF6 - Manutenibilidade

- Código bem documentado
- Padrões de arquitetura consistentes
- Testes unitários (cobertura > 80%)
- Logs detalhados de operações
- Versioning de banco de dados

---

## Casos de Uso

### CU1 - Gestor cria nova OP

**Ator**: Gestor de Operações/PCP  
**Pré-condição**: Pedido de venda existe  
**Fluxo**:
1. Abrir módulo "Pedidos de Venda"
2. Localizar pedido
3. Clicar "Gerar OP"
4. Sistema preenche automaticamente PA e quantidade
5. Confirmar data de conclusão
6. Clicar "Criar OP"
7. Sistema valida estoque e cria OP
8. Sistema reserva componentes
9. OP aparece no Kanban
**Pós-condição**: OP criada, componentes reservados, Kanban atualizado

### CU2 - Operador move OP no Kanban

**Ator**: Operador (Chão de Fábrica)  
**Pré-condição**: OP aberta  
**Fluxo**:
1. Visualizar Kanban
2. Clicar em cartão de OP
3. Arrastar cartão para próxima coluna
4. Sistema registra transição
5. Sistema atualiza timestamp
**Pós-condição**: OP em nova etapa, histórico atualizado

### CU3 - Gestor recebe insumos

**Ator**: Gestor de Operações  
**Pré-condição**: PC emitido, insumos chegaram  
**Fluxo**:
1. Abrir módulo "Pedidos de Compra"
2. Localizar PC
3. Clicar "Registrar Recebimento"
4. Sistema mostra itens esperados
5. Inserir quantidade recebida
6. Clicar "Confirmar"
7. Sistema atualiza estoque
8. Sistema muda status PC (se completo)
**Pós-condição**: Estoque atualizado, PC em status recebido

### CU4 - Sistema gera sugestão de compra

**Ator**: Sistema (Automático)  
**Pré-condição**: Múltiplas OPs abertas  
**Fluxo**:
1. Rodar análise de necessidade (diário ou manual)
2. Cruzar OPs + BOM + estoque atual
3. Calcular necessidades
4. Filtrar itens abaixo de mínimo
5. Gerar lista de sugestão
6. Apresentar ao Gestor com opção de "Gerar Cotação"
**Pós-condição**: Lista de sugestão disponível, Gestor pode processar

### CU5 - Gestor consulta alerta de criticalidade

**Ator**: Gestor de Operações  
**Pré-condição**: Dashboard acessível  
**Fluxo**:
1. Abrir dashboard
2. Visualizar widget "Alerta de Insumos Críticos"
3. Clique em item em alerta
4. Abre detalhes do item
5. Visualiza saldo atual vs mínimo
6. Opção: "Gerar Compra Automática"
**Pós-condição**: Gestor informado, pode agir

---

## Regras de Negócio

### RN1 - Ciclo de Suprimentos

- Todo pedido de venda deve gerar uma OP
- Toda OP deve ter uma BOM ativa
- Toda OP deve reservar seus componentes no estoque
- Não permitir abrir OP se estoque insuficiente (bloquear ou sugerir compra)
- Componentes são baixados do estoque somente quando OP é finalizada

### RN2 - Integridade de Estoque

- Saldo nunca pode ficar negativo (exceto ajuste justificado)
- Cada movimentação deve ter rastreabilidade (ref. nº PC, nº OP, etc)
- Alertas automáticos quando ≤ estoque mínimo
- Bloqueio de saída se saldo insuficiente

### RN3 - Sequência de Estapas no Kanban

Ordem obrigatória:
1. Separação → 2. Montagem → 3. Testes → 4. Expedição

Não permitir pular etapas ou voltar.

### RN4 - Validade de BOM

- Uma versão de BOM é válida a partir de data inicial
- Ao criar nova versão, anterior vira "Histórica"
- OPs criadas utilizam versão ativa na data da OP
- Consultar histórico de BOMs para rastreabilidade

### RN5 - Estoque Mínimo e Máximo

- Estoque Mínimo = Quantidade de segurança (ex: 5 unidades)
- Estoque Máximo = Limite de armazenagem (ex: 100 unidades)
- Alertas quando Mínimo ≤ Saldo ≤ Máximo
- Crítico quando Saldo < Mínimo
- Sugerir compra quando < Mínimo

### RN6 - Lead Times

- Lead Time Compra = Tempo para item chegar (do fornecedor)
- Lead Time Produção = Tempo para PA ser produzida
- Ao criar PC, data de entrega = hoje + Lead Time Compra + dias úteis
- Ao criar OP, data conclusão = hoje + Lead Time Produção

### RN7 - Custos e Rastreabilidade

- Cada OP deve rastrear custo dos componentes consumidos
- Custo OP = Σ (Quantidade Usada × Preço Unitário Componente)
- Histórico de preços deve ser mantido (para análise futura)
- Relatórios de custo devem estar disponíveis

---

## Prioridades e Fases

### Fase 1 (Sprint 1-2): Fundação

**Prioridade ALTA**

- [x] Cadastro de PA
- [x] Cadastro de PP
- [x] Cadastro de Fornecedores
- [x] BOM (criar e versionar)
- [x] Estoque básico (entrada/saída)
- [x] Dashboard resumido

**Entregas**: Tabelas base + telas CRUD simples

### Fase 2 (Sprint 3-5): Compras

**Prioridade ALTA**

- [x] Cotações (CRUD)
- [x] Pedidos de Compra (criar, emitir, receber)
- [x] Acompanhamento de status de PC
- [x] Recebimento de insumos
- [x] Alerta de estoque crítico
- [x] Geração automática de necessidade

**Entregas**: Módulo completo de compras

### Fase 3 (Sprint 6-8): Produção

**Prioridade ALTA**

- [x] Pedidos de Venda (CRUD)
- [x] Geração de OPs
- [x] Reserva automática de componentes
- [x] Kanban visual (4 etapas)
- [x] Movimento de cartões no Kanban
- [x] Conclusão de OP e atualização de estoque

**Entregas**: Módulo PCP com Kanban funcional

### Fase 4 (Sprint 9-10): Relatórios e Otimizações

**Prioridade MÉDIA**

- [x] Dashboard completo
- [x] Relatórios (Estoque, Compras, Produção, Vendas)
- [x] Apontamento de produção (tempo)
- [x] Testes de performance
- [x] Otimizações de queries

**Entregas**: Sistema completo testado e otimizado

### Backlog (Futuro)

**Prioridade BAIXA**

- [ ] Integração com sistemas ERP externos
- [ ] Mobile app nativo
- [ ] BI avançado (Power BI / Tableau)
- [ ] Automação de email (notificações)
- [ ] Integração com IoT (sensores de produção)

---

## Critérios de Aceitação

Para cada requisito ser considerado "Pronto para Produção":

1. ✅ Código implementado conforme especificação
2. ✅ Testes unitários implementados (cobertura > 80%)
3. ✅ Testes de integração passando
4. ✅ Documentação inline atualizada
5. ✅ Sem erros de segurança (OWASP Top 10)
6. ✅ Performance dentro de limites (< 2s)
7. ✅ Validações implementadas
8. ✅ Tratamento de erros completo
9. ✅ Aprovado por Gestor em UAT

---

**Data de Revisão**: Setembro 2026  
**Próxima Versão**: 1.1

