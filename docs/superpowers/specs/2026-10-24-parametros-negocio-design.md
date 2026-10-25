# Parâmetros de Negócio (Estoque e Compras) — Design (Fase 4, sub-entrega 4)

Referência: `docs/0_SUMARIO_EXECUTIVO.md` §4.7.5 e `docs/6_CRONOGRAMA_TECNICO.md` (Fase 4,
item 6 — "só Estoque e Compras"). Spec decidida de forma autônoma (decisão do usuário
de 24/10/2026); decisões provisórias marcadas.

## 1. Princípio

Só entra parâmetro que o sistema **aplica** hoje, ou que tem consumidor certo e já
agendado (método de custeio → Fase 3, item 5.1.D). Parâmetro gravado sem efeito vira
promessa falsa na tela.

## 2. Parâmetros

Singleton `configuracao_negocio` (mesmo molde de `configuracao_regional`): leitura por
qualquer usuário autenticado (os formulários de cadastro precisam do lead time padrão),
escrita só Administrador.

| Campo | Padrão | Onde é aplicado |
|---|---|---|
| `metodo_custeio` (`CMP` / `PEPS` / `UPC`) | `CMP` | Gravado agora; o cálculo de custo nasce na Fase 3 (5.1.D). A tela diz isso. |
| `tolerancia_excesso_recebimento_pct` (0–100, 2 casas) | 0 | Registrar recebimento de PC: o acumulado recebido por item pode ir até `solicitada × (1 + pct/100)`, arredondado para baixo. Hoje o limite é fixo em 0%. |
| `lead_time_padrao_dias` (1–365) | 7 | Valor inicial do lead time nos formulários **novos** de Fornecedor e Parte/Peça (substitui o `7` fixo no código). |
| `limite_emissao_gestor` (valor ≥ 0, ou nulo = sem limite) | nulo | Emitir PC: Gestor emite até esse valor total; acima, só Administrador. |
| `cotacoes_minimas` (0–10) | 0 (desliga) | Emitir PC com valor total ≥ `valor_exige_cotacoes`: cada peça do pedido precisa de cotação **Respondida** de ao menos N **fornecedores distintos**, com `data_emissao` nos últimos 90 dias (e não no futuro). |
| `valor_exige_cotacoes` (valor ≥ 0) | 0 | Gatilho da regra acima. |

**Saldo negativo**: não é parâmetro. O banco tem `CHECK (quantidade_atual >= 0)` desde a
migration 002 e o §4.7.5 recomenda bloquear; a tela mostra "Bloqueado" como informação
fixa.

## 3. Decisões provisórias

- **Alçada** como um único limite para o Gestor (os perfis de hoje são só
  Admin/Gestor/Operador, e Operador não emite PC). A Fase 2.2 (RBAC) converte em faixas
  de valor por perfil/permissão "Aprovar PC".
- **Janela de 90 dias** das cotações válidas, fixa (constante documentada). Vira
  parâmetro se o Gestor pedir.
- Contam **fornecedores distintos** por peça (revisão de código: três cotações do mesmo
  fornecedor não comparam preço nenhum), com status `Respondida` e `data_emissao` entre
  hoje−90 e hoje. Cotação cancelada, só enviada ou com data de emissão futura não conta.
- Tolerância aplicada sobre a **quantidade solicitada** de cada item (o §4.7.5 fala em
  "saldo do PC"; sobre o solicitado é a leitura usual em ERP e não muda entre
  recebimentos parciais).
- Fora: numeração automática de documentos (decisão de stakeholder pendente), estoque
  mínimo/ponto de pedido padrão, FIFO/FEFO, validade de reserva, antecedência mínima
  (dependem de OP/MRP — Fase 3), demais itens de Recebimento Fiscal (não existe NF-e).

## 4. Contrato

`GET /api/v1/configuracoes/negocio` (autenticado) e `PUT` (Administrador), corpo inteiro:

```json
{
  "metodo_custeio": "CMP",
  "tolerancia_excesso_recebimento_pct": 5.00,
  "lead_time_padrao_dias": 7,
  "limite_emissao_gestor": 10000.00,
  "cotacoes_minimas": 3,
  "valor_exige_cotacoes": 5000.00,
  "updated_at": "...", "updated_by": "admin"
}
```

Valores monetários e a tolerância saem como **número JSON** com duas casas (`dinheiro.Dinheiro`);
o backend aceita número ou texto, com no máximo duas casas e até 9.999.999.999,99.
**Risco aceito**: num PUT parcial, campo omitido ou `null` (exceto `limite_emissao_gestor`)
vira zero — o contrato é "configuração inteira", e o frontend sempre envia tudo. Erros novos de emissão de PC: `403 ACESSO_NEGADO` "valor
acima da alçada do Gestor — a emissão precisa de um Administrador";
`409 CONFLITO` "cotações insuficientes: P-001 (1 de 3), ...".

## 5. Plano (uma task = um commit)

- **B1** Migration 012 + domínio `negocio` (tipos, validação, serviço) + repositório.
- **B2** Handler + rotas.
- **B3** Recebimento com tolerância (repositório de PC recebe o limite calculado).
- **B4** Emissão com alçada e mínimo de cotações.
- **F1** Tipos/serviço + tela "Parâmetros de negócio" + rota/nav/ajuda.
- **F2** Lead time padrão nos formulários novos de Fornecedor e Parte/Peça.
- **F3** Verificação final (suítes, code-reviewer, Playwright, screenshot, manual, ledger).
