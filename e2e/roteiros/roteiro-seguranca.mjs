// Roteiro de navegador real -- Seguranca e Banco de Dados (Fase 4, sub-entrega 3).
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

async function login(page, usuario, senha = 'Admin@123') {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Usuário').fill(usuario);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function logado(page) {
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const violacoesCSP = [];
page.on('console', (msg) => {
  if (/Content Security Policy|Refused to/i.test(msg.text())) violacoesCSP.push(msg.text());
});
page.on('pageerror', (erro) => violacoesCSP.push(`pageerror: ${erro.message}`));

try {
  await login(page, 'admin');
  await logado(page);
  passo('login como Administrador', true);

  const tema = await page.evaluate(() => document.documentElement.getAttribute('data-tema'));
  passo('tema-inicial.js aplicou o tema no <html> (script externo sob CSP)', tema === 'claro' || tema === 'escuro', tema);

  // Passa por todas as telas pelo menu, colhendo violacoes de CSP.
  const telas = ['Produtos acabados', 'Partes e peças', 'Fornecedores', 'Estrutura de produtos', 'Cotações',
    'Pedidos de compra', 'Necessidade de compra', 'Estoque', 'Dados da empresa', 'Auditoria',
    'Parâmetros regionais', 'Banco de dados', 'Painel'];
  for (const tela of telas) {
    await page.getByRole('link', { name: tela, exact: true }).click();
    await page.getByRole('heading', { level: 1 }).first().waitFor();
  }
  await page.getByRole('button', { name: 'Preferências' }).click();
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  passo('navegou por todas as telas', true, `${telas.length + 1} telas`);

  // ViaCEP (connect-src liberado na CSP). Nao salva nada.
  await page.getByRole('link', { name: 'Dados da empresa', exact: true }).click();
  const cep = page.getByLabel('CEP');
  await cep.waitFor();
  const cepOriginal = await cep.inputValue();
  const logradouroOriginal = await page.getByLabel('Logradouro').inputValue();
  await cep.fill('01310100');
  await page.getByRole('button', { name: 'Buscar CEP' }).click();
  let logradouro = '';
  for (let i = 0; i < 40 && !logradouro; i++) {
    await page.waitForTimeout(250);
    logradouro = await page.getByLabel('Logradouro').inputValue();
  }
  const cspViaCep = violacoesCSP.some((v) => v.includes('viacep'));
  passo('Buscar CEP (ViaCEP) não é bloqueado pela CSP', !cspViaCep && /paulista/i.test(logradouro),
    logradouro || '(sem resposta -- sem internet no container?)');
  await cep.fill(cepOriginal);

  // Tela de banco.
  await page.getByRole('link', { name: 'Banco de dados', exact: true }).click();
  await page.getByText('Conectado').waitFor();
  const host = await page.locator('dd', { hasText: '*****' }).first().innerText();
  passo('host aparece mascarado', /^po\*{5}es:5432$/.test(host), host);
  const linhasTabela = await page.getByRole('table', { name: 'Maiores tabelas' }).locator('tbody tr').count();
  passo('lista as maiores tabelas', linhasTabela > 0 && linhasTabela <= 10, `${linhasTabela} linhas`);
  const corpo = await page.locator('main').innerText();
  passo('nenhuma credencial na tela', !/pcp_user|senha_segura|postgres:\/\//.test(corpo));
  await page.getByRole('button', { name: 'Testar conexão' }).click();
  const teste = await page.getByText(/^Conexão OK em/).innerText();
  passo('Testar conexão mostra a latência', true, teste);
  await page.screenshot({ path: `${SHOTS}/44-banco-de-dados.png`, fullPage: true });

  await page.setViewportSize({ width: 800, height: 900 });
  const rolagem = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  passo('800px sem rolagem horizontal', !rolagem);
  await page.setViewportSize({ width: 1440, height: 900 });

  passo('zero violações de CSP/erros de página até aqui', violacoesCSP.length === 0, violacoesCSP.slice(0, 3).join(' | '));

  // Gestor: sem link e URL direta bloqueada.
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/\/login/);
  await login(page, 'gestor_teste');
  await logado(page);
  passo('Gestor não vê o link Banco de dados', (await page.getByRole('link', { name: 'Banco de dados' }).count()) === 0);
  await page.goto(`${BASE}/configuracoes/banco`);
  passo('URL direta mostra acesso restrito ao Gestor', /acesso restrito/i.test(await page.getByRole('alert').innerText()));
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/\/login/);

  // Forca bruta no login: o limite por IP tem que aparecer na tela. Com um
  // login que nao existe -- errar a senha do admin 5 vezes bloquearia a conta
  // (Fase 5) e os roteiros seguintes nao entrariam.
  let mensagem = '';
  for (let i = 0; i < 8 && !/tentativas de login/i.test(mensagem); i++) {
    await login(page, 'ninguem_e2e', 'senha-errada');
    const alerta = page.getByRole('alert');
    await alerta.waitFor();
    mensagem = await alerta.innerText();
  }
  passo('login: após várias tentativas aparece o aviso de limite', /tentativas de login/i.test(mensagem), mensagem);
} catch (erro) {
  passo('execução do roteiro', false, String(erro).split('\n')[0]);
  await page.screenshot({ path: `${SHOTS}/_falha.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passos OK`);
process.exit(falhas ? 1 : 0);
