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

Task F1: complete (commits a7e9f5b..69115f1, review clean). tipos/estoque.ts +
servicos/estoque.ts (mirror de compras.ts): listarEstoque/obterEstoque/
listarEstoqueCriticos/ajustarEstoque/listarMovimentacoes. 7/7 testes.
Task F2: complete (commits b5b50f4..0c3ae6c, review clean). useListagemEstoque: mesma
forma de useListagemCompras, sem busca/debounce (decisao deliberada, ja aprovada -- sem
acoplar estoque a compras por coincidencia de formato). 6/6 testes.
Task F3: complete (commits eda859e..9b32122, review clean). Tela /estoque (sem rota ainda
-- isso e a Task F5): lista com filtro de situacao, badge por status, modal de ajuste
manual com noValidate desde o primeiro commit, erro 409 mantem o modal aberto. Desvio
necessario do teste do brief: 4 linhas de getByLabelText('Quantidade'/'Motivo') (string
exata) trocadas para regex, porque Campo com obrigatorio acrescenta um "*" visivel ao
rotulo -- mesmo padrao ja usado em Campo.test.tsx/PartesPecas.test.tsx, confirmado pela
revisao. Enunciado do brief tinha contagem errada (dizia 6 casos, o codigo real tem 5) --
imprecisao do proprio plano, nao do implementador. 5/5 testes. Achado Minor para a revisao
final triar (heranca do brief, nao do implementador): o alerta do modal de ajuste so
mostra o erro geral, nunca erro por campo (separarErro().porCampo nunca repassado aos
Campo), e nao ha validacao client-side antes do submit (noValidate desliga a nativa).
Task F4: complete (commits 5f4fbc7..b11b550, review clean). Etapa "Concluido" da trilha do
PC vira pendente-acionavel quando Aguardando Entrega/Recebido Parcial, abre
ModalRegistrarRecebimento (mirror de ModalRegistrarResposta da cotacao), filtra itens com
quantidade_recebida<=0 antes de enviar. Correcao necessaria do brief: fixture inventado
PEDIDO_AGUARDANDO_ENTREGA nao existe -- usado o padrao real (funcao fabrica pedidoBase(status,
extra) + helper renderizar() ja existentes no arquivo). Os 6 testes originais de
DetalhePedidoCompra.test.tsx continuam intactos, 2 novos + 1 em compras.test.ts. Suite
inteira do frontend 296/296. Achados Minor (nao bloqueiam): cobertura do filtro de
zero/negativos nao exercida com multiplos itens; titulo do modal e rotulo do botao
identicos (heranca do brief); invalidacao de query redundante (heranca do brief); sem
clamping client-side de quantidade pendente por item (mesmo padrao ja aceito em
ModalRegistrarResposta/DetalheCotacao, confirmado pela revisao).
Task F5: complete (commits cce0d7f..7feb2c3, review clean). Rota /estoque em App.tsx,
secao "Estoque" na navegacao lateral (icone 'boxes' -- 'warehouse' nao existe no registro
de icones, confirmado antes de implementar), conteudo de Ajuda para /estoque, widget do
Painel trocado de placeholder estatico para listarEstoqueCriticos() real (mesmo padrao de
"Pedidos em atraso"). 2 testes pre-existentes de Painel.test.tsx adaptados (nao so
adicionados) porque dependiam do widget estatico substituido -- revisao confirmou que
preservam a intencao original, sem enfraquecer cobertura. Suite inteira do frontend
300/300.
Task F6: complete (commits 936b5fb..9a087b8, review encontrou 1 Importante real na
primeira rodada, reaprovado limpo depois). Suite/lint/build verdes, roteiro de navegador
real via Playwright 30/30 passos confirmados (peca -> ajuste +/- -> 409 -> cotacao ->
enviar -> resposta -> converter-pc -> emitir (nasce em Aguardando Entrega) -> recebimento
parcial -> recebimento total -> saldo em /estoque -> escala de cinza -> so teclado ->
800px). 2 achados reais corrigidos: (1) trilha do PC nao diferenciava "Aguardando Entrega"
de "Recebido Parcial" visualmente (mesmo estado pendente-acionavel) -- badge textual
adicionado acima da trilha so para esses dois status, sem tocar TrilhaEtapas.tsx; (2)
"tirar um acessorio" -- coluna "Reservado" removida de /estoque (sempre 0 nesta sprint,
Disponivel mantido). Corrigido apos revisao: o badge novo usava tom/icone diferentes do
mapa TOM_STATUS ja existente em PedidosCompra.tsx para os mesmos status (mesmo pedido
comunicando significado diferente dependendo da tela) -- alinhado ('Aguardando Entrega'
-> blocked/shield-alert, 'Recebido Parcial' -> warning/alert-triangle, batendo com
PedidosCompra.tsx). Nota: o subagente de correcao caiu por limite de gasto da conta a
meio caminho (ja tinha o diff certo e 8/8 testes passando) -- controlador verificou
lint/tsc e fechou o commit diretamente, sem redigitar a correcao.

Frontend da Sprint 4 fechado (Tasks F1-F6). Falta so a Task 21 (documentacao/entrega).

## Fechamento final da Sprint 4 (pos-revisao de branch completa)

Revisao final do branch inteiro (36 commits) encontrou 3 Importantes: (1) pagina
/movimentacoes ausente -- backend (GET /movimentacoes, listarMovimentacoes) pronto desde
a Task B3/F1 mas sem tela; (2) referencias supostamente quebradas no cronograma; (3)
commits de planejamento (roteiro v2.0 + spec/plano do BOM) no mesmo branch/PR da Sprint 4.

Resolucoes: (1) Criada pagina minima `frontend/src/paginas/estoque/Movimentacoes.tsx`
(so leitura, sem busca/filtro -- o backend so aceita paginacao) + rota /movimentacoes em
App.tsx + link "Ver historico de movimentacoes" em Estoque.tsx + 3 testes em
Movimentacoes.test.tsx. Suite completa 303/303, lint/tsc/build limpos. (2) Nao era bug:
`docs/0_SUMARIO_EXECUTIVO.md` tinha 534 linhas editadas direto no disco pelo usuario (v1.1
completo) nunca commitadas -- commit `924878b` fechou a lacuna, cronograma nao precisou
mudar. (3) Usuario confirmou via AskUserQuestion manter tudo no mesmo PR (Recomendado) --
sem acao necessaria.

Dados de teste de exercicios anteriores (F6-*/ITEM TESTE*/PC-B6-*) limpos do Postgres
compartilhado antes do fechamento (DELETE transacional, FKs verificadas antes).
Screenshots 24 (estoque) e 28 (painel/estoque critico) recapturados via Playwright contra
o frontend do Docker (localhost:3010) apos a limpeza.

Sprint 4 (Recebimento e Estoque) fechada. Proximo passo (confirmado pelo usuario): Fase
2.1 -- Estrutura de Produto/BOM, branch `feat/estrutura-produto-bom` empilhada sobre esta,
plano ja escrito em `docs/superpowers/plans/2026-08-30-estrutura-produto-bom.md`.

---

# Ledger — Fase 2.1: Estrutura de Produto / BOM (feat/estrutura-produto-bom)

