# DOCUMENTO DE PROJETO — SISTEMA PCP
## Planejamento e Controle da Produção | Painéis VMS e Radares de Trânsito

**Versão 1.2** | Agosto 2026
**Proprietário:** Gustavo Landal | **Contato:** Suporte Interno

---

## 1. SUMÁRIO EXECUTIVO

Este projeto visa desenvolver e implantar um Sistema Web de Planejamento e Controle da Produção (PCP) simplificado e intuitivo para substituir o acompanhamento manual via Excel. O sistema centralizará toda a gestão de operações de montagem de painéis eletrônicos e radares de trânsito, integrando compras, estoques, produção, qualidade e expedição.

Através deste sistema, esperamos eliminar erros de digitação, garantir rastreabilidade completa dos custos e dos componentes, dominar o ciclo de suprimentos e cumprir prazos de entrega com precisão.

**Blocos incorporados nesta versão:**

- **Módulo de Configurações do Sistema** (v1.1) — parametrização completa da aplicação: aparência, usuários e permissões, dados da empresa, formatos regionais, regras de negócio, segurança, integrações e auditoria.
- **Melhorias propostas** (v1.1) — rastreabilidade por número de série, controle metrológico, versionamento de BOM e custo real por OP.
- **Recebimento Fiscal e Entrada de Estoque** (v1.2) — toda entrada de insumo origina-se de nota fiscal vinculada a um pedido de compra, com captura de número de série, lote e validade no momento da digitação.
- **Mídia e Documentação de Produto** (v1.2) — foto e documentos técnicos em PDF nos cadastros de Produtos Acabados e Partes/Peças.

---

## 2. OBJETIVO DO PROJETO

Desenvolver e implantar um sistema web simplificado, centralizado e intuitivo de Planejamento e Controle da Produção (PCP) para substituir o acompanhamento manual via planilhas de Excel.

### Objetivos Específicos

- Organizar a produção de painéis de controle de velocidade e radares de trânsito
- Integrar o fluxo de compras e orçamentos com a demanda de produção
- Reduzir erros de montagem e desencontros de dados
- Garantir o cumprimento dos prazos de entrega
- Fornecer visibilidade total sobre custos e componentes consumidos
- Assegurar rastreabilidade unitária (número de série) do equipamento entregue até o componente instalado
- **Garantir que todo saldo de estoque tenha origem documental comprovável e auditável**
- Permitir que o próprio Gestor de Operações parametrize o sistema sem depender da equipe de desenvolvimento

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
- **De-Para Item × Fornecedor:** Código do item no catálogo do fornecedor, essencial para o reconhecimento automático dos itens na importação do XML da nota fiscal
- **Cadastro de Clientes:** Órgãos públicos, concessionárias e integradores, com dados contratuais
- **Cadastro de Centros de Trabalho / Bancadas:** Vinculação de etapas produtivas a recursos

#### 4.1.1 Flags de Controle do Item *(determinam o comportamento no recebimento)*

Definidos no cadastro do produto, aplicáveis tanto a PA quanto a PP:

| Flag | Efeito |
|---|---|
| `controla_numero_serie` | Exige a captura de um número de série individual para cada unidade recebida |
| `controla_lote` | Exige a identificação do lote do fornecedor a cada entrada |
| `controla_validade` | Exige data de validade, vinculada ao lote |
| `item_critico` | Marca componentes cuja rastreabilidade é obrigatória no registro *as-built* do equipamento |
| `exige_certificado` | Bloqueia a efetivação da entrada sem o anexo do certificado de conformidade do lote |

> Combinações válidas: um item pode controlar série **e** lote simultaneamente — nesse caso cada número de série pertence a um lote. Validade só é habilitável em conjunto com lote.

#### 4.1.2 Mídia e Documentação Técnica do Produto

**Fotografias**
- Foto principal obrigatória para itens marcados como `item_critico`, opcional para os demais
- Galeria com até 10 imagens adicionais por produto
- Formatos aceitos: JPG, PNG e WebP; tamanho máximo de 5 MB por arquivo
- Geração automática de miniatura (thumbnail) para uso em listagens
- Recorte/rotação básicos no próprio upload
- **Exibição da foto nos pontos de decisão operacional:** lista de separação, tela de apontamento de montagem, conferência de recebimento e consulta de estoque

> **Justificativa:** conectores, placas e displays de modelos próximos são visualmente semelhantes. A foto ao lado do código na lista de separação é a defesa mais barata contra a troca de componente — erro que só aparece no teste final, quando o retrabalho já custa caro.

**Documentos Técnicos (PDF)**
- Upload de múltiplos arquivos por produto, com **categoria obrigatória**: Datasheet, Desenho Mecânico, Esquema Elétrico, Manual de Montagem, Certificado de Conformidade, Laudo de Ensaio, Instrução de Trabalho, Ficha de Segurança
- Metadados: título, descrição, versão, data de emissão, data de validade (para certificados), fornecedor de origem
- **Versionamento:** o envio de nova versão preserva as anteriores; apenas uma permanece marcada como vigente
- Vínculo opcional à **revisão da BOM**, garantindo que a OP exiba o desenho correspondente à revisão congelada
- Alerta automático de vencimento para documentos com data de validade
- Visualização inline no navegador, sem necessidade de download — o tablet do chão de fábrica abre a instrução de montagem diretamente pela OP
- Formato aceito: PDF; tamanho máximo de 25 MB por arquivo (parametrizável)

