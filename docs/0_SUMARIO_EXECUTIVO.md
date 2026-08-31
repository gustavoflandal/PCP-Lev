# DOCUMENTO DE PROJETO — SISTEMA PCP
## Planejamento e Controle da Produção | Painéis VMS e Radares de Trânsito

**Versão 1.1** | Agosto 2026
**Proprietário:** Gustavo Landal | **Contato:** Suporte Interno

---

## 1. SUMÁRIO EXECUTIVO

Este projeto visa desenvolver e implantar um Sistema Web de Planejamento e Controle da Produção (PCP) simplificado e intuitivo para substituir o acompanhamento manual via Excel. O sistema centralizará toda a gestão de operações de montagem de painéis eletrônicos e radares de trânsito, integrando compras, estoques, produção, qualidade e expedição.

Através deste sistema, esperamos eliminar erros de digitação, garantir rastreabilidade completa dos custos e dos componentes, dominar o ciclo de suprimentos e cumprir prazos de entrega com precisão.

Nesta versão 1.1 foram incorporados dois blocos novos ao escopo:

- **Módulo de Configurações do Sistema** — parametrização completa da aplicação (aparência, usuários e permissões, dados da empresa, formatos regionais, regras de negócio, segurança, integrações e auditoria), eliminando a necessidade de alterações em código para ajustes operacionais.
- **Melhorias propostas** — funcionalidades identificadas como críticas para o segmento de equipamentos de fiscalização eletrônica de trânsito, notadamente rastreabilidade por número de série, controle de calibração/metrologia legal, versionamento de BOM e custo real por Ordem de Produção.

---

## 2. OBJETIVO DO PROJETO

Desenvolver e implantar um sistema web simplificado, centralizado e intuitivo de Planejamento e Controle da Produção (PCP) para substituir o acompanhamento manual via planilhas de Excel.

### Objetivos Específicos

- Organizar a produção de painéis de controle de velocidade e radares de trânsito
- Integrar o fluxo de compras e orçamentos com a demanda de produção
- Reduzir erros de montagem e desencontros de dados
- Garantir o cumprimento dos prazos de entrega
- Fornecer visibilidade total sobre custos e componentes consumidos
- **Assegurar rastreabilidade unitária (número de série) do equipamento entregue até o componente instalado**
- **Permitir que o próprio Gestor de Operações parametrize o sistema sem depender da equipe de desenvolvimento**

---

## 3. PERFIL DA OPERAÇÃO

**Atividade Principal:** Montagem de painéis eletrônicos de velocidade (VMS) e radares de trânsito (fixos e móveis)

### Estrutura de Operação

| Componente | Descrição |
|---|---|
| Chão de Fábrica | 20 colaboradores na linha de montagem e integração final |
| Gestão | 1 Gestor de Operações/PCP com foco em usabilidade simples e visual |
| Volume | Produção variável de painéis em lotes conforme demanda de vendas |
| Perfil de acesso | Poucos usuários administrativos, muitos usuários operacionais de uso rápido e pontual |

> **Implicação de projeto:** o volume de usuários administrativos é baixo, mas o número de interações operacionais é alto. A interface deve priorizar **entrada rápida com poucos cliques**, autenticação leve no chão de fábrica (PIN ou crachá) e leitura por código de barras/QR.

---

## 4. ESCOPO — MÓDULOS E REQUISITOS FUNCIONAIS

### 4.1 Cadastros de Base

- **Cadastro de Produtos:** Registro de Produtos Acabados (PA) e Partes/Peças (PP)
  - Exemplos PA: Painel VMS-01, Radar Fixo R-200
  - Exemplos PP: Conectores, placas de circuito, gabinetes, displays LED
- **Estrutura de Produto (BOM):** Mapeamento multinível dos componentes e quantidades por unidade
- **Cadastro de Fornecedores:** Registro com Lead Time, contatos e condições comerciais
- **Cadastro de Clientes:** Órgãos públicos, concessionárias e integradores, com dados contratuais
- **Cadastro de Centros de Trabalho / Bancadas:** Vinculação de etapas produtivas a recursos

### 4.2 Módulo de Orçamentos e Pedidos de Compra

