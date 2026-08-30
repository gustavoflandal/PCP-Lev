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
Task B8 (handler): complete (commit 6ed9ef2, review clean). Handler HTTP de pedidos de
compra, com /em-atraso registrada antes de /:id.
Task B5: complete (commit 6fbb2c5, review clean). Handler HTTP de cotacoes, incluindo
converter-pc (cria PedidoCompra a partir de uma Cotacao Respondida, preco travado na
cotacao). numero_pc do PC gerado por conversao tambem e digitado pelo usuario no corpo do
converter-pc -- mesmo padrao de "sem gerador automatico" do resto do sistema.
Task B9: complete (commit 3c40cb3, review clean). registrarCompras publica cotacoes e
pedidos de compra em routes.go. Backend da Sprint 3 fechado: 336/336 testes (255 anteriores
+ 81 novos), go vet e gofmt limpos. Fluxo completo verificado manualmente contra o Postgres
real via curl/node fetch (nao so testes automatizados): criar cotacao -> enviar ->
registrar-resposta (valor_total recalculado) -> converter-pc (preco negociado preservado) ->
emitir PC -> em-atraso -> cancelar PC -> reenviar cotacao ja respondida devolve 409 -- 8/8
passos.

Backend completo. Frontend (Tasks F1-F11) a seguir.

Task F1: complete (commit 24cd13e, review clean). tipos/servicos/compras.ts, espelhando
cadastros.ts mas com `status` no lugar de `filtro_ativo`.
Task F2: complete (commit 5a65000, review needed 1 fix round: pendente-acionavel so virava
botao quando aoAcionar era passado, mas a spec exige que seja sempre a etapa clicavel por
definicao -- corrigido). TrilhaEtapas, novo componente §5 do design system.
Task F3: complete (commit 5574326, review clean). useListagemCompras, compartilhado por
cotacoes e pedidos de compra (duplicacao ja visivel de antemao, ao contrario do Sprint 2).
Extra (nao numerada no plano): useFornecedoresAtivos (commit ce0e2e7, refatora
FormularioPeca para reusar) e usePartesPecasAtivas (commit da43484) -- hooks compartilhados
de selecao/resolucao de nome, precisos pelas 4 telas novas de compras.
Extra: formatarData (commit ca6d89e) para exibir AAAA-MM-DD em DD/MM/AAAA.
Task F4: complete (commit 062d00a, review clean). Lista de cotacoes.
Task F5: complete (commit 8f7459c, review clean). Formulario de nova cotacao (pagina cheia,
useFieldArray para os itens).
Task F6: complete (commit 438b3a5, review needed 1 fix round: renderizarComProvedores nao
aceitava rota inicial, impedindo testar paginas com :id -- ganhou um parametro opcional
`{rota}`; testes de toast tambem precisaram do padrao ja usado nos cadastros --
useToasts.setState({itens:[]}) no beforeEach e assercao via useToasts.getState(), nao a
regiao role=status do DOM). Detalhe da cotacao com TrilhaEtapas + acoes contextuais.
npm test 255/255 apos F6, lint e tsc limpos em cada etapa.
Task F7: complete (commit ba0961e, review clean). Lista de pedidos de compra + bloco
"Pedidos em atraso" (so aparece quando ha algum).
Task F8: complete (commit cabd312, review clean). Formulario de novo pedido de compra
(mesmo padrao de F5), aceita ?cotacao_id= opcional na URL.
Task F9: complete (commit ae7e6de, review clean). Detalhe do pedido de compra: trilha com
3 etapas (Criado -> Emitido -> Concluido), mais enxuta que a de cotacao porque as fases
intermediarias do enum nao tem acao nesta sprint (recebimento e Sprint 4).
Task F10: complete (commit 5b4d43f, review clean). Rotas em App.tsx, "Compras" vira secao
real na NavegacaoLateral, Ajuda ganha lookup por prefixo para sub-rotas com :id, Painel troca
o widget estatico de compras por dado real (GET /pedidos-compra/em-atraso).
Task F11 (verificacao final): complete. npm test 275/275, lint e build limpos (tsc -b +
vite build). Fluxo completo via Playwright real contra o app rodando (nao so testes
unitarios): criar cotacao -> enviar -> registrar resposta -> converter em PC -> emitir PC ->
cancelar PC -- 14/14 passos, incluindo checagem de grayscale (achromatopsia via CDP) na
trilha de etapas e responsividade 800px nas duas listas novas. Nenhum bug de navegador
encontrado desta vez (as licoes do Sprint 2 -- noValidate, foco do Modal -- ja valiam para
os componentes reusados aqui).
Passo "tirar um acessorio" (commit 0d98651): "Observações" nos dois formularios de criacao
era escrito mas nunca lido de volta em nenhuma tela de detalhe -- removido dos dois.
"Condição de pagamento" tinha o mesmo problema mas e dado relevante pra decisao (prazo de
pagamento); em vez de remover, completado o ciclo -- agora aparece no detalhe do PC.