**Requisitos técnicos de tratamento de arquivos**
- Validação de tipo real por *magic number*, nunca apenas pela extensão do arquivo
- Armazenamento em object storage privado (S3 compatível ou MinIO on-premise), fora do banco de dados
- Acesso exclusivamente por **URL assinada com expiração curta**; nenhum arquivo servido por caminho público
- Nome de arquivo sanitizado e substituído por identificador interno (UUID), preservando o nome original apenas como metadado
- Cálculo de hash SHA-256 para deduplicação e verificação de integridade
- Varredura antivírus no upload (recomendado: ClamAV)
- Sem execução ou renderização de conteúdo ativo; PDFs servidos com `Content-Disposition` e CSP restritiva

### 4.2 Módulo de Orçamentos e Pedidos de Compra

- **Gestão de Cotações:** Emissão, registro e histórico de preços/validades
- **Comparativo de Cotações (Mapa de Compras):** Confronto lado a lado entre fornecedores por preço, prazo e condição de pagamento
- **Geração Automática de Necessidade:** Cruzamento de BOM + estoque mínimo vs. saldo atual
- **Emissão de Pedidos de Compra:** Conversão de orçamentos aprovados em PCs oficiais
- **Alçadas de Aprovação:** Aprovação obrigatória acima de valores configuráveis
- **Acompanhamento de Status:** Painel visual (Orçado → Aprovado → Entrega → Recebido)
- **Controle de saldo por item do PC:** quantidade pedida, quantidade já recebida e saldo pendente, atualizados a cada nota fiscal efetivada
- **Impressão/envio do PC** com logo da empresa e condições gerais de compra

---

### 4.3 Recebimento Fiscal e Entrada de Estoque *(novo)*

#### 4.3.1 Regra Fundamental

> **RN-001 — Origem documental obrigatória:** nenhuma quantidade entra no estoque sem um documento de origem registrado no sistema. Não existe inclusão direta de saldo.

**Origens de entrada permitidas:**

| Origem | Documento de origem | Vínculo obrigatório |
|---|---|---|
| Compra de insumos | **Nota Fiscal de Entrada** | **Pedido de Compra** |
| Produção de PA | Ordem de Produção concluída | OP aprovada na etapa de testes |
| Devolução de cliente | NF de devolução | Pedido de venda e número de série |
| Retorno de conserto/RMA | NF de retorno | Chamado de assistência técnica |
| Ajuste de inventário | Termo de ajuste interno | Justificativa + aprovação de perfil autorizado |

> **Observação necessária sobre a regra:** a exigência de nota fiscal aplica-se à **entrada de insumos comprados**. O Produto Acabado não entra por nota fiscal — ele nasce da conclusão da Ordem de Produção, consumindo os insumos que já entraram por NF. Da mesma forma, o ajuste de inventário precisa existir: sem ele, qualquer divergência entre o físico e o sistema torna-se permanente e o saldo deixa de ser confiável. O ajuste não é uma exceção à regra, é uma origem controlada — restrita por permissão, com motivo obrigatório e registro em auditoria.

#### 4.3.2 Relação entre Pedido de Compra e Nota Fiscal

- **1 Pedido de Compra : N Notas Fiscais** — atende entregas parceladas, itens com prazos diferentes e faltas repostas posteriormente
- **1 Nota Fiscal : 1 Pedido de Compra** *(regra padrão adotada)*

> **Ponto de decisão a confirmar:** alguns fornecedores consolidam itens de mais de um pedido em uma única nota. Com a regra padrão, o tratamento é lançar a nota contra o PC predominante e registrar os itens restantes como divergência, o que polui o saldo dos demais pedidos. A alternativa é permitir o vínculo **NF × PC no nível do item**, mantendo a tela padrão com um único PC selecionado e exibindo a troca de PC por linha apenas quando o usuário ativar essa opção. O custo de implementar depois é alto, porque muda a chave de rateio do custo de entrada. **Recomendo modelar o vínculo no item desde o início e manter a interface simples.**

#### 4.3.3 Cabeçalho da Nota Fiscal de Entrada

| Campo | Regra |
|---|---|
| Pedido de Compra | Obrigatório; seleção restrita a PCs com status Aprovado ou Parcialmente Recebido |
| Fornecedor | Preenchido automaticamente pelo PC e **imutável**; deve coincidir com o CNPJ do emitente da NF |
| Modelo | 55 (NF-e) ou 01 (nota modelo 1) |
| Série e Número | Obrigatórios |
| Chave de Acesso | 44 dígitos, com validação de dígito verificador; obrigatória para modelo 55 |
| Data de Emissão / Data de Entrada | Obrigatórias; entrada não pode ser anterior à emissão |
| CFOP | Obrigatório, com validação contra lista de CFOPs de entrada aceitos |
| Valores | Total de produtos, frete, seguro, desconto, IPI, ICMS-ST e total geral |
| Anexos | XML da NF-e e DANFE em PDF anexados ao documento |
| Situação | Rascunho → Conferida → Efetivada → (Cancelada / Estornada) |

