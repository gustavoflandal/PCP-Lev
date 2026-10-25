# 4. FLUXOS DE PROCESSO — ADENDO v1.2
## Recebimento Fiscal, Rastreabilidade e Movimentação de Estoque

**Versão 1.2** | Agosto 2026
**Proprietário:** Gustavo Landal
**Relação com a suíte:** este documento **substitui** o fluxo de recebimento descrito na v1.0 do `4_FLUXOS_PROCESSO.md` e **acrescenta** os fluxos 02 a 07. Os demais fluxos da versão anterior (geração de necessidade, cotação, pedido de venda) permanecem válidos sem alteração.

---

## 0. CONVENÇÕES

**Notação do pseudocódigo:** sintaxe inspirada em Go, sem compromisso com compilação. `tx` representa uma transação de banco; tudo dentro de `WithTransaction` é atômico.

**Níveis de isolamento:** `READ COMMITTED` (padrão do PostgreSQL) é suficiente em todos os fluxos, **desde que** os bloqueios explícitos descritos em cada seção sejam aplicados. Nenhum fluxo depende de `SERIALIZABLE`.

**Ordem de bloqueio (prevenção de deadlock):** sempre que múltiplas linhas de `produto` ou `saldo_estoque` forem bloqueadas na mesma transação, os bloqueios são adquiridos em ordem crescente de `produto_id`. Essa regra é obrigatória e vale para todos os fluxos deste documento.

**Princípio do livro-razão:** `movimento_estoque` é *append-only*. Não existe `UPDATE` nem `DELETE` na tabela. Saldo é sempre resultado de soma de movimentos; qualquer campo de saldo materializado é cache derivado, reconstruível.

**Códigos de erro:** identificadores no formato `ERR_XXX`, catalogados na seção 8.

---

## FLUXO 01 — LANÇAMENTO E EFETIVAÇÃO DA NOTA FISCAL DE ENTRADA

### 1.1 Diagrama de Estados

```
                    ┌──────────────┐
                    │   RASCUNHO   │ ←── criação / importação XML / digitação
                    └──────┬───────┘
                           │ validar()  — todas as regras da seção 1.4
                           ↓
                    ┌──────────────┐
              ┌──── │  CONFERIDA   │ ←── quantidades físicas conferidas
              │     └──────┬───────┘
   voltarPara │            │ efetivar()  — TRANSAÇÃO ATÔMICA
   Rascunho() │            ↓
              │     ┌──────────────┐
              └──── │  EFETIVADA   │ ── imutável
                    └──────┬───────┘
                           │ estornar(motivo)  — Fluxo 03
                           ↓
                    ┌──────────────┐
                    │  ESTORNADA   │ ── terminal
                    └──────────────┘

    RASCUNHO ──cancelar(motivo)──→ CANCELADA   (terminal, não movimenta estoque)
```

**Transições permitidas:**

| De | Para | Ação | Permissão exigida |
|---|---|---|---|
| — | Rascunho | `criar` / `importarXML` | `nf.incluir` |
| Rascunho | Rascunho | `editar` | `nf.editar` |
| Rascunho | Conferida | `conferir` | `nf.conferir` |
| Rascunho | Cancelada | `cancelar` | `nf.cancelar_rascunho` |
| Conferida | Rascunho | `reabrir` | `nf.editar` |
| Conferida | Efetivada | `efetivar` | `nf.efetivar` (+ `nf.efetivar_acima_alcada` se valor > limite) |
| Efetivada | Estornada | `estornar` | `nf.estornar` |

Qualquer outra transição retorna `ERR_TRANSICAO_INVALIDA`. A validação da transição ocorre **dentro** da transação, relendo o estado com `FOR UPDATE` — nunca com base no estado carregado pela tela.

### 1.2 Fluxo do Usuário (visão da operação)

```
1. Almoxarife recebe a mercadoria na doca
2. Abre "Recebimento" → seleciona o Pedido de Compra
   └─ sistema lista apenas PCs em situação Aprovado ou Parcialmente Recebido
3. Informa a origem dos dados:
   ├─ (a) Upload do XML da NF-e   → Fluxo 02, itens pré-preenchidos
   └─ (b) Digitação manual        → itens do PC apresentados com saldo pendente
4. Para cada item:
   ├─ confere quantidade física vs. quantidade da nota
   ├─ se controla_lote  → informa lote (+ fabricação/validade)
   └─ se controla_serie → bipa/cola/gera as séries até fechar a contagem
5. Anexa DANFE, XML, foto do recebimento e certificados exigidos
6. "Conferir" → sistema roda todas as validações e aponta pendências
7. "Efetivar" → transação atômica; estoque passa a existir
```

**Rascunho persistido de forma incremental:** cada item confirmado é gravado imediatamente. Uma nota com 200 itens não pode depender de um único `submit` no fim — queda de conexão ou tablet em suspensão não pode custar 40 minutos de digitação.

### 1.3 Captura de Série e Lote — Detalhe da Interface

```
Item: PLACA-CTRL-V3    Qtd. NF: 50    Qtd. recebida: [ 50 ]

┌─ Lote ────────────────────────────────────────────────────┐
│ Lote: [L2608-A]  Fabricação: [10/08/2026]                  │
│ Validade: [10/08/2028]     [+ adicionar outro lote]        │
└────────────────────────────────────────────────────────────┘

┌─ Números de Série ──────────────────── 38 de 50 ──────────┐
│ [_____________________]  ← foco automático, aceita bipagem │
│                            contínua, um beep por leitura   │
│                                                            │
│ [Colar lista]  [Gerar faixa sequencial]  [Limpar]          │
│                                                            │
│ SN-1001 ✓   SN-1002 ✓   SN-1003 ✓   ...   SN-1038 ✓        │
└────────────────────────────────────────────────────────────┘
```

**Regras de interface obrigatórias:**
- O campo de leitura **nunca perde o foco** entre bipagens; o operador não toca no mouse
- Duplicata dentro da própria nota: rejeição imediata, com destaque na série repetida e sinal sonoro distinto
- Duplicata contra o histórico: verificação assíncrona (*debounce* de 300 ms) contra o banco, sem travar a digitação
- "Gerar faixa": prefixo + número inicial + quantidade, com pré-visualização antes de confirmar
- Contador sempre visível; botão **Efetivar** desabilitado enquanto `séries_informadas ≠ qtd_recebida`