- **Gestão de Cotações:** Emissão, registro e histórico de preços/validades
- **Comparativo de Cotações (Mapa de Compras):** Confronto lado a lado entre fornecedores por preço, prazo e condição de pagamento
- **Geração Automática de Necessidade:** Cruzamento de BOM + estoque mínimo vs. saldo atual
- **Emissão de Pedidos de Compra:** Conversão de orçamentos aprovados em PCs oficiais
- **Alçadas de Aprovação:** Aprovação obrigatória acima de valores configuráveis
- **Acompanhamento de Status:** Painel visual (Orçado → Aprovado → Entrega → Recebido)
- **Recebimento de Insumos:** Entrada simplificada no estoque, com conferência de quantidade e divergência

### 4.3 Controle de Estoque

- **Estoque de Insumos:** Entrada por compras, baixa automática por OP, alerta de mínimo
- **Estoque de PA:** Controle de produtos prontos para testes/expedição
- **Controle por Lote e Validade:** Aplicável a baterias, componentes com data de fabricação e itens sensíveis
- **Endereçamento simplificado:** Prateleira/gaveta para localização física do insumo
- **Inventário Rotativo:** Contagem cíclica com registro de divergências e ajuste auditado
- **Curva ABC:** Classificação automática por valor de consumo, orientando prioridade de compra

### 4.4 Gestão de Pedidos de Venda

- **Acompanhamento de Pedidos:** Status e prazos de entrega
- **Estados:** Aguardando Insumos → Em Produção → Pronto → Entregue
- **Vínculo Pedido ↔ OP ↔ Série do equipamento:** Rastreabilidade do que foi entregue a qual cliente
- **Controle de Entregas Parciais:** Pedidos com múltiplos lotes de entrega

### 4.5 Controle da Produção (PCP Simplificado)

- **Geração de OPs:** Vinculadas aos pedidos de venda
- **Reserva de Componentes:** Trava automática no estoque ao abrir OP
- **Quadro Kanban Visual:** Status por etapa (Separação → Montagem → Testes → Expedição)
- **Etapas Configuráveis:** As colunas do Kanban são parametrizáveis por tipo de produto
- **Apontamento de Produção:** Registro de início/fim de etapa por operador, via tablet com leitura de QR Code
- **Lista de Separação (Picking List):** Impressão/exibição dos itens a separar por OP
- **Registro de Refugo e Retrabalho:** Baixa de material perdido com motivo obrigatório

---

## 4.6 MÓDULO DE CONFIGURAÇÕES DO SISTEMA *(novo)*

Módulo centralizado, acessível apenas a perfis autorizados, organizado em abas. Toda alteração é registrada em trilha de auditoria.

### 4.6.1 Aparência e Preferências de Interface

| Configuração | Descrição |
|---|---|
| Tema | **Claro**, **Escuro** ou **Automático** (segue a preferência do sistema operacional) |
| Modo Alto Contraste | Variante de alta legibilidade para uso no chão de fábrica sob luz intensa |
| Cor de Destaque | Definição da cor primária da interface, alinhada à identidade visual da empresa |
| Densidade de Layout | Compacta (mais linhas visíveis) ou Confortável (alvos de toque maiores para tablet) |
| Tamanho de Fonte | Padrão, Grande, Extra Grande — acessibilidade para operadores |
| Modo Quiosque / TV | Exibição em tela cheia do Kanban e do painel de alertas para monitor no chão de fábrica |
| Idioma | Português (Brasil) como padrão; arquitetura preparada para i18n |
| Escopo | Preferências salvas **por usuário**; o administrador define apenas o padrão da empresa para novos usuários |

**Requisito técnico:** o tema deve ser aplicado via *CSS custom properties* (design tokens), com persistência no perfil do usuário no banco e cache local para evitar *flash* de tema incorreto no carregamento.

### 4.6.2 Dados da Empresa

- **Identificação:** Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, Inscrição Municipal, CNAE
- **Endereço completo** com CEP, com preenchimento automático por consulta de CEP
- **Contatos:** Telefone, e-mail institucional, site
- **Logotipo:**
  - Upload em PNG ou SVG (recomendado SVG para nitidez em impressão)
  - Variante para **tema claro** e variante para **tema escuro**
  - Versão reduzida (favicon / ícone do app)
  - Limite de tamanho e validação de dimensões mínimas
  - Aplicação automática no cabeçalho do sistema, na tela de login e em **todos os documentos impressos**: Pedido de Compra, Ordem de Produção, Lista de Separação, Romaneio de Expedição e Etiquetas
