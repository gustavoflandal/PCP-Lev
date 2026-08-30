1. SUMÁRIO EXECUTIVO
Este projeto visa desenvolver e implantar um Sistema Web de Planejamento e Controle da Produção (PCP) simplificado e intuitivo para substituir o acompanhamento manual via Excel. O sistema centralizará toda a gestão de operações de montagem de painéis eletrônicos e radares de trânsito, integrando compras, estoques, produção e expedição.
Através deste sistema, esperamos eliminar erros de digitação, garantir rastreabilidade completa dos custos, dominar o ciclo de suprimentos e cumprir prazos de entrega com precisão.
2. OBJETIVO DO PROJETO
Desenvolver e implantar um sistema web simplificado, centralizado e intuitivo de Planejamento e Controle da Produção (PCP) para substituir o acompanhamento manual via planilhas de Excel.
Objetivos Específicos:
●	Organizar a produção de painéis de controle de velocidade e radares de trânsito
●	Integrar o fluxo de compras e orçamentos com a demanda de produção
●	Reduzir erros de montagem e desencontros de dados
●	Garantir o cumprimento dos prazos de entrega
●	Fornecer visibilidade total sobre custos e componentes consumidos

3. PERFIL DA OPERAÇÃO
Atividade Principal:
Montagem de painéis eletrônicos de velocidade (VMS) e radares de trânsito (fixos e móveis)
Estrutura de Operação:
Componente	Descrição
Chão de Fábrica	20 colaboradores na linha de montagem e integração final
Gestão	1 Gestor de Operações/PCP com foco em usabilidade simples e visual
Volume	Produção variável de painéis em lotes conforme demanda de vendas

4. ESCOPO - MÓDULOS E REQUISITOS FUNCIONAIS
4.1 Cadastros de Base
●	Cadastro de Produtos: Registro de Produtos Acabados (PA) e Partes/Peças (PP)
●	Exemplos PA: Painel VMS-01, Radar Fixo R-200
●	Exemplos PP: Conectores, placas de circuito, gabinetes, displays LED
●	Estrutura de Produto (BOM): Mapeamento multinível dos componentes e quantidades por unidade
●	Cadastro de Fornecedores: Registro com Lead Time, contatos e condições comerciais

4.2 Módulo de Orçamentos e Pedidos de Compra
●	Gestão de Cotações: Emissão, registro e histórico de preços/validades
●	Geração Automática de Necessidade: Cruzamento de BOM + estoque mínimo vs. saldo atual
●	Emissão de Pedidos de Compra: Conversão de orçamentos aprovados em PCs oficiais
●	Acompanhamento de Status: Painel visual (Orçado → Aprovado → Entrega → Recebido)
●	Recebimento de Insumos: Entrada simplificada no estoque

4.3 Controle de Estoque
●	Estoque de Insumos: Entrada por compras, baixa automática por OP, alerta de mínimo
●	Estoque de PA: Controle de produtos prontos para testes/expedição

4.4 Gestão de Pedidos de Venda
●	Acompanhamento de Pedidos: Status e prazos de entrega
●	Estados: Aguardando Insumos → Em Produção → Pronto → Entregue

4.5 Controle da Produção (PCP Simplificado)
●	Geração de OPs: Vinculadas aos pedidos de venda
●	Reserva de Componentes: Trava automática no estoque ao abrir OP
●	Quadro Kanban Visual: Status por etapa (Separação → Montagem → Testes → Expedição)

5. REQUISITOS NÃO-FUNCIONAIS
Usabilidade:
●	Interface direta, amigável e intuitiva
●	Botões de ação rápida e poucos cliques
●	Design orientado para o Gestor de Operações e operadores do chão

Dashboard / Painel de Controle:
●	Tela inicial resumida exibindo:
●	  • OPs em atraso
●	  • Pedidos de compra a receber
●	  • Alerta de insumos críticos
●	  • Status geral da fábrica

Desempenho:
●	Aplicação responsiva para desktop e tablets
●	Tempos de resposta ágeis (< 2s para operações padrão)

6. ARQUITETURA TÉCNICA PROPOSTA
Stack Tecnológico:
Camada	Tecnologia
Frontend	React.js + TypeScript com UI intuitiva e responsiva
Backend	Golang ou Rust para alta performance e escalabilidade
Banco de Dados	PostgreSQL com modelo relacional otimizado
Deploy	Docker + Kubernetes ou ambiente on-premise

Princípios de Design:
●	Modular: Componentes independentes e reutilizáveis
●	RESTful ou GraphQL: APIs claras e documentadas
●	Segurança: Autenticação, autorização e auditoria de ações
●	Escalabilidade: Preparado para crescimento de operações

7. RESULTADOS ESPERADOS
●	Eliminação de erros de digitação e desencontro de dados decorrentes do Excel
●	Domínio completo do ciclo de suprimentos, evitando paradas por falta de insumos
●	Rastreabilidade total sobre custos de compra e componentes por painel produzido
●	Redução do tempo de ciclo de produção através de automações
●	Cumprimento consistente de prazos de entrega
●	Aumento da eficiência operacional e redução de custos administrativos

8. CRONOGRAMA ESTIMADO
Fase	Atividades	Duração Estimada
Planejamento	Levantamento de requisitos, design de arquitetura, prototipagem	2 a 3 semanas
Dev - Fase 1	Cadastros base, estoque e dashboard	4 a 5 semanas
Dev - Fase 2	Compras, OPs e Kanban	4 a 5 semanas
Testes & UAT	Testes funcionais, integração e homologação com usuários	2 a 3 semanas
Deploy & Treinamento	Implantação e treinamento da equipe	1 a 2 semanas

Timeline Total: 13 a 18 semanas (3 a 4 meses)
9. RISCOS E PLANO DE MITIGAÇÃO
Risco	Impacto	Mitigação
Resistência à mudança	Alto	Envolver usuários desde o início, treinamento contínuo
Requisitos incompletos	Alto	Sessões de levantamento detalhadas e prototipagem
Migração de dados	Médio	Planejamento de ETL com validação de integridade
Performance em volume	Médio	Testes de carga antecipados e otimizações

10. PRÓXIMOS PASSOS
●	Revisão e aprovação da documentação com stakeholders
●	Sessão de levantamento de requisitos detalhados com Gestor de Operações
●	Criação de wireframes/protótipos das principais telas
●	Design do modelo de banco de dados
●	Kick-off de desenvolvimento

---
Documento de Projeto PCP | Versão 1.0 | Agosto 2026
Proprietário: Gustavo Landal | Contato: Suporte Interno