**Subdivisão por múltiplos lotes:** ao adicionar um segundo lote, a quantidade do item se divide em linhas de recebimento. A soma das linhas deve igualar `qtd_recebida` — validação em tempo real na tela e revalidada no servidor.

### 1.4 Validações na Conferência

Executadas em bloco, retornando **todas** as pendências de uma vez. Nunca uma por vez: o almoxarife precisa ver a lista completa do que corrigir.

```go
func ValidarNotaFiscal(ctx context.Context, nf *NotaFiscal) []Pendencia {
    var p []Pendencia

    // ---- Cabeçalho ----
    if nf.PedidoCompraID == 0 {
        p = append(p, Pendencia{"ERR_NF_001", "Nota fiscal sem pedido de compra vinculado"})
    }
    if nf.FornecedorCNPJ != nf.PedidoCompra.FornecedorCNPJ {
        p = append(p, Pendencia{"ERR_NF_002", "CNPJ do emitente diverge do fornecedor do pedido"})
    }
    if nf.Modelo == "55" && !ChaveAcessoValida(nf.ChaveAcesso) {
        p = append(p, Pendencia{"ERR_NF_003", "Chave de acesso inválida (44 dígitos + DV)"})
    }
    if ExisteNotaDuplicada(ctx, nf) {
        p = append(p, Pendencia{"ERR_NF_004", "Nota já lançada: " + notaOriginal.Numero})
    }
    if nf.DataEntrada.Before(nf.DataEmissao) {
        p = append(p, Pendencia{"ERR_NF_005", "Data de entrada anterior à emissão"})
    }
    if diasAtras(nf.DataEntrada) > param.PrazoMaxLancamentoRetroativo {
        p = append(p, Pendencia{"ERR_NF_006", "Lançamento retroativo além do prazo permitido"})
    }
    if param.ExigirXML && nf.ArquivoXML == nil {
        p = append(p, Pendencia{"ERR_NF_007", "XML da NF-e obrigatório para efetivação"})
    }

    // ---- Itens ----
    for _, item := range nf.Itens {
        itemPC := nf.PedidoCompra.BuscarItem(item.ProdutoID)

        // 1. Item pertence ao pedido
        if itemPC == nil && !item.Bonificacao {
            p = append(p, Pendencia{"ERR_ITEM_001",
                fmt.Sprintf("Item %s não consta no pedido de compra", item.Produto.Codigo)})
            continue
        }

        // 2. Saldo do pedido, com tolerância de excesso
        if itemPC != nil {
            limite := itemPC.QtdPedida * (1 + param.ToleranciaExcessoPerc/100)
            if itemPC.QtdRecebidaAcum + item.QtdRecebida > limite {
                p = append(p, Pendencia{"ERR_ITEM_002",
                    fmt.Sprintf("Item %s excede o saldo do pedido (saldo: %.3f)",
                        item.Produto.Codigo, itemPC.Saldo())})
            }
        }

        // 3. Divergência de preço
        if itemPC != nil {
            divPerc := abs(item.ValorUnitario - itemPC.ValorUnitario) / itemPC.ValorUnitario * 100
            if divPerc > param.ToleranciaPrecoPerc {
                switch param.AcaoDivergenciaPreco {
                case "BLOQUEAR":
                    p = append(p, Pendencia{"ERR_ITEM_003", "Divergência de preço acima da tolerância"})
                case "APROVAR":
                    item.RequerAprovacao = true   // não bloqueia; exige perfil autorizado
                }
            }
        }

        // 4. Conversão de unidade
        if item.UnidadeNF != item.Produto.UnidadeEstoque {
            if item.Produto.FatorConversao == 0 {
                p = append(p, Pendencia{"ERR_ITEM_004", "Fator de conversão não cadastrado"})
            }
        }

        // 5. Lote
        if item.Produto.ControlaLote {
            if len(item.Recebimentos) == 0 || algumLoteVazio(item.Recebimentos) {
                p = append(p, Pendencia{"ERR_LOTE_001", "Lote obrigatório para " + item.Produto.Codigo})
            }
            if somaQuantidades(item.Recebimentos) != item.QtdRecebida {
                p = append(p, Pendencia{"ERR_LOTE_002", "Soma dos lotes difere da quantidade recebida"})
            }
        }

        // 6. Validade
        if item.Produto.ControlaValidade {
            for _, r := range item.Recebimentos {
                if r.Validade.IsZero() {
                    p = append(p, Pendencia{"ERR_VAL_001", "Validade obrigatória para o lote " + r.Lote})
                } else if diasAte(r.Validade) < param.ValidadeMinimaDias {
                    p = append(p, Pendencia{"ERR_VAL_002",
                        fmt.Sprintf("Lote %s com validade remanescente inferior ao mínimo", r.Lote)})
                }
            }
        }

        // 7. Número de série
        if item.Produto.ControlaSerie {
            series := coletarSeries(item)
            if float64(len(series)) != item.QtdRecebida {
                p = append(p, Pendencia{"ERR_SERIE_001",
                    fmt.Sprintf("%d séries informadas para %.0f unidades", len(series), item.QtdRecebida)})
            }
            if dup := duplicadasNaNota(series); len(dup) > 0 {
                p = append(p, Pendencia{"ERR_SERIE_002", "Séries repetidas na nota: " + join(dup)})
            }
            if dup := jaExistemNoBanco(ctx, item.ProdutoID, series); len(dup) > 0 {
                p = append(p, Pendencia{"ERR_SERIE_003", "Séries já cadastradas: " + join(dup)})
            }
            if item.Produto.MascaraSerie != "" {
                if inv := foraDoPadrao(series, item.Produto.MascaraSerie); len(inv) > 0 {
                    p = append(p, Pendencia{"ERR_SERIE_004", "Séries fora do padrão: " + join(inv)})
                }
            }
        }

        // 8. Certificado obrigatório
        if item.Produto.ExigeCertificado && !possuiCertificado(item) {
            p = append(p, Pendencia{"ERR_ITEM_005", "Certificado de conformidade não anexado"})
        }
    }

    // ---- Anexos ----
    if param.ExigirFotoRecebimento && !nf.PossuiAnexoTipo("FOTO_RECEBIMENTO") {
        p = append(p, Pendencia{"ERR_NF_008", "Foto do recebimento obrigatória"})
    }

    return p
}
```