- **Dados para documentos:** Texto de rodapé padrão, condições gerais de compra, responsável técnico


### 4.6.3 Usuários, Perfis e Permissões

**Cadastro de Usuários**
- Nome completo, matrícula, e-mail, telefone, foto, setor, situação (Ativo/Inativo/Bloqueado)
- Data de admissão e desligamento — usuário **nunca é excluído**, apenas inativado, para preservar a integridade do histórico de apontamentos
- Vínculo com unidade/filial e com centro de trabalho padrão

**Perfis de Acesso (RBAC — Role-Based Access Control)**

| Perfil | Escopo típico |
|---|---|
| Administrador | Acesso total, incluindo configurações e auditoria |
| Gestor de Operações / PCP | Todos os módulos operacionais, aprovação de OP, sem acesso a credenciais técnicas |
| Comprador | Cotações, pedidos de compra, fornecedores, visualização de estoque |
| Almoxarife | Recebimento, movimentação de estoque, separação, inventário |
| Operador de Montagem | Apontamento de produção, consulta de OP e BOM, registro de refugo |
| Qualidade | Testes, aprovação/reprovação, não conformidades, certificados |
| Vendas | Pedidos de venda, consulta de prazos e disponibilidade |
| Consulta | Somente leitura de dashboards e relatórios |

**Matriz de Permissões**
- Grade **módulo × ação** (Visualizar, Incluir, Editar, Excluir, Aprovar, Exportar)
- Permissões sensíveis tratadas de forma granular e independente:
  - Visualizar custos de compra e margem
  - Cancelar OP já iniciada
  - Ajustar saldo de estoque manualmente
  - Reabrir período fechado
  - Acessar módulo de configurações
- Perfis customizados criados pelo administrador, além dos perfis pré-definidos
- Permissões podem ser concedidas ou revogadas individualmente, sobrepondo o perfil, com justificativa registrada

**Política de Autenticação e Senha (parametrizável)**
- Comprimento mínimo, exigência de caracteres, bloqueio de senhas comuns e de reuso das N últimas
- Expiração periódica (recomendado: **desativada por padrão**, conforme NIST SP 800-63B, exigindo troca apenas em suspeita de comprometimento)
- Bloqueio temporário após N tentativas inválidas
- Troca obrigatória no primeiro acesso
- Redefinição por e-mail com token de uso único e expiração curta
- **MFA (autenticação em dois fatores)** opcional por perfil, obrigatório para Administrador
- Tempo de expiração de sessão configurável, com valor menor para perfis administrativos
- **Login rápido de chão de fábrica:** PIN numérico ou crachá com código de barras, restrito a perfis operacionais e a dispositivos previamente autorizados
- **SSO opcional (fase 2):** integração LDAP/Active Directory ou OAuth2/OIDC

> **Armazenamento de senhas:** hash com **Argon2id** (alternativa aceitável: bcrypt com custo ≥ 12). Senhas nunca são armazenadas ou trafegadas em texto claro, nem exibidas em qualquer tela, log ou exportação.

### 4.6.4 Parâmetros Regionais e de Formatação

| Parâmetro | Opções |
|---|---|
| Formato de Data | DD/MM/AAAA (padrão), DD-MM-AAAA, AAAA-MM-DD |
| Formato de Hora | 24 horas (padrão) ou 12 horas |
| Fuso Horário | America/Sao_Paulo (padrão), com suporte a outras zonas por unidade |
| Separador Decimal | Vírgula (padrão brasileiro) |
| Separador de Milhar | Ponto (padrão brasileiro) |
| Moeda | BRL (R$), com suporte a USD/EUR para itens importados |
| Casas Decimais — Quantidade | Configurável (padrão: 3) |
| Casas Decimais — Valor Unitário | Configurável (padrão: 4, para componentes de baixo custo unitário) |
| Casas Decimais — Valor Total | Configurável (padrão: 2) |
| Primeiro Dia da Semana | Segunda-feira (padrão) |
| Unidades de Medida | Cadastro livre: UN, PC, M, KG, L, CX, RL, com fator de conversão entre unidade de compra e de consumo |

