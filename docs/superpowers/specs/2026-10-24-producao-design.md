# Fase 3 — Produção (pedidos de venda, OP, Kanban, rastreabilidade, metrologia, custo real)

Data: 24/10/2026 · Branch: `feat/producao` (empilhado sobre `feat/clientes-centros`) ·
Decidida de forma autônoma (decisão do usuário de 24/10/2026) e registrada no ledger.
Referências: `0_SUMARIO_EXECUTIVO.md` §4 (RF4/RF5), §5.1 A/B/D; `6_CRONOGRAMA_TECNICO.md`, Fase 3.

## 1. Fluxo

```
Pedido de venda (cliente, itens de PA)
  └─ Gerar OP por item ──► OP "Aberta" (BOM ativa congelada na OP)
        └─ Liberar ──► reserva todo o material (tudo ou nada) ──► OP "Liberada", Kanban: Separação
              Separação ─► Montagem ─► Testes ─► Expedição ─► Concluir
              (avançar exige apontamento encerrado na etapa atual)
              · sair da Separação: baixa o material reservado (consumo, custo pelo CMP)
              · Testes: resultado por número de série; só avança com todas aprovadas
                (e metrologia preenchida, se o produto exigir)
              · Concluir: PA entra no estoque; pedido vira "Pronto para Envio" quando
                todas as OPs dele concluem
  Pedido "Pronto para Envio" ──► Registrar entrega ──► sai do estoque de PA, "Entregue",
                                  séries "Expedidas"
```

## 2. Entregas (commits em sequência no mesmo branch)

| # | Entrega | Conteúdo |
|---|---|---|
| 3A | Pedidos de venda | `cliente_id` (FK) no pedido, itens de PA com preço, status `Aberto → Em Producao → Pronto para Envio → Entregue` (+ `Cancelado`). Número informado pelo usuário, único. Editar só `Aberto`; cancelar só sem OP liberada. |
| 3B | Ordem de produção | Gerar OP por item (uma por item — `UNIQUE` já existente), número automático `OP-AAAA-NNNNN`, BOM ativa obrigatória. Liberar = reserva tudo-ou-nada com lista do que falta (409). Cancelar OP libera a reserva (só antes de consumir). |
| 3C | Kanban e apontamento | Quadro de 4 colunas fixas (RN3). Apontamento: iniciar/encerrar na etapa atual, com centro de trabalho da mesma etapa e operador = usuário da sessão; um apontamento aberto por OP. Avançar etapa grava `historico_kanban`. Consumo ao sair da Separação. Concluir na Expedição. |
| 3D | Rastreabilidade por série (§5.1.A) | Séries geradas na liberação: `<CODIGO-PA>-<AAAA>-<NNNNN>` (sequência por produto e ano). Resultado de teste por série. Ficha *as-built* (`/rastreabilidade/:numero`): pedido/cliente, OP, BOM congelada, apontamentos (etapa, operador, centro, horários), teste, metrologia; QR Code da ficha. |
| 3E | Metrologia (§5.1.B) | `exige_metrologia` no produto acabado. Por série: nº de aprovação de modelo (Inmetro), data de verificação, lacre, validade. Obrigatória antes de sair de Testes quando o produto exige. Lista de verificações vencidas / a vencer em 30 dias. |
| 3F | Custo real (§5.1.D) | CMP por peça (`saldo_estoque.custo_medio`, atualizado no recebimento do PC pelo preço do item). Consumo grava custo unitário. `custo_hora` no centro de trabalho. OP: orçado (BOM × CMP na liberação) × realizado (material consumido + horas apontadas × custo/hora). |

## 3. Decisões

- **Método de custeio**: só CMP (o parâmetro `metodo_custeio` existe, mas PEPS fica para
  depois — registrado). Peça sem custo (nunca recebida por PC) entra com custo 0 e a tela
  avisa "custo incompleto".
- **Kanban fixo** (4 etapas). Configurável por família fica para a Fase 4.
- **Componentes críticos com lote/série** no *as-built*: dependem do recebimento fiscal com
  série/lote (v1.2), que ainda não existe — a ficha lista os componentes da BOM congelada,
  sem lote. Registrado.
- **Quantidade de OP** inteira; série = 1 por unidade.
- **Apontamento**: o operador é sempre o usuário da sessão (não se aponta por outra pessoa).
- **Baixa no consumo** usa o mesmo travamento por linha do estoque (`FOR UPDATE`) e roda na
  mesma transação da mudança de etapa.

## 4. Permissões (migration 017)

`pedidos_venda.visualizar|incluir|editar|cancelar|entregar`;
`producao.visualizar|gerar_op|liberar|apontar|avancar|cancelar|testar|metrologia|custos`.

| Perfil | Pedidos de venda | Produção |
|---|---|---|
| GESTOR | tudo | tudo |
| VENDAS | tudo | visualizar |
| OPERADOR | — | visualizar, apontar, avancar |
| QUALIDADE | — | visualizar, apontar, testar, metrologia |
| ALMOXARIFE | — | visualizar, apontar, avancar |
| CONSULTA | visualizar | visualizar |
| COMPRADOR | — | visualizar |

## 5. Fora do escopo (registrado)

Kanban configurável, backflushing, calendário, modo quiosque/TV, PEPS, lote/série de
componentes no *as-built*, impressão de etiqueta física, notificações de OP em risco.