**Unicidade:** a chave de acesso é única em todo o sistema. Para notas sem chave, a unicidade é dada pela combinação CNPJ do emitente + modelo + série + número. A tentativa de lançar nota duplicada é bloqueada com identificação do lançamento original.

**Importação do XML da NF-e (fortemente recomendada):**
- Upload do XML ou colagem da chave de acesso
- Leitura automática de cabeçalho, itens, quantidades, valores e impostos
- Reconhecimento dos itens pelo **de-para Item × Fornecedor**; itens não reconhecidos são apresentados para vinculação manual, e o vínculo criado é memorizado para as próximas notas
- Conferência automática do CNPJ do emitente contra o fornecedor do PC

> A digitação manual permanece disponível, mas a importação do XML elimina a principal fonte de erro de digitação citada como motivação do projeto — e resolve simultaneamente o problema de divergência de valores.

#### 4.3.4 Itens da Nota e Validações

Ao inserir cada item, o sistema aplica:

1. **Item pertencente ao PC** — item ausente do pedido é bloqueado por padrão. Exceção configurável para bonificação/brinde, que exige marcação explícita, justificativa e valor zerado, sem impacto no saldo do PC.
2. **Saldo do PC** — quantidade acumulada recebida não pode exceder `quantidade_pedida × (1 + tolerância_excesso_%)`, parâmetro definido em Configurações.
3. **Divergência de preço** — o valor unitário da NF é confrontado com o do PC. Dentro da tolerância, segue; acima dela, o sistema bloqueia ou exige aprovação, conforme parametrização.
4. **Divergência de quantidade física** — na conferência, a quantidade contada pode diferir da declarada na nota. O sistema registra **quantidade da NF** e **quantidade recebida** separadamente, gerando pendência com o fornecedor. O estoque é movimentado pela quantidade fisicamente recebida.
5. **Unidade de medida** — conversão automática entre a unidade de compra (ex.: caixa com 100) e a unidade de consumo (ex.: peça), pelo fator cadastrado.
6. **Validade mínima** — para itens com controle de validade, recusa ou alerta quando a validade remanescente for inferior ao mínimo parametrizado.
7. **Certificado obrigatório** — itens com `exige_certificado` não podem ser efetivados sem o anexo correspondente.

#### 4.3.5 Captura de Número de Série, Lote e Validade

A tela de digitação do item expande-se conforme os flags do produto:

**Item com controle de número de série**
- Exige exatamente **um número de série por unidade** — a efetivação é bloqueada enquanto a contagem de séries informadas for diferente da quantidade recebida
- Unicidade do número de série **por produto** em todo o histórico do sistema, incluindo itens já consumidos
- Entrada otimizada para leitor de código de barras: campo com foco automático que aceita bipagens em sequência, avançando sozinho a cada leitura
- Modos alternativos de entrada: colagem de lista (uma série por linha) e geração de faixa sequencial (ex.: `SN-1001` a `SN-1050`) para lotes numerados de forma contínua
- Máscara/formato de validação opcional por produto
- Contador visível em tempo real: *"38 de 50 séries informadas"*

**Item com controle de lote**
- Número do lote do fornecedor obrigatório
- Uma linha da nota pode conter **múltiplos lotes** — o sistema permite subdividir a quantidade em várias linhas de recebimento, cada uma com seu lote, validando que a soma iguale a quantidade da linha da nota
- Data de fabricação opcional; validade obrigatória quando o item controla validade
- Anexo de certificado por lote

**Combinação série + lote:** cada número de série é vinculado ao lote ao qual pertence, permitindo, a partir de um lote defeituoso do fornecedor, listar imediatamente todas as unidades e todos os equipamentos que as receberam.

**Estados do número de série:**

```
Em Estoque → Reservado para OP → Consumido em OP → Instalado em Equipamento (série pai)
     ↓                                                          ↓
 Sucateado                                            Devolvido / Substituído em RMA
```

#### 4.3.6 Conferência e Efetivação

- A nota em **Rascunho não movimenta estoque**. Permite salvar parcialmente, sair e retomar a digitação — importante para notas extensas.
- A **Efetivação** é uma transação atômica única que: gera os movimentos de estoque, cria os registros de série e lote, atualiza o saldo e o status do PC, recalcula o custo médio e grava a auditoria. Falha em qualquer etapa reverte tudo.
- Nota efetivada é **imutável**. Correções ocorrem por **estorno**, que gera movimentos inversos e é bloqueado caso o material já tenha sido consumido, reservado ou expedido — nesse caso, a correção deve ser feita por ajuste de inventário justificado.
- **Anexos de recebimento:** fotos da mercadoria, do lacre e de eventuais avarias, vinculadas à nota.
- **Custo de entrada:** valor unitário da nota acrescido do rateio configurável de frete, seguro e impostos não recuperáveis, alimentando o custo médio ponderado do item.
- Ao efetivar, o status do PC evolui automaticamente: `Aprovado → Parcialmente Recebido → Recebido Totalmente`. O **encerramento com saldo pendente** é uma ação manual, com motivo obrigatório (cancelamento pelo fornecedor, item descontinuado, entrega a menor aceita).