Task 20 (screenshots, manual, entrega): capturas 16 a 23 em docs/screenshots/ (Painel com
indicador real, lista/novo/detalhe de Cotacoes em dois estados -- Rascunho e Respondida --
lista/novo/detalhe de Pedidos de Compra com o bloco de atraso visivel), com dados de exemplo
limpos (COT-2026-010/011, PC-2026-020) via API, e um PC com entrega empurrada para o passado
via SQL direto (a API sempre usa a data de hoje para data_pedido, entao nao da pra criar um
atrasado so pela API). docs/8_MANUAL_OPERACAO.md ganhou as secoes 7 (Cotacoes) e 8 (Pedidos
de compra), indice e FAQ atualizados, Ajuda/Paginel renumerados para 9/10.

Sprint 3 completa: backend (336 testes) + frontend (275 testes) verdes, verificacao de
navegador real feita duas vezes (fluxo funcional + fluxo apos o corte de acessorio),
documentacao e capturas de tela entregues.

## Pos-entrega: CI quebrada (achado durante checagem autonoma)

A CI do backend (GitHub Actions) falhava de forma consistente desde antes desta sprint --
mesmo padrao de falha (3 pacotes travando 10min ate timeout) numa execucao na main de
26/08, ou seja, pre-existente ao trabalho desta sessao. Diagnosticado e corrigido:

1. **Deadlock em `TestAplicarSuportaDuasInstanciasSubindoAoMesmoTempo`**: `db.Aplicar`
   segura uma conexao do pool durante todo o lock de migracao E precisa de uma segunda
   conexao do MESMO pool para aplicar cada migration. O teste sobe 4 goroutines chamando
   Aplicar ao mesmo tempo, mas `testsupport.PoolLimpo` nunca fixava `MaxConns` -- o pgxpool
   usa por padrao um tamanho proporcional a `runtime.NumCPU()`, pequeno demais nos runners
   de CI (poucos nucleos). Pool esgotado -> quem venceu a corrida pelo lock fica preso
   esperando uma segunda conexao que nunca sobra -> ninguem libera o lock -> timeout de
   10min. Corrigido fixando `MaxConns=20` no pool de teste (commit 008031b em
   feat/telas-de-cadastro, mesclado em af934e3 nesta branch).
2. **`TestConectarAbrePoolValido`/`TestConectarFalhaComBancoInexistente` com porta
   hardcoded**: usavam `localhost:5442` (porta local deste repo via docker-compose) em vez
   de respeitar `PCP_TEST_DSN` (porta 5432 no servico Postgres do workflow de CI) --
   corrigido derivando a config de `testsupport.DSNTeste()`.