> **Regra técnica obrigatória:** todas as datas e horas são **armazenadas no banco em UTC** e convertidas apenas na camada de apresentação. A formatação é responsabilidade exclusiva do frontend, nunca do banco.

### 4.6.5 Parâmetros de Negócio

**Numeração de Documentos**
- Máscara configurável por tipo de documento, com prefixo, ano e sequencial (ex.: `OP-2026-00147`, `PC-2026-0089`)
- Sequência reiniciável por ano, definida por unidade
- Numeração gerada de forma transacional, sem lacunas

**Estoque**
- Estoque mínimo e ponto de pedido padrão para novos itens
- Permitir ou bloquear saldo negativo (recomendado: **bloquear**)
- Método de custeio: Custo Médio Ponderado (padrão), PEPS ou Último Preço de Compra
- Política de consumo: FIFO ou FEFO para itens com validade
- Tolerância de divergência no recebimento (% aceitável a mais ou a menos)
- Prazo de validade de reserva de componentes antes de liberação automática

**Compras**
- Alçadas de aprovação por faixa de valor e por aprovador
- Lead time padrão quando não informado no cadastro do fornecedor
- Antecedência mínima de compra (dias de segurança somados ao lead time)
- Exigir número mínimo de cotações acima de determinado valor

**Produção**
- Etapas do Kanban configuráveis por família de produto (incluir/remover/reordenar colunas)
- Política de baixa de material: **baixa real na separação** ou **backflushing na conclusão da OP**, definida por item
- Permitir ou bloquear início de OP sem 100% dos insumos disponíveis
- Exigir apontamento de operador por etapa
- Motivos de refugo, retrabalho e parada de produção (lista editável)
- Calendário de produção: turnos, jornada, feriados e paradas programadas
- Percentual de perda técnica esperado por item da BOM

### 4.6.6 Segurança, Credenciais e Banco de Dados

> **Decisão de arquitetura — leia antes de implementar:** senhas de banco de dados e demais segredos **não devem ser digitados nem armazenados em tela de configuração da aplicação**, nem gravados em arquivo de configuração versionado. Uma tela que aceita e devolve a senha do banco é, na prática, uma porta de escalonamento de privilégio: qualquer comprometimento da sessão de um administrador expõe o banco inteiro.

**Modelo adotado**

| Aspecto | Definição |
|---|---|
| Origem das credenciais | Variáveis de ambiente injetadas no contêiner, alimentadas por **Docker Secrets**, **Kubernetes Secrets** ou **HashiCorp Vault** |
| Versionamento | Arquivo `.env.example` sem valores reais no repositório; `.env` no `.gitignore` |
| Conexão | **TLS obrigatório** entre aplicação e PostgreSQL, com verificação de certificado |
| Privilégios | Usuário de aplicação com privilégio mínimo (sem `SUPERUSER`, sem `DROP`); usuário separado e de uso exclusivo para execução de migrações |
| Rotação | Procedimento documentado de rotação com *dual credentials* (nova credencial aceita antes da antiga ser revogada), sem downtime |
| Logs | Mascaramento obrigatório de credenciais, tokens e dados pessoais em logs e mensagens de erro |
| Segredos de terceiros | Chaves de API, senha de SMTP e tokens de integração armazenados **criptografados em repouso com AES-256-GCM**, com chave mestra fora do banco |

**O que a tela administrativa de banco de dados exibe (somente leitura):**
- Status da conexão, host mascarado, nome do banco, versão do PostgreSQL
- Tamanho do banco e das maiores tabelas
- Uso do pool de conexões, latência média e conexões ativas
- Data e resultado do último backup e da última restauração testada
- Botão **Testar Conexão** (executa `SELECT 1`, sem exibir credenciais)
- **Nunca** exibe usuário completo, senha ou string de conexão