#### 4.3.7 Consultas de Rastreabilidade Habilitadas

- **Do equipamento ao fornecedor:** número de série do radar → OP → componentes consumidos → lotes → notas fiscais → fornecedores e datas
- **Do lote ao campo:** lote defeituoso do fornecedor → unidades consumidas → equipamentos produzidos → pedidos de venda → clientes
- **Do saldo à origem:** qualquer quantidade em estoque → notas fiscais que a originaram, com valor e data

---

### 4.4 Controle de Estoque

- **Estoque de Insumos:** entrada exclusivamente pelas origens da RN-001, baixa automática por OP, alerta de mínimo
- **Estoque de PA:** controle de produtos prontos para testes/expedição, identificados por número de série
- **Controle por Lote e Validade:** saldo segregado por lote, com consumo FEFO para itens perecíveis
- **Endereçamento simplificado:** prateleira/gaveta para localização física do insumo
- **Inventário Rotativo:** contagem cíclica com registro de divergências e ajuste auditado
- **Curva ABC:** classificação automática por valor de consumo, orientando prioridade de compra
- **Kardex por item:** extrato cronológico de todas as movimentações, com documento de origem clicável

### 4.5 Gestão de Pedidos de Venda

- **Acompanhamento de Pedidos:** status e prazos de entrega
- **Estados:** Aguardando Insumos → Em Produção → Pronto → Entregue
- **Vínculo Pedido ↔ OP ↔ Série do equipamento:** rastreabilidade do que foi entregue a qual cliente
- **Controle de Entregas Parciais:** pedidos com múltiplos lotes de entrega

### 4.6 Controle da Produção (PCP Simplificado)

- **Geração de OPs:** vinculadas aos pedidos de venda
- **Reserva de Componentes:** trava automática no estoque ao abrir OP, inclusive de séries específicas quando aplicável
- **Quadro Kanban Visual:** status por etapa (Separação → Montagem → Testes → Expedição)
- **Etapas Configuráveis:** as colunas do Kanban são parametrizáveis por família de produto
- **Apontamento de Produção:** registro de início/fim de etapa por operador, via tablet com leitura de QR Code
- **Lista de Separação (Picking List):** itens a separar por OP, **com foto do componente**
- **Registro as-built:** captura das séries dos componentes críticos efetivamente instalados em cada equipamento
- **Registro de Refugo e Retrabalho:** baixa de material perdido com motivo obrigatório

---

## 4.7 MÓDULO DE CONFIGURAÇÕES DO SISTEMA

Módulo centralizado, acessível apenas a perfis autorizados, organizado em abas. Toda alteração é registrada em trilha de auditoria.

### 4.7.1 Aparência e Preferências de Interface

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

### 4.7.2 Dados da Empresa

- **Identificação:** Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, Inscrição Municipal, CNAE
- **Endereço completo** com CEP, com preenchimento automático por consulta de CEP
- **Contatos:** Telefone, e-mail institucional, site
- **Logotipo:**
  - Upload em PNG ou SVG (recomendado SVG para nitidez em impressão)
  - Variante para **tema claro** e variante para **tema escuro**
  - Versão reduzida (favicon / ícone do app)
  - Limite de tamanho e validação de dimensões mínimas
  - Aplicação automática no cabeçalho do sistema, na tela de login e em **todos os documentos impressos**: Pedido de Compra, Ordem de Produção, Lista de Separação, Romaneio de Expedição e Etiquetas
- **Dados para documentos:** texto de rodapé padrão, condições gerais de compra, responsável técnico
- **Múltiplas Unidades/Filiais:** cadastro de plantas com endereço próprio, permitindo estoque e produção segregados por unidade

### 4.7.3 Usuários, Perfis e Permissões

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
| Almoxarife | Recebimento fiscal, movimentação de estoque, separação, inventário |
| Operador de Montagem | Apontamento de produção, consulta de OP e BOM, registro de refugo |
| Qualidade | Testes, aprovação/reprovação, não conformidades, certificados |
| Vendas | Pedidos de venda, consulta de prazos e disponibilidade |
| Consulta | Somente leitura de dashboards e relatórios |

**Matriz de Permissões**
- Grade **módulo × ação** (Visualizar, Incluir, Editar, Excluir, Aprovar, Exportar)
- Permissões sensíveis tratadas de forma granular e independente:
  - Visualizar custos de compra e margem
  - Cancelar OP já iniciada
  - **Efetivar nota fiscal acima de valor definido**
  - **Estornar nota fiscal efetivada**
  - **Ajustar saldo de estoque manualmente**
  - **Aceitar recebimento com divergência de preço ou quantidade**
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

