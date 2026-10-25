// Roteiro de navegador real -- Parametros de Negocio (Fase 4, sub-entrega 4).
// Cria fornecedor/peca/PC proprios (prefixo PW-NEG) e o script de limpeza SQL
// remove tudo depois; a configuracao volta aos defaults no fim.
import { chromium, request } from 'playwright';

const BASE = 'http://frontend';
const SHOTS = '/shots';
const resultados = [];
let n = 0;

function passo(nome, ok, detalhe = '') {
  n += 1;
  resultados.push({ n, nome, ok, detalhe });
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${n}. ${nome}${detalhe ? ' -- ' + detalhe : ''}`);
}

function cnpjValido() {
  const base = Array.from({ length: 12 }, (_, i) => (i < 8 ? Math.floor(Math.random() * 10) : [0, 0, 0, 1][i - 8]));
  const dv = (nums, pesos) => {
    const r = nums.reduce((s, d, i) => s + d * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, d1, d2].join('');
}

const api = await request.newContext({ baseURL: `${BASE}/api/v1/` });
const login = await (await api.post('auth/login', { data: { username: 'admin', password: 'Admin@123' } })).json();
const adm = { Authorization: `Bearer ${login.access_token}` };
const padrao = {
  metodo_custeio: 'CMP', tolerancia_excesso_recebimento_pct: 0, lead_time_padrao_dias: 7,
  limite_emissao_gestor: null, cotacoes_minimas: 0, valor_exige_cotacoes: 0,
};
const configurar = (corpo) => api.put('configuracoes/negocio', { headers: adm, data: { ...padrao, ...corpo } });

async function entrar(page, usuario) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Usuário').fill(usuario);
  await page.getByLabel('Senha', { exact: true }).fill('Admin@123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function sair(page) {
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/\/login/);
}

// Espera o toast com o texto esperado (a regiao de toasts acumula mensagens,
// entao ler "o ultimo" logo apos o clique pode pegar um anterior).
async function toast(page, padrao) {
  const item = page.getByText(padrao).last();
  await item.waitFor({ timeout: 10000 });
  return item.innerText();
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  // Dados proprios do teste.
  const forn = await (await api.post('fornecedores', {
    headers: adm, data: { razao_social: 'PW-NEG Fornecedor de Teste', cnpj: cnpjValido(), lead_time_medio: 5 },
  })).json();
  const peca = await (await api.post('partes-pecas', {
    headers: adm,
    data: { codigo: 'PW-NEG-001', descricao: 'Peca de teste do roteiro', unidade_medida: 'UN',
      estoque_minimo: 0, estoque_maximo: 1000, lead_time_compra: 5 },
  })).json();
  const entrega = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const pc = await (await api.post('pedidos-compra', {
    headers: adm,
    data: { numero_pc: 'PC-PW-NEG', fornecedor_id: forn.dados.id, data_entrega_prevista: entrega,
      itens: [{ parte_peca_id: peca.dados.id, quantidade_solicitada: 100, preco_unitario: 10 }] },
  })).json();
  passo('dados de teste criados (fornecedor, peça, PC de R$ 1.000)', Boolean(pc.dados?.id), `PC ${pc.dados?.id}`);

  // Tela de parametros, pelo menu.
  await entrar(page, 'admin');
  await page.getByRole('link', { name: 'Parâmetros de negócio', exact: true }).click();
  await page.getByRole('form', { name: 'Parâmetros de negócio' }).waitFor();
  const tolerancia = page.getByLabel(/Tolerância de excesso/);
  await tolerancia.fill('5');
  await page.getByLabel('Lead time padrão (dias)').fill('12');
  await page.getByLabel('Alçada do Gestor para emitir pedido de compra').selectOption('limitado');
  await page.getByLabel(/Valor máximo que o Gestor emite/).fill('100');
  await page.getByLabel('Mínimo de cotações por peça').fill('1');
  await page.getByLabel(/Exigir as cotações a partir/).fill('0');
  await page.screenshot({ path: `${SHOTS}/45-parametros-negocio.png`, fullPage: true });
  await page.getByRole('button', { name: 'Salvar' }).click();
  passo('salvar mostra confirmação', Boolean(await toast(page, 'Parâmetros de negócio salvos')));

  const salvo = await (await api.get('configuracoes/negocio', { headers: adm })).json();
  passo('API reflete o que foi salvo', salvo.dados.limite_emissao_gestor === 100 && salvo.dados.tolerancia_excesso_recebimento_pct === 5
    && salvo.dados.lead_time_padrao_dias === 12 && salvo.dados.cotacoes_minimas === 1, JSON.stringify(salvo.dados));

  // Lead time padrao no cadastro novo.
  await page.getByRole('link', { name: 'Fornecedores', exact: true }).click();
  await page.getByRole('button', { name: 'Novo fornecedor' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Novo fornecedor' });
  const leadTime = await dialogo.getByLabel(/Lead time médio/).inputValue();
  passo('novo fornecedor nasce com lead time 12', leadTime === '12', leadTime);
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();

  // Gestor: alcada.
  await sair(page);
  await entrar(page, 'gestor_teste');
  await page.goto(`${BASE}/pedidos-compra/${pc.dados.id}`);
  await page.getByText('PC-PW-NEG').first().waitFor();
  await page.getByRole('button', { name: /Emitido/ }).click();
  await page.getByRole('button', { name: 'Emitir' }).click();
  let msg = await toast(page, /alcada do Gestor/);
  passo('Gestor acima da alçada: tela explica a recusa', true, msg);

  // Sem alcada, mas cotacoes minimas = 1.
  await configurar({ cotacoes_minimas: 1, valor_exige_cotacoes: 0, tolerancia_excesso_recebimento_pct: 5 });
  await page.getByRole('button', { name: /Emitido/ }).click();
  await page.getByRole('button', { name: 'Emitir' }).click();
  msg = await toast(page, /PW-NEG-001 \(0 de 1\)/);
  passo('sem cotações suficientes: tela lista a peça', true, msg);

  // Sem exigencia: emite.
  await configurar({ tolerancia_excesso_recebimento_pct: 5 });
  await page.getByRole('button', { name: /Emitido/ }).click();
  await page.getByRole('button', { name: 'Emitir' }).click();
  msg = await toast(page, 'Pedido de compra emitido');
  passo('dentro das regras: Gestor emite', true, msg);

  // Recebimento (por nota fiscal desde a v1.2) com 5% de tolerancia: 106 vira
  // pendencia de bloqueio na conferencia, 105 confere e efetiva.
  const itemPC = (await (await api.get(`pedidos-compra/${pc.dados.id}`, { headers: adm })).json()).dados.itens[0];
  const hoje = new Date().toISOString().slice(0, 10);
  async function nota(numero, qtd) {
    const r = await api.post('notas-entrada', { headers: adm, data: {
      pedido_compra_id: pc.dados.id, cnpj_emitente: forn.dados.cnpj, modelo: '01', serie: '1', numero: String(numero),
      data_emissao: hoje, data_entrada: hoje, cfop: '1102', valor_produtos: (qtd * 10).toFixed(2), valor_total: (qtd * 10).toFixed(2),
      itens: [{ item_pedido_compra_id: itemPC.id, parte_peca_id: peca.dados.id, quantidade_nf: qtd, quantidade_recebida: qtd,
        valor_unitario: 10, valor_total: (qtd * 10).toFixed(2) }] } });
    return (await r.json()).dados.id;
  }
  const acima = await nota(9106, 106);
  const recusa = await api.post(`notas-entrada/${acima}/conferir`, { headers: adm });
  const corpoRecusa = await recusa.text();
  passo('nota acima da tolerância (106 de 100) fica bloqueada', recusa.status() === 409 && /passa do limite de 105/.test(corpoRecusa),
    `${recusa.status()}`);
  await api.post(`notas-entrada/${acima}/cancelar`, { headers: adm });
  const dentro = await nota(9105, 105);
  const conferida = await api.post(`notas-entrada/${dentro}/conferir`, { headers: adm });
  const efetivada = await api.post(`notas-entrada/${dentro}/efetivar`, { headers: adm });
  passo('nota dentro da tolerância (105 de 100) confere e efetiva', conferida.ok() && efetivada.ok(),
    `${conferida.status()} / ${efetivada.status()}`);
  const recebida = await (await api.get(`pedidos-compra/${pc.dados.id}`, { headers: adm })).json();
  passo('PC concluído com 105 recebidos', recebida.dados.status === 'Concluido' && recebida.dados.itens[0].quantidade_recebida === 105,
    `${recebida.dados.status} / ${recebida.dados.itens[0].quantidade_recebida}`);

  // Gestor nao acessa a tela.
  await page.goto(`${BASE}/configuracoes/negocio`);
  passo('Gestor: URL direta com acesso restrito', /acesso restrito/i.test(await page.getByRole('alert').innerText()));
  passo('Gestor: sem link na navegação', (await page.getByRole('link', { name: 'Parâmetros de negócio' }).count()) === 0);
} catch (erro) {
  passo('execução do roteiro', false, String(erro).split('\n')[0]);
  await page.screenshot({ path: `${SHOTS}/_falha.png`, fullPage: true }).catch(() => {});
} finally {
  await configurar({});
  const final = await (await api.get('configuracoes/negocio', { headers: adm })).json();
  passo('configuração revertida aos defaults', final.dados.limite_emissao_gestor === null && final.dados.lead_time_padrao_dias === 7
    && final.dados.tolerancia_excesso_recebimento_pct === 0);
  await browser.close();
}

const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passos OK`);
process.exit(falhas ? 1 : 0);