### 1.5 Efetivação — Transação Atômica

Este é o ponto crítico do sistema. Tudo abaixo acontece em uma única transação: ou o estoque inteiro passa a existir, ou nada acontece.

```go
func EfetivarNotaFiscal(ctx context.Context, nfID int64, usuarioID int64,
                        chaveIdempotencia string) (*ResultadoEfetivacao, error) {

    // Idempotência: duplo clique, retry de rede ou reenvio do app não podem
    // gerar dois lançamentos. A chave é gerada pelo cliente ao abrir a tela.
    if res, ok := buscarResultadoIdempotente(ctx, chaveIdempotencia); ok {
        return res, nil
    }

    var resultado ResultadoEfetivacao

    err := db.WithTransaction(ctx, func(tx Tx) error {

        // ── 1. Bloquear a nota e reler o estado real ──────────────────────
        nf, err := tx.BuscarNotaFiscalForUpdate(nfID)
        if err != nil { return err }
        if nf.Situacao != SituacaoConferida {
            return ErrTransicaoInvalida(nf.Situacao, SituacaoEfetivada)
        }

        // ── 2. Bloquear o PC (advisory lock) ──────────────────────────────
        // Duas notas do mesmo pedido efetivadas simultaneamente poderiam,
        // cada uma, ver saldo suficiente e juntas estourar o pedido.
        tx.AdvisoryLock(LOCK_PEDIDO_COMPRA, nf.PedidoCompraID)

        // ── 3. Bloquear os produtos em ordem crescente de ID ──────────────
        produtoIDs := ordenarAsc(nf.ProdutoIDsDistintos())
        saldos := tx.BuscarSaldosForUpdate(produtoIDs)   // SELECT ... FOR UPDATE

        // ── 4. REVALIDAR tudo com os dados bloqueados ─────────────────────
        // A validação da conferência é orientação de tela. A verdade é aqui:
        // entre conferir e efetivar, outra nota do mesmo PC pode ter entrado.
        if pend := ValidarNotaFiscalTx(tx, nf); len(pend) > 0 {
            return ErrValidacao(pend)
        }

        // ── 5. Calcular o rateio de frete e impostos ───────────────────────
        rateio := CalcularRateio(nf, param.MetodoRateio)

        // ── 6. Processar item a item ───────────────────────────────────────
        for _, item := range nf.Itens {

            qtdEstoque := item.QtdRecebida * item.Produto.FatorConversao
            custoUnit  := (item.ValorTotal + rateio.Para(item.ID)) / qtdEstoque

            for _, rec := range item.Recebimentos {   // uma linha por lote

                // 6.1 Lote — cria ou reaproveita
                var loteID *int64
                if item.Produto.ControlaLote {
                    l := tx.UpsertLote(Lote{
                        ProdutoID:     item.ProdutoID,
                        FornecedorID:  nf.FornecedorID,
                        Identificacao: rec.Lote,
                        Fabricacao:    rec.Fabricacao,
                        Validade:      rec.Validade,
                    })
                    loteID = &l.ID
                }

                // 6.2 Movimento de estoque — o registro que cria o saldo
                mov := tx.InserirMovimento(MovimentoEstoque{
                    Tipo:            MovEntradaCompra,
                    ProdutoID:       item.ProdutoID,
                    LoteID:          loteID,
                    Quantidade:      rec.Quantidade * item.Produto.FatorConversao,  // positivo
                    CustoUnitario:   custoUnit,
                    DocumentoTipo:   "NF_ENTRADA",
                    DocumentoID:     nf.ID,
                    DocumentoItemID: item.ID,
                    UnidadeID:       nf.UnidadeID,
                    UsuarioID:       usuarioID,
                })

                // 6.3 Números de série
                for _, sn := range rec.Series {
                    tx.InserirNumeroSerie(NumeroSerie{
                        ProdutoID:  item.ProdutoID,
                        Serie:      sn,
                        LoteID:     loteID,
                        Situacao:   SerieEmEstoque,
                        MovimentoOrigemID: mov.ID,
                        NotaFiscalID:      nf.ID,
                        CustoAquisicao:    custoUnit,
                    })
                    // UNIQUE (produto_id, serie) é a garantia final:
                    // a validação de aplicação previne o erro comum,
                    // a constraint previne a corrida entre dois usuários.
                }
            }

            // 6.4 Custo médio ponderado
            AtualizarCustoMedio(tx, item.ProdutoID, qtdEstoque, custoUnit)

            // 6.5 Saldo do item no pedido de compra
            tx.IncrementarRecebidoPC(item.PedidoCompraItemID, item.QtdRecebida)

            // 6.6 Divergência de quantidade — pendência com o fornecedor
            if item.QtdNF != item.QtdRecebida {
                tx.InserirDivergencia(Divergencia{
                    NotaFiscalItemID: item.ID,
                    Tipo:             DivergenciaQuantidade,
                    ValorEsperado:    item.QtdNF,
                    ValorRecebido:    item.QtdRecebida,
                    Situacao:         DivergenciaAberta,
                })
            }
        }

        // ── 7. Atualizar o status do pedido de compra ──────────────────────
        AtualizarStatusPC(tx, nf.PedidoCompraID)

        // ── 8. Selar a nota ────────────────────────────────────────────────
        tx.AtualizarSituacaoNF(nf.ID, SituacaoEfetivada, usuarioID, time.Now())

        // ── 9. Auditoria ───────────────────────────────────────────────────
        tx.RegistrarAuditoria(Auditoria{
            Entidade:   "nota_fiscal_entrada",
            EntidadeID: nf.ID,
            Acao:       "EFETIVAR",
            UsuarioID:  usuarioID,
            ValorNovo:  snapshotCompleto(nf),
        })

        resultado = montarResultado(nf)
        return nil
    })

    if err != nil { return nil, err }

    // ── 10. Efeitos colaterais — SEMPRE fora da transação ──────────────────
    // Publicados após o commit. Um e-mail lento não pode segurar um lock
    // de estoque, e um erro de SMTP não pode desfazer um recebimento.
    eventos.Publicar(NotaFiscalEfetivada{NotaID: nfID})
    // consumidores: recalcular necessidade de compra, liberar OPs bloqueadas
    //               por falta de insumo, notificar comprador, indexar busca

    registrarIdempotencia(chaveIdempotencia, resultado)
    return &resultado, nil
}
```

