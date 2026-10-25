# Roteiro de homologação

**Para:** Gestor de Operações e usuários-chave de cada área.
**Objetivo:** confirmar, com dados e rotinas reais da empresa, que o sistema atende ao trabalho do dia a dia antes de entrar em produção.
**Onde:** num ambiente de homologação instalado como o de produção ([docs/10_IMPLANTACAO.md](10_IMPLANTACAO.md)), com uma cópia do cadastro real. Nunca no servidor de produção.

## Como usar

1. Cada cenário tem pré-condição, passos e resultado esperado. A seção do [manual de operação](8_MANUAL_OPERACAO.md) indicada explica a tela em detalhe.
2. Execute com o usuário do perfil indicado, não com o administrador. Assim a homologação também confere as permissões de cada função.
3. Em **Aceite**, marque **OK**, **OK com ressalva** ou **Não OK**. Em **Observações**, descreva o que aconteceu, com print e horário. O horário permite achar o registro na Auditoria.
4. Um cenário **Não OK** volta para correção e é refeito.

O sistema pode ir para produção quando todos os cenários estiverem OK, ou quando as ressalvas forem aceitas por escrito pelo Gestor.

## Preparação (administrador)

- [ ] Ambiente instalado, com HTTPS e acesso pelas estações das áreas.
- [ ] Dados da empresa, logotipo e parâmetros regionais e de negócio configurados (manual 13, 15 e 17).
- [ ] SMTP configurado e testado (manual 18).
- [ ] Um usuário por pessoa da homologação, com o perfil da função (manual 20).
- [ ] Cadastros base importados ou digitados: fornecedores, peças, produtos e a estrutura (BOM) dos produtos a usar nos testes.

## Cenários

| # | Cenário | Perfil | Manual |
|---|---|---|---|
| H01 | Primeiro acesso e troca de senha | todos | 1, 20 |
| H02 | Permissões por perfil | todos | 19 |
| H03 | Cadastro de fornecedor, peça e produto com mídia | Gestor / Comprador | 4, 5, 6, 28.1 |
| H04 | Estrutura do produto (BOM) com versão | Gestor | 7 |
| H05 | Cotação até pedido de compra | Comprador | 8, 9 |
| H06 | Recebimento por XML da NF-e | Almoxarife | 26.1, 26.3 |
| H07 | Recebimento manual com lote, validade e séries | Almoxarife | 26.2 |
| H08 | Divergência de preço com aprovação | Almoxarife + Gestor | 26.3, 17 |
| H09 | Estorno de nota e ajuste de inventário | Almoxarife | 26, 10.2 |
| H10 | Necessidade de compra | Comprador | 11 |
| H11 | Pedido de venda até a OP liberada | Vendas + Gestor | 23, 24 |
| H12 | Produção no Kanban, com teste e metrologia | Operador + Qualidade | 24, 25 |
| H13 | Expedição e entrega | Gestor / Vendas | 23, 24 |
| H14 | Rastreabilidade da unidade e do lote | Qualidade | 25, 27 |
| H15 | Documentos e vencimentos | Qualidade / Comprador | 28 |
| H16 | Auditoria e segurança da conta | Administrador | 14, 16 |

### H01 — Primeiro acesso e troca de senha
- **Pré-condição:** usuário criado pelo administrador, com senha temporária.
- **Passos:**
  1. Entre com a senha temporária.
  2. Tente uma senha nova fraca (`1234567890` ou uma que contenha o seu login).
  3. Defina uma senha válida.
- **Esperado:**
  - o sistema exige a troca antes de qualquer tela;
  - recusa a senha fraca com a explicação;
  - depois da troca, abre o Painel.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H02 — Permissões por perfil
- **Passos:** com cada perfil (Almoxarife, Comprador, Operador, Qualidade, Vendas, Gestor), percorra o menu e tente abrir pelo endereço uma tela que não aparece no menu.
- **Esperado:**
  - cada perfil vê só os módulos da sua função;
  - pelo endereço direto aparece "Acesso restrito";
  - os botões de ações não permitidas não aparecem.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H03 — Cadastros com mídia
- **Passos:**
  1. Cadastre um fornecedor (CNPJ real, com busca de CEP).
  2. Cadastre uma peça com lote/validade ou série, com foto principal e datasheet em PDF.
  3. Cadastre um produto.
- **Esperado:**
  - as validações apontam erros de CNPJ e de campos obrigatórios;
  - a foto aparece como miniatura na lista;
  - o datasheet abre;
  - uma versão nova substitui a vigente e guarda o histórico.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H04 — Estrutura do produto
- **Passos:** monte a BOM de um produto real e depois crie a versão 2 com uma peça a mais.
- **Esperado:** a versão 1 fica no histórico, e a versão 2 passa a valer para OPs novas.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H05 — Cotação até pedido de compra
- **Passos:**
  1. Crie uma cotação e registre a resposta do fornecedor.
  2. Gere o pedido de compra.
  3. Emita o pedido. Com a alçada configurada, tente também um pedido acima dela com o Gestor.
- **Esperado:**
  - o pedido chega a "Aguardando entrega";
  - acima da alçada, só o Administrador emite;
  - sem as cotações mínimas configuradas, a emissão é recusada com a lista das peças.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H06 — Recebimento por XML da NF-e