### 4.7.4 Parâmetros Regionais e de Formatação

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

### 4.7.5 Parâmetros de Negócio

**Numeração de Documentos**
- Máscara configurável por tipo de documento, com prefixo, ano e sequencial (ex.: `OP-2026-00147`, `PC-2026-0089`)
- Sequência reiniciável por ano, definida por unidade
- Numeração gerada de forma transacional, sem lacunas

**Recebimento Fiscal** *(novo)*
- Tolerância de excesso na quantidade recebida (% sobre o saldo do PC)
- Tolerância de divergência de preço entre NF e PC (%), com ação: alertar, exigir aprovação ou bloquear
- Exigir XML da NF-e para efetivação (sim/não)
- Permitir item fora do pedido de compra (sim/não; padrão: não)
- Validade mínima remanescente aceita na entrada (dias)
- Rateio de frete e impostos no custo de entrada: proporcional ao valor, ao peso ou não ratear
- Prazo máximo para lançamento retroativo de nota (dias)
- Exigir foto de recebimento (sim/não)

**Estoque**
- Estoque mínimo e ponto de pedido padrão para novos itens
- Permitir ou bloquear saldo negativo (recomendado: **bloquear**)
- Método de custeio: Custo Médio Ponderado (padrão), PEPS ou Último Preço de Compra
- Política de consumo: FIFO ou FEFO para itens com validade
- Prazo de validade de reserva de componentes antes de liberação automática

**Compras**
- Alçadas de aprovação por faixa de valor e por aprovador
- Lead time padrão quando não informado no cadastro do fornecedor
- Antecedência mínima de compra (dias de segurança somados ao lead time)
- Exigir número mínimo de cotações acima de determinado valor

**Produção**
- Etapas do Kanban configuráveis por família de produto
- Política de baixa de material: **baixa real na separação** ou **backflushing na conclusão da OP**, definida por item
- Permitir ou bloquear início de OP sem 100% dos insumos disponíveis
- Exigir apontamento de operador por etapa
- Motivos de refugo, retrabalho e parada de produção (lista editável)
- Calendário de produção: turnos, jornada, feriados e paradas programadas
- Percentual de perda técnica esperado por item da BOM

**Arquivos e Mídia** *(novo)*
- Tamanho máximo por imagem e por PDF
- Quantidade máxima de anexos por produto
- Exigir foto para itens críticos (sim/não)
- Categorias de documento (lista editável)
- Política de retenção de versões antigas de documentos

### 4.7.6 Segurança, Credenciais e Banco de Dados

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

### 4.7.7 Integrações e Serviços Externos

- **Servidor de E-mail (SMTP):** host, porta, criptografia, remetente, com botão de envio de teste; senha gravada criptografada e nunca reexibida
- **Notificações por mensageria:** WhatsApp Business API ou Telegram para alertas críticos (opcional)
- **Webhooks de saída:** URL, evento, segredo de assinatura HMAC, política de retentativa
- **Chaves de API:** geração de tokens para integrações externas, com escopo, expiração, último uso registrado e revogação imediata
- **Consulta de NF-e na SEFAZ (fase 2):** validação da chave de acesso e download automático do XML pelo manifesto do destinatário
- **Integração fiscal/ERP (fase 2):** exportação das entradas para o ERP contábil
- **Consulta de CNPJ e CEP:** preenchimento automático de cadastros

### 4.7.8 Backup, Manutenção e Ambiente

- Agendamento de backup automático: frequência, horário, destino (local e off-site)
- Política de retenção (diários, semanais, mensais)
- **Backup do object storage** incluído na rotina — fotos, PDFs e XMLs não estão no banco de dados
- Registro do último backup bem-sucedido com alerta em caso de falha
- **Teste periódico de restauração** com registro de data e resultado — backup não testado não é backup
- Expurgo e arquivamento de dados antigos, com período configurável
- **Modo Manutenção:** bloqueia o acesso de usuários comuns exibindo aviso, mantendo o acesso administrativo
- Identificação visual de ambiente (faixa colorida indicando Desenvolvimento / Homologação / Produção)
- Exportação e importação do conjunto de parâmetros, facilitando a replicação entre ambientes

### 4.7.9 Auditoria e Rastreabilidade de Ações

- Trilha de auditoria **imutável** (append-only) registrando: usuário, data/hora, endereço IP, ação, entidade afetada, **valor anterior e valor novo**
- Cobertura obrigatória: alterações de configuração, permissões, **efetivação e estorno de notas fiscais**, ajustes manuais de estoque, aceite de divergências, cancelamento de OP, alteração de preço e exclusões lógicas
- Consulta com filtros por período, usuário, módulo e tipo de ação; exportação em CSV/PDF
- Registro de tentativas de login bem-sucedidas e falhas
- Retenção configurável, com mínimo recomendado de 5 anos para operações que envolvem contratos públicos
- **LGPD:** registro de consentimento, base legal, política de retenção de dados pessoais e procedimento de atendimento a titulares

### 4.7.10 Notificações e Alertas

