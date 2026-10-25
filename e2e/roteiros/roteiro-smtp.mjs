// Roteiro de navegador real -- Integracoes / SMTP (Fase 4, sub-entrega 5),
// com envio real para o Mailpit do docker-compose (perfil dev).
import { chromium, request } from 'playwright';

const BASE = 'http://frontend';
const MAILPIT = 'http://mailpit:8025';
const SHOTS = '/shots';
const resultados = [];
let n = 0;

function passo(nome, ok, detalhe = '') {
  n += 1;
  resultados.push({ n, nome, ok, detalhe });
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${n}. ${nome}${detalhe ? ' -- ' + detalhe : ''}`);
}

const api = await request.newContext({ baseURL: `${BASE}/api/v1/` });
const login = await (await api.post('auth/login', { data: { username: 'admin', password: 'Admin@123' } })).json();
const adm = { Authorization: `Bearer ${login.access_token}` };
const mailpit = await request.newContext({ baseURL: MAILPIT });
await mailpit.delete('/api/v1/messages');

async function entrar(page, usuario) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Usuário').fill(usuario);
  await page.getByLabel('Senha', { exact: true }).fill('Admin@123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function toast(page, padrao) {
  const item = page.getByText(padrao).last();
  await item.waitFor({ timeout: 20000 });
  return item.innerText();
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const SENHA = 'senha-de-teste-roteiro-123';

try {
  await entrar(page, 'admin');
  await page.getByRole('link', { name: 'Integrações', exact: true }).click();
  await page.getByRole('form', { name: 'Servidor de e-mail' }).waitFor();
  passo('tela abre pelo menu', true);

  // 1) Servidor sem autenticacao (Mailpit): envio real.
  await page.getByLabel('Envio de e-mail').selectOption('true');
  await page.getByLabel('Servidor (host)').fill('mailpit');
  await page.getByLabel('Porta').fill('1025');
  await page.getByLabel('Criptografia').selectOption('NENHUMA');
  await page.getByLabel('Usuário').fill('');
  await page.getByLabel('E-mail do remetente').fill('pcp@empresa.com.br');
  await page.getByLabel('Nome do remetente').fill('Sistema PCP — Produção');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await toast(page, 'Servidor de e-mail salvo');
  passo('salvar configuração sem senha', true);

  await page.getByLabel('Enviar para').fill('gestor@empresa.com.br');
  await page.getByRole('button', { name: 'Enviar e-mail de teste' }).click();
  await toast(page, /E-mail de teste enviado para gestor@empresa\.com\.br/);
  const caixa = await (await mailpit.get('/api/v1/messages')).json();
  const msg = caixa.messages?.[0];
  passo('e-mail chegou no Mailpit', caixa.total === 1 && msg?.To?.[0]?.Address === 'gestor@empresa.com.br'
    && /Teste de envio/.test(msg?.Subject) && msg?.From?.Name === 'Sistema PCP — Produção',
  `${msg?.From?.Name} <${msg?.From?.Address}> -> ${msg?.To?.[0]?.Address}: ${msg?.Subject}`);
  await page.screenshot({ path: `${SHOTS}/46-integracoes-smtp.png`, fullPage: true });

  // 2) "Nenhuma" com usuario: recusado ja no formulario.
  await page.getByLabel('Usuário').fill('pcp@empresa.com.br');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText('Usuário e senha exigem STARTTLS ou TLS').waitFor();
  passo('usuário sem criptografia é recusado no formulário', true);

  // 3) Com senha (STARTTLS): gravada cifrada, nunca reexibida.
  await page.getByLabel('Criptografia').selectOption('STARTTLS');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await toast(page, 'Servidor de e-mail salvo');
  passo('campo de senha esvazia depois de salvar', (await page.getByLabel('Senha').inputValue()) === '');
  const corpoGet = await (await api.get('configuracoes/smtp', { headers: adm })).text();
  passo('API nunca devolve a senha', !corpoGet.includes(SENHA) && JSON.parse(corpoGet).dados.senha_definida === true);
  await page.reload();
  await page.getByRole('form', { name: 'Servidor de e-mail' }).waitFor();
  passo('após recarregar: senha não reaparece e há aviso de senha gravada',
    (await page.getByLabel('Senha').inputValue()) === ''
    && (await page.getByText(/Já existe uma senha gravada/).count()) === 1);
  passo('senha não aparece em nenhum lugar da página', !(await page.content()).includes(SENHA));

  // 4) STARTTLS num servidor que nao oferece: recusa em vez de mandar em claro.
  await page.getByLabel('Enviar para').fill('gestor@empresa.com.br');
  await page.getByRole('button', { name: 'Enviar e-mail de teste' }).click();
  const erroTls = await toast(page, /nao oferece STARTTLS/);
  passo('STARTTLS exigido não cai para texto claro, mensagem sem a senha', !erroTls.includes(SENHA), erroTls);

  // 5) Ataque: trocar so o host mantendo a senha gravada.
  await page.getByLabel('Servidor (host)').fill('smtp.atacante.com');
  await page.getByRole('button', { name: 'Salvar' }).click();
  const recusa = await toast(page, /digite a senha de novo/);
  passo('trocar o servidor sem redigitar a senha é recusado', true, recusa);
  const aindaMailpit = await (await api.get('configuracoes/smtp', { headers: adm })).json();
  passo('nada foi gravado', aindaMailpit.dados.host === 'mailpit');
  await page.reload();
  await page.getByRole('form', { name: 'Servidor de e-mail' }).waitFor();

  // 6) Auditoria: a troca aparece com o marcador; o texto cifrado, nunca.
  const trilha = await (await api.get('auditoria?tabela=configuracao_smtp&limite=20', { headers: adm })).text();
  passo('auditoria registra a troca de senha só com marcador', trilha.includes('definida (trocada)') && !trilha.includes('v1:'));

  // 7) Remover senha, com confirmacao.
  await page.getByRole('button', { name: 'Remover senha gravada' }).click();
  await page.getByRole('button', { name: 'Remover senha', exact: true }).click();
  await toast(page, 'Senha removida');
  const semSenha = await (await api.get('configuracoes/smtp', { headers: adm })).json();
  passo('remover senha gravada (com confirmação)', semSenha.dados.senha_definida === false);

  // 8) Gestor.
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/\/login/);
  await entrar(page, 'gestor_teste');
  passo('Gestor sem link na navegação', (await page.getByRole('link', { name: 'Integrações' }).count()) === 0);
  await page.goto(`${BASE}/configuracoes/integracoes`);
  passo('Gestor: URL direta com acesso restrito', /acesso restrito/i.test(await page.getByRole('alert').innerText()));
} catch (erro) {
  passo('execução do roteiro', false, String(erro).split('\n')[0]);
  await page.screenshot({ path: `${SHOTS}/_falha.png`, fullPage: true }).catch(() => {});
} finally {
  await api.put('configuracoes/smtp', {
    headers: adm,
    data: { habilitado: false, host: '', porta: 587, criptografia: 'STARTTLS', usuario: '', senha: '',
      remover_senha: true, remetente_email: '', remetente_nome: '' },
  });
  const final = await (await api.get('configuracoes/smtp', { headers: adm })).json();
  passo('configuração revertida', final.dados.habilitado === false && final.dados.host === '' && !final.dados.senha_definida);
  await browser.close();
}

const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passos OK`);
process.exit(falhas ? 1 : 0);