**Demais parâmetros de segurança configuráveis**
- Política de sessão: tempo de inatividade, sessão única por usuário, encerramento remoto de sessões
- Lista de IPs ou faixas autorizadas para acesso administrativo
- Habilitar/desabilitar exportação de dados por perfil
- Registro e revogação de dispositivos autorizados para login por PIN
- Cabeçalhos de segurança (HSTS, CSP, X-Frame-Options) e política de CORS
- Rate limiting por endpoint e por usuário

### 4.6.7 Integrações e Serviços Externos

- **Servidor de E-mail (SMTP):** host, porta, criptografia, remetente, com botão de envio de teste; senha gravada criptografada e nunca reexibida
- **Notificações por mensageria:** WhatsApp Business API ou Telegram para alertas críticos (opcional)
- **Webhooks de saída:** URL, evento, segredo de assinatura HMAC, política de retentativa
- **Chaves de API:** geração de tokens para integrações externas, com escopo, expiração, último uso registrado e revogação imediata
- **Integração fiscal/ERP (fase 2):** importação de NF-e de entrada por XML para lançamento automático de recebimento; exportação de dados para o ERP contábil
- **Consulta de CNPJ e CEP:** preenchimento automático de cadastros

### 4.6.8 Backup, Manutenção e Ambiente

- Agendamento de backup automático: frequência, horário, destino (local e off-site)
- Política de retenção (diários, semanais, mensais)
- Registro do último backup bem-sucedido com alerta em caso de falha
- **Teste periódico de restauração** com registro de data e resultado — backup não testado não é backup
- Expurgo e arquivamento de dados antigos, com período configurável
- **Modo Manutenção:** bloqueia o acesso de usuários comuns exibindo aviso, mantendo o acesso administrativo
- Identificação visual de ambiente (faixa colorida indicando Desenvolvimento / Homologação / Produção) para evitar operação acidental no ambiente errado
- Exportação e importação do conjunto de parâmetros, facilitando a replicação entre ambientes

### 4.6.9 Auditoria e Rastreabilidade de Ações

- Trilha de auditoria **imutável** (append-only) registrando: usuário, data/hora, endereço IP, ação, entidade afetada, **valor anterior e valor novo**
- Cobertura obrigatória: alterações de configuração, permissões, ajustes manuais de estoque, cancelamento de OP, alteração de preço e exclusões lógicas
- Consulta com filtros por período, usuário, módulo e tipo de ação; exportação em CSV/PDF
- Registro de tentativas de login bem-sucedidas e falhas
- Retenção configurável, com mínimo recomendado de 5 anos para operações que envolvem contratos públicos
- **LGPD:** registro de consentimento, base legal, política de retenção de dados pessoais e procedimento de atendimento a titulares

### 4.6.10 Notificações e Alertas

Matriz configurável de **Evento × Canal × Perfil destinatário**:

| Evento | Canais disponíveis |
|---|---|
| Insumo abaixo do estoque mínimo | Sistema, E-mail, WhatsApp |
| Pedido de compra atrasado | Sistema, E-mail |
| OP com prazo em risco | Sistema, E-mail, Painel de TV |
| Pedido de venda próximo do vencimento | Sistema, E-mail |
| Reprovação em teste de qualidade | Sistema, E-mail |
| Falha de backup | E-mail (Administrador) |
| Aprovação pendente acima da alçada | Sistema, E-mail |

- Limiares configuráveis (ex.: alertar X dias antes do prazo)
- Agrupamento de notificações para evitar excesso de e-mails
- Silenciamento por usuário, exceto para alertas classificados como críticos

---

## 5. MELHORIAS PROPOSTAS *(novo — complementos identificados)*

As melhorias abaixo foram identificadas a partir do perfil da operação. Estão priorizadas conforme relação entre impacto e esforço.

### 5.1 Prioridade Alta — recomendado incluir na Fase 1

**A) Rastreabilidade Unitária por Número de Série**
Cada painel VMS e cada radar produzido recebe número de série próprio, com etiqueta QR Code gerada pelo sistema. O registro *as-built* vincula: série do equipamento → OP → lote de cada componente crítico instalado → operador de cada etapa → resultado dos testes.

*Justificativa:* em caso de falha em campo ou recall de um lote de componente, é possível identificar em minutos exatamente quais equipamentos e quais clientes foram afetados. Sem isso, a alternativa é a inspeção de todo o parque instalado.