Matriz configurável de **Evento × Canal × Perfil destinatário**:

| Evento | Canais disponíveis |
|---|---|
| Insumo abaixo do estoque mínimo | Sistema, E-mail, WhatsApp |
| Pedido de compra atrasado | Sistema, E-mail |
| Nota fiscal em rascunho há mais de N dias | Sistema, E-mail |
| Recebimento com divergência aguardando decisão | Sistema, E-mail |
| Lote com validade próxima do vencimento | Sistema, E-mail |
| OP com prazo em risco | Sistema, E-mail, Painel de TV |
| Reprovação em teste de qualidade | Sistema, E-mail |
| Falha de backup | E-mail (Administrador) |
| Aprovação pendente acima da alçada | Sistema, E-mail |

- Limiares configuráveis (ex.: alertar X dias antes do prazo)
- Agrupamento de notificações para evitar excesso de e-mails
- Silenciamento por usuário, exceto para alertas classificados como críticos

---

## 5. MELHORIAS PROPOSTAS

### 5.1 Prioridade Alta — recomendado incluir na Fase 1

**A) Rastreabilidade Unitária por Número de Série** *(agora sustentada pela captura na entrada fiscal)*
Cada painel VMS e cada radar produzido recebe número de série próprio, com etiqueta QR Code gerada pelo sistema. O registro *as-built* vincula: série do equipamento → OP → série e lote de cada componente crítico → nota fiscal de entrada → fornecedor → operador de cada etapa → resultado dos testes.

**B) Controle Metrológico e de Certificação**
Registro do número de aprovação de modelo do Inmetro, data da verificação inicial, número do lacre aplicado, validade da verificação e alerta antecipado de vencimento por equipamento instalado.

*Justificativa:* equipamento com verificação vencida invalida a autuação e gera passivo jurídico para o cliente. É o risco de maior impacto do segmento.

**C) Versionamento de BOM com Controle de Alteração de Engenharia (ECO)**
Toda alteração na estrutura de produto gera nova revisão, preservando o histórico. A OP fica congelada na revisão vigente na data de abertura, assim como os documentos técnicos vinculados a ela.

**D) Custo Real por OP**
Material consumido valorizado pelo custo de entrada apurado na nota fiscal (incluindo rateio de frete e impostos), somado a horas apontadas × custo/hora do centro de trabalho e overhead configurável. Comparativo **orçado × realizado**.

**E) Importação do XML da NF-e**
Tratada aqui como item de alta prioridade e não como conveniência: é a medida que efetivamente elimina o erro de digitação na entrada e garante que o valor lançado seja idêntico ao documento fiscal.

### 5.2 Prioridade Média — Fase 2

**F) Roteiro de Testes e Não Conformidades** — checklist digital por família de produto, com valores medidos, foto e assinatura eletrônica
**G) Controle de Firmware Embarcado** — versão gravada em cada equipamento, vinculada ao número de série
**H) MRP Simplificado com Horizonte de Datas** — considera pedidos em trânsito, reservas futuras e lead time, projetando a data de ruptura
**I) Gestão de Garantia e Assistência Técnica (RMA)** — chamado vinculado ao número de série, com histórico de peças substituídas
**J) Aplicação Mobile / PWA com Modo Offline** — apontamento e conferência com conectividade instável
**K) Conferência de recebimento por coletor** — bipagem do item e das séries diretamente na doca

### 5.3 Prioridade Baixa — evolução futura

**L) Portal do Fornecedor** — envio de cotações e confirmação de prazos pelo próprio fornecedor
**M) Análise ABC/XYZ e ponto de pedido dinâmico**
**N) Sequenciamento com capacidade finita** e simulação de cenários
**O) Indicadores avançados:** OEE simplificado, OTIF, giro de estoque, lead time real de produção

---

## 6. REQUISITOS NÃO-FUNCIONAIS

### Usabilidade
- Interface direta, amigável e intuitiva
- Botões de ação rápida e poucos cliques
- Design orientado para o Gestor de Operações e operadores do chão
- **Leitor de código de barras/QR como entrada primária** nas telas de recebimento, separação e apontamento
- Navegação por teclado nas telas de alta repetição, sem necessidade de mouse
- Salvamento automático de rascunhos em formulários longos (nota fiscal, BOM)

### Dashboard / Painel de Controle
Tela inicial resumida exibindo:
- OPs em atraso
- Pedidos de compra a receber
- Alerta de insumos críticos
- Notas fiscais pendentes de efetivação e divergências em aberto
- Lotes com validade próxima do vencimento
- Equipamentos com verificação metrológica a vencer
- Aprovações pendentes para o usuário logado
- Status geral da fábrica

### Desempenho
- Aplicação responsiva para desktop e tablets
- Tempos de resposta ágeis (< 2s para operações padrão)
- **Digitação de nota com 200 itens sem degradação perceptível** — validações no cliente, persistência incremental do rascunho
- Listagens com paginação server-side e índices adequados para crescimento do histórico

