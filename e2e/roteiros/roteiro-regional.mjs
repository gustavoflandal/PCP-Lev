// Roteiro de navegador real -- Parametros Regionais (Task F8).
import { chromium } from 'playwright';

const BASE = 'http://frontend';
const SHOTS = '/shots';
const resultados = [];
let n = 0;

function passo(nome, ok, detalhe = '') {
  n += 1;
  resultados.push({ n, nome, ok, detalhe });
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${n}. ${nome}${detalhe ? ' -- ' + detalhe : ''}`);
}

async function login(page, usuario) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Usuário').fill(usuario);
  await page.getByLabel('Senha', { exact: true }).fill('Admin@123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  // Depois de um logout, o login volta para a ultima rota visitada, nao para /.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function sair(page) {
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/\/login/);
}

async function textoTabela(page) {
  await page.locator('table tbody tr').first().waitFor();
  return page.locator('table tbody').innerText();
}

const DATA_BR = /\b\d{2}\/\d{2}\/\d{4}\b/;
const DATA_ISO = /\b\d{4}-\d{2}-\d{2}\b/;
const DATAHORA_BR_24 = /\b\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\b(?! [AP]M)/;
const DATAHORA_ISO_12 = /\b\d{4}-\d{2}-\d{2} \d{2}:\d{2} [AP]M\b/;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await login(page, 'admin');
  passo('login como Administrador', true);

  // Linha de base (defaults) -- navegacao pelo menu, sem recarregar a pagina.
  await page.getByRole('link', { name: 'Cotações' }).click();
  let t = await textoTabela(page);
  passo('Cotações mostra validade em DD/MM/AAAA (default)', DATA_BR.test(t) && !DATA_ISO.test(t));

  await page.getByRole('link', { name: 'Auditoria' }).click();
  t = await textoTabela(page);
  passo('Auditoria mostra data/hora DD/MM/AAAA 24h (default)', DATAHORA_BR_24.test(t), t.match(DATAHORA_BR_24)?.[0]);

  await page.getByRole('link', { name: 'Parâmetros regionais' }).click();
  await page.getByText('Assim: 31/08/2026 14:30').waitFor();
  passo('tela abre com os defaults e a prévia correta', true);

  await page.getByLabel('Formato de data').selectOption('AAAA-MM-DD');
  await page.getByLabel('Formato de hora').selectOption('12H');
  const previa = await page.getByText(/^Assim:/).innerText();
  passo('prévia muda antes de salvar', previa === 'Assim: 2026-08-31 02:30 PM', previa);
  await page.screenshot({ path: `${SHOTS}/42-parametros-regionais.png`, fullPage: true });

  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText('Parâmetros regionais salvos').waitFor();
  passo('salvar mostra o toast de confirmação', true);

  await page.getByRole('link', { name: 'Cotações' }).click();
  t = await textoTabela(page);
  passo('Cotações reflete AAAA-MM-DD sem F5', DATA_ISO.test(t) && !DATA_BR.test(t), t.match(DATA_ISO)?.[0]);
  await page.screenshot({ path: `${SHOTS}/43-cotacoes-formato-iso.png`, fullPage: true });

  await page.getByRole('link', { name: 'Auditoria' }).click();
  t = await textoTabela(page);
  passo('Auditoria reflete AAAA-MM-DD 12h sem F5', DATAHORA_ISO_12.test(t), t.match(DATAHORA_ISO_12)?.[0]);

  // Carga a frio direto numa tela com datas (achado M1 da revisao).
  await page.goto(`${BASE}/cotacoes`);
  t = await textoTabela(page);
  passo('carga a frio em /cotacoes já sai em AAAA-MM-DD', DATA_ISO.test(t) && !DATA_BR.test(t));

  await sair(page);
  await login(page, 'gestor_teste');
  passo('login como Gestor', true);
  const linkVisivel = await page.getByRole('link', { name: 'Parâmetros regionais' }).count();
  passo('Gestor não vê o link na navegação', linkVisivel === 0);

  await page.getByRole('link', { name: 'Cotações' }).click();
  t = await textoTabela(page);
  passo('Gestor também vê o formato do sistema (AAAA-MM-DD)', DATA_ISO.test(t) && !DATA_BR.test(t));

  await page.goto(`${BASE}/configuracoes/regional`);
  const alerta = await page.getByRole('alert').innerText();
  passo('URL direta mostra acesso restrito ao Gestor', /acesso restrito/i.test(alerta), alerta);

  await sair(page);
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Parâmetros regionais' }).click();
  await page.getByText('Assim: 2026-08-31 02:30 PM').waitFor();
  await page.getByLabel('Formato de data').selectOption('DD/MM/AAAA');
  await page.getByLabel('Formato de hora').selectOption('24H');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText('Parâmetros regionais salvos').waitFor();
  await page.getByRole('link', { name: 'Cotações' }).click();
  t = await textoTabela(page);
  passo('revertido para os defaults ao final', DATA_BR.test(t) && !DATA_ISO.test(t));

  await page.setViewportSize({ width: 800, height: 900 });
  await page.getByRole('link', { name: 'Parâmetros regionais' }).click();
  await page.getByText(/^Assim:/).waitFor();
  const rolagem = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  passo('800px sem rolagem horizontal', !rolagem);
} catch (erro) {
  passo('execução do roteiro', false, String(erro).split('\n')[0]);
  await page.screenshot({ path: `${SHOTS}/_falha.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passos OK`);
process.exit(falhas ? 1 : 0);