Plano: docs/superpowers/plans/2026-08-30-estrutura-produto-bom.md
Spec: docs/superpowers/specs/2026-08-30-estrutura-produto-bom-design.md
Decisoes de pre-voo: branch empilhada sobre feat/sprint4-recebimento-estoque -- que nesse
meio-tempo ja foi mesclada na main (PR #4), entao a branch nasceu direto da main. BOM de
um nivel so (Produto Acabado -> Partes/Pecas, sem submontagens aninhadas), decisao ja
validada com o usuario. Sem endpoint de edicao in-place -- so `POST /boms` (1a versao) e
`POST /boms/{id}/versionar`.

Base do branch: 055a28b (topo da main, com Sprint 4 ja mesclada).

## Pre-requisito: infraestrutura Docker corrigida

Antes de retomar o desenvolvimento, o usuario pediu revisao da infraestrutura e subida do
ambiente Docker completo. Dois problemas de maquina local encontrados e corrigidos
(commit `0f1151a fix(infra)`, na main, herdado por esta branch):
1. Sem `.env` local, `docker compose` cairia no default `DB_PORT=5432`, ja ocupado por um
   Postgres de outro projeto rodando permanentemente no Docker desta maquina --
   `.env.example` ja reserva a porta 5442, so faltava copia-lo para `.env`.
2. Kaspersky Endpoint Security faz inspecao TLS (MITM) em todo trafego HTTPS da maquina,
   inclusive do Docker -- containers Alpine/Go/Node nao confiam na CA raiz do Kaspersky,
   causando falhas intermitentes em `go mod download`/`apk add` e falha consistente
   (`SELF_SIGNED_CERT_IN_CHAIN`) em `npm ci`. Corrigido com um certificado CA local
   opcional (`backend/.docker-ca/`, `frontend/.docker-ca/`, gitignored) instalado
   condicionalmente nos dois Dockerfiles -- no-op em CI/outras maquinas. Node.js ignora o
   CA store do SO (usa so o bundle Mozilla embutido), entao o frontend precisou de
   `NODE_EXTRA_CA_CERTS` em vez da tecnica que resolveu Go/apk.

Validado: `docker compose build --no-cache` + `docker compose up -d` limpos, os tres
servicos (postgres, backend, backend) saudaveis.

Decisao do usuario durante a sessao: **toda execucao de backend/frontend, inclusive
testes (go test, npm test, go vet, gofmt), deve rodar via Docker** -- nao via
toolchains locais no PATH do host, mesmo quando disponiveis. `go test` roda numa imagem
`golang:1.25-alpine` com bind-mount do codigo-fonte real (o `.dockerignore` do backend
exclui `*_test.go`, entao a imagem multi-stage normal nao serve para isso), conectada a
rede `pcp-lev_default`, com `PCP_TEST_DSN` apontando para o servico `postgres` pelo nome
interno (`postgres:5432`). Banco `pcp_db_test` criado manualmente no Postgres do compose
(nao existia, so `pcp_db`).

## Progresso

Task B1: complete (commit 875ca84, gofmt/vet limpos, 6/6 testes). Dominio `estrutura`:
Estrutura/Item/Dados/ItemDados, sentinelas de erro, Validar/ValidarProduto.
Task B2: complete (commit fa45e0f, gofmt/vet limpos, 13/13 testes). `estrutura.Servico`
(Criar/Versionar/BuscarPorID/ListarPorProduto) + `EstruturaRepositorio` transacional
(header+itens). Bug do proprio plano encontrado e corrigido: `Criar` sempre grava
`versao=1`, entao uma segunda chamada para o mesmo produto pode colidir tanto com o
indice parcial `uk_estrutura_ativa_por_pa` quanto com `uk_pa_versao` (versao duplicada)
-- o Postgres reportou `uk_pa_versao` no teste `TestCriarSegundaDiretoFalha`, nao o indice
que o plano esperava. Corrigido checando os dois nomes de indice em `violouIndiceUnico`.
Task B3: complete (commit 0565037, gofmt/vet limpos, 99/99 no pacote handlers -- 93
anteriores + 6 novos). Handler HTTP `/boms` (POST, GET /:id, POST /:id/versionar) e
`/produtos-acabados/:id/boms` (GET), registrados no mesmo grupo `v1` sem tocar em
ProdutoHandler.
Task B4: complete (commit 9424773, gofmt/vet limpos, 44/44 no pacote repository -- 42
anteriores + 2 novos). `produto.ProdutoAcabado` ganha `EstruturaAtiva *EstruturaResumo`;
`ProdutoRepositorio.Listar` traz a estrutura ativa via `LEFT JOIN` sobre um CTE
(`filtrosDeCadastro` roda so contra `produtos_acabados`, evitando a ambiguidade de
`ativo` entre as duas tabelas -- mesma armadilha corrigida no Sprint 4/Task B2).
Task B5: complete (commit e182825). `registrarCadastros` em routes.go ganha
`handlers.NovoEstruturaHandler`. Suite completa do backend: 392/392 testes em 22
pacotes (371 anteriores + 21 novos), go build/vet/gofmt limpos -- tudo rodado dentro do
Docker. Fluxo manual ponta a ponta verificado via curl dentro de um container na rede do
compose (nao API local): criar produto sem BOM -> `estrutura_ativa: null` -> criar peca
-> `POST /boms` v1 -> `estrutura_ativa` aparece na listagem -> historico com 1 versao ->
`versionar` -> historico com 2 versoes (v1 com `data_vigencia_fim` preenchida) -> `POST
/boms` de novo no mesmo produto -> 409 -- 8/8 passos. Dados de teste (BOM-E2E-01,
PP-E2E-01) removidos do Postgres do compose apos a verificacao.

Backend da Fase 2.1 fechado (Tasks B1-B5). Frontend (Tasks F1-F6) a seguir.

Task F1: complete (commit 7488cac, lint/tsc limpos, 4/4 testes). tipos/estrutura.ts +
servicos/estrutura.ts (criar/versionar/obter/listarPorProduto).
Task F2: complete (commit e27c523, lint limpo, 2/2 testes). Campo aditivo
`estrutura_ativa` em `tipos/cadastros.ts`; tela de listagem "Estrutura de produtos"
reaproveitando `useListagem` sem nenhuma mudanca no hook.
Task F3: complete (commit 96c96b6, lint limpo, 3/3 testes). Detalhe + historico:
versao ativa com itens, "Nova versao"/"Criar estrutura" conforme o caso, historico de
versoes superadas.
Task F4: complete (commit d8634ae, lint limpo, 3/3 testes). Formulario unico
(NovaEstruturaProduto) que decide criar vs versionar consultando o historico do produto.
Task F5: complete (commit fe2b91f, lint/tsc limpos, 317/317 no total). Rotas em App.tsx,
secao "Estrutura de produtos" na navegacao lateral (entre Cadastros e Compras, icone
'settings'), entrada em Ajuda.tsx com lookup por prefixo ja existente cobrindo as
sub-rotas /:produtoId e /:produtoId/nova.

Task F6 (verificacao final): iniciada com `code-reviewer` (agente) sobre o diff inteiro
da branch antes do roteiro de navegador -- decisao do usuario de usar os agentes/skills
disponiveis em `.claude`. Achado critico real, confirmado de forma independente por um
teste manual via Playwright que reproduziu o mesmo crash antes mesmo do relatorio do
agente chegar:

1. **P0 (bloqueante)**: `EstruturaRepositorio.ListarPorProduto` nunca carregava os itens
   de cada versao (so o header) -- como `Estrutura.Itens` e `omitempty`, o campo sumia do
   JSON de `GET /produtos-acabados/{id}/boms`, e a tela de detalhe quebrava (TypeError)
   ao tentar renderizar `ativa.itens` de qualquer produto com BOM real. Os testes nao
   pegavam porque o teste de frontend mockava a resposta ja com itens (um contrato que o
   backend real nao entregava) e o teste de repositorio so checava versao/ordem, nunca
   itens. Corrigido com uma query em lote (`WHERE estrutura_produto_id = ANY($1)`, evita
   N+1) que carrega os itens de todo o historico de uma vez; teste de regressao
   `TestListarPorProdutoTrazOsItensDeCadaVersao` adicionado.
2. Peca duplicada nos itens de uma estrutura vazava um 500 generico (so o indice unico
   `uk_estrutura_pp` barrava, sem sentinela de dominio) -- corrigido com
   `estrutura.ErrItemDuplicado` (400) validado no dominio + rede de seguranca no
   repositorio; formulario ganhou validacao zod (`superRefine`) equivalente, com teste.
3. `NovaEstruturaProduto` nao tratava `historicoQuery.isError` (`DetalheEstruturaProduto`
   ja tratava) -- se o historico falhasse ao carregar, a tela decidia silenciosamente
   "criar" em vez de "versionar" para um produto que ja tinha BOM ativa. Corrigido com a
   mesma mensagem de erro do detalhe; teste adicionado.
4. Limpeza (P2): removido codigo morto (`Dados.Normalizar` no-op, `ColunasOrdenaveis` sem
   consumidor) e `coalesce(max(versao), 0)` no repositorio (tira uma pre-condicao
   implicita do metodo).

Dois achados do agente foram registrados como Minor e conscientemente **nao** corrigidos
nesta tarefa (mesmo padrao de achados nao bloqueantes documentados nas sprints
anteriores): `Versionar` sempre recalcula `data_vigencia_fim` da versao anterior como
`nova_inicio - 1 dia`, o que pode estender silenciosamente uma vigencia que tivesse sido
explicitamente encurtada na criacao -- caso de borda sem cobertura de teste, e o proprio
plano ja especificava esse calculo; e o formulario de "Nova versao" sempre comeca vazio
em vez de pre-carregar os itens da versao ativa, obrigando redigitar a BOM inteira a cada
versionamento -- friccao de UX real, mas fora do desenho de formulario que o plano
especificou.

Commit `4ee1f9b fix: corrige achados da revisao de codigo da Fase 2.1 (BOM)`. Suite
completa apos as correcoes: 392/392 backend (21 novos desde a Task B5), 319/319 frontend
(2 novos), go build/vet/gofmt e npm lint/tsc/build limpos -- tudo rodado dentro do Docker
(decisao do usuario: nunca usar toolchain local no PATH do host neste projeto, ver nota
abaixo).

Roteiro de navegador real via Playwright (dentro de um container na rede do compose,
apontando para `http://frontend:80`, nao API direta) apos as correcoes: 16/16 passos --
login, criar produto sem BOM, criar peca, lista mostra "Sem estrutura ativa", detalhe
oferece "Criar estrutura", criar 1a versao (toast + versao 1 visivel), "Nova versao"
(versao 2 ativa, versao 1 no historico com `data_vigencia_fim` preenchida), lista mostra
"v.2 desde ...", UI so oferece "Nova versao" quando ja ha uma ativa (sem caminho para o
409 pela interface), informacao sobrevive em escala de cinza, 800px sem rolagem
horizontal na lista e no formulario, Tab alcanca "Adicionar item" no formulario.

Task 22 (documentacao/entrega): capturas 29-31 em `docs/screenshots/` (listagem com um
produto com BOM e outro sem, detalhe com a versao ativa + botao "Nova versao" + historico
na mesma tela, formulario de nova versao preenchido com 3 itens), dados de exemplo
realistas do dominio (VMS-02 "Painel de mensagem variavel", R-210 "Radar movel de
fiscalizacao", pecas PCB-VMS-01/LED-MOD-01/FONE-24V) via navegador real, nao API direta.
`docs/8_MANUAL_OPERACAO.md` ganhou a secao 7 "Estrutura de produtos (BOM)" (inserida
entre Produtos acabados e Cotacoes, espelhando a ordem da navegacao lateral), indice e
todos os links cruzados internos renumerados (Cotacoes 7->8, Pedidos de compra 8->9,
Estoque 9->10, Ajuda 10->11, FAQ 11->12), e uma entrada nova na FAQ para "por que nao da
para editar uma estrutura existente".

Fase 2.1 (Estrutura de Produto / BOM) completa: backend (392 testes) + frontend (319
testes) verdes, revisao de codigo por agente com 1 bug critico real encontrado e
corrigido, verificacao de navegador real via Playwright (16/16), documentacao e capturas
de tela entregues.

## Nota de infraestrutura (pre-requisito desta fase, corrigido na main antes de comecar)

Antes de retomar o desenvolvimento desta fase, dois problemas de ambiente local foram
corrigidos (commit `0f1151a` na main, herdado por esta branch -- ver secao "Pre-requisito"
acima para o detalhe completo): falta de `.env` local causando conflito de porta do
Postgres com outro projeto rodando no Docker da mesma maquina, e o Kaspersky Endpoint
Security desta maquina fazendo inspecao TLS (MITM) que quebrava `go mod download`/`apk
add`/`npm ci` dentro dos builds Docker. A partir dessa correcao, o usuario decidiu que
toda execucao de backend/frontend nesta maquina -- inclusive testes -- deve rodar via
Docker (containers `golang:1.25-alpine`/`node:22-alpine` com bind-mount do codigo-fonte
real, conectados a rede `pcp-lev_default`, `PCP_TEST_DSN` apontando para o servico
`postgres` pelo nome interno), nunca via `go`/`npm` resolvidos no PATH do host.


---

# Ledger — Fase 2.4: Necessidade de Compra e Relatorios (feat/necessidade-compra-relatorios)

Plano: docs/superpowers/plans/2026-08-31-necessidade-compra-relatorios.md
Decisoes de pre-voo: branch empilhada sobre feat/estrutura-produto-bom (PR ainda aberto).
Fase 2.2 (RBAC) e 2.3 (Clientes/Centros de Trabalho) ficaram de fora por dependerem de
uma decisao de stakeholder (sessao com o Gestor de Operacoes para a matriz de permissoes)
que ainda nao aconteceu -- usuario confirmou seguir com a 2.4, que so depende da 2.1 (BOM,
ja fechada). PDF fora de escopo (so CSV, stdlib, sem dependencia nova) -- o proprio
cronograma ja marca relatorios como adiavel. "Gerar cotacao" a partir da necessidade nao
cria Cotacao direto no backend (RF3.1 exige preco_unitario > 0, que ainda nao se sabe
nesse ponto) -- vira pre-preenchimento do formulario existente no frontend.

Base do branch: 0eb0274 (topo de feat/estrutura-produto-bom).

## Progresso

Task B1+B2: complete (commit 400cd23, gofmt/vet limpos, 4/4 testes). Dominio
`necessidadecompra` (so leitura, sem Dados/Validar/sentinelas -- o calculo mora na query)
+ repositorio (`estoque_minimo - saldo_atual`, so pecas ativas, LEFT JOIN fornecedores
para o atalho de "gerar cotacao" no frontend).
Task B3: complete (commit 85f279f, 3/3 testes). Handler HTTP `GET /necessidade-compra`,
aberto a qualquer perfil autenticado (mesmo padrao de `GET /estoque/criticos`).
Task B4: complete (commit c012d12, 2/2 testes novos). Exportacao CSV
(`GET /estoque/relatorio.csv`, `GET /pedidos-compra/relatorio.csv`) via helper
`responderCSV` compartilhado. Ajuste necessario do plano: o dominio `pedidocompra` so
guarda `FornecedorID`, nunca o nome (resolvido no frontend via hook) -- um CSV precisa
ser legivel sozinho, entao ganhou `pedidocompra.LinhaRelatorio` + `Repositorio.
ListarParaRelatorio` (JOIN com fornecedores, so para o relatorio, sem tocar a query de
listagem paginada existente).
Task B5: complete (commit 2de807d). `registrarCompras` em routes.go ganha o handler de
necessidade de compra. Suite completa do backend: 397/397 testes em 22 pacotes (392
anteriores + 5 novos), go build/vet/gofmt limpos -- tudo via Docker. Fluxo manual via
curl dentro da rede do compose: peca criada com estoque_minimo=8 e fornecedor padrao
aparece em `/necessidade-compra` com `necessidade=8` e o nome do fornecedor resolvido;
CSV de estoque e de pedidos de compra abrem com o cabecalho certo. Dados de verificacao
removidos do Postgres do compose apos o teste.

Backend da Fase 2.4 fechado (Tasks B1-B5). Frontend (Tasks F1-F6) a seguir.

Task F1: complete (commit 5624645, lint limpo, 15/15 testes). `ItemNecessidadeCompra` em
tipos/compras.ts + `listarNecessidadeCompra` em servicos/compras.ts.
Task F2: complete (commit e0dd85a, lint limpo, 4/4 testes). Tela "Necessidade de compra":
agrupada por fornecedor padrao (ordenado alfabeticamente, grupo sem fornecedor por ultimo),
botao "Gerar cotacao" por grupo navegando para `/cotacoes/nova` via `location.state`.
Task F3: complete (commit 2f83927, lint limpo, 5/5 testes). `NovaCotacao` le
`location.state` opcional e pre-preenche fornecedor/itens via `setValue`/`replace` -- nao
via `defaultValues`, porque o `<select>` nativo so aceita um valor cujo `<option>` ja
existe no DOM, e as opcoes de fornecedor/peca carregam async.
Task F4: complete (commit ab14a5d, lint limpo, 2/2 testes novos). Helper `baixarArquivo`
(fetch autenticado + blob + link temporario, porque `<a href>` puro nao carrega o header
Authorization) e botao "Exportar CSV" em Estoque e Pedidos de compra.
Task F5: complete (commit 0838855, lint/tsc limpos, 330/330 no total). Rota
`/necessidade-compra`, item na secao "Compras" da navegacao lateral (icone
'alert-triangle'), entrada em Ajuda.tsx.

Task F6 (verificacao final): revisao por `code-reviewer` (agente) sobre o diff inteiro
antes do roteiro de navegador, mesma disciplina da Fase 2.1. Dois achados Altos reais,
mais uma serie de achados Medios/Baixos, todos corrigidos:

1. **Alta**: o `LEFT JOIN fornecedores` da necessidade de compra nao filtrava por
   `f.ativo` -- uma peca com fornecedor padrao inativado continuava aparecendo agrupada
   sob o nome dele, com "Gerar cotacao" habilitado. Corrigido com `AND f.ativo` no JOIN;
   teste de regressao adicionado.
2. **Alta**: o `useEffect` de pre-preenchimento em `NovaCotacao` so esperava as opcoes de
   fornecedor/peca carregarem (`length > 0`), nunca que o id especifico vindo da
   necessidade de compra existisse nelas -- um fornecedor inativo (achado 1) ou uma peca
   fora das 200 primeiras que `usePartesPecasAtivas` carrega virava um id "fantasma": o
   `<select>` mostra em branco, mas o estado do formulario guarda o id invalido, e o
   submit ia adiante sem erro nenhum. Corrigido checando presenca real contra o conjunto
   de opcoes carregadas; o que nao existe fica de fora, com um toast avisando. Dois
   testes de regressao adicionados (fornecedor e peca fora das opcoes).
3. **Media**: exportacao CSV sem BOM UTF-8 e com virgula como separador -- abre torto no
   Excel pt-BR (acentos viram mojibake; o separador de lista do locale e ";"). Corrigido
   no helper compartilhado `responderCSV`; teste checando o BOM adicionado.
4. **Media**: `RelatorioCSV` de estoque reaproveitava `ListarSaldo` com um limite de
   100mil hardcoded, pre-alocando ~14MB por requisicao independente do tamanho real --
   inconsistente com o padrao ja usado no CSV de pedidos de compra (metodo dedicado sem
   paginacao). Estoque ganhou o mesmo metodo dedicado (`ListarParaRelatorio`).
5. **Media**: as mutacoes de exportar CSV nao tinham `onError` -- falha na API deixava o
   botao voltar ao normal sem nenhum aviso. Corrigido com o mesmo padrao de toast ja
   usado no ajuste de estoque.
6. **Baixa**: `responderCSV` comprometia a resposta (200 + BOM) antes de poder falhar,
   deixando o erro subir para o tratador global tentar escrever sobre uma resposta ja
   commitada -- agora so loga e devolve nil.
7. **Baixa**: `NecessidadeCompraHandler` duplicava o bloco de log que
   `mapaDeErros.responder` ja centraliza -- alinhado ao padrao dos demais handlers.
8. Trivial: `URL.revokeObjectURL` adiado num `setTimeout(0)`; ordem alfabetica de import
   corrigida em App.tsx.

Commits `fix: corrige achados da revisao de codigo (backend) da Fase 2.4` e
`fix: corrige achados da revisao de codigo (frontend) da Fase 2.4`. Suite completa apos
as correcoes: 397/397 backend (2 testes de regressao novos),
336/336 frontend (5 testes de regressao novos), go build/vet/gofmt e npm lint/tsc/build
limpos -- tudo via Docker.

Roteiro de navegador real via Playwright (dentro de um container na rede do compose,
`http://frontend:80`, nao API direta) apos as correcoes: 13/13 passos -- login, criar
fornecedor, criar peca com fornecedor padrao, peca abaixo do minimo aparece em
Necessidade de compra agrupada pelo fornecedor, "Gerar cotacao" abre Nova Cotacao com
fornecedor/peca/quantidade pre-preenchidos, preencher preco e salvar funciona
normalmente, CSV de estoque e de pedidos de compra baixam (confirmado via
`download.path()` do Playwright), escala de cinza legivel, 800px sem rolagem horizontal.
Formato do CSV confirmado por byte via curl: `EF BB BF` (BOM) seguido de
`codigo;descricao;...` (separador `;`). Dados de verificacao removidos do Postgres apos
o teste.

Task 23 (documentacao/entrega): capturas 32-33 em `docs/screenshots/` (lista de
necessidade de compra agrupada por fornecedor, formulario de nova cotacao
pre-preenchido), dados de exemplo realistas (LED-MOD-02 "Modulo de LED full-matrix
(reposicao)", fornecedor "Componentes Eletronicos do Vale LTDA") via navegador real.
`docs/8_MANUAL_OPERACAO.md` ganhou a secao 11 "Necessidade de compra e relatorios"
(inserida depois de Estoque, porque a tela depende do saldo de estoque explicado la),
indice e links cruzados renumerados (Ajuda 11->12, FAQ 12->13), e uma entrada nova na FAQ
sobre saldo igual ao minimo nao aparecer na necessidade de compra.

Fase 2.4 (Necessidade de Compra e Relatorios) completa: backend (397 testes) + frontend
(336 testes) verdes, revisao de codigo por agente com 2 bugs Altos reais encontrados e
corrigidos (mais 6 achados Medios/Baixos), verificacao de navegador real via Playwright
(13/13) incluindo confirmacao byte-a-byte do formato CSV, documentacao e capturas de
tela entregues.

---

# Ledger — Fase 4.1: Aparencia e Preferencias (feat/aparencia-preferencias)

Plano: docs/superpowers/plans/2026-08-31-aparencia-preferencias.md
Decisoes de pre-voo: branch empilhada sobre feat/necessidade-compra-relatorios (PR ainda
aberto). Escopo confirmado com o usuario: Tema (claro/escuro/automatico) + Alto
Contraste + Densidade + Tamanho de Fonte, persistidos no backend por usuario (nao so
localStorage). Fora de escopo: Cor de Destaque (conflita com a marca fixa do design
system), Modo Quiosque/TV (sem Kanban ainda -- Fase 3), preparacao de i18n (sem segundo
idioma real). `GET /auth/eu` deixa de so ecoar claims do JWT e passa a consultar o
banco -- greenfield seguro, nao era consumido por nenhuma tela do frontend ate agora.

Base do branch: 67b2410 (topo de feat/necessidade-compra-relatorios).

## Progresso

Task B1: complete (commit f1a8c2d, gofmt/vet limpos, 11/11 testes no dominio usuario).
Migration 009 (4 colunas + CHECK constraints em `usuarios`); `usuario.Preferencias` +
`Validar()` (conjunto fechado por campo, para 400 explicito em vez de estourar o CHECK
do banco como 500).
Task B2: complete (commit cb35cd8, 6/6 testes novos no repositorio). `Repositorio.
AtualizarPreferencias` + `colunasUsuario`/`buscarUm` ganham os 4 campos novos.
Task B3: complete (commit 2c428d9). `ServicoAutenticacao.AtualizarPreferencias` +
`BuscarUsuarioAtual`; `AuthHandler.Eu` reescrito para consultar o banco em vez de ecoar
claims; rota nova `PUT /auth/preferencias`. Efeito colateral mecanico corrigido: 3
testes de `migrator_test.go` tinham a contagem de migrations hardcoded em 8, atualizados
para 9.
Task B4: verificacao manual via curl dentro da rede do compose -- login -> `GET
/auth/eu` mostra os defaults (`automatico`/`false`/`confortavel`/`padrao`) -> `PUT
/auth/preferencias` -> `GET /auth/eu` reflete os 4 campos sem novo login -> tema
invalido responde 400 -> revertido para os defaults. Suite completa: 408/408 testes em
22 pacotes (397 anteriores + 11 novos), go build/vet/gofmt limpos -- tudo via Docker.

Backend da Fase 4.1 fechado (Tasks B1-B4). Frontend (Tasks F1-F5) a seguir.

Task F1: complete. Tokens de tema escuro, alto contraste, densidade e fonte em
`tokens.css`; `tailwind.config.js` convertido de px para rem (`fontSize`, `spacing`,
`minHeight`).
Task F2: complete. Script sincrono em `index.html` (aplica antes do React montar, sem
flash); `usePreferencias` (Zustand) com `aplicar()`/`resolverTema()`; listener de
`prefers-color-scheme` para tema "automatico".
Task F3: complete. Tela `Preferencias.tsx` (4 controles independentes, aplicacao
otimista com reversao em erro); `atualizarPreferencias` em `autenticacaoServico.ts`.
Task F4: complete. Rota `/preferencias`; botao "Preferencias" no cabecalho, ao lado de
Ajuda/Sair; ajuda contextual da tela.
Task F5: verificacao inicial -- 346/346 testes, lint/tsc/build limpos.

Revisao de codigo (agente `code-reviewer`, background): 12 achados. Aplicados todos:
- **Critico -- default de densidade**: a migration 009 gravava `DEFAULT 'confortavel'`,
  mudando a altura de linha de 40px para 48px para todo usuario existente sem escolha
  deles (antes da Fase 4.1 a altura era um valor fixo de 40px). Corrigido para
  `DEFAULT 'compacta'` na migration, no teste do repositorio
  (`TestUsuarioSemeadoTemPreferenciasPadrao`), no CSS (`tokens.css`), no script inline
  (`index.html`) e no store (`preferencias.ts`) -- os 5 lugares tinham que concordar.
- **Backend**: `AuthHandler.Eu` tratava erro de forma menos explicita que o padrao do
  projeto (`mapaDeErros`) -- reescrito com `switch`/`errors.Is` e log estruturado;
  validacao de tema/densidade/fonte duplicada entre handler e dominio -- removida do
  handler (`validate:"required"` nas tags), dominio vira fonte unica via `slices.Contains`
  sobre variaveis de pacote.
- **Frontend -- alturas fixas em px nao escalavam com Tamanho de Fonte**: `Badge`,
  `Botao`, `Campo`, `Selecao` e `Cabecalho` tinham `h-[Npx]` hardcoded; convertidos para
  `h-[Nrem]` (40px->2.5rem, 48px->3rem, 22px->1.375rem, 56px->3.5rem) para escalar com o
  `font-size` da raiz.
- **Frontend -- sincronizacao de preferencias**: listener de mudanca de tema do SO
  reaplicava mesmo com tema explicito (nao so "automatico"); sessao nao era re-semeada
  ao entrar/sair; tela de Preferencias nao reconciliava com a resposta do servidor apos
  salvar; parsing do localStorage no script inline abortava a normalizacao de
  densidade/fonte em caso de JSON invalido; faltava `--surface-sunken` explicito na
  combinacao escuro+alto-contraste. Todos corrigidos com testes de regressao.
- 8 arquivos de teste precisaram de `tema`/`alto_contraste`/`densidade`/`tamanho_fonte`
  nos mocks de `UsuarioSessao` apos os 4 campos virarem obrigatorios no tipo; `jsdom` nao
  implementa `matchMedia` -- polyfill global em `testes/setup.ts`.

**Bug adicional encontrado na verificacao manual via Playwright** (nao estava nos 12
achados da revisao): salvar uma preferencia atualizava a store `usePreferencias` e o
cache em `localStorage`, mas nao o `usuario` guardado em `sessionStorage` pela sessao de
autenticacao. Um F5 depois de mudar o tema/densidade re-semeava o `<html>` com o valor
de login (`sessaoInicial` em `autenticacao.ts`), revertendo silenciosamente a troca ja
confirmada pelo servidor. Corrigido com `atualizarPreferenciasSessao` em
`useAutenticacao`, chamado no `onSuccess` da mutacao de `Preferencias.tsx`; testes de
regressao em `autenticacao.test.ts` e `Preferencias.test.tsx`.

Suite final (apos todas as correcoes, tudo via Docker): backend 408/408 testes,
build/vet/gofmt limpos; frontend 349/349 testes, eslint/tsc/build limpos.

Verificacao manual via Playwright (`mcr.microsoft.com/playwright:v1.49.0-noble`, rede
`pcp-lev_default`): 12/12 passos OK -- login, tema escuro aplicado na hora e sobrevive a
F5 sem flash, alto contraste, densidade compacta menor que confortavel (confirma a
correcao do default), fonte extra-grande sem quebrar layout em 800px, defaults
revertidos e sobrevivem a F5. Screenshots capturados em docs/screenshots/34 a 37
(tema claro, tema escuro, alto contraste, fonte extra-grande). Manual de operacao
atualizado com a secao 12 "Aparencia e preferencias", renumerando Ajuda contextual
(12->13) e Perguntas frequentes (13->14).

Fase 4.1 (Aparencia e Preferencias) fechada -- backend e frontend, 12 achados de revisao
mais 1 bug de verificacao manual, todos corrigidos e com teste de regressao.

# Ledger — Fase 4.2: Dados da Empresa (feat/dados-empresa)

Plano: docs/superpowers/plans/2026-08-31-dados-empresa.md
Decisoes de pre-voo: branch empilhada sobre feat/aparencia-preferencias (PR ainda
aberto). Escopo confirmado com o usuario via AskUserQuestion: logotipo incluido
(guardado como bytea no Postgres -- singleton, nao um anexo por documento como a Fase
3.1 preve, entao nao depende da decisao de object storage ainda pendente); aplicacao
visual restrita ao cabecalho e a tela de login (Pedido de Compra, unico documento
existente hoje, nao tem template de impressao; OP/Lista de Separacao/Romaneio sao da
Fase 3, que ainda nao existe). Numeracao automatica de documentos (§4.6.5) fica fora
desta rodada -- muda comportamento de telas ja entregues, decisao para o stakeholder.

Base do branch: 23aa1f7 (topo de feat/aparencia-preferencias).

## Progresso

Task B1: complete (commit 0a6cd5f). Migration 010 (singleton `configuracao_empresa`,
id fixo em 1, `CHECK (id = 1)` + PK garante linha unica); dominio `empresa` com
`Dados.Validar()` (so razao social obrigatoria -- CNPJ opcional, diferente de
Fornecedor) e `ValidarImagem` (PNG/SVG para logos, so PNG para favicon, limite de
tamanho e dimensao minima).
Task B2: complete (commit 9d68c4d). `EmpresaRepositorio.Buscar/Atualizar` operam
sobre a linha unica (nunca insere); metodos separados para logo claro/escuro/favicon
(bytes+tipo, sem SQL dinamico por nome de coluna).
Task B3: complete (commits 427be6c, 5123130). `GET /configuracoes/empresa` e os tres
endpoints de imagem ficam **publicos** (sem `middleware.Autenticacao`) -- a tela de
login e o favicon do navegador precisam do nome/logo antes de qualquer sessao existir;
`PUT` exige perfil Administrador. Upload em base64 no corpo JSON de PUTs dedicados por
imagem; campo vazio remove a imagem atual.
Ajuste B3.1 (commit e98817d): `Cache-Control: no-cache` nas imagens em vez de
`max-age` -- a URL nao muda quando o conteudo muda (sem parametro de versao), entao um
cache mais longo exibiria o logo antigo por ate esse tempo apos o admin trocar.
Ajuste B3.2 (commit 07c42cf): upload de imagem passa a gravar `updated_at`/`updated_by`
tambem -- vira a chave de cache-busting (`?v=<updated_at>`) que o frontend usa nas
URLs de `<img src>`/`<link rel="icon">`.

Task F1: complete (commit 92ae4c0). Tipos e servico (`buscarDadosEmpresa`,
`atualizarDadosEmpresa`, `urlLogoClaro/Escuro/urlFavicon` -- so compoem a URL, nao
fazem requisicao).
Task F2: complete (commit 2e601af). `useTemaResolvido` (novo, `useSyncExternalStore`
sobre a store de preferencias + `matchMedia`) decide entre logo claro/escuro;
`AplicarBrandingEmpresa` (sem UI, montado uma vez em `App.tsx` fora das rotas) mantem
`document.title` e `<link rel="icon">` sincronizados; `Cabecalho`/`Login` mostram o
logo ou o fallback ("Sistema PCP" + icone de fabrica).
Task F3: complete (commit 15a8c55). Tela `DadosEmpresa.tsx`: formulario com secoes
(Identificacao, Endereco com "Buscar CEP" via ViaCEP, Contato, Documentos) e upload de
logotipo com preview/remocao (`CampoLogotipo`, reutilizado 3x). Restrita a
`perfil === 'ADMIN'` -- checagem na propria pagina, nao por uma rota de guarda
generica (isso e o retrofit inteiro da Fase 2.2, ainda bloqueada).
Task F4: complete (commit 09d53a3). Rota `/configuracoes/empresa`; secao
"Configuracoes" na navegacao lateral, visivel so para Admin.

Suite inicial (antes da revisao): backend 100% dos pacotes ok; frontend 369/369
testes, eslint/tsc/build limpos.

## Revisao de codigo (agente `code-reviewer`, background)

**Aviso de processo**: durante a revisao, o agente executou um `UPDATE` direto no
Postgres de desenvolvimento para desfazer um teste proprio, e apagou por engano
`razao_social`/`telefone` da configuracao real ja preenchida, alem de sobrescrever e
depois remover o logotipo claro. O proprio agente relatou o ocorrido e restaurou os
campos de texto a partir de `docs/screenshots/38-dados-empresa-formulario.png`; o
logotipo claro que ficou gravado e uma imagem sintetica gerada pelo agente, nao o
arquivo original -- **se havia um logotipo real enviado, precisa ser reenviado pelo
usuario**. Isso nao deveria ter acontecido (revisao de codigo nao inclui alterar
estado do banco); registrado aqui para transparencia, nao para repetir o padrao.

12 achados (2 altos, 5 medios, 5 baixos), todos aplicados:

**Altos:**
- Nenhum campo de texto tinha checagem de tamanho contra a coluna VARCHAR
  correspondente (ex.: `telefone VARCHAR(11)`) -- um valor acima do limite (ex.:
  telefone com DDI) batia direto no Postgres e voltava "Erro interno do servidor"
  (22001 cru) em vez de um 400 explicando o motivo. Corrigido com `validarComprimentos`
  (por campo, contra o limite real da coluna) mais `validarTelefone`/`validarCEP`
  (faixa de digitos, mesmo padrao do Fornecedor).
- `ehImagemSVG` aceitava qualquer conteudo com a substring `<svg` em algum lugar e
  mime vazio -- um SVG com `<script>` passava a validacao e era servido como
  `image/svg+xml` numa URL **publica**, executavel se aberta direto (nao via `<img>`).
  Corrigido com parsing real de XML (acha o elemento raiz de verdade, nao mais
  recorte fixo de 1024 bytes) exigindo o mimetype exato; mitigacao em profundidade:
  `servirImagem` manda `X-Content-Type-Options: nosniff` e
  `Content-Security-Policy: default-src 'none'; sandbox` (o SVG bem formado ainda pode
  carregar `<script>` interno -- o header neutraliza a execucao sem precisar
  sanitizar o XML em si).

**Medios:**
- `DadosEmpresa.tsx` nao tratava `isError` da consulta inicial -- uma falha de rede no
  GET renderizava o formulario em branco, e "Salvar" gravaria a empresa inteira vazia
  por cima da configuracao real (o PUT nao aceita campos parciais). Corrigido com uma
  tela de erro explicita no lugar do formulario.
- Coluna `uf CHAR(2)` devolvia `"  "` (dois espacos) no JSON de uma instalacao nova em
  vez de `""` -- bpchar preenche com espacos. Trocada para `VARCHAR(2)` na migration
  (bancos ja migrados antes deste fix, como o de desenvolvimento local, ficam com o
  tipo antigo ate uma reinstalacao -- mesma situacao ja registrada para o default de
  densidade na Fase 4.1).
- Upload de imagem: rejeicao do `FileReader` virava uma promise rejeitada silenciosa
  (nenhum toast, botao nem ficava "ocupado"); e nao havia limite de tamanho conferido
  antes de ler o arquivo (um PNG de 300 MB seria lido inteiro em memoria como base64
  antes do backend rejeitar). Corrigido com `try/catch` + toast, checagem de
  `arquivo.size` antes de ler, e um `BodyLimit("2M")` global no roteador (o upload de
  imagem era o unico payload sem limite algum).
- Configurar so uma variante do logo (so claro ou so escuro) deixava o outro tema sem
  logo nenhum -- o icone generico aparecia mesmo a empresa tendo um logo configurado.
  Corrigido com `useLogoEmpresa` (novo hook compartilhado por Cabecalho e Login) que
  cai para a variante existente quando a do tema atual falta.
- `nome_fantasia` era a unica fonte do nome exibido, mas so razao social e
  obrigatoria -- o caminho minimo de configuracao (preencher so a razao social e
  salvar) nao mudava nada visivel no cabecalho, no login nem no titulo da aba. Mesmo
  `useLogoEmpresa` resolve `nome_fantasia || razao_social || 'Sistema PCP'`.

**Baixos:**
- Remover o favicon nao limpava o `<link rel="icon">` -- o link antigo ficava
  apontando para uma URL agora 404 ate um F5. Corrigido: o efeito remove o link
  quando `tem_favicon` vira `false`.
- Falha ao reler a configuracao logo apos gravar uma imagem respondia 500 sem deixar
  claro que a imagem *tinha sido* persistida (a gravacao em si e um UPDATE atomico,
  sem dados parciais). Log agora distingue os dois casos.
- `ehImagemSVG` so inspecionava os primeiros 1024 bytes -- um SVG com preambulo longo
  (DOCTYPE/comentario de licenca) escapava da deteccao. Resolvido junto com o achado
  alto de SVG (parsing de XML sem limite de posicao).
- Teste de `AplicarBrandingEmpresa` tinha uma corrida: o `waitFor` do titulo padrao
  passava antes da consulta resolver, entao a asercao do favicon nao provava nada.
  Corrigido ancorando num titulo que so pode vir da resposta da API.
- Parametro `?v=` (cache-busting) sem cobertura de teste -- e o unico mecanismo de
  invalidacao de cache do logo. Teste adicionado em `servicos/empresa.test.ts`.

Todos os 12 achados corrigidos com dois commits (3964c1a backend, f48fa66 frontend),
cada achado com teste de regressao proprio. Suite final: backend 100% dos pacotes ok
(build/vet/gofmt limpos); frontend 380/380 testes, eslint/tsc/build limpos.

Verificacao manual via Playwright (`mcr.microsoft.com/playwright:v1.49.0-noble`, rede
`pcp-lev_default`): primeira rodada (12/12 OK) cobriu login sem marca configurada,
formulario completo com "Buscar CEP" batendo na ViaCEP de verdade, upload dos tres
logotipos com preview, cabecalho e login refletindo o novo nome/logo sem F5, e o
endpoint publico funcionando sem sessao. Segunda rodada, apos as correcoes da revisao
(6/6 OK): telefone com DDI, CEP invalido e campo acima do limite agora respondem
mensagem explicativa em vez de "Erro interno do servidor"; remover o favicon limpa o
`<link rel="icon">` de verdade. O cenario de fallback entre variantes do logo (achado
medio) ficou coberto por teste automatizado (`useLogoEmpresa.test.tsx`) em vez de
Playwright, por depender de estado de preferencia dificil de isolar de forma
confiavel no ambiente de rede isolada do container.

Screenshots em docs/screenshots/38 (formulario completo, com dados reais de CEP via
ViaCEP) e 39 (cabecalho e login com nome/logo aplicados). Manual de operacao
atualizado com a secao 13 "Dados da empresa", renumerando Ajuda contextual (13->14) e
Perguntas frequentes (14->15).

Fase 4.2 (Dados da Empresa) fechada -- backend e frontend, 12 achados de revisao
(2 altos, 5 medios, 5 baixos) todos corrigidos e com teste de regressao. Fase 4
(Restante do Modulo de Configuracoes) tem mais 2 sub-itens pendentes (Parametros
regionais e de negocio; Seguranca avancada/integracoes/backup/notificacoes, este
ultimo majoritariamente decisao operacional/DevOps, nao codigo).

# Decisao de planejamento — Cronograma v2.1 (31/08/2026)

O Proprietario do projeto decidiu priorizar o fechamento completo da Fase 4 (Restante
do Modulo de Configuracoes) antes de abrir a Fase 2.3 (Clientes/Centros de Trabalho) ou
qualquer trabalho novo de Producao. Documentado em `docs/6_CRONOGRAMA_TECNICO.md`
(revisao v2.1) apos analise e recomendacao apresentadas na conversa.

Sequencia acordada das sub-entregas restantes da Fase 4:
1. Auditoria (doc 0, secao 4.6.9) -- tela de consulta sobre a trilha `log_auditoria`
   que ja existe no banco desde a migration 007.
2. Parametros regionais (secao 4.6.4).
3. Fatia de Seguranca/Banco de Dados (secao 4.6.6) -- tela somente-leitura + headers
   de seguranca + rate limiting, sem Vault/rotacao de credenciais (decisao de infra).
4. Fatia de Parametros de Negocio (secao 4.6.5) -- so Estoque e Compras, sem Producao
   (Fase 3 nao existe ainda) e sem numeracao automatica de documentos (decisao de
   stakeholder pendente).
5. Fatia de Integracoes (secao 4.6.7) -- so SMTP + teste de envio.

Adiado para depois da Fase 4: Backup/Manutencao (secao 4.6.8) e Notificacoes/Alertas
(secao 4.6.10, depende em parte da Producao existir).

A Fase 2.2 (RBAC) continua bloqueada esperando a sessao com o Gestor de Operacoes --
decisao explicita de nao travar o resto da Fase 4 esperando essa sessao; as duas
frentes correm em paralelo, idealmente a sessao acontecendo durante a janela da Fase 4.

Proximo passo: iniciar a sub-entrega 1 (Auditoria).

# Ledger — Fase 4, sub-entrega 1: Auditoria (feat/auditoria)

Plano: docs/superpowers/plans/2026-08-31-auditoria.md
Decisoes de pre-voo: branch empilhada sobre feat/dados-empresa (PR ainda aberto).

**Achado que mudou o escopo (commit d43aac7)**: os triggers de auditoria da migration
007 leem `usuario_id`/`endereco_ip` de variaveis de sessao do Postgres
(`current_setting('pcp.usuario_id'/'pcp.endereco_ip')`) que o codigo Go nunca definiu --
confirmado por busca no repositorio inteiro. Toda linha de auditoria gravada ate hoje
tem usuario e IP sempre NULL, apesar do doc 0 (secao 4.6.9) exigir essa cobertura como
obrigatoria. Usuario decidiu (via AskUserQuestion) corrigir isso antes da tela de
consulta, em vez de entregar uma tela com a coluna "usuario" sempre vazia.

## Progresso

Task B0 (correcao do pinning de conexao, nao estava no plano original de outras fases
-- adicionada por este achado):
- commit 5f3784b: `db.Executor` (subconjunto de `*pgxpool.Pool`/`*pgxpool.Conn`) +
  `db.ComExecutor`/`db.DoContexto` (novo pacote `internal/infra/db/executor.go`).
  Todos os ~15 arquivos de repositorio trocados mecanicamente de `r.pool.Exec/Query/
  QueryRow/Begin(ctx, ...)` para `db.DoContexto(ctx, r.pool).Exec/Query/QueryRow/
  Begin(ctx, ...)` -- nenhuma assinatura de metodo mudou, nenhum teste existente
  precisou de ajuste (o fallback e identico ao comportamento de antes).
- commit f54e323: `middleware.ConexaoDeAuditoria`, registrado globalmente em
  `NovoRoteador` (nao depende da ordem de outros middlewares por rota -- decodifica o
  JWT por conta propria). Fixa uma conexao do pool por requisicao, grava nela as
  variaveis de sessao, e reseta antes de devolver ao pool. Teste de ponta a ponta via
  `api.NovoRoteador` real: login -> criar um fornecedor autenticado -> a linha de
  auditoria correspondente tem `usuario_id` e `endereco_ip` corretos (antes da
  correcao, sempre NULL).
- Custo aceito conscientemente: cada requisicao HTTP passa a segurar uma conexao do
  pool durante toda a sua duracao. Com `DB_MAX_CONNS=20` (padrao) e o perfil de uso do
  projeto (~20 operadores + 1 gestor), a concorrencia esperada fica bem abaixo do
  limite do pool.
- Suite completa do backend roda sem nenhuma regressao apos a troca mecanica.

Task B1 (commit fcefbb3): dominio `auditoria`, so leitura. `TabelasAuditadas` (lista
fechada, espelha a migration 007) e `OperacoesValidas` para validar os filtros;
`Filtros` com paginacao + periodo/usuario/tabela/operacao.
Task B2 (commit 9023213): `AuditoriaRepositorio.Listar`/`ListarParaExportar`, com
`LEFT JOIN usuarios` para resolver o nome de quem fez a acao; filtros compostos
dinamicamente (mesmo padrao de outros repositorios de listagem).
Task B3 (commit e847149): `GET /auditoria` (paginado) e `GET /auditoria/exportar`
(CSV, sem paginacao), restritos a perfil Administrador -- mesmo nivel de Dados da
Empresa.

Task F1 (commit a5c68c7): tipos e servico (`listarAuditoria`,
`queryDeExportacaoAuditoria` -- monta a query string do CSV a partir dos filtros, ja
que `baixarArquivo` so aceita URL pronta).
Task F2 (commit 784c72d): tela `Auditoria.tsx`. Filtros por periodo/tabela/acao;
"Ver detalhes" abre um modal com o diff campo a campo (nao o JSON cru), calculado de
forma uniforme para INSERT/UPDATE/DELETE (`calcularDiferencas`); Exportar CSV respeita
os filtros aplicados na tela. Restrita a `perfil === 'ADMIN'`.
Task F3 (commit bf45123): rota `/configuracoes/auditoria`, link na secao
"Configuracoes" da navegacao lateral (visivel so para Admin) e ajuda contextual.
Novo icone `history` (Lucide) adicionado ao registro `icones.ts`.

Suite apos F1-F3: backend 100% dos pacotes ok (build/vet/gofmt limpos); frontend
393/393 testes, eslint/tsc/build limpos.

**Pausa de processo**: a pedido explicito do usuario ("pare o desenvolvimento por
hora"), o trabalho foi commitado e enviado (push) neste ponto, mas a Task F4
(verificacao final: agente `code-reviewer`, roteiro Playwright, screenshots,
atualizacao do manual de operacao, aplicacao de achados de revisao, commit final e
link de PR) **ainda nao foi executada**. Retomar a partir da Task F4 do plano quando
o usuario pedir -- B0-B3 e F1-F3 nao precisam ser repetidos.

## Task F4 (verificacao final) -- retomada em 31/08/2026

**Achado de processo**: ao retomar, o branch `feat/auditoria` ja tinha sido mesclado
na `main` (PRs #9 e #10) **sem** a Task F4 ter rodado -- o merge aconteceu antes da
verificacao final, fora da ordem usual deste projeto. Trabalho continuado direto
sobre a `main` atual, num worktree novo (`chore/auditoria-verificacao-final`), com
plano de entregar as correcoes/documentacao resultantes como um PR pequeno de
acompanhamento (nao um novo `feat/auditoria`).

Progresso desta sessao:
- Suite completa via Docker antes de qualquer mudanca: backend 100% dos pacotes ok
  (build/vet/gofmt limpos), frontend 393/393 testes (lint/tsc/build limpos).
- **Achado de ambiente** (nao relacionado ao codigo): os containers `pcp_frontend`/
  `pcp_backend` que ja estavam rodando tinham imagem de 30/08 -- um dia antes da
  Auditoria (e ate da Fase 4.2) terem sido mescladas. Nem "Dados da empresa" nem
  "Auditoria" apareciam na navegacao. Reconstruido via
  `docker compose --project-directory D:/PCP-Lev -f D:/PCP-Lev/docker-compose.yml up
  -d --build` a partir do checkout principal (nao deste worktree).
- Agente `code-reviewer` (background, `opus`) sobre o diff completo da sub-entrega
  (`a1001c0..d03926d`), com atencao especial ao pinning de conexao. Achou **1 Critico**
  e **6 Altos** reais:
  - CRITICO: middleware `ConexaoDeAuditoria` fixa uma conexao do pool para TODA
    requisicao (inclusive GET/HEAD/404, sem autenticacao) -- com `DB_MAX_CONNS=20`
    isso vira um teto de 20 requisicoes HTTP simultaneas na API inteira, e um DoS
    trivial nao autenticado (bater em qualquer rota inexistente ~20x esgota o pool).
  - ALTO: fallback do middleware (Acquire falhou / set_config falhou) pode atribuir
    a auditoria ao usuario ERRADO (pior que NULL); panic no handler pula o RESET das
    variaveis de sessao antes de devolver a conexao ao pool -- mesma causa raiz.
  - ALTO: IP gravado na auditoria e forjavel (`c.RealIP()` sem `IPExtractor`
    configurado, le `X-Forwarded-For` de qualquer cliente).
  - ALTO: `senha_hash` de qualquer usuario vaza pela API/tela de auditoria (a tabela
    `usuarios` e auditada, o trigger grava a linha inteira; todo login atualiza
    `ultimo_login` e dispara o trigger).
  - ALTO: `GET /auditoria/exportar` sem limite, e busca `dados_antigos`/`dados_novos`
    (colunas pesadas) que o CSV nem usa.
  - ALTO: data/hora da auditoria aparece 3h errada na tela (diverge do CSV, que esta
    correto) -- bug de fuso horario no scan do pgx (timestamp sem tz lido como UTC,
    quando na verdade e hora de parede de Sao Paulo).
  - Relatorio completo com file:linha, causa e correcao sugerida em
    `.superpowers/sdd/reviews/` (nao versionado, so local) e no historico da sessao.
- Brief de correcao escrito (`.superpowers/sdd/reviews/task-f4-fix-brief.md`, tambem
  local) cobrindo os 7 achados Critico/Alto (com a correcao exata pedida para cada
  um) mais 3 itens baratos de Medio/Baixo (filtro `enabled` no frontend, testes de
  403 faltando, comentario desatualizado na migration 007). Dispatchado um subagente
  (`backend-architect`, `opus`, background) para implementar -- **em andamento**,
  ainda sem relatorio final nesta sessao.
- Roteiro manual via Playwright (`mcr.microsoft.com/playwright:v1.49.0-noble`, rede
  `pcp-lev_default`, contra `http://frontend`) rodado ANTES das correcoes (contra o
  codigo ja mesclado, sem os fixes do achado critico ainda): 9/9 passos -- login,
  editar fornecedor autenticado, Auditoria mostra usuario/IP corretos, modal de diff
  mostra o campo certo, exportar CSV funciona, login como usuario OPERADOR (criado
  via SQL so para o teste, removido depois), link Auditoria some da navegacao, acesso
  direto pela URL bloqueado (403 + mensagem de acesso restrito).
- Screenshots `docs/screenshots/40-auditoria-lista.png` e
  `41-auditoria-detalhe-diff.png` capturados via Playwright contra o app real.
- `docs/8_MANUAL_OPERACAO.md` ganhou a secao 14 "Auditoria" (indice, links cruzados
  de outras secoes e numeracao de Ajuda contextual/FAQ renumerados 14->15, 15->16;
  FAQ nova sobre Usuario/IP em branco em linhas antigas).

**Falta para fechar a Task F4**: aguardar o relatorio do subagente de correcao,
revisar o diff, rodar a suite completa de novo, refazer o roteiro Playwright contra
o codigo corrigido (o anterior validou o comportamento ainda SEM os fixes de
seguranca/disponibilidade), e decidir o formato de entrega (commit direto vs PR novo
a partir do worktree `chore/auditoria-verificacao-final`, ja que o `feat/auditoria`
original ja foi mesclado).

## Task F4 -- correcoes aplicadas e verificadas (mesmo dia, 31/08/2026)

Subagente (`backend-architect`, background, `opus`) implementou os 10 itens do brief
(`.superpowers/sdd/reviews/task-f4-fix-brief.md`, commitado): 4 commits em
`chore/auditoria-verificacao-final` --
`403973c fix(backend): protege o pool e a atribuicao de usuario na auditoria`,
`d64a265 fix(backend): remove senha_hash, corrige o fuso e alivia a exportacao da
auditoria`, `60b1d79 test(backend): cobre 403 da auditoria para gestor na exportacao
e para operador`, `2433c44 fix(frontend): nao consulta a auditoria quando o perfil
nao e ADMIN`. Relatorio completo em
`.superpowers/sdd/reviews/task-f4-fix-report.md` (tambem commitado).

Verificado de forma independente (nao so aceito o relatorio do subagente):
- Li o diff dos 4 commits arquivo por arquivo -- a implementacao bate com o brief
  (skip de pinning em GET/HEAD/OPTIONS + timeout de 3s no Acquire; RESET das
  variaveis de sessao movido para `defer` registrado depois do `defer Release()`,
  cobrindo retorno normal/erro/panic; `e.IPExtractor` com
  `TrustLoopback/TrustLinkLocal/TrustPrivateNet`; `camposSensiveisPorTabela` +
  `semCamposSensiveis` removendo `senha_hash` com fail-closed se o JSON nao
  desserializar como objeto; `colunasAuditoriaExportacao` sem os dois JSONB pesados;
  `normalizarRegistro` reetiquetando `data_hora` para `America/Sao_Paulo` fixo
  -03:00, com o comentario documentando a premissa de `TZ` do Postgres).
- Rodei a suite completa do backend de novo, do zero, via Docker: **build/vet/gofmt
  limpos, todos os pacotes ok**.
- **Achado de ambiente durante a verificacao**: os containers `pcp_frontend`/
  `pcp_backend` continuavam com a imagem de antes dos fixes (nem o `docker compose
  up -d --build` a partir de `D:/PCP-Lev` reconstroi o codigo do worktree -- sao
  duas arvores de trabalho diferentes). Build das imagens direto do worktree
  (`docker build ... backend/Dockerfile`, idem frontend) e troca dos containers
  `pcp_backend`/`pcp_frontend` por essas imagens, mantendo o `pcp_postgres`
  compartilhado -- **importante**: `docker run --network ... --name pcp_backend` NAO
  registra o alias DNS curto `backend` que o `docker-compose.yml` cria automaticamente
  a partir do nome do servico; precisa de `--network-alias backend`/`--network-alias
  frontend` explicito, senao o nginx do frontend (que faz `proxy_pass
  http://backend:8000`) e o roteiro de teste (que navega para `http://frontend`) 
  falham com `ERR_NAME_NOT_RESOLVED`.
- Roteiro Playwright completo refeito contra o codigo CORRIGIDO (o mesmo roteiro de
  9 passos da rodada anterior): **9/9 OK**.
- Confirmado via `curl` direto na API (`GET /auditoria?tabela=usuarios`) que
  `senha_hash` nao aparece em nenhum `dados_antigos`/`dados_novos`, e que
  `data_hora` sai com sufixo `-03:00` (timezone corrigido).
- Dados de verificacao (usuario `operador_teste`) removidos do Postgres apos os
  testes.

Commit de documentacao/ledger feito (`docs: verificacao final da Auditoria (Task F4)
e manual de operacao`, na mesma branch). Usuario escolheu "Push + PR" (mesmo padrao
das sub-entregas anteriores) via `finishing-a-development-branch`. Branch enviada:
https://github.com/gustavoflandal/PCP-Lev/pull/new/chore/auditoria-verificacao-final
(PR ainda precisa ser aberto manualmente pelo usuario nesse link -- 5 commits: os 4
de correcao mais o de documentacao). Containers `pcp_backend`/`pcp_frontend`
devolvidos ao build a partir de `D:/PCP-Lev` (main) apos a verificacao, ja que este
branch ainda nao foi mesclado.

## Fechamento -- PR #11 mesclado (31/08/2026)

Usuario abriu e mesclou o PR #11 (`chore/auditoria-verificacao-final` -> `main`,
commit de merge `f288b12`). Worktree removido apos a confirmacao de que nao havia
commits nem trabalho pendente (so os 3 arquivos de diff bruto, descartaveis, ja
listados como "nao versionado" acima).

**Fase 4, sub-entrega 1 (Auditoria) completa**: backend (dominio + repositorio +
endpoints, com o pinning de conexao corrigido) e frontend (tela de consulta com
filtros, diff campo a campo, exportacao CSV) mesclados; revisao de codigo com 1
Critico + 6 Altos, todos corrigidos com teste de regressao e verificados de forma
independente; roteiro Playwright de 9 passos duas vezes (antes e depois das
correcoes); documentacao (secao 14 do manual, 2 screenshots) e ledger atualizados a
cada etapa da sessao, nao so no fechamento.

Proxima sub-entrega da Fase 4, na ordem acordada na decisao de cronograma v2.1 (mais
acima neste arquivo): **Parametros regionais** (secao 4.6.4) -- ainda sem spec/plano
escritos nesta data.

---

# Ledger — Fase 4, sub-entrega 2: Parametros Regionais (feat/parametros-regionais)

Spec: `docs/superpowers/specs/2026-08-31-parametros-regionais-design.md`.
Plano: `docs/superpowers/plans/2026-08-31-parametros-regionais.md` (B1-B3, F1-F8).

## Progresso

### Sessao de 23/10/2026 (retomada)

- **Achado de ambiente**: o repositorio foi reinicializado desde a ultima sessao -- o
  historico agora e um unico `initial commit` (318fc0b), e o `origin` aponta para um
  Gitea local (`http://localhost:3000/Gustavo/Pcp-lev.git`), nao mais o GitHub. Esse
  commit inicial ja continha a Task B1 (migration 011 + dominio `regional`), feita numa
  sessao anterior sem registro no ledger. Branch `feat/parametros-regionais` criada
  direto sobre a `main` (sem worktree).
- **B1** validada via Docker (build/vet + 4 testes do dominio + migration 011 aplicando).
- **B2** (servico + repositorio): 5 testes novos verdes. Commit `3a45746`.
- **B3** (handler + rota em `registrarConfiguracoes`): 8 testes novos verdes
  (401 sem token em GET/PUT, 200 para Operador no GET, 403 Gestor/Operador no PUT,
  400 para formato de data/hora invalido, PUT refletindo no GET). Commit `6e6db73`.
- **Bombas-relogio de data em testes existentes** (sem relacao com esta sub-entrega,
  quebrando a suite por causa do calendario): `TestEmAtrasoTrazSoOsVencidosENaoTerminais`
  (fixture com entrega 2026-09-25) e `TestConverterCotacaoEmPedidoCompra` (entrega fixa
  2026-10-15). Corrigidos ancorando as datas no dia corrente. Commit `0969f0b`.
  **Pendente**: outros testes de handlers usam `data_entrega_prevista`/`data_validade`
  fixas em `2026-12-25` (`pedidos_compra_test.go`, `cotacoes_test.go`) -- vao quebrar do
  mesmo jeito a partir de 26/12/2026.
- Suite completa do backend via Docker (`go build/vet/test -count=1 ./...`, gofmt): verde.

Proximo: frontend, Task F1 (tipos e servico).
- **F1-F7** (frontend) concluidas, um commit por task (`635b742`..`HEAD`): tipos +
  servico, store Zustand, `formatarData`/`formatarDataHora` parametrizados em
  `lib/formato.ts`, Auditoria usando o helper compartilhado, carregador global
  `CarregarConfiguracaoRegional` em `App.tsx`, tela `ParametrosRegionais` e
  rota/navegacao/ajuda/icone `clock`.
  - Desvio do plano na F6: o teste "salvar..." procurava o toast com `findByText`,
    mas `renderizarComProvedores` nao monta o container de toasts. Trocado pelo
    padrao do projeto (`useToasts.getState().itens[0].mensagem`, como em
    `useMutacoesCadastro.test.tsx`), e acrescentada a assercao de que a store
    regional foi aplicada (o que o nome do teste ja prometia).
  - Suite completa do frontend via Docker (`node:22-alpine`, `node_modules` em volume
    nomeado `pcp_node_modules`): lint, `tsc -b`, `npm run build` e **411/411** testes.
- Proximo: Task F8 (verificacao final -- code-reviewer, roteiro Playwright,
  screenshots, secao 15 do manual).

## Task F8 (verificacao final) -- 23/10/2026

- Agente `code-reviewer` (background) sobre o diff completo + migration 011 e
  `regional.go`: **0 Critico, 0 Alto, 3 Medios, 4 Baixos**. Ponto 1 confirmado (GET exige
  autenticacao, PUT so Admin).
  - **M1 (corrigido)**: carga a frio (F5/link direto) com formato nao-padrao -- uma
    tabela cujo GET voltasse antes do GET regional ficava no formato padrao (a store e
    lida via `getState()`, sem assinatura). Correcao: `ConfiguracaoRegionalCarregada`
    no `Shell` segura o `<Outlet/>` ate a configuracao chegar (segue com defaults se
    falhar), e a store e aplicada DENTRO da `queryFn` (hook
    `useConfiguracaoRegionalServidor`), antes de o dado entrar no cache -- um `useEffect`
    rodaria depois do commit em que os filhos ja renderizaram. O antigo
    `CarregarConfiguracaoRegional` em `App.tsx` foi substituido por esse wrapper.
  - **M2 (corrigido)**: a tela deixava salvar durante o carregamento ou apos falha do
    GET, gravando os defaults por cima da configuracao real. Agora mostra carregando /
    aviso de erro (mesmo padrao de DadosEmpresa) e o formulario nasce do valor carregado
    (sem `useEffect` sobrescrevendo escolha nao salva).
  - **M3 (corrigido)**: fixtures de handlers com `2026-12-25` -> helper `dataFutura(dias)`
    em `testapi_test.go` (era a pendencia anotada acima nesta mesma sessao).
  - **B3 (corrigido)**: previa com `aria-live="polite"`.
  - **Nao corrigidos (Baixos, registrados)**: B1 -- `staleTime: Infinity` + `sair()` sem
    limpar cache: se outro admin mudar o formato em outra maquina, esta aba so ve com F5
    (logout/login nao refaz o GET); B2 -- `configuracao_regional` (e
    `configuracao_empresa`) nao tem trigger de auditoria; B4 -- `updated_at` e
    `TIMESTAMP` sem fuso, sai com `Z` deslocado 3h (confirmado via curl; a tela nao exibe
    o campo hoje, mas e o mesmo defeito ja corrigido na Auditoria).
  - Testes de regressao: `ConfiguracaoRegionalCarregada.test.tsx` (2) e 3 novos em
    `ParametrosRegionais.test.tsx`. `App.test` ajustado (conteudo agora e assincrono).
- Suites apos as correcoes, via Docker: backend gofmt/build/vet + 24 pacotes verdes
  (`-count=1`); frontend lint, `tsc -b`, build e **416/416**.
- Roteiro Playwright real (container `mcr.microsoft.com/playwright:v1.49.1-noble` na rede
  `pcp-lev_default`, `http://frontend`), containers reconstruidos a partir do branch:
  **15/15** -- defaults em Cotacoes/Auditoria, previa antes de salvar, toast, Cotacoes e
  Auditoria refletem AAAA-MM-DD/12H sem F5, **carga a frio direto em /cotacoes ja no
  formato novo (cenario do M1)**, Gestor sem link, Gestor ve o formato do sistema, URL
  direta com acesso restrito, revertido aos defaults, 800px sem rolagem horizontal.
  Usuario temporario `gestor_teste` criado e removido do Postgres; configuracao conferida
  de volta em DD/MM/AAAA / 24H.
  - Primeira execucao parou no passo 10 por erro do roteiro (o login volta para a
    ultima rota visitada, nao para `/`), e deixou o banco em AAAA-MM-DD/12H -- revertido
    via API na hora.
- Screenshots 42 (tela) e 43 (Cotacoes em AAAA-MM-DD). Manual: secao 15 "Parametros
  regionais", Ajuda contextual 15->16, Perguntas frequentes 16->17, links cruzados
  ajustados.

Pendente: decisao do usuario sobre integracao do branch (push para o `origin` Gitea +
PR, ou merge local).

---

# Ledger — Fase 4, sub-entrega 3: Seguranca e Banco de Dados (feat/seguranca-banco)

Spec (com plano de tasks embutido): `docs/superpowers/specs/2026-10-24-seguranca-banco-design.md`.
Branch empilhado sobre `feat/parametros-regionais` (ainda sem merge na `main`).

## Decisoes de 24/10/2026 (usuario)

Seguir ate a Fase 3.1 na ordem Fase 4 (3, 4, 5) -> 2.2 -> 2.3 -> 3 -> 3.1. RBAC com matriz
proposta (editavel pela tela depois); integracao por push + PR no Gitea, empilhando
branches; anexos em `bytea`; **autonomia total nas specs** (decidir e registrar aqui,
sem parar para aprovacao). `feat/parametros-regionais` enviado ao Gitea (PR a abrir pelo
usuario: http://localhost:3000/Gustavo/Pcp-lev/pulls/new/feat/parametros-regionais).

## Progresso

- **B1** dominio `banco` (Status/Teste/MascararHost, erro do driver nunca propagado) +
  repositorio (versao, tamanho, 10 maiores tabelas do `current_schema()`, pool, conexoes).
- **B2** `GET /configuracoes/banco` e `POST /configuracoes/banco/testar`, so Admin; teste
  procura usuario/senha/DSN no corpo da resposta.
- **B3** rate limiting (global por usuario+IP ou IP; login por IP) + cabecalhos de
  seguranca na API (Echo Secure, CSP `default-src 'none'`, HSTS so por HTTPS).
  Config `RATE_LIMIT_RPS`/`RATE_LIMIT_RAJADA`/`RATE_LIMIT_LOGIN_POR_MINUTO` (0 desliga;
  zerado nos testes, por isso os testes existentes nao mudaram).
- **F1/F2** tela "Banco de dados" (cartoes Conexao, Identificacao, Pool, Ultimo backup,
  Armazenamento), `formatarBytes`/`formatarMilissegundos`, rota/navegacao/icone/ajuda.
- **F3** nginx: cabecalhos num snippet incluido em `/` e `/assets/` (**achado**: o
  `add_header` do `location /assets/` anulava os herdados -- os bundles saiam sem nenhum
  cabecalho de seguranca); `/api/` so com os do backend (sem duplicar). CSP com
  `script-src 'self'` -> o script inline de tema virou `public/tema-inicial.js`.
- Decisoes provisorias: "Ultimo backup" mostra "Nenhum backup registrado" (backup real e
  §4.6.8, adiado); limites 20 req/s rajada 60 e 5 falhas de login/min.

## Revisao (code-reviewer) -- 1 Alto, 3 Medios, 5 Baixos, todos corrigidos

- **ALTO**: o nginx ANEXAVA o `X-Forwarded-For` do cliente e a API confia em XFF vindo de
  rede privada -> um cliente da LAN trocava de "IP" a cada tentativa e escapava do limite
  de login (e falseava o IP da auditoria, problema que ja existia antes). Correcao: nginx
  sobrescreve com `$remote_addr`; porta 8000 publicada so em `127.0.0.1` (direto na porta,
  o cliente chegaria com o IP do gateway Docker, que e privado). Verificado ao vivo: 7
  tentativas com XFF forjado diferente -> 5x401 e depois 429.
- Medios: limite de login agora conta **so falhas** (limitador proprio -- o do Echo gasta a
  ficha antes do handler; verificado ao vivo: 10 logins certos seguidos do mesmo IP -> 200);
  balde global por usuario+IP; crescimento do store resolvido pelo item ALTO.
- Baixos: limitador depois do CORS; causa real da falha no log; timeout de 3s no
  diagnostico; "ativas" so `state='active'`; tela nao mostra "Conectado" com dado velho
  junto do erro.
- **Achado meu na verificacao visual**: "Linhas (estimativa)" mostrava 0 em tabelas com
  dados -- `n_live_tup` zera quando o container do Postgres e recriado. Agora usa o maior
  entre `n_live_tup` e `pg_class.reltuples`, e nulo ("—") quando nao ha nenhum dos dois.

## Verificacao

- Backend: gofmt/vet/build + 25 pacotes verdes (`-count=1`). Frontend: lint, `tsc -b`,
  build, **426/426**.
- Playwright (container com IP fixo na rede, para nao herdar balde de login de outro
  container -- o Docker reaproveita IPs): **13/13** -- tema aplicado pelo script externo,
  14 telas navegadas com **zero violacoes de CSP**, ViaCEP funcionando sob a CSP, host
  mascarado, 10 maiores tabelas, nenhuma credencial na tela, Testar conexao, 800px sem
  rolagem, Gestor sem link e com acesso restrito na URL, aviso de limite no login.
  Usuario temporario `gestor_teste` criado e removido.
- Screenshot 44; manual secao 16 "Banco de dados e seguranca" (Ajuda 16->17, FAQ 17->18,
  links ajustados); cronograma com itens 3-5 da Fase 4 marcados como entregues.

Proximo: push de `feat/seguranca-banco` e sub-entrega 4 (Parametros de Negocio, so
Estoque e Compras).

---

# Ledger — Fase 4, sub-entrega 4: Parametros de Negocio (feat/parametros-negocio)

Spec: `docs/superpowers/specs/2026-10-24-parametros-negocio-design.md`. Empilhado sobre
`feat/seguranca-banco`.

## Decisoes (autonomas, 24/10/2026)

So entra parametro que o sistema aplica: tolerancia de excesso no recebimento, alcada do
Gestor na emissao de PC (acima do limite so Admin), minimo de cotacoes respondidas por
peca (fornecedores distintos, 90 dias) a partir de um valor, lead time padrao nos
cadastros novos. Metodo de custeio so gravado (consumidor: Fase 3, 5.1.D). Saldo negativo
fica sempre bloqueado (CHECK da migration 002), mostrado como informacao fixa. Fora:
numeracao automatica, FIFO/FEFO, antecedencia, estoque minimo padrao, NF-e.

## Progresso

- B1 migration 012 (singleton + CHECK de recebimento com folga 2x) + dominio `negocio`
  (porcentagem em centesimos via `dinheiro.Dinheiro`, sem float) + repositorio.
- B2 handler (GET autenticado, PUT Admin). B3/B4 `pedidocompra`: recebimento com limite por
  funcao dentro da transacao; `Emitir(ctx, id, autor, perfil)` com alcada (403) e cotacoes
  (409 listando todas as pecas que faltam).
- F1 tela "Parametros de negocio" (react-hook-form + zod, `noValidate`; campo de limite
  oculto em vez de desabilitado -- input `disabled` vira `undefined` no RHF). F2 lead time
  padrao nos formularios novos de Fornecedor e Parte/Peca (so em cadastro novo e nao tocado).
- **Achado meu**: a emissao/cancelamento de PC nao tinham `onError` -- o 403/409 novos
  seriam silenciosos na tela. Corrigido com toast da mensagem da API (+ teste).

## Revisao (code-reviewer) -- 0 Critico/Alto, 4 Medios, 6 Baixos

Corrigidos: M1 corrida PUT x emitir furava a alcada (emissao agora e UPDATE condicionado a
Rascunho + valor conferido; edicao so grava em Rascunho); M2 PUT da configuracao inteira
sobre cache antigo (tela sempre rebusca e so mostra o form depois); M3 contava cotacoes, nao
fornecedores, e aceitava data futura; M4 teste da janela de 90 dias quebrava entre 21h e
24h (CURRENT_DATE em America/Sao_Paulo x `tempo.Hoje()` UTC); B1 trigger de auditoria em
`configuracao_negocio`; B2 `::bigint` no CHECK; B3 teto de valor; B5 pendente negativo.
Aceito e registrado na spec: B4 (PUT parcial zera campos -- contrato e "configuracao
inteira"). B6: spec ajustada (numeros JSON; tolerancia sobre o solicitado).

**Atencao de ambiente**: a migration 012 foi editada depois de aplicada no banco local de
desenvolvimento (trigger + `::bigint`); o migrator nao reaplica versao registrada, entao o
banco local foi corrigido a mao (CREATE TRIGGER + troca do CHECK). Bancos novos recebem a
012 completa. Nao fazer isso depois que um branch for enviado/mesclado -- ai e migration nova.

## Verificacao

- Backend: gofmt/vet + 26 pacotes verdes (`-count=1`). Frontend: lint, `tsc -b`, build, 438/438.
- Playwright **13/13** (rodado antes e depois das correcoes, IP fixo na rede): salvar
  parametros, API reflete, novo fornecedor com lead time 12, Gestor barrado pela alcada com
  a mensagem na tela, barrado por cotacoes ("PW-NEG-001 (0 de 1)"), emite dentro das regras,
  recebimento 106/100 recusado e 105/100 aceito com 5%, PC concluido com 105, Gestor sem
  acesso a tela, configuracao revertida. Dados de teste (fornecedor/peca/PC "PW-NEG") e
  usuario `gestor_teste` removidos por SQL. Trilha de auditoria conferida (UPDATE com
  usuario e IP).
- Screenshot 45; manual secao 17 "Parametros de negocio" (Ajuda 17->18, FAQ 18->19);
  cronograma item 6 marcado.

Proximo: sub-entrega 5 (Integracoes: SMTP + teste de envio).

---

# Ledger — Fase 4, sub-entrega 5: Integracoes / SMTP (feat/integracoes-smtp)

Spec: `docs/superpowers/specs/2026-10-24-integracoes-smtp-design.md`. Empilhado sobre
`feat/parametros-negocio`. **Fecha a Fase 4** (rodada atual: itens 1-7 do cronograma).

## Progresso

- B1 `platform/cripto` (AES-256-GCM, nonce aleatorio, prefixo `v1:`, contexto como AAD) +
  `CHAVE_MESTRA_SEGREDOS` (opcional; invalida impede a subida).
- B2 migration 013 (`configuracao_smtp`) + dominio `email` (senha nunca devolvida; PUT com
  senha vazia mantem, `remover_senha` apaga) + repositorio.
- B3 enviador `infra/smtp` (net/smtp, TLS implicito/STARTTLS obrigatorio, TLS 1.2+, prazo
  de 15 s, cancelamento fecha a conexao, PLAIN ou LOGIN so sob TLS, cabecalhos UTF-8 sem
  injecao) + `/configuracoes/smtp` (GET/PUT/POST testar, so Admin) + **Mailpit** no
  compose (perfil `dev`, `docker compose --profile dev up -d mailpit`, UI em 127.0.0.1:8025).
- F1 tela "Integracoes" (SMTP + envio de teste).

## Revisao (code-reviewer) -- 0 Critico/Alto, 4 Medios, 8 Baixos, todos tratados

- **M1** qualquer admin recuperava a senha trocando so o host e usando "testar" -> senha
  amarrada ao destino (AAD) + trocar destino exige redigitar (400). Teste do cenario.
- **M2** chave mestra de desenvolvimento como default no compose -> removida; chave local
  gerada so no `.env` (que nao existia -- repo reinicializado; agora criado, ignorado pelo
  git, so com essa chave).
- **M3** texto cifrado copiado para sempre na tabela `auditoria` pela trigger generica ->
  trigger propria grava marcador `ausente`/`definida`/`definida (trocada)`. Teste confere a
  tabela crua.
- **M4** so AUTH PLAIN -> LOGIN como alternativa.
- Baixos: erros por categoria (sem IP/banner/certificado interno -- "scanner de portas");
  `NENHUMA` + usuario -> 400; limites de tamanho; remover senha com confirmacao e a partir
  do valor gravado; `mutacao.reset()` (senha no cache do TanStack); `context.AfterFunc`.
- **Ambiente**: a 013 foi refeita apos aplicada no banco local (branch ainda nao enviado):
  DROP da tabela + `DELETE FROM schema_version WHERE id = 13` + linhas de auditoria do SMTP
  (de teste) apagadas; a API reaplicou a 013 nova na subida. Tabela de migrations:
  `schema_version(id, descricao, data_aplicacao)`.

## Verificacao

- Backend: gofmt/vet + 29 pacotes verdes, incluindo **envio real no Mailpit** (rodar com
  `PCP_TEST_SMTP=mailpit:1025 PCP_TEST_SMTP_API=http://mailpit:8025`; sem elas o teste e
  pulado). Frontend: lint, `tsc -b`, build, 448/448.
- Playwright **16/16** (antes da revisao 14/14): envio real chega no Mailpit com acento no
  remetente, "Nenhuma" + usuario recusado no form, senha nunca na API/pagina, STARTTLS nao
  cai para texto claro, troca de host sem senha recusada e nada gravado, trilha so com
  marcador (tabela crua sem `v1:`), remover com confirmacao, Gestor sem acesso,
  configuracao revertida.
- Screenshot 46; manual secao 18 "Integracoes" (Ajuda 18->19, FAQ 19->20); cronograma item 7.

Proximo: Fase 2.2 (RBAC) com matriz proposta (decisao de 24/10/2026).

---

# Ledger — Fase 2.2a: RBAC, perfis e permissoes (feat/rbac)

Spec: `docs/superpowers/specs/2026-10-24-rbac-design.md`. Empilhado sobre
`feat/integracoes-smtp`. Decisao do usuario (24/10/2026): construir com a **matriz
proposta**, sem esperar a sessao com o Gestor de Operacoes (que ajusta pela tela).

## Progresso

- B1 migration 014 (perfis, catalogo de 39 permissoes espelhado em Go, matriz, FK de
  usuarios.perfil, triggers) + dominio `acesso` + repositorio. Teste: catalogo do banco =
  catalogo do codigo.
- B2 `ExigirPermissao` em todos os handlers (resolvedor no contexto por middleware global
  `Autorizacao`; `ExigirPerfil`, `Perfil.Valido` e `PodeGerenciarCadastros` removidos);
  login e `/auth/eu` com `permissoes` e `perfil_nome`; alcada de emissao vira a permissao
  `pedidos_compra.emitir_acima_alcada`. Testes de leitura passaram a usar `CONSULTA` (o
  `OPERADOR` virou o Operador de Montagem, com escopo menor) e o Gestor ganhou auditoria.
- B3 `/acesso/*`.
- F1 frontend guiado por permissao (`usePode`, `PERMISSOES`): navegacao (secao vazia some),
  cadastros, configuracoes, compras/estoque/estrutura (antes mostravam acoes a todos), Painel,
  guarda de rota `ExigePermissao`, `SessaoSincronizada` (refaz `/auth/eu` ao abrir).
  Testes: espelho da matriz em `testes/permissoesPorPerfil.ts` aplicado pelo `setup.ts` a
  fixtures SEM permissoes; `entrarComoPerfil` para telas antes testadas sem sessao.
- F2 tela "Perfis e permissoes" (matriz por modulo, sensiveis sinalizadas, ADMIN so leitura,
  novo perfil copiando outro, excluir personalizado sem usuarios, confirmar descarte).

## Revisao (code-reviewer) -- 0 Critico, 1 Alto, 3 Medios, varios Baixos, todos tratados

- **A1** corrida no cache repunha permissao revogada sem prazo -> contador de geracao + TTL
  60 s (teste deterministico com repositorio que segura a leitura).
- **M1** `/auth/eu` em cache de outro usuario aplicado apos logout/login na mesma aba ->
  chave por usuario + `data.id` conferido + `queryClient.clear()` no logout (achou de quebra
  um teste do App que dependia do cache vazado entre testes).
- **M2** `configuracoes.perfis` equivalia a ADMIN -> ninguem edita o proprio perfil nem
  concede o que nao tem.
- **M3** perfis/perfil_permissoes filtraveis na auditoria.
- Baixos: lista nil normalizada no dominio; converter cotacao exige `pedidos_compra.incluir`;
  exportar auditoria com guarda; catalogo do frontend completo + **teste cruzado Go x TS**
  (`TestCatalogoDoFrontendIgualAoDoCodigo`; o script de testes Go agora monta o repositorio
  inteiro em /repo); textos de ajuda; teste do login real com permissoes vindas do servidor;
  espelho de perfis completo e com erro para perfil desconhecido; avisos visiveis na tela.
- Meu: seed com acentos (nomes iam direto para a tela sem acento).
- **Ambiente**: 014 refeita no banco local antes do push (usuarios de teste removidos, tabelas
  dropadas, CHECK antigo restaurado, `schema_version` 14 apagada, API reaplicou).

## Verificacao

- Backend 30 pacotes verdes (gofmt/vet). Frontend lint/tsc/build, **465/465**.
- Playwright **17/17**: Admin ve e edita a matriz; Almoxarife ve so o seu escopo, URL direta de
  Cotacoes restrita, API 403; Admin concede "Ver cotacoes" pela tela e o Almoxarife passa a ver
  (sem "Nova cotacao"); Operador sem compras/ajuste/exportacao e Painel sem widget de pedidos;
  Comprador com cotacoes; matriz revertida. Usuarios de teste criados e removidos por SQL.
- Screenshot 47; manual secao 19 "Perfis e permissoes" com a matriz inicial (Ajuda 20, FAQ 21);
  cronograma Fase 2.2 com status 2.2a entregue.

Proximo: Fase 2.2b (gestao de usuarios: cadastro, campos estendidos do §4.7.3, situacao,
permissoes individuais com justificativa, redefinicao de senha, troca de perfil com efeito
imediato -- o perfil hoje vem do token).

---

# Ledger — Fase 2.2b: Gestao de usuarios (feat/usuarios)

Spec: `docs/superpowers/specs/2026-10-24-usuarios-design.md`. Empilhado sobre `feat/rbac`.
Autonomo (decisao do usuario): specs decididas por mim e registradas aqui.

## Progresso

- B1 migration 015 (matricula/telefone/setor/admissao/desligamento, `situacao` com
  `ativo` GENERATED, `deve_trocar_senha`, `usuario_permissoes` com justificativa >= 10 e
  auditoria, permissao `configuracoes.usuarios`). Login distingue bloqueado/inativo.
- B2 permissoes resolvidas POR USUARIO (`acesso.Servico.AcessoDoUsuario`, cache geracao + TTL)
  em vez do perfil do token -> efeito imediato de perfil/situacao/overrides. `ExigirPermissao`:
  inativo 401 `USUARIO_INATIVO`; troca pendente 403 `TROCA_DE_SENHA_OBRIGATORIA`. Helper de
  teste cria usuario real por perfil (antes todo token de teste tinha ID 1 = admin).
- B3 `/usuarios` (+ `/usuarios/opcoes`: perfis e catalogo sem exigir `configuracoes.perfis`).
- F1 `/trocar-senha` fora do Shell (obrigatoria redireciona via RotaProtegida; voluntaria por
  Preferencias), interceptador marca a troca ao receber 403; tela Usuarios (filtros, criar com
  senha temporaria sugerida, situacao, redefinir senha, permissoes individuais); rotulos de
  permissao extraidos para `lib/rotulosPermissoes.ts`; Badge sem quebra de linha.

## Decisoes

- 401 em `/auth/trocar-senha` = senha atual errada (nao derruba a sessao), salvo `USUARIO_INATIVO`.
- `/auth/eu` e troca de senha recusam usuario bloqueado/inativo (sessao aberta cai).
- Desfazer uma RETIRADA equivale a conceder -> editor precisa ter a permissao.
- Promover a ADMIN apaga as permissoes individuais (voltariam sem justificativa num rebaixamento).

## Revisao (code-reviewer) -- 1 Alto, 4 Medios, 5 Baixos

- **Alto** tomada de conta: quem tem `configuracoes.usuarios` redefinia a senha (ou reativava)
  alguem com mais poderes -> editor precisa ter todas as permissoes CONFIGURADAS do alvo.
- **M** corrida do ultimo ADMIN -> escritas de gestao em transacao com `pg_advisory_xact_lock`
  + `FOR UPDATE` (teste com dois ADMIN se inativando em paralelo: sobra 1, 200 + 409).
- **M** atualizacao perdida -> estado lido (perfil, situacao) conferido na escrita, 409.
- **M** tela de permissoes usava as efetivas (vazias para novo/bloqueado) -> configuradas.
- **M** `/auth/eu` em cache reabria a troca de senha -> `removeQueries` no sucesso.
- Baixos tratados: motivo "desativado" no login; individuais apagadas ao virar ADMIN.
- **Pendentes (fora do escopo, registrados)**: revogar tokens emitidos ao redefinir senha
  (`senha_alterada_em` x `iat`); invalidacao de cache entre replicas (LISTEN/NOTIFY);
  `PUT /auth/preferencias` ainda aceita token de bloqueado (inofensivo).

## Verificacao

- Backend todos os pacotes verdes (gofmt/vet). Frontend lint/tsc, **477/477**.
- Playwright **16/16** (`roteiro-usuarios.mjs`): cadastro pela tela, primeiro acesso forcado
  para a troca (URL direta tambem), API 403 com codigo, Consulta sem "Usuarios", permissao
  individual com efeito imediato, bloqueio derruba sessao aberta com o motivo, login bloqueado
  401, senha redefinida exige nova troca, Preferencias > Alterar senha.
- Screenshots 48-50; manual secao 20 "Usuarios" (Ajuda 21, FAQ 22) + nota no acesso;
  cronograma Fase 2.2 concluida.

Proximo: Fase 2.3 (Clientes e Centros de Trabalho).

---

# Ledger — Fase 2.3: Clientes e Centros de Trabalho (feat/clientes-centros)

Spec: `docs/superpowers/specs/2026-10-24-clientes-centros-design.md` (decidida de forma
autonoma). Empilhado sobre `feat/usuarios`.

## Progresso

- Backend: migration 016 (clientes, centros_trabalho, triggers de updated_at/auditoria, 8
  permissoes, matriz inicial), dominios `cliente`/`centrotrabalho`, repositorios (filtro extra
  por igualdade `comIgualdade`; etapa ordena pelo fluxo com array_position), handlers.
  `TabelasAuditadas` ganhou usuario_permissoes (esquecida na 015), clientes, centros_trabalho.
- Frontend (feito por subagente frontend-developer, revisado por mim): telas no molde de
  Fornecedores; `useListagem`/`ParametrosListagem` com `filtros` genericos; `BarraDeFiltros`
  com `filtrosExtras`; selo "Contrato vencido"; permissoes/rotulos/espelho de testes.

## Revisao -- 0 Alto, 2 Medios, 3 Baixos, todos tratados

- M uf CHAR(2) devolvia "  " -> VARCHAR(2) (016 editada antes do push; banco local corrigido
  com ALTER ... USING rtrim(uf)).
- M capacidade arredondada pelo NUMERIC(3,1) / 0,04 virava 500 -> uma casa decimal no
  dominio e no formulario.
- B busca por CNPJ pontuado; datas com ano de 5 digitos; pagina 1 imediata ao trocar filtro.

## Verificacao

- Backend todos os pacotes verdes; frontend lint/tsc, **499/499**.
- Playwright **6/6** (`roteiro-clientes.mjs`): menu, cadastro de cliente com CNPJ formatado e
  contrato vencido, CNPJ duplicado recusado, centro com codigo em maiusculas, filtro por etapa.
- Screenshots 51-52; manual secoes 21 Clientes e 22 Centros (Ajuda 23, FAQ 24); cronograma.

Fora do escopo (Fase 3): FK pedidos_venda -> clientes, centro padrao do usuario, filiais.

Proximo: Fase 3 (Producao).

---

# Ledger — Fase 3: Producao (feat/producao)

Spec: `docs/superpowers/specs/2026-10-24-producao-design.md` (autonoma). Empilhado sobre
`feat/clientes-centros`.

## Progresso

- Backend (eu): migration 017 (pedido x cliente; OP com Liberada e unicidade so de OP ativa por
  item; reservas com custo orcado/consumo; apontamento com centro e custo/hora congelado;
  numeros_serie; metrologia_serie; exige_metrologia; CMP em saldo_estoque; custo_hora no centro;
  14 permissoes). Dominios `pedidovenda` e `producao`; repositorios transacionais (liberacao
  tudo-ou-nada com lista de faltas, consumo ao sair da Separacao, conclusao com entrada do PA,
  pedido Pronto para Envio, entrega); CMP no recebimento do PC.
- Frontend (subagente frontend-developer com o contrato = structs Go; revisado por mim): pedidos
  de venda, Kanban, OPs, detalhe com apontamento/avanco/teste/metrologia/custo, ficha as-built
  com QR (`qrcode@1.5.4`), metrologia; produto exige metrologia; centro custo/hora.

## Revisao backend -- 0 Alto, 4 Medios, 8 Baixos, tratados

- M ordem unica de travamento pedido -> OP -> serie (OPs do mesmo pedido concluindo juntas;
  cancelar pedido x liberar/gerar OP; teste x avanco).
- M custo vazava sem `producao.custos` (reservas, CMP do estoque, custo/hora do centro).
- B: CMP com estoque legado sem custo; mensagem para pedido com itens ja liberados; numeracao sem
  truncar; apontamento so do proprio operador (Gestor destrava); metrologia vencida bloqueia;
  custo/hora congelado; migracao normaliza apontamentos legados.
- Achado meu no Playwright: **TIMESTAMP rotulado como UTC** (hora de Sao Paulo) -> horarios 3 h
  adiantados no navegador em todo o sistema. Codec de timestamp com o fuso da sessao
  (`infra/db/fusohorario`), no pool da API e de testes.

## Verificacao

- Backend todos os pacotes verdes (fluxo completo de ponta a ponta em `producao_test.go`).
  Frontend lint/tsc, **530/530**.
- Playwright **17/17** (`roteiro-producao.mjs`, dados por `pw3-dados.sql`, navegador em
  America/Sao_Paulo): pedido -> OP -> liberar -> Kanban -> 4 etapas com apontamento -> teste
  bloqueia sem aprovacao -> aprovacao + metrologia -> concluir -> custo -> Pronto para envio ->
  entrega -> ficha as-built com QR -> metrologia a vencer.
- Screenshots 53-58; manual secoes 23-25 (Ajuda 26, FAQ 27); cronograma Fase 3 concluida.

Fora do escopo: PEPS, Kanban configuravel, backflushing, calendario, quiosque/TV, lote/serie de
componentes (recebimento fiscal v1.2), etiqueta fisica, notificacoes. npm audit acusou 16
vulnerabilidades em dependencias de dev -- nao investigado (Fase 5).

Proximo: Fase 3.1 (Anexos em bytea).

---

# Ledger — v1.2 (recebimento fiscal, rastreabilidade, midia) e Fase 3.1 (anexos) — feat/recebimento-fiscal

Specs (autonomas): `docs/superpowers/specs/2026-10-24-v12-recebimento-fiscal-design.md` e
`docs/superpowers/specs/2026-10-24-fase31-anexos-design.md`. Empilhado sobre `feat/producao`.
Migrations 018 (arquivos/anexos/flags), 019 (recebimento fiscal), 020 (consumo rastreado).

## Progresso

- R1 arquivos (bytea, SHA-256, miniatura, URL assinada HMAC 5 min) + midia de produto/peca + flags.
- R2/R3 nota fiscal de entrada (Rascunho -> Conferida -> Efetivada, cancelar/estornar), pendencias
  BLOQUEIO/APROVACAO/AVISO, rateio de custos no CMP, de-para por fornecedor, XML da NF-e; o
  recebimento direto no PC saiu (encerramento com saldo entrou no lugar).
- R4 lotes (FEFO na OP), series de componente, kardex com documento, origem do saldo, rastreio do
  lote ao campo, ficha as-built com series/lotes.
- 3.1: categorias fechadas por entidade (OP, fornecedor, PC, PV, cliente; so ANEXO), registro
  encerrado nao perde anexo (409), vencimentos de fornecedor/cliente por permissao, laudos da OP na
  ficha as-built; componente `AnexosDoRegistro` no frontend.
- Frontend de R2-R4 e da 3.1 por subagentes frontend-developer (contrato = structs Go).

## Revisao backend v1.2 -- 2 Altos, 9 Medios, 9 Baixos, tratados

- A: liberacao da OP contava lote vencido como disponivel (agora lotes validos + parte sem rastro,
  e series em estoque); efetivacao sem travar o PC (agora trava e recusa PC encerrado).
- M: versao da nota (conferir/efetivar recusam edicao concorrente, 409); chave unica so entre notas
  ativas; chave confere com CNPJ/modelo/serie/numero; soma dos itens x total e linha x qtd*unit;
  preco pelo total da linha; fator x de-para; validade minima a partir de hoje; lote existente com
  outra validade bloqueia; custo oculto sem `producao.custos`; anexos (principal opcional, nota
  imutavel, dimensao de imagem, UUID).
- B: series so quando a peca controla; quantidade do lote como digitada; rateio sem linhas nao
  recebidas; certificado invalido/XML grande com erro proprio; ajuste exige validade.
- Decisao: bonificacao mantem o valor da nota (entra na soma), custo zero no rateio.
- Contrato acertado a pedido do frontend: PC expoe `motivo_encerramento`/`encerrado_por`; nota
  aceita `origem` (XML preservado nas edicoes). `reservas_lote` nao e auditada (segue o backend).

## Verificacao

- Backend: todos os pacotes verdes. Frontend: tsc/eslint ok, **622/622**.
- Playwright `roteiro-recebimento.mjs` **12/12** (dados `pw12-dados.sql`): importar XML -> de-para
  memorizado -> rascunho com XML anexado -> series bipadas -> conferir -> efetivar -> lotes ->
  rastreio do lote -> kardex -> origem do saldo -> estorno -> lista com selo XML.
- Playwright `roteiro-anexos.mjs` **7/7**: foto + datasheet da peca; laudo em OP concluida (sem
  remover); laudo na ficha as-built; certificado do fornecedor com validade -> documentos a vencer.
- Achado no Playwright: o XML trazia o CFOP de saida do emitente (5102) para a nota -> agora vira o
  de entrada (1102), com teste.
- Screenshots 59-71; manual 10.3/10.4 reescritas, secoes 26-28 novas (Ajuda 29, FAQ 30);
  cronograma com v1.2 e 3.1 concluidas.

## Pendencias pequenas -- resolvidas no fechamento

- Formato da nota padronizado em numero/serie ("NF 1277/1") em todo o frontend, como o backend ja
  fazia no kardex e na ficha as-built.
- Tabela de Fornecedores (e Clientes) cabia mal com as acoes: rotulo "De-para" encurtado (aria-label
  completo mantido) e acoes com quebra de linha -- 1170 px numa area de 1220 px.
- Fora do escopo: antivirus, consulta SEFAZ, recorte de imagem, RMA, assinatura digital, anexos
  por e-mail, anexos em cotacao.

Proximo: Fase 5 (testes integrados, UAT, deploy) e decidir o merge da pilha de branches.

---

# Ledger — Fase 5: Testes, UAT e Deploy (feat/fase5)

Spec (autonoma): `docs/superpowers/specs/2026-10-24-fase5-testes-uat-deploy-design.md`. Empilhado sobre
`release/v1.2` (PR #5 aberto, aguardando o usuario mesclar).

## 5a Seguranca

- Auditoria OWASP (agente security-auditor, so leitura): 2 Criticos, 4 Altos, 5 Medios, 9 Baixos, 8 Info.
- Corrigidos: C1 segredo JWT padrao (compose sem default; producao recusa exemplos; .env local ganhou
  segredo aleatorio), C2 Postgres em 0.0.0.0 com superusuario (dev em loopback; prod sem porta e papel
  pcp_app sem SUPERUSER via deploy/initdb), A1 admin com senha de instalacao (troca exigida no boot em
  producao), A2 corrida no limitador (reserva antes do handler) + bloqueio por conta (5 falhas:
  15/30/60 min), A3 versao_sessao no JWT (claim sv; troca/redefinicao/bloqueio derrubam tokens; a troca
  devolve token novo), A4 Go 1.26.10 + x/image, jwt, pgx, x/net... (govulncheck: 0 alcancaveis) + npm audit
  fix; M1 IDOR ao vincular arquivo, M4 politica de senha (10+), M5 oraculo em trocar-senha, B1 tempo igual,
  B2 sessao conferida em toda rota, B3 perfil so por quem o domina, B4 25 MP e 2 decodificacoes, B5
  server_tokens/imagens, B6 timeouts, B7 trilha sem senha_hash (migration 021) e exportacao limitada, B9 CI.
- Aceitos (docs/9_SEGURANCA.md): zod 3 e react-router 6 (major), detalhe do teste SMTP, chave HMAC derivada
  do JWT, assinatura do XML da NF-e, URL assinada no access log, arquivos orfaos.
- Go 1.26 vet passou a recusar format string nao constante (6 chamadas de bloq em notaentrada).

## 5b Testes

- E2E versionado: `e2e/run.sh` sobe stack isolada (projeto pcp-e2e, banco novo, portas 3110/8100/5543/8125),
  10 roteiros, 132 passos verdes. Roteiro de negocio refeito (tolerancia agora por nota fiscal); roteiro de
  seguranca usa login inexistente (errar o admin 5x bloquearia a conta para os seguintes).
- Carga k6 (`e2e/carga/run.sh`, 30 VUs, 200 mil movimentacoes): leitura p95 9,3 ms, escrita p95 6,0 ms,
  0% de erros.
- Cobertura: frontend 95% linhas / 83% ramos; backend 74,8% dos statements com -coverpkg (por pacote o
  numero engana: repository 16% sozinho, 78% somado aos testes de integracao). Lacunas cobertas com testes
  unitarios de pedidovenda (validacao) e controle (100%).

## 5c Deploy

- `docker-compose.prod.yml` + `deploy/` (Caddyfile, nginx-proxy.conf com real_ip, initdb, backup.sh,
  restaurar.sh, .env.prod.example). Validado numa stack de teste: HTTPS + HSTS, 80->443, admin forcado a
  trocar senha, pcp_app sem superusuario dono das 43 tabelas, backup e restauracao com dono preservado.
- Runbook `docs/10_IMPLANTACAO.md`.

## 5d/5e

- `docs/11_ROTEIRO_HOMOLOGACAO.md` (16 cenarios por perfil) e `docs/12_TREINAMENTO.md` (trilhas por perfil).
  Execucao fica com o Gestor/usuarios.

## Proximo

Usuario mesclar PR #5, depois PR da Fase 5; homologacao com o Gestor; provisionar o servidor.

---

# Ledger — Paineis por setor / dashboards (feat/paineis)

Pedido do usuario (24/10/2026): graficos no painel e paineis por setor com permissao de visualizacao.
Decisoes do usuario (AskUserQuestion): paineis de Compras, Recebimento e estoque, Producao, Vendas/expedicao
e Qualidade; permissao propria por painel; atualizacao automatica com modo TV e intervalo configuravel.
Spec: `docs/superpowers/specs/2026-10-24-paineis-dashboards-design.md`. Empilhado sobre feat/fase5.

- Backend: migration 022 (paineis.compras|estoque|producao|vendas|qualidade, ordens 891-895, matriz por
  perfil), dominio `painel`, `painel_repo.go` (agregacoes em SQL, series mensais/semanais completas),
  `GET /paineis/inicio` (blocos pela permissao do modulo) e `/paineis/<setor>?dias=` (permissao propria;
  valor em estoque so com producao.custos). Testes com cenario semeado e numeros conferidos a mao.
- Achado no Playwright: lead time de producao negativo (liberacao com hora x conclusao so data) -> dias de
  calendario, com teste de OP liberada e concluida no mesmo dia. Horas por centro sem arredondar.
- Frontend (subagente frontend-developer): recharts 3.10.1 (exato), componentes de indicador e grafico com
  "Ver dados" (tabela equivalente), barra de controles (periodo, atualizacao, modo TV na URL), modo TV com
  Fullscreen API e inatividade suspensa, menu "Paineis" por permissao, Painel inicial refeito. Eu acrescentei
  marcas inteiras nos eixos de contagem e eixo de moeda mais largo.
- E2E: roteiro-paineis (15 passos: Painel inicial, periodo na URL, Ver dados, modo TV, Comprador sem
  Producao, permissao individual libera na hora). Suite completa 11 roteiros / 147 passos verdes. Carga com os
  paineis: p95 9,3 ms, 0% erros. Screenshots 72-78 com dados de demonstracao (`e2e/carga/demo-paineis.sql`).
- Manual: secao 3 reescrita, secao 29 nova (Ajuda 30, FAQ 31).
- Pendencias: o JWT expira em 8 h -- uma TV ligada o turno inteiro precisa de login de novo (decisao de
  backend: token de quiosque ou refresh); bundle passou de 500 kB por causa do recharts (dividir o codigo).

---

# Ledger — Imprimir / PDF em todas as telas (feat/impressao)

Pedido do usuario (24/10/2026): "todas as telas devem conter um botao para impressao em pdf dos dados da tela".
Decisao: impressao do navegador (destino "Salvar como PDF"), nao PDF gerado no servidor -- vale para toda
tela, inclusive as futuras, e mantem tabelas/graficos vetoriais.

- Botao "Imprimir / PDF" no Cabecalho (toda tela do Shell) e icone de impressora em todo Modal (com
  dialogo aberto, imprime so o dialogo). Ctrl+P tem o mesmo leiaute.
- `@media print` (index.css): A4, tokens claros mesmo no tema escuro, sem menu/cabecalho/toasts/acoes;
  botao com icone some (acao), botao so de texto fica (dado clicavel, ex.: numero do pedido); titulo de
  coluna ordenavel e etapas da trilha levam data-imprimir; coluna Acoes some; thead repetido.
- CabecalhoImpressao: tela, empresa, quem imprimiu, data/hora; document.title vira o nome do arquivo.
- Graficos: viewBox + largura 100% com altura mantida antes de imprimir (lib/impressao.ts). Forcar largura
  ou altura do container do recharts faz ele redesenhar durante a impressao e sair em branco -- conferido
  gerando PDFs reais (page.pdf) de lista, painel, detalhe de OP, dialogo e tema escuro.
- E2E: roteiro-paineis +2 passos (botao e midia de impressao). Frontend 693 testes. Manual secao 2.
