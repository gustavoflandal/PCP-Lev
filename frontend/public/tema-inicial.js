// Carregado de forma sincrona no <head> do index.html (sem defer/async), antes
// do primeiro paint. Fica num arquivo proprio, e nao inline, para a CSP do
// nginx poder usar script-src 'self' sem 'unsafe-inline' nem um hash que
// teria de ser recalculado a cada mudanca deste codigo.
// Aplica tema/contraste/densidade/fonte antes do primeiro paint, a
// partir do cache local -- sem isso a tela pisca no tema claro (ou
// errado) por uma fracao de segundo ate o React montar e reconciliar
// com a preferencia de verdade (backend). Ver store/preferencias.ts,
// que reaplica a mesma logica depois de montar (login/troca).
(function () {
  // O parse fica isolado: se a chave estiver corrompida, "p" volta a
  // {} e cada atributo ainda recebe um valor valido abaixo -- um so
  // try ao redor de tudo faria um JSON quebrado pular ate a
  // resolucao de tema (que nao depende do parse), deixando o <html>
  // sem nenhum atributo e a pagina inteira sem tema nenhum.
  var p = {};
  try {
    p = JSON.parse(localStorage.getItem('pcp.preferencias') || '{}');
  } catch (e) {}

  var el = document.documentElement;
  var tema = p.tema === 'claro' || p.tema === 'escuro'
    ? p.tema
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
  el.setAttribute('data-tema', tema);
  if (p.alto_contraste) el.setAttribute('data-alto-contraste', 'true');
  // 'compacta' e o padrao (preserva o visual de antes da Fase 4.1) --
  // ver store/preferencias.ts e a migration 009 no backend.
  el.setAttribute('data-densidade', p.densidade === 'confortavel' ? 'confortavel' : 'compacta');
  var fontesValidas = ['padrao', 'grande', 'extra-grande'];
  el.setAttribute('data-fonte', fontesValidas.indexOf(p.tamanho_fonte) !== -1 ? p.tamanho_fonte : 'padrao');
})();
