# Fase 2.3 — Clientes e Centros de Trabalho

Data: 24/10/2026 · Branch: `feat/clientes-centros` (empilhado sobre `feat/usuarios`) ·
Decidida de forma autônoma (decisão do usuário de 24/10/2026), registrada no ledger.

## 1. Por que agora

O `0_SUMARIO_EXECUTIVO.md` §4.1 lista os dois cadastros. A Fase 3 (Produção) depende deles:
o Pedido de Venda precisa de um Cliente (hoje `pedidos_venda.cliente_nome` é texto livre) e
a Ordem de Produção/Kanban roda sobre Centros de Trabalho por etapa.

## 2. Escopo

Dois CRUDs no molde de Fornecedores (lista com busca/situação/ordenação/paginação, modal de
cadastro/edição, inativação lógica), com as permissões do RBAC desde o início.

### Clientes

| Campo | Regra |
|---|---|
| `tipo` | `ORGAO_PUBLICO`, `CONCESSIONARIA`, `INTEGRADOR`, `OUTRO` (obrigatório) |
| `razao_social` | obrigatório, até 255 |
| `nome_fantasia` | opcional, até 255 |
| `cnpj` | obrigatório, válido (mesma validação de Fornecedores), único |
| `inscricao_estadual` | opcional, até 30 |
| `contato_nome`, `contato_email`, `contato_telefone` | opcionais; e-mail e telefone validados como em Fornecedores |
| `endereco`, `cidade`, `uf` | opcionais; UF entre as 27 siglas |
| `numero_contrato` | opcional, até 60 (contratos públicos: nº do contrato/ata) |
| `vigencia_inicio`, `vigencia_fim` | opcionais; fim ≥ início |
| `condicao_pagamento` | opcional, até 50 |
| `observacoes` | opcional, até 1000 |

A lista mostra o selo **Contrato vencido** quando `vigencia_fim` < hoje (apenas um aviso).

### Centros de Trabalho / Bancadas

| Campo | Regra |
|---|---|
| `codigo` | obrigatório, `[A-Z0-9_-]{2,20}`, único, imutável |
| `nome` | obrigatório, até 100 |
| `etapa` | `SEPARACAO`, `MONTAGEM`, `TESTES`, `EXPEDICAO` — as etapas fixas do Kanban (RN3) |
| `capacidade_horas_dia` | opcional, 0 < x ≤ 24 (uma casa decimal) |
| `descricao` | opcional, até 255 |

Filtro extra por etapa na lista.

## 3. Permissões (migration 016)

`clientes.visualizar|incluir|editar|inativar` e `centros_trabalho.visualizar|incluir|editar|inativar`.
Matriz inicial: ADMIN (tudo, por regra); GESTOR tudo; VENDAS clientes completo + ver centros;
OPERADOR, QUALIDADE ver centros; CONSULTA ver os dois. COMPRADOR e ALMOXARIFE, nada novo.

## 4. Fora do escopo (vai com a Fase 3)

- Ligar `pedidos_venda` a `clientes` (FK) — a tela de Pedidos de Venda nasce na Fase 3.
- Centro de trabalho padrão do usuário (§4.7.3) e unidades/filiais.
- Inativar cliente com pedido de venda em aberto: a regra entra junto com a FK.