**B) Controle Metrológico e de Certificação**
Radares de trânsito são instrumentos de medição sujeitos à regulamentação do Inmetro. O sistema deve registrar: número de aprovação de modelo, data da verificação inicial, número do lacre aplicado, validade da verificação e alerta antecipado de vencimento por equipamento instalado.

*Justificativa:* equipamento com verificação vencida invalida a autuação e gera passivo jurídico para o cliente. É o risco de maior impacto do segmento e não estava contemplado no escopo original.

**C) Versionamento de BOM com Controle de Alteração de Engenharia (ECO)**
Toda alteração na estrutura de produto gera nova revisão, preservando o histórico. A OP fica congelada na revisão vigente na data de abertura.

*Justificativa:* sem versionamento, alterar a BOM corrompe retroativamente o custo e a composição de tudo que já foi produzido. É um dos erros mais caros de corrigir depois que o sistema está em produção.

**D) Custo Real por OP**
Apuração de material consumido (valorizado pelo método de custeio configurado) + horas apontadas × custo/hora do centro de trabalho + rateio de overhead configurável. Comparativo **orçado × realizado** por OP e por produto.

*Justificativa:* atende diretamente ao objetivo declarado de "rastreabilidade total sobre custos por painel produzido", que não é alcançável apenas com o consumo de materiais.

**E) Anexos e Documentação Técnica**
Vinculação de arquivos a produtos, OPs, fornecedores e pedidos: datasheets, desenhos mecânicos, esquemas elétricos, certificados de conformidade, fotos de recebimento e laudos de teste.

### 5.2 Prioridade Média — Fase 2

**F) Roteiro de Testes e Não Conformidades**
Checklist digital de testes por família de produto, com registro de valores medidos, aprovação/reprovação, foto e assinatura eletrônica do responsável. Abertura de não conformidade com plano de ação e reteste.

**G) Controle de Firmware Embarcado**
Registro da versão de firmware gravada em cada equipamento, vinculada ao número de série, com histórico de atualizações realizadas em campo.

**H) MRP Simplificado com Horizonte de Datas**
Evolução da "geração de necessidade": além do saldo atual, considerar pedidos de compra em trânsito, reservas de OPs futuras e lead time, projetando a data em que cada item ficará em falta e a data-limite para a colocação do pedido.

**I) Gestão de Garantia e Assistência Técnica (RMA)**
Abertura de chamado vinculado ao número de série, histórico de intervenções, peças substituídas e controle do prazo de garantia contratual.

**J) Aplicação Mobile / PWA com Modo Offline**
Apontamento e conferência funcionando com conectividade instável no chão de fábrica, sincronizando ao restabelecer conexão.

### 5.3 Prioridade Baixa — evolução futura

**K) Portal do Fornecedor** — envio de cotações e confirmação de prazos pelo próprio fornecedor
**L) Análise ABC/XYZ e ponto de pedido dinâmico** baseado em histórico de consumo
**M) Sequenciamento com capacidade finita** e simulação de cenários de carga
**N) Indicadores avançados:** OEE simplificado, OTIF, giro de estoque, lead time real de produção

---

## 6. REQUISITOS NÃO-FUNCIONAIS

### Usabilidade
- Interface direta, amigável e intuitiva
- Botões de ação rápida e poucos cliques
- Design orientado para o Gestor de Operações e operadores do chão
- Suporte a leitor de código de barras/QR como entrada primária nas telas operacionais
- Navegação por teclado nas telas de alta repetição

### Dashboard / Painel de Controle
Tela inicial resumida exibindo:
- OPs em atraso
- Pedidos de compra a receber
- Alerta de insumos críticos
- Status geral da fábrica
- Equipamentos com verificação metrológica a vencer
- Aprovações pendentes para o usuário logado

### Desempenho
- Aplicação responsiva para desktop e tablets
- Tempos de resposta ágeis (< 2s para operações padrão)
- Listagens com paginação server-side e índices adequados para crescimento do histórico

### Segurança
- Autenticação, autorização e auditoria de todas as ações sensíveis
- Proteção contra as vulnerabilidades do OWASP Top 10
- Comunicação exclusivamente via HTTPS/TLS 1.3
- Segredos gerenciados conforme o item 4.6.6
- Conformidade com a LGPD para dados de colaboradores e contatos