### Segurança
- Autenticação, autorização e auditoria de todas as ações sensíveis
- Proteção contra as vulnerabilidades do OWASP Top 10
- Comunicação exclusivamente via HTTPS/TLS 1.3
- Segredos gerenciados conforme o item 4.7.6
- Upload de arquivos tratado conforme o item 4.1.2
- Conformidade com a LGPD para dados de colaboradores e contatos

### Disponibilidade e Continuidade
- Disponibilidade alvo: 99,5% no horário produtivo
- **RPO:** 1 hora | **RTO:** 4 horas
- Backup diário automatizado do banco **e do object storage**, com teste de restauração mensal

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
| Armazenamento de Arquivos | Object storage S3 compatível (MinIO on-premise) para logos, fotos, PDFs e XMLs |
| Deploy | Docker + Kubernetes ou ambiente on-premise |
| Gestão de Segredos | Docker Secrets, Kubernetes Secrets ou HashiCorp Vault |

### Princípios de Design
- **Modular:** componentes independentes e reutilizáveis
- **RESTful ou GraphQL:** APIs claras e documentadas (OpenAPI)
- **Segurança:** autenticação, autorização e auditoria de ações
- **Escalabilidade:** preparado para crescimento de operações
- **Configuração externalizada:** nenhum parâmetro de negócio fixo em código
- **Design tokens:** temas claro e escuro derivados de um único conjunto de variáveis
- **Livro-razão de estoque imutável:** o saldo é sempre derivado da soma dos movimentos, nunca um campo atualizado diretamente
- **Linguagem ubíqua em português** no domínio (entidades, tabelas e rotas), reservando o inglês para termos de framework e infraestrutura

### Estratégia de Configuração em Runtime
As configurações são carregadas na inicialização e mantidas em cache no Redis, com invalidação por evento ao serem alteradas. Cada parâmetro possui tipo, valor padrão, escopo (Sistema / Unidade / Usuário) e validação própria. Parâmetros de escopo Usuário sobrepõem os de Unidade, que sobrepõem os de Sistema.

---

## 8. ANEXO TÉCNICO — ENTIDADES

Complemento ao documento *2_ARQUITETURA_BANCO_DADOS.md*.

### 8.1 Recebimento Fiscal e Rastreabilidade *(novo)*

| Entidade | Finalidade |
|---|---|
| `nota_fiscal_entrada` | Cabeçalho da NF: fornecedor, PC, modelo, série, número, chave de acesso, datas, valores, situação |
| `nota_fiscal_item` | Item da nota: produto, quantidade NF, quantidade recebida, valor unitário, item do PC vinculado, rateio |
| `recebimento_lote_serie` | Subdivisão do item por lote e/ou série, quando o produto exige controle |
| `lote` | Lote do fornecedor: identificação, fabricação, validade, produto, certificado vinculado |
| `numero_serie` | Série individual: produto, lote, situação, nota de origem, OP de consumo, equipamento pai |
| `movimento_estoque` | Livro-razão imutável: tipo, produto, lote, quantidade, custo, documento de origem, usuário |
| `pedido_compra_item` | Item do PC com quantidade pedida, recebida acumulada e saldo |
| `divergencia_recebimento` | Registro de divergência de quantidade ou preço, com tratativa e responsável |
| `produto_fornecedor` | De-para do código do item no catálogo de cada fornecedor |

### 8.2 Arquivos e Mídia *(novo)*

| Entidade | Finalidade |
|---|---|
| `arquivo` | Registro genérico: UUID, nome original, MIME real, tamanho, hash SHA-256, chave no object storage |
| `produto_imagem` | Vínculo produto × arquivo, com ordem de exibição e marcação de foto principal |
| `produto_documento` | Vínculo produto × arquivo: categoria, versão, vigência, revisão de BOM associada |
| `anexo_documento` | Vínculo polimórfico de arquivos a NF, PC, OP, lote e chamado de RMA |

### 8.3 Configuração e Segurança

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

### 8.4 Restrições e Índices Críticos

- `UNIQUE (chave_acesso)` em `nota_fiscal_entrada`
- `UNIQUE (fornecedor_id, modelo, serie, numero)` em `nota_fiscal_entrada`
- `UNIQUE (produto_id, numero_serie)` em `numero_serie`
- `UNIQUE (produto_id, fornecedor_id, lote)` em `lote`
- `CHECK` garantindo que a soma das quantidades em `recebimento_lote_serie` iguale a quantidade recebida do item
- `movimento_estoque` sem `UPDATE` nem `DELETE` — correção exclusivamente por lançamento inverso
- Índices: `movimento_estoque(produto_id, criado_em DESC)`, `nota_fiscal_entrada(pedido_compra_id)`, `numero_serie(situacao, produto_id)`, `lote(validade)` parcial para lotes com saldo, `log_auditoria(entidade, entidade_id, criado_em DESC)`

---

## 9. RESULTADOS ESPERADOS

