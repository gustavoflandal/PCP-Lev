# Ledger — telas de cadastro (feat/telas-de-cadastro)

Plano: docs/superpowers/plans/2026-08-29-telas-de-cadastro.md
Decisoes de pre-voo: branch propria + PR; Task 15b extrai useCadastroCrud para
evitar a triplicacao da maquina de estado nas tarefas 16 e 17.

Base do branch: ee353eb5eb0a42a976d1b9e94d3b7d504ac5ec70

## Progresso

Task 1: complete (commits 576fb0e..7c33c26, review clean)
Task 2: complete (commits 7c33c26..1c55af5, review clean)
Task 3: complete (commits 1c55af5..1dd0211, review clean)
Task 4: complete (commits 1dd0211..c0ba4db, review needed 1 fix round: undocumented testid decision, resolved)
Task 5: complete (commits c0ba4db..9427241, review needed 1 fix round: dependency range mismatch ^1.1.23 vs brief's ^1.1.4, resolved)
Task 6: complete (commits 9427241..9d555c7, review clean)
Task 7: complete (commits 9d555c7..44ae9ae, review needed 1 fix round: lint warning react-refresh/only-export-components, resolved with scoped eslint-disable)
Task 8: complete (commits 44ae9ae..010f1a3, review clean)
Task 9: complete (commits 010f1a3..ab4f12e, review clean)
Task 10: complete (commits ab4f12e..5c2ee11, review clean)
Task 11: complete (commits 5c2ee11..03db4cb, review clean)
Task 12: complete (commits 03db4cb..6e39f6d, review clean)
Task 13: complete (commits 6e39f6d..11601b0, review clean; App.tsx routes deferred to Tasks 15-17 per controller instruction; plan bug found: sr-only span broke accessible-name match, removed)
Task 14: complete (commits 11601b0..2051d86, review clean)
Task 15: complete (commits 2051d86..316b8b3, review clean; reference screen for Tasks 16-17)
Task 15b: complete (commits 316b8b3..2263234, review clean; advisory carried forward to Tasks 16/17: useCadastroCrud.salvar takes `unknown`, tsc won't catch a form wired to the wrong crud instance -- verify by hand)
Task 16: complete (commits 2263234..bbe32f7, review clean; useCadastroCrud wiring risk verified by hand, holds)
Task 17: complete (commits bbe32f7..7f6b56a, review clean; two verified test adaptations: NBSP normalizer mismatch fixed with plain-space matcher, userEvent.clear() added before typing over pre-filled numeric defaults)
Task 18: complete (commits 7f6b56a..639a43c, review needed 1 fix round: 3 bugs so visiveis num
navegador de verdade, resolvidos). npm test 197/197, lint limpo, build limpo. Ambiente subido
(postgres via docker compose, backend `go run`, frontend `npm run dev`) e as tres telas
exercitadas de ponta a ponta via Playwright real (nao API direta): criar, duplicata 409, campo
obrigatorio, busca, ordenacao, editar, inativar, filtro Todos, CNPJ pontuado na lista -- 16/16
passos. Checagem do §8.4 tambem via Playwright: escala de cinza (CDP achromatopsia, badges
seguem legiveis por icone+texto), so teclado (Tab ate a acao, abrir/preencher/salvar/fechar o
modal), 1280px e 800px sem rolagem horizontal -- 8/8 apos corrigir:
  1. `required` nativo no `<input>`/`<select>` disparava o popup do proprio navegador (em
     ingles) antes do zod rodar, escondendo a mensagem em portugues do design system. Corrigido
     com `noValidate` nos 3 `<form>`.
  2. Radix focava o botao Fechar (X) ao abrir o modal, nao o primeiro campo -- digitar rapido
     (com espaco) fechava o modal sem querer. Corrigido com `onOpenAutoFocus` no `Modal`
     focando o primeiro elemento do corpo.
  3. Foco nao voltava ao gatilho ao fechar (Modal e controlado por estado externo, sem
     `Dialog.Trigger`, e o retorno automatico do Radix nao pegava). Corrigido guardando o
     `activeElement` na abertura e restaurando via `onCloseAutoFocus`.
Passo 4.3 tambem revelou `<main class="flex-1">` sem `min-w-0` no Shell: o conteudo nao
encolhia a 800px e a pagina toda rolava na horizontal (a tabela tem `overflow-x-auto` proprio,
mas o pai nunca deixava o espaco faltar). Corrigido com `min-w-0` no `<main>`.
Passo 5 (tirar um acessorio): o seletor "Situacao" no formulario so tem uma serventia real --
reativar um registro inativo ao editar. Ao criar, o registro sempre nasce ativo e o campo so
adicionava uma decisao sem sentido (e mais um Tab no fluxo por teclado). Escondido nos 3
formularios quando `!inicial`; reativacao via edicao verificada por script (Situacao some ao
criar, aparece ao editar, reativar Inativo->Ativo funciona).
Branch enviada e PR aberto: https://github.com/gustavoflandal/PCP-Lev/pull/1 (main <- feat/telas-de-cadastro).

Task 19 (fora do plano original, pedido do usuario apos a Task 18): complete (commits
639a43c..554335c, review clean). Componente `Ajuda` novo (TDD, 9 testes): botao de ajuda
contextual no cabecalho, presente em todas as telas inclusive o login, conteudo calculado pela
rota atual. 15 capturas de tela em `docs/screenshots/` (login, painel, os 3 cadastros com lista
e formularios/dialogos) tiradas via Playwright contra o app real, com dados de exemplo do
dominio (radar de transito, paineis eletronicos) no lugar do lixo de teste anterior. Manual de
operacao `docs/8_MANUAL_OPERACAO.md` criado e indexado em `docs/README.md`. npm test 206/206,
lint limpo, build limpo. Push feito para a mesma branch/PR #1.

---

# Ledger — Sprint 3: Cotações e Pedidos de Compra (feat/sprint3-cotacoes-pedidos-compra)

Plano: docs/superpowers/plans/2026-08-30-sprint3-cotacoes-pedidos-compra.md
Decisoes de pre-voo:
- Branch empilhada sobre feat/telas-de-cadastro (PR #1 ainda aberto; reusa Tabela/Modal/
  Badge/BarraDeFiltros de la). PR desta sprint aponta base para feat/telas-de-cadastro, nao main.
- Escopo EXCLUI registrar-recebimento (precisa de Estoque, Sprint 4) e necessidade-compra/gerar
  (precisa de OPs, Sprint 5/6). GET /pedidos-compra/em-atraso ENTRA (so depende de data+status).
- Descoberta: as tabelas cotacoes/itens_cotacao/pedidos_compra/itens_pedido_compra ja existem
  migradas (003_criar_tabelas_compras.sql) -- sem migration nova para o CRUD basico.
- numero_cotacao/numero_pc sao digitados pelo usuario (sem gerador automatico), mesmo padrao
  de codigo de peca/produto.

Base do branch: 554335c (topo de feat/telas-de-cadastro na hora da criacao)

## Progresso

Task B0: complete (commit d8ad638, review clean). platform/tempo.Data, espelhando
dinheiro.Dinheiro, para colunas DATE (JSON como "AAAA-MM-DD", nao RFC3339).
Task B1: complete (commit 7a20e01, review clean). Dominio cotacao: modelo e validacao.
Task B2+B3: complete (commit bf0764b, review clean; feitas juntas porque servico_test.go so
compila com o repositorio existindo -- ver nota abaixo). consulta.AnalisarComStatus (aditivo,
nao muda Analisar) + cotacao.Servico (criar/atualizar/enviar/registrar-resposta/cancelar).
Task B4: complete (commit 8796833, review needed 1 fix round: SQLSTATE 42P08 -- reusar o
mesmo parametro numa atribuicao e numa expressao aritmetica exigiu cast explicito $1::numeric
em RegistrarResposta, resolvido). Repositorio de cotacoes, transacional (header+itens).
Task B6: complete (commit 5862cd6, review clean). Dominio pedidocompra: modelo e validacao.
Task B7+B8: complete (commit 41c4f15, review needed 1 fix round: fixture de teste de EmAtraso
comparava CURRENT_DATE-5 com uma data_pedido fixa no fixture, quebrando o CHECK
chk_pc_data_entrega dependendo do dia real em que o teste roda -- corrigido empurrando
data_pedido tambem para o passado no fixture). Servico + repositorio de pedidos de compra.

Nota de ordem: o plano previa B1->B2->B4->B5 sequenciais, mas servico_test.go (B2) so
compila com o repositorio (B4) ja existindo -- neste codebase os testes de servico de
dominio rodam contra Postgres real via testsupport.BancoMigrado, sem interface mock. Path
real seguido: B0, B1, (B2+B3+B4 implementados juntos, testados juntos), B6, (B7+B8 juntos).
go test ./... 255+70 = todos verdes apos cada etapa, gofmt/go vet limpos.