### 1.6 Cálculo do Rateio de Frete e Impostos

```go
func CalcularRateio(nf *NotaFiscal, metodo string) Rateio {
    // Valor a ratear: encargos que compõem o custo de aquisição,
    // excluídos os impostos recuperáveis conforme o regime da empresa.
    total := nf.Frete + nf.Seguro + nf.OutrasDespesas + nf.IPINaoRecuperavel +
             nf.ICMSSTNaoRecuperavel - nf.Desconto

    if total == 0 || metodo == "NAO_RATEAR" { return RateioZero() }

    r := Rateio{}
    switch metodo {
    case "VALOR":   // padrão — proporcional ao valor de cada item
        for _, item := range nf.Itens {
            r[item.ID] = total * (item.ValorTotal / nf.ValorTotalProdutos)
        }
    case "PESO":    // usar quando o frete é dominado por itens pesados
        pesoTotal := somaPesos(nf.Itens)
        for _, item := range nf.Itens {
            r[item.ID] = total * (item.PesoTotal() / pesoTotal)
        }
    }
    // Diferença de arredondamento vai integralmente para o item de maior valor.
    ajustarArredondamento(&r, total)
    return r
}
```

> **Por que importa:** um gabinete de radar tem frete relevante em relação ao próprio preço. Ignorar o rateio subavalia o custo do PA em percentuais de dois dígitos, e o objetivo de "rastreabilidade total sobre custos" não se cumpre.

### 1.7 Atualização do Custo Médio Ponderado

```go
func AtualizarCustoMedio(tx Tx, produtoID int64, qtdEntrada, custoEntrada float64) {
    s := tx.BuscarSaldoForUpdate(produtoID)   // já bloqueado no passo 3

    // Saldo zerado ou negativo: a média histórica não tem significado.
    // Adotar o custo da entrada evita propagar distorção.
    if s.Quantidade <= 0 {
        tx.AtualizarSaldo(produtoID, s.Quantidade + qtdEntrada, custoEntrada)
        return
    }

    valorAtual   := s.Quantidade * s.CustoMedio
    valorEntrada := qtdEntrada  * custoEntrada
    novaQtd      := s.Quantidade + qtdEntrada
    novoCusto    := (valorAtual + valorEntrada) / novaQtd

    tx.AtualizarSaldo(produtoID, novaQtd, arredondar(novoCusto, param.CasasDecimaisCusto))
}
```

### 1.8 Atualização do Status do Pedido de Compra

```go
func AtualizarStatusPC(tx Tx, pcID int64) {
    itens := tx.BuscarItensPC(pcID)

    todosCompletos := true
    algumRecebido  := false

    for _, i := range itens {
        minimoAceito := i.QtdPedida * (1 - param.ToleranciaFaltaPerc/100)
        if i.QtdRecebidaAcum >= minimoAceito { /* item completo */ } else { todosCompletos = false }
        if i.QtdRecebidaAcum > 0 { algumRecebido = true }
    }

    switch {
    case todosCompletos: tx.AtualizarStatusPC(pcID, PCRecebidoTotalmente)
    case algumRecebido:  tx.AtualizarStatusPC(pcID, PCParcialmenteRecebido)
    }
    // PC com saldo pendente só vai a "Encerrado" por ação manual com motivo.
}
```

---

## FLUXO 02 — IMPORTAÇÃO DO XML DA NF-e

```
Upload do XML
     ↓
Validar estrutura contra o schema da NF-e (versão 4.00)
     ↓
Extrair cabeçalho: emitente, destinatário, chave, série, número, datas, totais
     ↓
┌─ Destinatário confere com o CNPJ da unidade? ──── não ──→ ERR_XML_001, aborta
│  Emitente confere com o fornecedor do PC? ────── não ──→ ERR_XML_002, aborta
│  Chave já lançada no sistema? ────────────────── sim ──→ ERR_NF_004, aborta
└─ Chave com DV válido? ────────────────────────── não ──→ ERR_NF_003, aborta
     ↓
Para cada <det> do XML:
     ↓
 Reconhecimento do item, em cascata:
   1. de-para produto_fornecedor (código do fornecedor)   → match direto
   2. GTIN/EAN do XML contra o GTIN do cadastro           → match direto
   3. código do produto igual ao código interno            → match provável
   4. similaridade de descrição (trigram, limiar 0.6)     → sugestão a confirmar
   5. nenhum dos anteriores                                → vinculação manual
     ↓
Itens não reconhecidos são exibidos lado a lado com os itens em aberto do PC.
Ao confirmar a vinculação, o de-para é gravado — o mesmo item nunca mais
precisa ser vinculado à mão para aquele fornecedor.
     ↓
Pré-preencher: quantidade, valor unitário, valor total, unidade, impostos
     ↓
Converter unidade do XML para a unidade de estoque (fator de conversão)
     ↓
Nota em RASCUNHO, aguardando a captura de lote/série e a conferência física
```

**O que a importação não faz:** lote, validade, número de série e quantidade física conferida **nunca** vêm do XML. Lote e série raramente constam do arquivo, e quando constam não há garantia de correspondência com o que está fisicamente na caixa. Esses dados são sempre capturados na doca.

```go
func ImportarXML(ctx context.Context, pcID int64, xml []byte) (*NotaFiscal, error) {
    nfe, err := parsearNFe(xml)
    if err != nil { return nil, ErrXMLInvalido(err) }

    pc := buscarPC(ctx, pcID)
    if nfe.Emitente.CNPJ != pc.Fornecedor.CNPJ { return nil, ErrEmitenteDivergente }
    if nfe.Destinatario.CNPJ != unidadeAtual.CNPJ { return nil, ErrDestinatarioDivergente }
    if notaJaLancada(ctx, nfe.ChaveAcesso) { return nil, ErrNotaDuplicada }

    nf := novaNotaDeXML(nfe, pc)

    for _, det := range nfe.Itens {
        prod, confianca := reconhecerProduto(ctx, det, pc.Fornecedor.ID)
        item := NotaFiscalItem{
            ProdutoID:        prod.ID,          // 0 quando não reconhecido
            ConfiancaMatch:   confianca,        // ALTA | MEDIA | MANUAL
            CodigoFornecedor: det.CProd,
            DescricaoXML:     det.XProd,
            QtdNF:            det.QCom,
            QtdRecebida:      det.QCom,         // sugestão; o físico manda
            ValorUnitario:    det.VUnCom,
            UnidadeNF:        det.UCom,
        }
        nf.Itens = append(nf.Itens, item)
    }

    nf.ArquivoXML = armazenarArquivo(xml, "application/xml")
    return salvarRascunho(ctx, nf)
}
```

