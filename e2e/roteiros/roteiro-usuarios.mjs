// Roteiro de navegador real -- Gestao de usuarios (Fase 2.2b). Cria o
// usuario "pw_maria" pela tela; a limpeza fica por SQL fora do script.
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
async function login(usuario, senha) {
  return api.post('auth/login', { data: { username: usuario, password: senha } });
}

async function entrar(page, usuario, senha) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Usuário').fill(usuario);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
async function sair(page) {
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/\/login/);
}
const link = (page, nome) => page.getByRole('navigation', { name: 'Módulos do sistema' }).getByRole('link', { name: nome, exact: true });
const linhaDe = (page, nome) => page.locator('table tbody tr', { hasText: nome });

const browser = await chromium.launch();
const ctxAdmin = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const ctxMaria = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const admin = await ctxAdmin.newPage();
const maria = await ctxMaria.newPage();
let senhaTemporaria = '';

try {
  // 1) Administrador cadastra pela tela.
  await entrar(admin, 'admin', 'Admin@123');
  passo('Administrador vê "Usuários" em Configurações', (await link(admin, 'Usuários').count()) === 1);
  await link(admin, 'Usuários').click();
  await linhaDe(admin, 'Administrador').first().waitFor();
  passo('a própria linha não tem ações', (await linhaDe(admin, '(você)').getByText('Peça a outro administrador').count()) === 1);

  await admin.getByRole('button', { name: 'Novo usuário' }).click();
  const form = admin.getByRole('form', { name: 'Novo usuário' });
  await form.getByLabel(/Usuário \(login\)/).fill('pw_maria');
  await form.getByLabel(/Nome completo/).fill('Maria Playwright');
  await form.getByLabel(/E-mail/).fill('pw_maria@exemplo.com');
  await form.getByLabel(/^Perfil/).selectOption('CONSULTA');
  await form.getByLabel(/Matrícula/).fill('PW-001');
  await form.getByLabel(/Setor/).fill('Qualidade');
  senhaTemporaria = await form.getByLabel(/Senha temporária/).inputValue();
  passo('senha temporária sugerida (10 caracteres)', senhaTemporaria.length === 10);
  await form.getByRole('button', { name: 'Cadastrar usuário' }).click();
  await admin.getByText('Usuário Maria Playwright cadastrado').last().waitFor();
  const linha = linhaDe(admin, 'Maria Playwright');
  passo('nova linha com perfil Consulta e "Senha temporária"',
    (await linha.getByText('Consulta').count()) === 1 && (await linha.getByText('Senha temporária').count()) === 1);
  await admin.screenshot({ path: `${SHOTS}/48-usuarios.png`, fullPage: true });

  // 2) Primeiro acesso da Maria: troca obrigatória.
  await entrar(maria, 'pw_maria', senhaTemporaria);
  await maria.waitForURL(/\/trocar-senha$/, { timeout: 5000 }).catch(() => {});
  passo('primeiro acesso vai direto para "Crie a sua senha"',
    maria.url().endsWith('/trocar-senha') && (await maria.getByRole('heading', { name: 'Crie a sua senha' }).count()) === 1);
  await maria.screenshot({ path: `${SHOTS}/49-troca-senha-obrigatoria.png`, fullPage: true });
  await maria.goto(`${BASE}/fornecedores`);
  await maria.waitForURL(/\/trocar-senha$/, { timeout: 5000 }).catch(() => {});
  passo('URL direta volta para a troca de senha', maria.url().endsWith('/trocar-senha'));
  const tokenMaria = (await (await login('pw_maria', senhaTemporaria)).json()).access_token;
  const negado = await api.get('fornecedores', { headers: { Authorization: `Bearer ${tokenMaria}` } });
  passo('API recusa com TROCA_DE_SENHA_OBRIGATORIA',
    negado.status() === 403 && (await negado.json()).erro.codigo === 'TROCA_DE_SENHA_OBRIGATORIA');

  await maria.getByLabel('Senha temporária').fill(senhaTemporaria);
  await maria.getByLabel(/^Nova senha/).fill('MinhaSenha#9');
  await maria.getByLabel('Repita a nova senha').fill('MinhaSenha#9');
  await maria.getByRole('button', { name: 'Salvar nova senha' }).click();
  await maria.waitForURL((url) => url.pathname === '/');
  await link(maria, 'Fornecedores').waitFor();
  passo('após a troca: painel e menu de consulta liberados', (await link(maria, 'Fornecedores').count()) === 1);
  passo('Consulta não vê "Usuários"', (await link(maria, 'Usuários').count()) === 0);

  // 3) Permissão individual: conceder "Cadastrar fornecedores" com justificativa.
  await admin.reload();
  await linhaDe(admin, 'Maria Playwright').getByRole('button', { name: 'Permissões de Maria Playwright' }).click();
  await admin.getByRole('button', { name: 'Conceder: Cadastrar' }).first().click();
  await admin.getByLabel(/Justificativa/).fill('cobre as férias do comprador');
  await admin.getByRole('button', { name: 'Confirmar' }).click();
  await admin.getByText('Concedida individualmente').waitFor();
  passo('permissão individual concedida com justificativa', true);
  await admin.screenshot({ path: `${SHOTS}/50-permissoes-individuais.png`, fullPage: true });
  await admin.getByRole('dialog').getByRole('button', { name: 'Fechar' }).last().click();

  await maria.goto(`${BASE}/fornecedores`);
  await maria.locator('table').waitFor();
  passo('Maria passa a ver "Novo fornecedor" (efeito imediato)', (await maria.getByRole('button', { name: 'Novo fornecedor' }).count()) === 1);

  // 4) Bloqueio vale na hora, com a sessão aberta.
  await linhaDe(admin, 'Maria Playwright').getByRole('button', { name: 'Situação de Maria Playwright' }).click();
  await admin.getByLabel('Nova situação').selectOption('BLOQUEADO');
  await admin.getByRole('button', { name: 'Salvar situação' }).click();
  await linhaDe(admin, 'Maria Playwright').waitFor({ state: 'detached' }).catch(() => {});
  await admin.getByLabel('Situação', { exact: true }).selectOption('BLOQUEADO');
  await linhaDe(admin, 'Maria Playwright').getByText('Bloqueado').waitFor();
  passo('linha aparece como Bloqueado (filtro de situação)', true);

  // A primeira chamada da Maria depois do bloqueio (o formulario busca os
  // parametros de negocio) ja a leva ao login com o motivo. So recarrega se
  // nada tiver disparado -- recarregar apaga o aviso, que vive em memoria.
  await maria.getByRole('button', { name: 'Novo fornecedor' }).click().catch(() => {});
  await maria.waitForURL(/\/login/, { timeout: 5000 }).catch(async () => {
    await maria.goto(`${BASE}/partes-pecas`);
    await maria.waitForURL(/\/login/, { timeout: 10000 });
  });
  passo('sessão aberta da Maria cai para o login, com o motivo',
    maria.url().includes('/login') && (await maria.getByText(/bloqueado ou desativado/).count()) === 1,
    `${maria.url()} | ${(await maria.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200)}`);
  const bloqueado = await login('pw_maria', 'MinhaSenha#9');
  passo('login bloqueado recusado', bloqueado.status() === 401 || bloqueado.status() === 403, String(bloqueado.status()));

  // 5) Reativar + redefinir senha => volta a exigir troca.
  await linhaDe(admin, 'Maria Playwright').getByRole('button', { name: 'Situação de Maria Playwright' }).click();
  await admin.getByLabel('Nova situação').selectOption('ATIVO');
  await admin.getByRole('button', { name: 'Salvar situação' }).click();
  await admin.getByText(/Maria Playwright: ativo/).last().waitFor();
  await admin.getByLabel('Situação', { exact: true }).selectOption('ATIVO');
  await linhaDe(admin, 'Maria Playwright').getByRole('button', { name: 'Redefinir senha de Maria Playwright' }).click();
  const nova = await admin.getByLabel('Senha temporária').inputValue();
  await admin.getByRole('button', { name: 'Redefinir senha' }).click();
  await admin.getByText(/Senha temporária de Maria Playwright definida/).last().waitFor();
  await entrar(maria, 'pw_maria', nova);
  await maria.waitForURL(/\/trocar-senha$/, { timeout: 5000 }).catch(() => {});
  passo('senha redefinida: novo acesso exige troca de novo', maria.url().endsWith('/trocar-senha'));

  // 6) Troca voluntária pelo admin? Só confere que o caminho existe.
  await admin.goto(`${BASE}/preferencias`);
  await admin.getByRole('button', { name: 'Alterar senha' }).click();
  passo('Preferências leva a "Alterar senha"', (await admin.getByRole('heading', { name: 'Alterar senha' }).count()) === 1);
} catch (erro) {
  passo('execução do roteiro', false, String(erro).split('\n')[0]);
  await admin.screenshot({ path: `${SHOTS}/_falha.png`, fullPage: true }).catch(() => {});
  await maria.screenshot({ path: `${SHOTS}/_falha_maria.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passos OK`);
process.exit(falhas ? 1 : 0);