- **Pré-condição:** pedido do H05 aguardando entrega e o XML real da nota do fornecedor.
- **Passos:**
  1. Notas fiscais de entrada → Importar XML.
  2. Vincule os itens não reconhecidos.
  3. Crie o rascunho.
  4. Confira a contagem física.
  5. Confira a nota.
  6. Efetive a nota.
- **Esperado:**
  - a prévia mostra emitente, chave e totais;
  - os vínculos são lembrados na próxima nota do mesmo fornecedor;
  - depois da efetivação, o estoque e o custo médio sobem e o pedido muda para "Recebido parcial" ou "Concluído".
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H07 — Recebimento manual com lote, validade e séries
- **Passos:** lance uma nota à mão com:
  - uma peça com lote e validade (dois lotes);
  - uma peça com número de série (bipar com o leitor);
  - um item de bonificação.
- **Esperado:**
  - a conferência acusa séries faltando, série fora do formato, validade abaixo do mínimo e soma dos lotes diferente da quantidade;
  - corrigidas as pendências, a nota efetiva;
  - a bonificação entra com custo zero.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H08 — Divergência de preço com aprovação
- **Pré-condição:** parâmetro "exigir aprovação" para divergência de preço (manual 17).
- **Passos:**
  1. O Almoxarife lança uma nota com preço acima da tolerância e confere.
  2. O Almoxarife tenta efetivar.
  3. O Gestor efetiva.
- **Esperado:**
  - o Almoxarife não consegue efetivar;
  - o Gestor efetiva e fica registrado como aprovador.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H09 — Estorno e ajuste de inventário
- **Passos:**
  1. Estorne uma nota efetivada que ainda não foi usada.
  2. Faça um ajuste de inventário positivo numa peça com lote.
- **Esperado:**
  - o estorno devolve o estoque e o saldo do pedido;
  - uma nota cujo material já foi reservado não pode ser estornada;
  - o ajuste pede o lote e a validade.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H10 — Necessidade de compra
- **Passos:** abra a Necessidade de compra e exporte o CSV.
- **Esperado:** as peças abaixo do mínimo aparecem agrupadas por fornecedor, com a quantidade sugerida conferindo com o saldo e o mínimo.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H11 — Pedido de venda até a OP liberada
- **Passos:**
  1. Vendas cria um pedido para um cliente (contrato anexado).
  2. O Gestor gera a OP do item.
  3. O Gestor libera a OP. Tente também liberar uma OP sem material suficiente.
- **Esperado:**
  - a liberação reserva o material, com os lotes de validade mais próxima primeiro;
  - gera os números de série das unidades;
  - sem material, mostra a lista do que falta e não reserva nada.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H12 — Produção no Kanban
- **Passos:**
  1. Os operadores apontam cada etapa no seu centro de trabalho.
  2. A Qualidade registra o teste de cada unidade e, se o produto exigir, a metrologia.
  3. Anexe o laudo de teste na OP.
- **Esperado:**
  - a OP avança só com os apontamentos encerrados;
  - não sai de Testes com unidade sem aprovação;
  - o custo real aparece para quem tem a permissão de custos.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H13 — Expedição e entrega
- **Passos:** conclua a OP e registre a entrega do pedido de venda, anexando o termo de aceite.
- **Esperado:**
  - o pedido passa a "Pronto para envio" e depois a "Entregue";
  - com o pedido entregue, os documentos não podem mais ser removidos.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H14 — Rastreabilidade
- **Passos:**
  1. Leia o QR Code de uma unidade.
  2. Abra um lote de componente consumido e siga "do lote ao campo".
- **Esperado:**
  - a ficha *as-built* mostra pedido, cliente, apontamentos, teste e metrologia;
  - mostra também as séries e os lotes dos componentes, com nota e fornecedor, e o laudo;
  - o lote leva às unidades e aos clientes.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H15 — Documentos e vencimentos
- **Passos:** anexe ao fornecedor um certificado de qualidade com validade em 10 dias e abra "Documentos a vencer".
- **Esperado:** o certificado aparece para quem vê fornecedores, e não aparece para um Operador.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

### H16 — Auditoria e segurança da conta
- **Passos:**
  1. Erre a senha de um usuário de teste 5 vezes seguidas.
  2. Redefina a senha dele.
  3. Consulte a Auditoria das últimas ações dos cenários.
- **Esperado:**
  - depois de 5 erros, a conta fica bloqueada por alguns minutos, mesmo com a senha certa;
  - a redefinição libera a conta e encerra as sessões abertas dela;
  - a auditoria mostra quem fez o quê e quando, sem expor senhas.
- **Aceite:** ☐ OK ☐ OK com ressalva ☐ Não OK — **Observações:**

## Encerramento

| Item | Responsável | Data | Assinatura |
|---|---|---|---|
| Todos os cenários OK ou com ressalvas aceitas | Gestor de Operações | | |
| Backup e restauração testados (runbook) | TI | | |
| Usuários reais criados e senhas iniciais entregues | Administrador | | |
| Data de entrada em produção | Gestor de Operações | | |
