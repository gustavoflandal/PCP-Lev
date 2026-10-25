// Roteiro de navegador real -- Paineis (dashboards). Roda depois de producao e
// recebimento (ha OPs, notas e lotes). Comprador ve Compras e Estoque, nao
// Producao; a permissao individual libera o painel na hora; modo TV esconde o
// menu e fica no endereco.
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

const api = await request.newContext({ baseURL: `${BASE}/api/v1/` });
const loginApi = async (u) => (await (await api.post('auth/login', { data: { username: u, password: 'Admin@123' } })).json());
const adm = { Authorization: `Bearer ${(await loginApi('admin')).access_token}` };
const comprador = (await loginApi('comprador_teste')).usuario;

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
const menu = (page) => page.getByRole('navigation', { name: 'Módulos do sistema' });
const link = (page, nome) => menu(page).getByRole('link', { name: nome, exact: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  // 1) Administrador: Painel inicial com os blocos e o grafico de etapas.
  await entrar(page, 'admin');
  await page.getByRole('group', { name: 'OPs em atraso' }).waitFor();
  passo('Painel inicial mostra os indicadores', (await page.getByRole('group', { name: 'PCs a receber' }).count()) === 1
    && (await page.getByRole('group', { name: 'Notas aguardando efetivação' }).count()) === 1);
  passo('Painel inicial tem o gráfico de OPs por etapa', (await page.getByRole('region', { name: 'OPs por etapa' }).count()) === 1);
  const paineis = ['Compras', 'Recebimento e estoque', 'Produção', 'Vendas e expedição', 'Qualidade'];
  const visiveis = [];
  for (const p of paineis) if ((await link(page, p).count()) === 1) visiveis.push(p);
  passo('Administrador vê os 5 painéis no menu', visiveis.length === 5, visiveis.join(', '));

  // Impressao / PDF: botao no cabecalho; no papel, sem menu nem cabecalho.
  passo('botão "Imprimir / PDF" no cabeçalho', (await page.getByRole('button', { name: 'Imprimir / PDF' }).count()) === 1);
  await page.emulateMedia({ media: 'print' });
  passo('na impressão o menu e o botão somem', !(await menu(page).isVisible())
    && !(await page.getByRole('button', { name: 'Imprimir / PDF' }).isVisible()));
  await page.emulateMedia({ media: 'screen' });

  // 2) Painel de producao: periodo na URL, tabela equivalente.
  await link(page, 'Produção').click();
  await page.getByRole('heading', { name: 'Painel de produção' }).waitFor();
  await page.getByRole('group', { name: 'OPs concluídas no período' }).waitFor();
  const concluidas = (await page.getByRole('group', { name: 'OPs concluídas no período' }).innerText()).replace(/\s+/g, ' ');
  passo('painel de produção mostra as OPs concluídas pelos roteiros', /\b[1-9]\d*\b/.test(concluidas), concluidas);
  await page.getByRole('toolbar', { name: 'Controles do painel' }).getByLabel('Período').selectOption({ label: 'Últimos 365 dias' });
  await page.waitForURL(/dias=365/);
  passo('período vai para o endereço', page.url().includes('dias=365'));
  const semanas = page.getByRole('region', { name: 'Concluídas por semana' });
  await semanas.getByRole('button', { name: 'Ver dados' }).click();
  passo('"Ver dados" mostra a tabela do gráfico', (await semanas.getByRole('table').count()) === 1);
  const lead = (await page.getByRole('group', { name: 'Lead time médio' }).innerText()).replace(/\s+/g, ' ');
  passo('lead time médio nunca negativo', !/-\d/.test(lead), lead);
  passo('"Atualizado às" visível', (await page.getByText(/Atualizado às \d{2}:\d{2}:\d{2}/).count()) === 1);

  // 3) Modo TV: sem menu, estado no endereco, sai e o menu volta.
  await page.getByRole('button', { name: 'Modo TV' }).click();
  await page.waitForURL(/tv=1/);
  await page.getByRole('button', { name: 'Sair do modo TV' }).waitFor();
  passo('modo TV esconde o menu e fica no endereço', (await menu(page).count()) === 0 && page.url().includes('tv=1'));
  await page.getByRole('button', { name: 'Sair do modo TV' }).click();
  await menu(page).waitFor();
  passo('ao sair do modo TV o menu volta e o período fica', !page.url().includes('tv=1') && page.url().includes('dias=365'));
  await sair(page);

  // 4) Comprador: Compras e Estoque sim, Producao nao.
  await entrar(page, 'comprador_teste');
  const doComprador = [];
  for (const p of paineis) if ((await link(page, p).count()) === 1) doComprador.push(p);
  passo('Comprador vê só Compras e Recebimento e estoque', doComprador.join('|') === 'Compras|Recebimento e estoque', doComprador.join(', '));
  await page.goto(`${BASE}/paineis/producao`);
  passo('URL direta do painel de produção: acesso restrito', /acesso restrito/i.test(await page.getByRole('alert').first().innerText()));
  await link(page, 'Compras').click();
  await page.getByRole('heading', { name: 'Painel de compras' }).waitFor();
  passo('Comprador abre o painel de compras', (await page.getByRole('group', { name: 'PCs em aberto' }).count()) === 1);

  // 5) Permissao individual: o painel de producao aparece na hora.
  const r = await api.put(`usuarios/${comprador.id}/permissoes/paineis.producao`, {
    headers: adm, data: { concedida: true, justificativa: 'Acompanha a producao das compras urgentes' } });
  passo('administrador concede o painel de produção ao comprador', r.ok(), String(r.status()));
  await page.reload();
  await link(page, 'Produção').waitFor({ timeout: 10000 }).catch(() => {});
  passo('Comprador passa a ver o painel de produção', (await link(page, 'Produção').count()) === 1);
} catch (erro) {
  passo('execução do roteiro', false, String(erro).split('\n')[0]);
  await page.screenshot({ path: `${SHOTS}/_falha_paineis.png`, fullPage: true }).catch(() => {});
} finally {
  await api.delete(`usuarios/${comprador.id}/permissoes/paineis.producao`, { headers: adm }).catch(() => {});
  await browser.close();
}

const falhas = resultados.filter((x) => !x.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passos OK`);
process.exit(falhas ? 1 : 0);
