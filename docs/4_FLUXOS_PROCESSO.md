# Fluxos de Processo - Sistema PCP 3PL

**Versão**: 1.0  
**Data**: Agosto 2026  
**Formato**: Pseudocódigo e Diagramas de Estado

---

## 📋 Índice

1. [Fluxo: Criar OP a partir de Pedido de Venda](#fluxo-criar-op)
2. [Fluxo: Mover OP no Kanban](#fluxo-kanban)
3. [Fluxo: Receber Insumos](#fluxo-receber)
4. [Fluxo: Gerar Sugestão de Compra](#fluxo-sugestao-compra)
5. [Fluxo: Finalizar OP](#fluxo-finalizar)
6. [Estados e Transições](#estados-e-transições)

---

## Fluxo: Criar OP

**Ator**: Gestor PCP  
**Início**: Pedido de Venda selecionado  
**Fim**: OP criada com componentes reservados

```
INÍCIO
  |
  ├─ Receber: pedido_venda_id
  |
  ├─ Validar Pedido Existe?
  |  └─ NÃO → Erro: Pedido não encontrado
  |
  ├─ Recuperar: Itens do Pedido de Venda
  |
  ├─ Para cada ITEM do Pedido:
  |  |
  |  ├─ Recuperar: produto_acabado_id
  |  |
  |  ├─ Recuperar: BOM ativa do PA
  |  |  └─ NÃO existe? → Erro: BOM não definida
  |  |
  |  ├─ Calcular Necessário:
  |  |     necessário_pp = quantidade_op × quantidade_bom
  |  |
  |  ├─ Para cada PARTE/PEÇA da BOM:
  |  |  |
  |  |  ├─ Recuperar: saldo_estoque[pp]
  |  |  |
  |  |  ├─ Verificar: saldo >= necessário_pp?
  |  |  |  |
  |  |  |  ├─ NÃO → Acumular erro: "PP {código} com estoque insuficiente"
  |  |  |  |
  |  |  |  └─ SIM → OK
  |  |  |
  |  |  └─ Fim do loop
  |  |
  |  └─ Fim do loop
  |
  ├─ Verificar: Existem erros de estoque?
  |  |
  |  ├─ SIM → Retornar erros e:
  |  |        Opção 1: Gerar compra automática
  |  |        Opção 2: Parar e avisar usuário
  |  |
  |  └─ NÃO → Continuar
  |
  ├─ TRANSAÇÃO INICIA
  |
  ├─ Para cada ITEM do Pedido:
  |  |
  |  ├─ Criar: ORDEM_PRODUCAO
  |  |    {
  |  |      numero_op = gerar_sequencia("OP-{YYYY}-"),
  |  |      item_pedido_venda_id = item.id,
  |  |      produto_acabado_id = item.pa_id,
  |  |      quantidade = item.quantidade,
  |  |      estrutura_produto_id = bom.id,
  |  |      data_conclusao_prevista = HOJE + PA.lead_time_producao,
  |  |      etapa_atual = "Separação",
  |  |      status = "Aberta"
  |  |    }
  |  |
  |  ├─ Recuperar: OP criada (op.id)
  |  |
  |  ├─ Para cada PARTE/PEÇA na BOM:
  |  |  |
  |  |  ├─ Criar: RESERVA_ESTOQUE
  |  |  |    {
  |  |  |      ordem_producao_id = op.id,
  |  |  |      parte_peca_id = pp.id,
  |  |  |      quantidade_reservada = op.quantidade × pp.quantidade_bom,
  |  |  |      status = "Reservada"
  |  |  |    }
  |  |  |
  |  |  ├─ Atualizar: saldo_estoque[pp]
  |  |  |    quantidade_reservada += quantidade_reservada
  |  |  |
  |  |  ├─ Recalcular: status_estoque
  |  |  |    SE saldo < estoque_minimo:
  |  |  |      status = "CRITICO"
  |  |  |    SENÃO SE saldo <= estoque_maximo:
  |  |  |      status = "OK"
  |  |  |
  |  |  └─ Fim do loop
  |  |
  |  ├─ Registrar: HISTORICO_KANBAN
  |  |    {
  |  |      ordem_producao_id = op.id,
  |  |      etapa_anterior = NULL,
  |  |      etapa_nova = "Separação",
  |  |      data_hora_transicao = AGORA,
  |  |      usuario_responsavel_id = usuario.id
  |  |    }
  |  |
  |  ├─ Atualizar: PEDIDO_VENDA status = "Em Produção"
  |  |
  |  └─ Fim do loop
  |
  ├─ Registrar: Auditoria
  |    {
  |      tabela = "ordens_producao",
  |      operacao = "INSERT",
  |      dados_novos = {/* dados da OP */},
  |      usuario_id = usuario.id,
  |      data_hora = AGORA
  |    }
  |
  ├─ TRANSAÇÃO COMMIT
  |
  ├─ Retornar: Sucesso com lista de OPs criadas
  |
FIM
```

---

## Fluxo: Kanban

**Ator**: Operador (Chão de Fábrica)  
**Início**: Cartão de OP selecionado  
**Fim**: OP movida para próxima etapa

```
INÍCIO
  |
  ├─ Receber: ordem_producao_id, nova_etapa
  |
  ├─ Recuperar: OP
  |  └─ NÃO existe? → Erro: OP não encontrada
  |
  ├─ Validar: etapa_atual → nova_etapa é válida?
  |
  |  Sequência obrigatória:
  |    Separação → Montagem → Testes → Expedição
  |
  |  ├─ NÃO → Erro: Sequência inválida
  |  └─ SIM → Continuar
  |
  ├─ Validar: Pode transicionar?
  |
  |  ├─ SE etapa_atual = "Separação":
  |  |    Componentes foram separados? (Não há check obrigatório)
  |  |    → Permitir transição
  |  |
  |  ├─ SE etapa_atual = "Montagem":
  |  |    Montagem foi concluída?
  |  |    → Permitir transição
  |  |
  |  ├─ SE etapa_atual = "Testes":
  |  |    Testes passaram?
  |  |    Validação obrigatória?
  |  |    → Permitir transição
  |  |
  |  └─ SE etapa_atual = "Expedição":
  |     → Erro: Já é a última etapa
  |
  ├─ TRANSAÇÃO INICIA
  |
  ├─ Atualizar: ORDEM_PRODUCAO
  |    etapa_atual = nova_etapa,
  |    updated_at = AGORA
  |
  ├─ Registrar: HISTORICO_KANBAN
  |    {
  |      ordem_producao_id = op.id,
  |      etapa_anterior = etapa_antiga,
  |      etapa_nova = nova_etapa,
  |      data_hora_transicao = AGORA,
  |      usuario_responsavel_id = usuario.id
  |    }
  |
  ├─ SE nova_etapa = "Expedição":
  |  |
  |  └─ Preparar para finalização (mas não finaliza automaticamente)
  |
  ├─ TRANSAÇÃO COMMIT
  |
  ├─ Retornar: Sucesso + OP atualizada
  |
FIM
```

---

## Fluxo: Receber Insumos

**Ator**: Gestor PCP  
**Início**: PC selecionado  
**Fim**: Insumos entram no estoque

```
INÍCIO
  |
  ├─ Receber: pedido_compra_id, itens_recebidos[]
  |
  ├─ Recuperar: PEDIDO_COMPRA
  |  └─ NÃO existe? → Erro: PC não encontrada
  |
  ├─ Validar: Status da PC
  |  ├─ SE status NOT IN ["Emitido", "Aceito", "Aguardando", "Recebido Parcial"]:
  |  |    → Erro: PC não pode receber neste status
  |  └─ SIM → Continuar
  |
  ├─ TRANSAÇÃO INICIA
  |
  ├─ Para cada ITEM_RECEBIDO:
  |  |
  |  ├─ Recuperar: ITEM_PEDIDO_COMPRA correspondente
  |  |  └─ NÃO existe? → Erro: Item não encontrado no PC
  |  |
  |  ├─ Validar: quantidade_recebida <= quantidade_solicitada
  |  |  └─ NÃO → Erro: Quantidade excede o solicitado
  |  |
  |  ├─ Atualizar: ITEM_PEDIDO_COMPRA
  |  |    quantidade_recebida += quantidade_recebida_agora
  |  |
  |  ├─ Recuperar: SALDO_ESTOQUE da PP
  |  |
  |  ├─ Atualizar: SALDO_ESTOQUE
  |  |    quantidade_atual += quantidade_recebida_agora
  |  |
  |  ├─ Recalcular: status_estoque
  |  |    SE quantidade_atual <= estoque_minimo:
  |  |      status = "CRITICO"
  |  |    SENÃO SE quantidade_atual > estoque_maximo:
  |  |      status = "EXCEDIDO" (alerta)
  |  |    SENÃO:
  |  |      status = "OK"
  |  |
  |  ├─ Registrar: MOVIMENTACAO_ESTOQUE
  |  |    {
  |  |      parte_peca_id = pp.id,
  |  |      tipo = "Entrada",
  |  |      quantidade = quantidade_recebida_agora,
  |  |      data_hora = AGORA,
  |  |      motivo = "Compra",
  |  |      referencia_numero = pc.numero_pc,
  |  |      usuario_id = usuario.id
  |  |    }
  |  |
  |  └─ Fim do loop
  |
  ├─ Verificar: Todos os itens do PC foram recebidos?
  |
  |  ├─ SIM → Atualizar: PEDIDO_COMPRA status = "Concluído"
  |  |
  |  ├─ NÃO → Atualizar: PEDIDO_COMPRA status = "Recebido Parcial"
  |  |
  |  └─ Registrar: data_entrega_real = HOJE
  |
  ├─ Registrar: Auditoria
  |
  ├─ TRANSAÇÃO COMMIT
  |
  ├─ Retornar: Sucesso com detalhes do recebimento
  |
FIM
```

---

## Fluxo: Gerar Sugestão de Compra

**Ator**: Sistema (Automático ou Manual)  
**Início**: Análise de OPs e estoques  
**Fim**: Lista de sugestões de compra

```
INÍCIO
  |
  ├─ Recuperar: Todas as ORDENS_PRODUCAO com status = "Aberta"
  |
  ├─ Para cada OP:
  |  |
  |  ├─ Recuperar: ESTRUTURA_PRODUTO (BOM) ativa
  |  |
  |  ├─ Para cada ITEM da BOM:
  |  |  |
  |  |  ├─ Calcular: necessário = OP.quantidade × BOM_ITEM.quantidade
  |  |  |
  |  |  ├─ Recuperar: saldo_estoque[PP]
  |  |  |
  |  |  ├─ Calcular: disponível = quantidade_atual - quantidade_reservada
  |  |  |
  |  |  ├─ Acumular em MATRIZ[pp.id] += necessário
  |  |  |
  |  |  └─ Fim do loop
  |  |
  |  └─ Fim do loop
  |
  ├─ Para cada PARTE_PECA:
  |  |
  |  ├─ Recuperar: saldo_estoque[pp]
  |  |
  |  ├─ Calcular: necessário_total = MATRIZ[pp.id] + estoque_minimo
  |  |
  |  ├─ Calcular: diferença = necessário_total - saldo_atual
  |  |
  |  ├─ SE diferença > 0:
  |  |  |
  |  |  ├─ Criar: SUGESTAO
  |  |  |    {
  |  |  |      parte_peca_id = pp.id,
  |  |  |      quantidade_necessaria = diferença,
  |  |  |      fornecedor_id = pp.fornecedor_padrao_id,
  |  |  |      prioridade = "ALTA" se diferença > (estoque_minimo * 2) senão "NORMAL"
  |  |  |    }
  |  |  |
  |  |  └─ Acumular em lista_sugestoes
  |  |
  |  └─ Fim do loop
  |
  ├─ Agrupar sugestões por FORNECEDOR
  |
  ├─ Retornar: Lista de sugestões com:
  |    - Códigos e descrições das PPs
  |    - Quantidades necessárias
  |    - Fornecedores
  |    - Prioridades
  |
  ├─ Apresentar ao Gestor com opção:
  |    Opção 1: Gerar Cotação
  |    Opção 2: Converter em PC (se já tem preço)
  |    Opção 3: Descartar sugestão
  |
FIM
```

---

## Fluxo: Finalizar OP

**Ator**: Operador  
**Início**: OP em etapa "Expedição"  
**Fim**: OP concluída, componentes consumidos, PA criado

```
INÍCIO
  |
  ├─ Receber: ordem_producao_id
  |
  ├─ Recuperar: OP
  |  └─ NÃO existe? → Erro
  |
  ├─ Validar: Precondições
  |  |
  |  ├─ Status = "Aberta"?
  |  |  └─ NÃO → Erro: OP já foi finalizada ou cancelada
  |  |
  |  ├─ Etapa Atual = "Expedição"?
  |  |  └─ NÃO → Erro: OP não está pronta para expedição
  |  |
  |  └─ SIM → Continuar
  |
  ├─ TRANSAÇÃO INICIA
  |
  ├─ Registrar: MOVIMENTACAO_ESTOQUE
  |    Para cada PP em RESERVA_ESTOQUE[op.id]:
  |    {
  |      parte_peca_id = pp.id,
  |      tipo = "Saída",
  |      quantidade = reserva.quantidade_reservada,
  |      data_hora = AGORA,
  |      motivo = "OP",
  |      referencia_numero = op.numero_op,
  |      usuario_id = usuario.id
  |    }
  |
  ├─ Atualizar: SALDO_ESTOQUE de cada PP
  |    Para cada PP em RESERVA_ESTOQUE[op.id]:
  |    {
  |      quantidade_atual -= reserva.quantidade_reservada,
  |      quantidade_reservada -= reserva.quantidade_reservada,
  |      atualizar status
  |    }
  |
  ├─ Atualizar: RESERVA_ESTOQUE
  |    status = "Consumida",
  |    quantidade_consumida = quantidade_reservada
  |
  ├─ Criar: SALDO_ESTOQUE de PA (se não existe)
  |    {
  |      produto_acabado_id = op.produto_acabado_id,
  |      quantidade_atual = 0,
  |      status = "OK"
  |    }
  |
  ├─ Atualizar: SALDO_ESTOQUE de PA
  |    quantidade_atual += op.quantidade
  |
  ├─ Registrar: MOVIMENTACAO_ESTOQUE (entrada de PA)
  |    {
  |      produto_acabado_id = op.produto_acabado_id,
  |      tipo = "Entrada",
  |      quantidade = op.quantidade,
  |      data_hora = AGORA,
  |      motivo = "OP",
  |      referencia_numero = op.numero_op
  |    }
  |
  ├─ Atualizar: ORDEM_PRODUCAO
  |    {
  |      status = "Concluída",
  |      data_conclusao_real = HOJE,
  |      etapa_atual = "Expedição" (mantém)
  |    }
  |
  ├─ Registrar: HISTORICO_KANBAN (última transição)
  |    {
  |      ordem_producao_id = op.id,
  |      etapa_anterior = "Testes",
  |      etapa_nova = "Expedição",
  |      data_hora_transicao = AGORA
  |    }
  |
  ├─ Atualizar: PEDIDO_VENDA (item correspondente)
  |    SE todos os itens do PV estão em OP concluídas:
  |      status_pv = "Pronto para Envio"
  |    SENÃO:
  |      status_pv = "Em Produção"
  |
  ├─ Registrar: Auditoria
  |
  ├─ TRANSAÇÃO COMMIT
  |
  ├─ Retornar: Sucesso com OP finalizada
  |
FIM
```

---

## Estados e Transições

### Estados de ORDEM_PRODUCAO

```
┌─────────┐
│  Aberta │ ← Criação automática por PV
└────┬────┘
     │
     ├─ (Kanban: Separação → Montagem → Testes → Expedição)
     │
     ├─ Expedição
     │
     ├─ Finalizar OP?
     │  │
     │  ├─ SIM → ┌───────────┐
     │  │        │ Concluída │
     │  │        └───────────┘
     │  │
     │  └─ NÃO → Aguarda finalização
     │
     └─ Cancelar?
        │
        └─ SIM → ┌───────────┐
                 │ Cancelada │ (libera componentes)
                 └───────────┘
```

### Estados de PEDIDO_COMPRA

```
┌──────────┐
│ Rascunho │
└────┬─────┘
     │
     ├─ Emitir PC?
     │  └─ SIM → ┌────────┐
     │           │ Emitido│
     │           └───┬────┘
     │               │
     │               ├─ Aceitar?
     │               │  └─ SIM → ┌────────┐
     │               │           │ Aceito │
     │               │           └───┬────┘
     │               │               │
     │               ├─ Aguardando Entrega
     │               │  ├─ Recebimento Parcial (volta aqui)
     │               │  └─ Receber Tudo?
     │               │     └─ SIM → ┌──────────┐
     │               │              │Concluído │
     │               │              └──────────┘
     │               │
     │               └─ Cancelar?
     │                  └─ SIM → ┌──────────┐
     │                           │Cancelado │
     │                           └──────────┘
     │
     └─ Cancelar?
        └─ SIM → ┌──────────┐
                 │Cancelado │
                 └──────────┘
```

### Estados de PEDIDO_VENDA

```
┌──────────────────┐
│ Aguardando Insumos│ ← Criação pela venda
└────┬─────────────┘
     │
     ├─ Todos os componentes disponíveis?
     │  └─ SIM → Gerar OPs automaticamente
     │
     │
     ├─ Em Produção ← OPs criadas
     │  │
     │  ├─ Todas as OPs concluídas?
     │  │  └─ SIM → ┌────────────────┐
     │  │           │Pronto para Envio│
     │  │           └────┬───────────┘
     │  │                │
     │  │                ├─ Registrar Entrega?
     │  │                │  └─ SIM → ┌──────────┐
     │  │                │           │ Entregue │
     │  │                │           └──────────┘
     │  │                │
     │  │                └─ Cancelar?
     │  │                   └─ SIM → ┌──────────┐
     │  │                            │Cancelado │
     │  │                            └──────────┘
     │  │
     │  └─ OP Cancelada?
     │     └─ SIM → Voltar "Aguardando Insumos"
     │
     └─ Cancelar direto?
        └─ SIM → ┌──────────┐
                 │Cancelado │
                 └──────────┘
```

---

**Data de Revisão**: Setembro 2026