---

## FLUXO 03 — ESTORNO DE NOTA FISCAL EFETIVADA

Nota efetivada é imutável. Erro se corrige por estorno, e o estorno só é possível enquanto o material permanecer intocado.

```
Solicitação de estorno (motivo obrigatório, mínimo 20 caracteres)
     ↓
Verificações de bloqueio, item a item:
     ├─ Saldo do lote ainda comporta a devolução?      não → ERR_EST_001
     ├─ Todas as séries ainda estão "Em Estoque"?      não → ERR_EST_002 (lista as séries)
     ├─ Algum item foi reservado para OP?              sim → ERR_EST_003
     ├─ Houve inventário fechado após a entrada?       sim → ERR_EST_004
     └─ Período contábil já fechado?                   sim → ERR_EST_005
     ↓
Todas passaram → transação atômica:
     ├─ Movimentos inversos (quantidade negativa), referenciando o movimento original
     ├─ Séries marcadas como ESTORNADA (nunca excluídas — o número fica queimado)
     ├─ Reversão do custo médio pelo valor de entrada original
     ├─ Decremento do recebido acumulado no PC e recálculo do status
     ├─ Situação da nota → ESTORNADA
     └─ Auditoria com motivo, usuário e snapshot
```

```go
func EstornarNotaFiscal(ctx context.Context, nfID int64, motivo string, usuarioID int64) error {
    if len(motivo) < 20 { return ErrMotivoInsuficiente }

    return db.WithTransaction(ctx, func(tx Tx) error {
        nf := tx.BuscarNotaFiscalForUpdate(nfID)
        if nf.Situacao != SituacaoEfetivada { return ErrTransicaoInvalida }

        tx.AdvisoryLock(LOCK_PEDIDO_COMPRA, nf.PedidoCompraID)
        saldos := tx.BuscarSaldosForUpdate(ordenarAsc(nf.ProdutoIDsDistintos()))

        for _, mov := range tx.BuscarMovimentosDaNota(nfID) {
            // Saldo do lote precisa comportar a saída
            if tx.SaldoLote(mov.ProdutoID, mov.LoteID) < mov.Quantidade {
                return ErrEstornoSaldoInsuficiente(mov.ProdutoID)
            }
            // Séries precisam estar todas intactas
            if s := tx.SeriesNaoEmEstoque(mov.ID); len(s) > 0 {
                return ErrEstornoSeriesConsumidas(s)
            }

            tx.InserirMovimento(MovimentoEstoque{
                Tipo:               MovEstornoEntrada,
                ProdutoID:          mov.ProdutoID,
                LoteID:             mov.LoteID,
                Quantidade:         -mov.Quantidade,        // inverso
                CustoUnitario:      mov.CustoUnitario,      // custo original, não o atual
                MovimentoOrigemID:  &mov.ID,
                DocumentoTipo:      "NF_ESTORNO",
                DocumentoID:        nfID,
                UsuarioID:          usuarioID,
            })
            tx.AtualizarSituacaoSeries(mov.ID, SerieEstornada)
            ReverterCustoMedio(tx, mov.ProdutoID, mov.Quantidade, mov.CustoUnitario)
        }

        for _, item := range nf.Itens {
            tx.DecrementarRecebidoPC(item.PedidoCompraItemID, item.QtdRecebida)
        }
        AtualizarStatusPC(tx, nf.PedidoCompraID)

        tx.AtualizarSituacaoNF(nfID, SituacaoEstornada, usuarioID, time.Now())
        tx.RegistrarAuditoria(Auditoria{
            Entidade: "nota_fiscal_entrada", EntidadeID: nfID,
            Acao: "ESTORNAR", Motivo: motivo, UsuarioID: usuarioID,
        })
        return nil
    })
}
```

> **Quando o estorno é impossível** (material já consumido em OP), a correção é feita por **ajuste de inventário** (Fluxo 07), com justificativa e aprovação. O sistema deve dizer isso ao usuário na própria mensagem de erro, e não apenas recusar a operação.

---

## FLUXO 04 — TRATAMENTO DE DIVERGÊNCIAS

```
                    Divergência registrada na efetivação
                                   ↓
              ┌────────────────────┴────────────────────┐
              ↓                                          ↓
    DIVERGÊNCIA DE QUANTIDADE                  DIVERGÊNCIA DE PREÇO
    (recebido ≠ declarado na NF)               (NF ≠ pedido de compra)
              ↓                                          ↓
    Estoque movimenta pelo FÍSICO              Estoque valoriza pela NF
    Pendência aberta com o fornecedor          Pendência aberta com o comprador
              ↓                                          ↓
    Tratativas possíveis:                      Tratativas possíveis:
    ├─ Fornecedor envia complemento            ├─ Aceitar (registra novo preço)
    │  → nova NF no mesmo PC                   ├─ Solicitar NF de ajuste
    ├─ Emitir devolução do excedente           └─ Devolver a mercadoria
    ├─ Aceitar a falta e encerrar o PC                   ↓
    └─ Recusar a mercadoria integralmente      Encerramento com responsável,
              ↓                                 data e documento comprobatório
    Encerramento com responsável e data
```

**Regra:** o estoque **sempre** reflete o físico conferido, nunca o declarado. A divergência é um problema comercial a resolver com o fornecedor; ela não pode contaminar o saldo, sob pena de a acuracidade de estoque cair já na primeira semana.

Divergências em aberto acima de N dias entram no dashboard e disparam notificação ao comprador.

---

## FLUXO 05 — RESERVA E BAIXA DE MATERIAL POR ORDEM DE PRODUÇÃO

### 5.1 Abertura da OP — Reserva

