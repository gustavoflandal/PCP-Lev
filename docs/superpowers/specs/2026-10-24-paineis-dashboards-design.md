# Painéis (dashboards) — design

Data: 24/10/2026. Pedido do usuário: "incluir gráficos importantes (dashboard) no painel para visualização dos processos" e "painéis para cada setor, com possibilidade de atribuir poderes de visualização aos usuários".

Base na especificação existente:
- RF6.1, os widgets do Painel;
- "Dashboard PC" e "Dashboard Pedidos";
- o item O do sumário executivo: OTIF, lead time real e giro.

## Decisões do usuário

1. **Painéis:**
   - **Painel inicial** (geral), refeito;
   - **Compras**;
   - **Recebimento e estoque**;
   - **Produção**;
   - **Vendas e expedição**;
   - **Qualidade**.
2. **Permissão própria por painel**, na matriz de perfis e concedível ou retirável por usuário (mecanismo de permissões individuais já existente). Valores de custo continuam exigindo `producao.custos`.
3. **Atualização automática com modo TV**, intervalo configurável.

## Permissões (migration 022)

| Código | Painel | Perfis com acesso por padrão |
|---|---|---|
| `paineis.compras` | Compras | Gestor, Comprador, Consulta |
| `paineis.estoque` | Recebimento e estoque | Gestor, Comprador, Almoxarife, Consulta |
| `paineis.producao` | Produção | Gestor, Operador, Qualidade, Consulta |
| `paineis.vendas` | Vendas e expedição | Gestor, Vendas, Consulta |
| `paineis.qualidade` | Qualidade | Gestor, Qualidade, Consulta |

O ADMIN tem todas. O Painel inicial não tem permissão própria: cada cartão aparece conforme a permissão de visualizar o módulo correspondente, como já acontece hoje.

## Dados (API)

`GET /api/v1/paineis/<setor>?dias=30|90|180|365` (padrão 90). Cada rota exige a sua permissão e devolve uma estrutura fechada de indicadores e séries, já agregada no banco. O frontend não soma nada.

`GET /api/v1/paineis/inicio` devolve só os blocos que o usuário pode ver, cada um conforme a permissão do módulo.

| Painel | Indicadores (números) | Gráficos |
|---|---|---|
| **Início** | OPs em atraso; PCs a receber e em atraso; insumos críticos; notas aguardando efetivação; lotes vencendo em 30 dias; metrologia vencendo em 30 dias; pedidos de venda em produção, prontos e entregues hoje. | OPs por etapa (barras). |
| **Compras** | PCs em aberto (quantidade e valor); PCs em atraso; lead time real médio (pedido → última nota); recebido no prazo (%). | PCs por situação; comprado por mês (valor emitido); atrasos por fornecedor (top 8); lead time por fornecedor (top 8). |
| **Recebimento e estoque** | Valor em estoque (CMP, exige `producao.custos`); itens críticos; notas pendentes (rascunho e conferida); lotes vencidos e a vencer. | Entradas por mês (valor efetivado); notas por situação; lotes por faixa de vencimento (vencidos, 30, 60 e 90 dias); top 10 itens por valor em estoque (exige custos). |
| **Produção** | OPs abertas, liberadas e concluídas no período; OPs em atraso; lead time médio (liberação → conclusão); horas apontadas. | OPs por etapa; concluídas por semana; horas por centro de trabalho; atraso por produto (top 8). |
| **Vendas e expedição** | Carteira (valor dos pedidos não entregues); pedidos em atraso; entregue no período (valor); entregas no prazo (OTD %). | Pedidos por situação; entregue por mês (valor); OTD por mês; principais clientes por valor (top 8). |
| **Qualidade** | Unidades testadas, aprovadas e reprovadas no período; taxa de aprovação; metrologia vencida e a vencer. | Aprovação por semana (%); reprovações por produto (top 8); metrologia por faixa de vencimento. |

**Período:** os indicadores de "agora" (abertos, em atraso, críticos, a vencer) ignoram o período. Os de fluxo (comprado, entregue, concluído, testado, lead time) usam os últimos N dias. As séries mensais cobrem o período, com no mínimo 6 meses.

## Frontend

- **Gráficos:** biblioteca `recharts`. É SVG, compatível com a CSP atual, que já permite estilos inline.
- **Cores:** tokens do sistema. A marca é usada para séries comuns. As cores de estado só aparecem com significado (concluído, atraso, bloqueio), e sempre com rótulo.
- **Menu:** grupo "Painéis" com os painéis que o usuário pode ver. O Painel inicial ganha os cartões novos e o gráfico de OPs por etapa.
- **Cabeçalho de cada painel:** período (30, 90, 180 ou 365 dias), atualização (Desligada, 30 s, 1, 2, 5 ou 10 min, padrão 1 min) e **Modo TV**.
  - O intervalo e o modo TV ficam no endereço (`?atualizar=60&tv=1`), então a TV abre direto pelo favorito, sem armazenamento local.
  - Mostra "Atualizado às HH:MM:SS".
- **Modo TV:**
  - tela cheia (Fullscreen API), sem menu lateral nem cabeçalho;
  - fonte maior;
  - a sessão não cai por inatividade enquanto o modo estiver ativo e a tela estiver em primeiro plano.
- **Estados de cada cartão e gráfico:**
  - carregando (skeleton);
  - vazio (frase do que falta);
  - erro (mensagem e botão Tentar de novo);
  - sem permissão (o cartão não aparece).
- **Acessibilidade:**
  - cada gráfico tem título;
  - uma tabela equivalente ("Ver dados") para leitor de tela e para conferência;
  - os números ficam em `tabular-nums`.

## Testes

- **Backend:** agregações sobre dados semeados, com números conferidos à mão; permissões (403 sem a do painel); custo oculto sem `producao.custos`.
- **Frontend:** componentes de gráfico (estados e tabela equivalente), menu conforme a permissão, controles de período, atualização e modo TV.
- **E2E:** um roteiro para os painéis, cobrindo o perfil Comprador (vê Compras e não vê Produção), a concessão individual de um painel e o modo TV.
- **Screenshots:** de cada painel; manual com seção nova.