Aplicado primeiro em feat/telas-de-cadastro (PR #1, a causa e anterior a ambas as PRs) e
depois mesclado em feat/sprint3-cotacoes-pedidos-compra (PR #2) para que a CI desta tambem
passe. Nao foi possivel rodar `-race` localmente (sem toolchain de cgo nesta maquina) --
verificado sem -race (255/255 em #1, 336/336 em #2) e por analise do mecanismo exato de
deadlock a partir dos logs de execucao reais da CI. Aguardando a CI confirmar em ambas as
PRs.

---

# Ledger — Sprint 4: Recebimento e Estoque (feat/sprint4-recebimento-estoque)

Plano: docs/superpowers/plans/2026-08-30-sprint4-recebimento-estoque.md
Spec: docs/superpowers/specs/2026-08-30-sprint4-estoque-recebimento-design.md
Decisoes de pre-voo:
- Branch empilhada sobre feat/sprint3-cotacoes-pedidos-compra (PR #2 ainda aberta).
- Escopo EXCLUI relatorio de estoque/movimentacoes em PDF/CSV (Sprint 5, mesma
  infraestrutura de exportacao de compras/producao), reserva/bloqueio de estoque por OP e
  entrada de PA por conclusao de OP (Sprint 6, dependem de Ordem de Producao que nao existe
  ainda), geracao automatica de necessidade de compra (Sprint 5, precisa de OPs+BOM).
- Descoberta: peca_repo.go.Criar ja grava a linha de saldo_estoque zerada/CRITICO na mesma
  transacao da peca desde o Sprint 2 -- nenhuma migration ou codigo novo precisou disso.
- Emitir um PC vai direto para "Aguardando Entrega" (nao mais "Emitido") -- nao ha, em
  nenhum requisito, um passo de "confirmar aceite do fornecedor".
- Duplicacao deliberada confirmada com o usuario (pre-flight do subagent-driven-development):
  estoque.SituacaoDoSaldo duplica peca.PartePeca.SituacaoDoSaldo (RN5), e useListagemEstoque
  duplica a forma de useListagemCompras -- em ambos os casos, mantidos como o plano manda,
  para nao acoplar os pacotes de dominio/hooks por uma coincidencia de formato.

Base do branch: 4dfa866 (topo de feat/sprint3-cotacoes-pedidos-compra na hora da criacao)

## Progresso

Task B1: complete (commits 3263648..01baacb, review clean -- so achados Minor ja
conhecidos: duplicacao de SituacaoDoSaldo com peca.go, aprovada previamente com o usuario).
Dominio estoque: Saldo, Movimentacao, AjusteDados, constantes de status/tipo/motivo,
Validar/Normalizar. 8/8 testes.
Task B2: complete (commits 95f6a53..ccbc3e7, review encontrou 2 Important reais na
primeira rodada -- bug do proprio plano, nao do implementador: ListarMovimentacoes
reusava filtrosDeCadastro, o que deixaria WHERE ativo=$1 ambiguo assim que o LEFT JOIN
usuarios entrasse (partes_pecas e usuarios tem coluna ativo); e Scan de Movimentacao
duplicado em 2 call sites sem o helper que Saldo ja tinha. Corrigido: ListarMovimentacoes
passa a listar sem filtro nesta sprint (nenhuma rota ainda envia data/motivo/parte_peca_id),
e escanearMovimentacao extraido mirror de escanearSaldo. Reaprovado limpo). estoque.Servico +
EstoqueRepositorio: AplicarMovimento com FOR UPDATE, Ajustar, ListarSaldo/Criticos/
Movimentacoes. 10/10 testes (2 servico + 8 repositorio).
Task B3: complete (commits fefc9a6..b8eb2fb, review clean). Handler HTTP de estoque:
GET /estoque, GET /estoque/:parte_peca_id, GET /estoque/criticos (registrada antes de
:parte_peca_id), POST /estoque/ajuste (Admin/Gestor), GET /movimentacoes,
GET /movimentacoes/:id. errosEstoque mapeia as 7 sentinelas do dominio. 8/8 testes novos
(98/98 no pacote handlers).
Task B4: complete (commits 9d58a3b..75aa0db, review clean). Emitir vai direto para
Aguardando Entrega; NovoServico(repo, estoqueServico) muda assinatura (4 chamadas
atualizadas: routes.go, cotacoes_test.go, pedidos_compra_test.go, servico_test.go);
RegistrarRecebimento (servico+repositorio) soma quantidade_recebida cumulativo com FOR
UPDATE, fecha o PC (Concluido + data_entrega_real via tempo.Hoje()) ou deixa Recebido
Parcial, aciona estoque.AplicarMovimento depois do PC commitado (no essa ordem, nao ao
contrario -- ver risco documentado no plano). Consequencia mecanica corrigida: 3 testes
pre-existentes que checavam o status "Emitido" literal passaram a checar "Aguardando
Entrega". Achados Minor da revisao (nao bloqueiam, registrados para referencia futura):
reuso de ErrFornecedorOuPecaInexistente para "item nao pertence a este PC" (decisao do
proprio brief); ordem de lock por item segue a ordem do slice recebido -- risco teorico
de deadlock com chamadas concorrentes que informem itens em ordens diferentes, sem teste
de concorrencia (nao exigido pelo brief); reenvio de recebimento parcial com multiplos
itens, se um item no meio do laco de estoque falhar, poderia contaritens ja recebidos
de novo se o operador reenviar a lista inteira em vez de so o que faltou. Suite completa
do backend (go build/vet/test ./...) verde. routes.go recebeu uma instancia local de
estoque.Servico so para compilar -- Task B6 deve compartilhar a mesma instancia, nao
duplicar.
Task B5: complete (commits ec8821d..a499669, review clean). Rota POST
/pedidos-compra/:id/registrar-recebimento (Admin/Gestor), errosPedidoCompra ganha
ErrQuantidadeRecebidaExcedeSolicitada->400. 4/4 testes novos (93/93 no pacote handlers).
Ajuste fora do brief: fixture criarFornecedorEPecaDeApoio (compartilhado com
cotacoes_test.go) ganhou INSERT em saldo_estoque -- sem isso o teste de recebimento dava
500 (fixture antigo pulava a abertura de saldo que peca.Servico.Criar faz em producao).
Achado Minor para a revisao final da branch triar: esse INSERT grava status='OK' a mao,
inconsistente com a RN5 (saldo 0 <= estoque_minimo 0 deveria nascer CRITICO, como o
fixture irmao criarPecaDeApoio em estoque_test.go ja faz corretamente) -- inocuo hoje
porque AplicarMovimento recalcula o status na primeira movimentacao e nenhum teste le o
status antes disso, mas vale alinhar os dois fixtures.
Task B6: complete (commits 6a926f6..253829c, review clean -- so achado Menor cosmetico
de comentario). registrarEstoque(v1, dep, autenticacao) monta o estoque.Servico, registra
/estoque e /movimentacoes, e devolve o servico; registrarCompras passa a receber esse
servico por parametro em vez de montar o proprio (consolida o que a Task B4 tinha criado
so para compilar -- agora e uma unica instancia por boot). go build/vet/gofmt/test ./...
limpos: 371 testes em 21 pacotes. Fluxo manual de 15 passos contra Postgres real
confirmado ponta a ponta (peca -> estoque critico -> cotacao -> enviar -> resposta ->
converter-pc -> emitir -> Aguardando Entrega -> recebimento parcial -> Recebido Parcial ->
recebimento total -> Concluido + data_entrega_real -> saldo somado -> ajuste negativo
demais -> 409).

Backend da Sprint 4 fechado (Tasks B1-B6). Frontend (Tasks F1-F6) a seguir.