- Eliminação de erros de digitação e desencontro de dados decorrentes do Excel
- Domínio completo do ciclo de suprimentos, evitando paradas por falta de insumos
- Rastreabilidade total sobre custos de compra e componentes por painel produzido
- **Todo saldo de estoque com origem documental comprovável, do fornecedor ao equipamento entregue**
- Redução do tempo de ciclo de produção através de automações
- Cumprimento consistente de prazos de entrega
- Aumento da eficiência operacional e redução de custos administrativos
- Autonomia do Gestor de Operações para parametrizar o sistema

### Indicadores de Sucesso Sugeridos

| Indicador | Meta em 6 meses |
|---|---|
| Pedidos entregues no prazo (OTIF) | ≥ 95% |
| Acuracidade de estoque | ≥ 98% |
| Entradas com origem em NF vinculada a PC | 100% |
| Notas lançadas por importação de XML | ≥ 90% |
| Paradas de produção por falta de insumo | Redução de 70% |
| Tempo de fechamento do custo de uma OP | De dias para tempo real |
| Equipamentos rastreáveis por número de série | 100% |

---

## 10. CRONOGRAMA ESTIMADO

| Fase | Atividades | Duração Estimada |
|---|---|---|
| Planejamento | Levantamento de requisitos, design de arquitetura, prototipagem | 2 a 3 semanas |
| Dev – Fase 0 | Fundação: autenticação, usuários, permissões, parâmetros, auditoria, temas, serviço de arquivos | 2 a 3 semanas |
| Dev – Fase 1 | Cadastros base com foto e documentos, BOM versionada, estoque e dashboard | 4 a 5 semanas |
| Dev – Fase 2 | Compras, **recebimento fiscal com série/lote/validade e importação de XML**, OPs, Kanban e apontamento | 6 a 7 semanas |
| Testes & UAT | Testes funcionais, integração e homologação com usuários | 2 a 3 semanas |
| Deploy & Treinamento | Implantação, migração de dados e treinamento da equipe | 1 a 2 semanas |

**Timeline Total: 17 a 23 semanas (4 a 6 meses)**

> **Justificativas:** a Fase 0 inclui agora o serviço de arquivos, usado por praticamente todos os módulos posteriores. A Fase 2 foi ampliada porque o recebimento fiscal com captura de série e lote é a tela mais complexa do sistema — concentra validação de saldo do PC, conversão de unidades, subdivisão por lote, contagem de séries e transação atômica de efetivação.

---

## 11. RISCOS E PLANO DE MITIGAÇÃO

| Risco | Impacto | Mitigação |
|---|---|---|
| Resistência à mudança | Alto | Envolver usuários desde o início, treinamento contínuo, operação assistida no go-live |
| Requisitos incompletos | Alto | Sessões de levantamento detalhadas e prototipagem |
| Migração de dados do Excel | Médio | ETL com validação de integridade e período de operação em paralelo |
| **Saldo inicial de estoque sem nota fiscal de origem** | **Alto** | **Carga inicial por termo de inventário de abertura, único evento sem NF, auditado e datado — a RN-001 passa a valer a partir do go-live** |
| **Fornecedor que não envia XML ou emite nota consolidando vários PCs** | **Médio** | **Digitação manual mantida como alternativa; vínculo NF × PC no nível do item conforme item 4.3.2** |
| **Rejeição do processo pelo almoxarifado por lentidão na digitação de séries** | **Médio** | **Entrada por bipagem contínua, colagem de lista e geração de faixa sequencial; medir o tempo real de lançamento na homologação** |
| Excesso de parametrização gerando complexidade | Médio | Valores padrão sensatos; parâmetros avançados ocultos por padrão |
| Vazamento de credenciais | Alto | Gestão de segredos fora da aplicação, rotação periódica, mascaramento em logs |
| Perda de arquivos do object storage | Alto | Backup do storage incluído na rotina; hash verificado periodicamente |
| Rejeição da BOM cadastrada por divergência com a prática | Alto | Validação da BOM com a linha de montagem antes do go-live, item a item |

---

## 12. PRÓXIMOS PASSOS

1. Revisão e aprovação desta versão 1.2 com os stakeholders
2. **Decidir o vínculo NF × PC:** um PC por nota ou vínculo no nível do item (item 4.3.2)
3. **Definir quais itens controlam série, lote e validade** — a lista deve sair da própria linha de montagem, não do cadastro teórico
4. **Definir os parâmetros de tolerância** de quantidade e preço no recebimento
5. Definir a matriz de permissões definitiva junto ao Gestor (insumo para a Fase 0)
6. Definir a estratégia de **carga inicial do saldo de estoque** e a data de corte da RN-001
7. Criação de wireframes/protótipos, com destaque para a tela de digitação de nota fiscal
8. Design do modelo de banco de dados, incorporando as entidades do item 8
9. Atualização dos documentos `1_ESPECIFICACAO_REQUISITOS.md`, `2_ARQUITETURA_BANCO_DADOS.md`, `3_ESPECIFICACAO_APIS.md` e `4_FLUXOS_PROCESSO.md`
10. Kick-off de desenvolvimento

---

*Documento de Projeto PCP | Versão 1.2 | Agosto 2026*
*Proprietário: Gustavo Landal | Contato: Suporte Interno*