```go
func AbrirOP(ctx context.Context, op *OrdemProducao) error {
    return db.WithTransaction(ctx, func(tx Tx) error {

        bom := tx.BuscarBOMVigente(op.ProdutoID)
        op.RevisaoBOM = bom.Revisao         // CONGELA a revisão na abertura

        produtoIDs := ordenarAsc(bom.ComponentesIDs())
        tx.BuscarSaldosForUpdate(produtoIDs)

        faltantes := []Faltante{}

        for _, comp := range bom.Componentes {
            necessario := comp.Quantidade * op.Quantidade * (1 + comp.PerdaTecnicaPerc/100)
            disponivel := tx.SaldoDisponivel(comp.ProdutoID)   // saldo − reservas

            if disponivel < necessario {
                faltantes = append(faltantes, Faltante{comp.ProdutoID, necessario - disponivel})
                continue
            }

            // Seleção de lotes por FEFO ou FIFO, conforme o parâmetro do item
            lotes := tx.SelecionarLotes(comp.ProdutoID, necessario, comp.PoliticaConsumo)
            for _, l := range lotes {
                tx.InserirReserva(Reserva{
                    OPID: op.ID, ProdutoID: comp.ProdutoID,
                    LoteID: l.LoteID, Quantidade: l.Quantidade,
                    ValidaAte: time.Now().Add(param.ValidadeReserva),
                })
            }
        }

        if len(faltantes) > 0 && !param.PermitirOPSemInsumo {
            return ErrInsumosInsuficientes(faltantes)   // lista tudo que falta
        }

        op.Situacao = seVazio(faltantes, OPLiberada, OPAguardandoInsumo)
        return tx.SalvarOP(op)
    })
}
```

**Seleção FEFO (itens com validade):**

```sql
SELECT l.id, l.identificacao, l.validade, s.quantidade_disponivel
  FROM lote l
  JOIN saldo_lote s ON s.lote_id = l.id
 WHERE l.produto_id = $1
   AND s.quantidade_disponivel > 0
   AND (l.validade IS NULL OR l.validade > CURRENT_DATE + $2::interval)
 ORDER BY l.validade ASC NULLS LAST, l.criado_em ASC
   FOR UPDATE OF s;
```

### 5.2 Separação — Baixa Real

```
Almoxarife abre a Lista de Separação da OP
     ↓
Para cada componente: código, descrição, quantidade, endereço e FOTO
     ↓
Bipa o item (código de barras) → sistema confere se é o item esperado
     ├─ item errado → alerta sonoro + visual, bloqueia a confirmação
     └─ item certo  → prossegue
     ↓
Se o item controla série: bipa as séries que estão saindo fisicamente
     └─ sistema valida: série existe, está Em Estoque, é do lote reservado
     ↓
Confirma a separação → transação:
     ├─ Movimento de saída (quantidade negativa), custo médio vigente
     ├─ Séries → CONSUMIDA_EM_OP, vinculadas à OP
     ├─ Reserva consumida
     └─ Custo real da OP acrescido
```

**Backflushing (alternativa por item):** para parafusos, terminais e consumíveis de baixo valor, a baixa ocorre na conclusão da OP, proporcional à quantidade produzida, sem separação individual. A escolha entre baixa real e backflushing é do item, não do sistema — está em `4.7.5` do documento de escopo.

### 5.3 Conclusão da OP — Entrada do Produto Acabado

```go
func ConcluirOP(ctx context.Context, opID int64, qtdProduzida, qtdRefugada float64,
                seriesPA []string, usuarioID int64) error {

    return db.WithTransaction(ctx, func(tx Tx) error {
        op := tx.BuscarOPForUpdate(opID)
        if op.Situacao != OPEmTeste { return ErrTransicaoInvalida }

        // 1. Backflushing dos itens marcados
        for _, comp := range tx.ComponentesBackflush(op.RevisaoBOM) {
            consumo := comp.Quantidade * qtdProduzida
            tx.InserirMovimento(MovimentoEstoque{
                Tipo: MovSaidaOP, ProdutoID: comp.ProdutoID,
                Quantidade: -consumo, DocumentoTipo: "OP", DocumentoID: opID,
            })
        }

        // 2. Refugo — baixa com motivo, entra no custo da OP
        if qtdRefugada > 0 { registrarRefugo(tx, op, qtdRefugada) }

        // 3. Custo real da OP
        custoMaterial := tx.SomarCustoMovimentosOP(opID)
        custoMDO      := tx.SomarApontamentos(opID)      // horas × custo/hora
        custoIndireto := (custoMaterial + custoMDO) * param.OverheadPerc / 100
        custoUnitPA   := (custoMaterial + custoMDO + custoIndireto) / qtdProduzida

        // 4. Entrada do PA — origem é a OP, não uma nota fiscal (RN-001)
        mov := tx.InserirMovimento(MovimentoEstoque{
            Tipo: MovEntradaProducao, ProdutoID: op.ProdutoID,
            Quantidade: qtdProduzida, CustoUnitario: custoUnitPA,
            DocumentoTipo: "OP", DocumentoID: opID,
        })
        AtualizarCustoMedio(tx, op.ProdutoID, qtdProduzida, custoUnitPA)

        // 5. Séries do produto acabado + registro as-built
        for _, sn := range seriesPA {
            serie := tx.InserirNumeroSerie(NumeroSerie{
                ProdutoID: op.ProdutoID, Serie: sn, Situacao: SerieEmEstoque,
                OPOrigemID: &opID, MovimentoOrigemID: mov.ID, CustoAquisicao: custoUnitPA,
            })
            // Vincula as séries dos componentes críticos a esta unidade
            tx.VincularComponentesAsBuilt(serie.ID, opID)
        }

        tx.AtualizarSituacaoOP(opID, OPConcluida)
        return nil
    })
}
```

---

## FLUXO 06 — CONSULTAS DE RASTREABILIDADE

### 6.1 Do Equipamento ao Fornecedor (rastro para trás)

Entrada: número de série do radar. Pergunta típica: *"este equipamento apresentou falha; de onde veio a placa que está nele?"*