### Disponibilidade e Continuidade
- Disponibilidade alvo: 99,5% no horário produtivo
- **RPO** (perda máxima aceitável de dados): 1 hora
- **RTO** (tempo máximo de indisponibilidade): 4 horas
- Backup diário automatizado, com teste de restauração mensal

### Acessibilidade
- Conformidade com WCAG 2.1 nível AA
- Contraste mínimo verificado nos temas claro e escuro
- Alvos de toque com no mínimo 44×44 px nas telas de tablet

### Observabilidade
- Logs estruturados em JSON com identificador de correlação por requisição
- Métricas de aplicação e endpoint de *health check*
- Alerta automático em caso de erro crítico ou fila de processamento represada

---

## 7. ARQUITETURA TÉCNICA PROPOSTA

### Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| Frontend | React.js + TypeScript com UI intuitiva e responsiva |
| Backend | Golang ou Rust para alta performance e escalabilidade |
| Banco de Dados | PostgreSQL com modelo relacional otimizado |
| Cache / Filas | Redis para cache de cadastros e processamento assíncrono de notificações |
| Armazenamento de Arquivos | Object storage (S3 compatível ou MinIO on-premise) para logos, anexos e documentos |
| Deploy | Docker + Kubernetes ou ambiente on-premise |
| Gestão de Segredos | Docker Secrets, Kubernetes Secrets ou HashiCorp Vault |

### Princípios de Design
- **Modular:** Componentes independentes e reutilizáveis
- **RESTful ou GraphQL:** APIs claras e documentadas (OpenAPI)
- **Segurança:** Autenticação, autorização e auditoria de ações
- **Escalabilidade:** Preparado para crescimento de operações
- **Configuração externalizada:** nenhum parâmetro de negócio fixo em código
- **Design tokens:** temas claro e escuro derivados de um único conjunto de variáveis
- **Linguagem ubíqua em português** no domínio (entidades, tabelas e rotas), reservando o inglês para termos de framework e infraestrutura

### Estratégia de Configuração em Runtime
As configurações são carregadas na inicialização e mantidas em cache no Redis, com invalidação por evento ao serem alteradas. Cada parâmetro possui tipo, valor padrão, escopo (Sistema / Unidade / Usuário) e validação própria. Parâmetros de escopo Usuário sobrepõem os de Unidade, que sobrepõem os de Sistema.

---

## 8. ANEXO TÉCNICO — ENTIDADES DO MÓDULO DE CONFIGURAÇÃO

Complemento ao documento *2_ARQUITETURA_BANCO_DADOS.md*:

| Entidade | Finalidade |
|---|---|
| `empresa` | Dados cadastrais, referências dos arquivos de logo, dados fiscais |
| `unidade` | Filiais/plantas com endereço e parâmetros próprios |
| `usuario` | Credenciais (hash), dados pessoais, situação, vínculo com unidade |
| `perfil` | Perfis de acesso, incluindo os customizados |
| `permissao` | Catálogo de permissões atômicas (módulo + ação) |
| `perfil_permissao` | Associação N:N entre perfil e permissão |
| `usuario_permissao` | Exceções individuais que sobrepõem o perfil |
| `preferencia_usuario` | Tema, densidade, fonte e demais preferências de interface |
| `parametro_sistema` | Chave, valor, tipo, escopo, valor padrão e descrição |
| `sequencia_documento` | Controle transacional de numeração por tipo, ano e unidade |
| `credencial_integracao` | Segredos de terceiros criptografados com AES-256-GCM |
| `log_auditoria` | Trilha append-only com valores anterior e novo em JSONB |
| `sessao` | Sessões ativas, dispositivo, IP e último acesso |
| `notificacao_regra` | Matriz evento × canal × perfil e respectivos limiares |
| `notificacao` | Fila e histórico de notificações enviadas |

**Índices críticos sugeridos:** `log_auditoria(entidade, entidade_id, criado_em DESC)`, `parametro_sistema(chave, escopo, escopo_id)` como índice único, `usuario(email)` como índice único parcial para registros ativos.

---

## 9. RESULTADOS ESPERADOS

