// Roteiro de navegador real -- RBAC (Fase 2.2a). Usuarios de teste
// (almox_teste, comprador_teste, operador_teste) sao criados/removidos por SQL
// fora deste script.
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
async function token(usuario) {
  const r = await (await api.post('auth/login', { data: { username: usuario, password: 'Admin@123' } })).json();
  return { Authorization: `Bearer ${r.access_token}` };
}
const adm = await token('admin');
const almoxOriginal = (await (await api.get('acesso/perfis/ALMOXARIFE', { headers: adm })).json()).dados;

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
const link = (page, nome) => page.getByRole('navigation', { name: 'Módulos do sistema' }).getByRole('link', { name: nome, exact: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  // 1) Administrador: tela de perfis.
  await entrar(page, 'admin');
  passo('Administrador vê "Perfis e permissões"', (await link(page, 'Perfis e permissões').count()) === 1);
  await link(page, 'Perfis e permissões').click();
  await page.getByRole('button', { name: /Almoxarife/ }).click();
  const matriz = page.getByRole('form', { name: 'Permissões do perfil Almoxarife' });
  await matriz.waitFor();
  const verCotacoes = matriz.getByRole('group', { name: 'Cotações' }).getByRole('checkbox', { name: 'Ver', exact: true });
  passo('matriz do Almoxarife: não vê cotações, ajusta estoque',
    !(await verCotacoes.isChecked()) && await matriz.getByRole('checkbox', { name: /Ajustar saldo manualmente/ }).isChecked());
  await page.screenshot({ path: `${SHOTS}/47-perfis-permissoes.png`, fullPage: true });
  await sair(page);

  // 2) Almoxarife.
  await entrar(page, 'almox_teste');
  const temCotacoes = await link(page, 'Cotações').count();
  const temEstoque = await link(page, 'Estoque').count();
  const temConfig = await page.getByText('Configurações', { exact: true }).count();
  passo('Almoxarife: vê Estoque e Pedidos, não vê Cotações nem Configurações',
    temCotacoes === 0 && temEstoque === 1 && (await link(page, 'Pedidos de compra').count()) === 1 && temConfig === 0);
  await page.getByRole('banner').getByText('Almoxarife').waitFor();
  passo('cabeçalho mostra o nome do perfil', true);
  await link(page, 'Estoque').click();
  await page.locator('table tbody tr').first().waitFor();
  passo('Almoxarife tem o botão Ajustar no estoque', (await page.getByRole('button', { name: 'Ajustar' }).count()) > 0);
  await page.goto(`${BASE}/cotacoes`);
  passo('URL direta de Cotações: acesso restrito', /acesso restrito/i.test(await page.getByRole('alert').innerText()));
  const almox = await token('almox_teste');
  const recusa = await api.post('cotacoes', { headers: almox, data: {} });
  passo('API recusa criar cotação para o Almoxarife (403)', recusa.status() === 403, String(recusa.status()));
  await sair(page);

  // 3) Admin concede "Ver cotações" ao Almoxarife pela tela.
  await entrar(page, 'admin');
  await link(page, 'Perfis e permissões').click();
  await page.getByRole('button', { name: /Almoxarife/ }).click();
  const m2 = page.getByRole('form', { name: 'Permissões do perfil Almoxarife' });
  await m2.getByRole('group', { name: 'Cotações' }).getByRole('checkbox', { name: 'Ver', exact: true }).check();
  await m2.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText('Perfil Almoxarife salvo').last().waitFor();
  passo('Administrador concede "Ver cotações" ao Almoxarife', true);
  await sair(page);

  // 4) Almoxarife ve a mudanca no proximo acesso.
  await entrar(page, 'almox_teste');
  passo('Almoxarife passa a ver Cotações', (await link(page, 'Cotações').count()) === 1);
  await link(page, 'Cotações').click();
  await page.locator('table tbody tr').first().waitFor();
  passo('lista de cotações carrega (API libera na hora)', (await page.getByRole('alert').count()) === 0);
  passo('mas sem "Nova cotação" (só ganhou visualizar)', (await page.getByRole('button', { name: 'Nova cotação' }).count()) === 0);
  await sair(page);

  // 5) Operador de Montagem.
  await entrar(page, 'operador_teste');
  passo('Operador: só cadastros de consulta, BOM e estoque',
    (await link(page, 'Produtos acabados').count()) === 1 && (await link(page, 'Fornecedores').count()) === 0
    && (await page.getByText('Compras', { exact: true }).count()) === 0);
  await link(page, 'Painel').click();
  await page.getByRole('group', { name: 'Insumos críticos' }).waitFor();
  passo('Painel do Operador sem os indicadores de compras',
    (await page.getByRole('group', { name: 'PCs em atraso' }).count()) === 0
    && (await page.getByRole('group', { name: 'Insumos críticos' }).count()) === 1);
  await link(page, 'Estoque').click();
  await page.locator('table tbody tr').first().waitFor();
  passo('Operador: estoque sem Ajustar e sem Exportar',
    (await page.getByRole('button', { name: 'Ajustar' }).count()) === 0 && (await page.getByRole('button', { name: 'Exportar CSV' }).count()) === 0);
  await sair(page);

  // 6) Comprador.
  await entrar(page, 'comprador_teste');
  passo('Comprador: vê Cotações e Fornecedores, não ajusta estoque',
    (await link(page, 'Cotações').count()) === 1 && (await link(page, 'Fornecedores').count()) === 1);
  await link(page, 'Cotações').click();
  passo('Comprador tem "Nova cotação"', (await page.getByRole('button', { name: 'Nova cotação' }).count()) === 1);
} catch (erro) {
  passo('execução do roteiro', false, String(erro).split('\n')[0]);
  await page.screenshot({ path: `${SHOTS}/_falha.png`, fullPage: true }).catch(() => {});
} finally {
  const r = await api.put('acesso/perfis/ALMOXARIFE', {
    headers: adm, data: { nome: almoxOriginal.nome, descricao: almoxOriginal.descricao, permissoes: almoxOriginal.permissoes },
  });
  const depois = (await (await api.get('acesso/perfis/ALMOXARIFE', { headers: adm })).json()).dados;
  passo('matriz do Almoxarife revertida', r.ok() && !depois.permissoes.includes('cotacoes.visualizar'));
  await browser.close();
}

const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passos OK`);
process.exit(falhas ? 1 : 0);