```sql
WITH RECURSIVE genealogia AS (
    -- Raiz: o equipamento
    SELECT ns.id, ns.produto_id, ns.serie, ns.lote_id, ns.op_origem_id,
           0 AS nivel, ns.serie::text AS caminho
      FROM numero_serie ns
     WHERE ns.produto_id = $1 AND ns.serie = $2

    UNION ALL

    -- Descida: componentes instalados em cada nível
    SELECT f.id, f.produto_id, f.serie, f.lote_id, f.op_origem_id,
           g.nivel + 1, g.caminho || ' → ' || f.serie
      FROM genealogia g
      JOIN as_built ab ON ab.serie_pai_id = g.id
      JOIN numero_serie f ON f.id = ab.serie_filho_id
     WHERE g.nivel < 10                      -- guarda contra ciclo em BOM mal cadastrada
)
SELECT g.nivel, g.caminho,
       p.codigo, p.descricao,
       l.identificacao AS lote, l.validade,
       nf.numero AS nota_fiscal, nf.data_entrada,
       forn.razao_social AS fornecedor
  FROM genealogia g
  JOIN produto p         ON p.id = g.produto_id
  LEFT JOIN lote l       ON l.id = g.lote_id
  LEFT JOIN numero_serie ns2 ON ns2.id = g.id
  LEFT JOIN nota_fiscal_entrada nf ON nf.id = ns2.nota_fiscal_id
  LEFT JOIN fornecedor forn ON forn.id = nf.fornecedor_id
 ORDER BY g.nivel, p.codigo;
```

### 6.2 Do Lote ao Cliente (rastro para frente — recall)

Entrada: lote defeituoso informado pelo fornecedor. Pergunta típica: *"quais equipamentos em campo têm componente deste lote e para quem foram entregues?"*

```sql
SELECT DISTINCT
       pa.serie          AS equipamento,
       prod.descricao    AS modelo,
       op.numero         AS ordem_producao,
       pv.numero         AS pedido_venda,
       cli.razao_social  AS cliente,
       pv.data_entrega,
       eq.local_instalacao
  FROM lote l
  JOIN numero_serie comp ON comp.lote_id = l.id
  JOIN as_built ab       ON ab.serie_filho_id = comp.id
  JOIN numero_serie pa   ON pa.id = ab.serie_pai_id
  JOIN produto prod      ON prod.id = pa.produto_id
  JOIN ordem_producao op ON op.id = pa.op_origem_id
  LEFT JOIN pedido_venda pv ON pv.id = op.pedido_venda_id
  LEFT JOIN cliente cli     ON cli.id = pv.cliente_id
  LEFT JOIN equipamento_instalado eq ON eq.numero_serie_id = pa.id
 WHERE l.identificacao = $1 AND l.produto_id = $2
 ORDER BY pv.data_entrega DESC;
```

> **Meta de desempenho:** ambas as consultas devem responder em menos de 2 segundos com o volume projetado. Esta é a resposta que a empresa precisa dar em uma reunião com o cliente, não em um relatório entregue no dia seguinte.

### 6.3 Do Saldo à Origem (Kardex)

```sql
SELECT m.criado_em, m.tipo, m.quantidade, m.custo_unitario,
       l.identificacao AS lote,
       CASE m.documento_tipo
            WHEN 'NF_ENTRADA' THEN 'NF ' || nf.numero || ' — ' || forn.razao_social
            WHEN 'OP'         THEN 'OP ' || op.numero
            WHEN 'AJUSTE'     THEN 'Ajuste: ' || aj.motivo
       END AS origem,
       u.nome AS usuario,
       SUM(m.quantidade) OVER (ORDER BY m.criado_em, m.id) AS saldo_acumulado
  FROM movimento_estoque m
  LEFT JOIN lote l  ON l.id = m.lote_id
  LEFT JOIN nota_fiscal_entrada nf ON nf.id = m.documento_id AND m.documento_tipo = 'NF_ENTRADA'
  LEFT JOIN fornecedor forn ON forn.id = nf.fornecedor_id
  LEFT JOIN ordem_producao op ON op.id = m.documento_id AND m.documento_tipo = 'OP'
  LEFT JOIN ajuste_inventario aj ON aj.id = m.documento_id AND m.documento_tipo = 'AJUSTE'
  JOIN usuario u ON u.id = m.usuario_id
 WHERE m.produto_id = $1 AND m.criado_em BETWEEN $2 AND $3
 ORDER BY m.criado_em, m.id;
```

---

## FLUXO 07 — AJUSTE DE INVENTÁRIO E CARGA INICIAL

### 7.1 Ajuste de Inventário

Única origem de entrada sem documento externo. Por isso, é a mais controlada.

```
Contagem física registrada (inventário rotativo ou geral)
     ↓
Sistema calcula a divergência: contado − saldo do sistema
     ↓
┌─ Divergência dentro da tolerância?  sim → ajuste automático, log simples
└─ Acima da tolerância?               sim → exige aprovação de perfil autorizado
     ↓
Aprovação registra: motivo obrigatório, responsável pela contagem, aprovador
     ↓
Transação: movimento de ajuste (positivo ou negativo) + auditoria com foto opcional
     ↓
Item entra no relatório de acuracidade e no histórico de divergências do endereço
```

Ajuste positivo de item com controle de série exige a informação das séries encontradas — caso contrário o saldo cresce sem lastro unitário e a rastreabilidade se rompe silenciosamente.

### 7.2 Carga Inicial (evento único de go-live)

```
Planilha de saldos iniciais (código, quantidade, custo, lote, validade, séries)
     ↓
Validação em modo simulação: itens inexistentes, duplicidades, formato de datas
     ↓
Relatório de conferência apresentado ANTES de qualquer gravação
     ↓
Confirmação pelo Gestor de Operações
     ↓
Movimentos do tipo SALDO_INICIAL, documento "Termo de Inventário de Abertura",
data de corte definida, aprovador registrado
     ↓
Trava permanente: SALDO_INICIAL não pode mais ser lançado após a data de corte
```

> A RN-001 (toda entrada tem documento de origem) passa a valer integralmente a partir da data de corte. O termo de abertura é a única exceção, e é uma exceção datada, aprovada e auditada.

---

## 8. CATÁLOGO DE ERROS