- Eliminação de erros de digitação e desencontro de dados decorrentes do Excel
- Domínio completo do ciclo de suprimentos, evitando paradas por falta de insumos
- Rastreabilidade total sobre custos de compra e componentes por painel produzido
- Redução do tempo de ciclo de produção através de automações
- Cumprimento consistente de prazos de entrega
- Aumento da eficiência operacional e redução de custos administrativos
- **Autonomia do Gestor de Operações para parametrizar o sistema sem acionar a equipe de desenvolvimento**
- **Capacidade de responder a qualquer questionamento sobre um equipamento entregue a partir do seu número de série**

### Indicadores de Sucesso Sugeridos

| Indicador | Meta em 6 meses |
|---|---|
| Pedidos entregues no prazo (OTIF) | ≥ 95% |
| Acuracidade de estoque | ≥ 98% |
| Paradas de produção por falta de insumo | Redução de 70% |
| Tempo de fechamento do custo de uma OP | De dias para tempo real |
| Equipamentos rastreáveis por número de série | 100% |

---

## 10. CRONOGRAMA ESTIMADO

| Fase | Atividades | Duração Estimada |
|---|---|---|
| Planejamento | Levantamento de requisitos, design de arquitetura, prototipagem | 2 a 3 semanas |
| Dev – Fase 0 | **Fundação: autenticação, usuários, permissões, parâmetros, auditoria, temas** | **2 semanas** |
| Dev – Fase 1 | Cadastros base, BOM versionada, estoque e dashboard | 4 a 5 semanas |
| Dev – Fase 2 | Compras, OPs, Kanban, apontamento e rastreabilidade por série | 5 a 6 semanas |
| Testes & UAT | Testes funcionais, integração e homologação com usuários | 2 a 3 semanas |
| Deploy & Treinamento | Implantação, migração de dados e treinamento da equipe | 1 a 2 semanas |

**Timeline Total: 16 a 21 semanas (4 a 5 meses)**

> **Justificativa da Fase 0:** autenticação, permissões e auditoria são transversais a todas as telas. Implementá-las antes dos módulos de negócio evita retrabalho em cada tela já construída — o custo de adicionar controle de permissão depois é várias vezes maior do que o de partir dele.

---

## 11. RISCOS E PLANO DE MITIGAÇÃO

| Risco | Impacto | Mitigação |
|---|---|---|
| Resistência à mudança | Alto | Envolver usuários desde o início, treinamento contínuo, operação assistida nas primeiras semanas |
| Requisitos incompletos | Alto | Sessões de levantamento detalhadas e prototipagem |
| Migração de dados do Excel | Médio | Planejamento de ETL com validação de integridade e período de operação em paralelo |
| Performance em volume | Médio | Testes de carga antecipados e otimizações |
| Excesso de parametrização gerando complexidade | Médio | Valores padrão sensatos; parâmetros avançados ocultos por padrão |
| Vazamento de credenciais | Alto | Gestão de segredos fora da aplicação, rotação periódica, mascaramento em logs |
| Perda de dados | Alto | Backup automatizado com teste mensal de restauração |
| Rejeição da BOM cadastrada por divergência com a prática | Alto | Validação da BOM com a linha de montagem antes do go-live, item a item |

---

## 12. PRÓXIMOS PASSOS

1. Revisão e aprovação desta versão 1.1 com os stakeholders
2. **Decisão sobre o escopo das melhorias do item 5** — definir o que entra na Fase 1
3. Sessão de levantamento de requisitos detalhados com o Gestor de Operações
4. **Definição da matriz de permissões definitiva junto ao Gestor** (insumo para a Fase 0)
5. Criação de wireframes/protótipos das principais telas, nos temas claro e escuro
6. Design do modelo de banco de dados, incorporando as entidades do item 8
7. Atualização dos documentos `1_ESPECIFICACAO_REQUISITOS.md`, `2_ARQUITETURA_BANCO_DADOS.md` e `3_ESPECIFICACAO_APIS.md` para refletir o módulo de configurações
8. Kick-off de desenvolvimento

---

*Documento de Projeto PCP | Versão 1.1 | Agosto 2026*
*Proprietário: Gustavo Landal | Contato: Suporte Interno*