| Código | Mensagem ao usuário | Ação sugerida na tela |
|---|---|---|
| `ERR_NF_001` | Nota fiscal sem pedido de compra vinculado | Selecionar o pedido |
| `ERR_NF_002` | CNPJ do emitente diverge do fornecedor do pedido | Verificar se o PC é o correto |
| `ERR_NF_003` | Chave de acesso inválida | Reconferir os 44 dígitos |
| `ERR_NF_004` | Nota já lançada no sistema | Link direto para o lançamento original |
| `ERR_NF_005` | Data de entrada anterior à emissão | Corrigir a data |
| `ERR_NF_006` | Lançamento retroativo além do prazo | Solicitar liberação ao gestor |
| `ERR_NF_007` | XML obrigatório para efetivação | Anexar o XML |
| `ERR_NF_008` | Foto do recebimento obrigatória | Anexar a foto |
| `ERR_ITEM_001` | Item não consta no pedido de compra | Marcar como bonificação ou remover |
| `ERR_ITEM_002` | Quantidade excede o saldo do pedido | Ajustar a quantidade ou revisar o PC |
| `ERR_ITEM_003` | Divergência de preço acima da tolerância | Solicitar aprovação |
| `ERR_ITEM_004` | Fator de conversão não cadastrado | Link para o cadastro do produto |
| `ERR_ITEM_005` | Certificado de conformidade não anexado | Anexar o certificado |
| `ERR_LOTE_001` | Lote obrigatório para este item | Informar o lote |
| `ERR_LOTE_002` | Soma dos lotes difere da quantidade | Revisar a subdivisão |
| `ERR_VAL_001` | Validade obrigatória para o lote | Informar a validade |
| `ERR_VAL_002` | Validade remanescente abaixo do mínimo | Recusar ou solicitar liberação |
| `ERR_SERIE_001` | Contagem de séries diferente da quantidade | Contador destacado na tela |
| `ERR_SERIE_002` | Séries repetidas nesta nota | Destacar as duplicadas |
| `ERR_SERIE_003` | Séries já cadastradas no sistema | Link para o lançamento anterior |
| `ERR_SERIE_004` | Séries fora do padrão do produto | Exibir a máscara esperada |
| `ERR_EST_001` | Saldo insuficiente para estornar | Usar ajuste de inventário |
| `ERR_EST_002` | Séries já consumidas em produção | Listar séries e OPs |
| `ERR_EST_003` | Material reservado para OP | Cancelar a reserva primeiro |
| `ERR_EST_004` | Inventário fechado após a entrada | Usar ajuste de inventário |
| `ERR_EST_005` | Período contábil encerrado | Solicitar reabertura ao gestor |
| `ERR_XML_001` | Destinatário do XML não é esta empresa | Verificar o arquivo |
| `ERR_XML_002` | Emitente do XML não é o fornecedor do PC | Verificar o pedido |

**Padrão das mensagens:** toda mensagem de erro diz **o que aconteceu, em qual item e o que fazer a seguir**. Uma mensagem que apenas recusa a operação transfere ao operador o trabalho de descobrir a causa — e é o principal motivo pelo qual sistemas corretos são abandonados em favor da planilha.

---

## 9. CASOS DE TESTE DE ACEITAÇÃO

| # | Cenário | Resultado esperado |
|---|---|---|
| 01 | NF cobrindo integralmente um PC de 3 itens | PC → Recebido Totalmente; 3 movimentos; custo médio atualizado |
| 02 | Duas NFs parciais no mesmo PC | Após a 1ª: Parcialmente Recebido; após a 2ª: Recebido Totalmente |
| 03 | NF com item ausente do PC | Bloqueio `ERR_ITEM_001`, salvo marcação de bonificação |
| 04 | Quantidade 2% acima com tolerância de 5% | Aceita; saldo do PC zerado |
| 05 | Quantidade 8% acima com tolerância de 5% | Bloqueio `ERR_ITEM_002` |
| 06 | 50 unidades e 49 séries informadas | Efetivação bloqueada; contador indica 49 de 50 |
| 07 | Série já existente no histórico | Bloqueio `ERR_SERIE_003` com link para a origem |
| 08 | Item com 3 lotes na mesma linha | 3 movimentos, um por lote; soma igual à quantidade |
| 09 | Lote com validade inferior ao mínimo | `ERR_VAL_002` conforme parâmetro |
| 10 | Efetivação com duplo clique | Um único lançamento (idempotência) |
| 11 | Duas notas do mesmo PC efetivadas em paralelo | Serializadas pelo advisory lock; saldo correto |
| 12 | Estorno com material intacto | Movimentos inversos; séries → Estornada; PC recalculado |
| 13 | Estorno com material já consumido | Bloqueio `ERR_EST_002`, sugerindo ajuste de inventário |
| 14 | Rateio de frete proporcional ao valor | Soma dos rateios igual ao total, sem centavo perdido |
| 15 | Entrada em item com saldo zerado | Custo médio assume o custo da entrada |
| 16 | Conclusão de OP com 5 PAs seriados | 5 séries criadas; as-built vinculado; custo real apurado |
| 17 | Consulta de genealogia com 3 níveis | Retorno completo em menos de 2 segundos |
| 18 | Queda de conexão na digitação do item 120 de 200 | Rascunho preservado até o item 119 |
| 19 | XML com item novo do fornecedor | Vinculação manual; de-para gravado para as próximas notas |
| 20 | Tentativa de UPDATE em movimento_estoque | Rejeitada pela trigger de proteção |

---

## 10. PONTOS DE ATENÇÃO PARA A IMPLEMENTAÇÃO

1. **A validação da conferência não substitui a revalidação na efetivação.** Entre uma e outra, outra nota do mesmo pedido pode ter sido efetivada. Validar duas vezes é intencional, não redundância.
2. **Todo bloqueio em ordem crescente de `produto_id`.** Duas notas com os mesmos itens em ordens diferentes produzem deadlock em produção, e o erro só aparece sob carga.
3. **A constraint `UNIQUE (produto_id, serie)` é a garantia final.** A verificação de aplicação melhora a mensagem ao usuário; ela não previne a corrida entre dois almoxarifes.
4. **Nada de I/O externo dentro da transação.** E-mail, webhook e indexação só depois do commit.
5. **`movimento_estoque` protegido por trigger** contra `UPDATE` e `DELETE`, inclusive por engano em migração.
6. **Saldo materializado é cache.** Deve existir rotina de reconstrução a partir dos movimentos e conferência periódica automática entre o cache e a soma real.
7. **Custo médio com casas decimais suficientes.** Componentes de R$ 0,0347 exigem no mínimo 4 casas; arredondar para 2 acumula erro em milhares de unidades.
8. **Idempotência com chave gerada pelo cliente**, não pelo servidor: o retry precisa reapresentar a mesma chave.
9. **A tela de recebimento é a de maior risco de rejeição do sistema.** Deve ser prototipada e cronometrada com o almoxarife antes de qualquer linha de código de produção.

---

*Documento de Fluxos de Processo — PCP | Versão 1.2 | Agosto 2026*
*Proprietário: Gustavo Landal*