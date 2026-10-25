// Roteiro de navegador real -- Clientes e Centros de Trabalho (Fase 2.3).
// Dados de teste (CNPJ 11.222.333/0001-81, codigo PW-BANC) sao removidos por
// SQL fora do script.
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

async function entrar(page, usuario, senha = 'Admin@123') {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Usuário').fill(usuario);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
const link = (page, nome) => page.getByRole('navigation', { name: 'Módulos do sistema' }).getByRole('link', { name: nome, exact: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await entrar(page, 'admin');
  passo('menu mostra Clientes e Centros de trabalho',
    (await link(page, 'Clientes').count()) === 1 && (await link(page, 'Centros de trabalho').count()) === 1);

  // Clientes
  await link(page, 'Clientes').click();
  await page.getByRole('heading', { name: 'Clientes', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel(/^Tipo/).selectOption('ORGAO_PUBLICO');
  await dialogo.getByLabel(/Razão social/).fill('Departamento de Estradas PW');
  await dialogo.getByLabel(/Nome fantasia/).fill('DER-PW');
  await dialogo.getByLabel(/^CNPJ/).fill('11222333000181');
  await dialogo.getByLabel(/Cidade/).fill('Belo Horizonte');
  await dialogo.getByLabel(/^UF/).selectOption('MG');
  await dialogo.getByLabel(/Nº do contrato/).fill('CT-2025/009');
  await dialogo.getByLabel(/Início da vigência|Vigência.*início/i).fill('2025-01-01');
  await dialogo.getByLabel(/Fim da vigência|Vigência.*fim/i).fill('2025-12-31');
  await dialogo.getByRole('button', { name: /Salvar|Cadastrar/ }).last().click();
  const linha = page.locator('table tbody tr', { hasText: 'Departamento de Estradas PW' });
  await linha.waitFor();
  passo('cliente cadastrado aparece na lista com CNPJ formatado', (await linha.getByText('11.222.333/0001-81').count()) === 1);
  passo('contrato vencido sinalizado', (await linha.getByText('Contrato vencido').count()) === 1);
  await page.screenshot({ path: `${SHOTS}/51-clientes.png`, fullPage: true });

  await page.getByRole('button', { name: 'Novo cliente' }).click();
  await dialogo.getByLabel(/^Tipo/).selectOption('OUTRO');
  await dialogo.getByLabel(/Razão social/).fill('Duplicado');
  await dialogo.getByLabel(/^CNPJ/).fill('11222333000181');
  await dialogo.getByRole('button', { name: /Salvar|Cadastrar/ }).last().click();
  await dialogo.getByText(/já existe um cliente|ja existe um cliente/i).first().waitFor({ timeout: 5000 });
  passo('CNPJ duplicado recusado com mensagem', true);
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();

  // Centros de trabalho
  await link(page, 'Centros de trabalho').click();
  await page.getByRole('heading', { name: 'Centros de trabalho', exact: true }).waitFor();
  await page.getByRole('button', { name: /Novo centro/ }).click();
  await dialogo.getByLabel(/^Código/).fill('pw-banc');
  await dialogo.getByLabel(/^Nome/).fill('Bancada de montagem PW');
  await dialogo.getByLabel(/^Etapa/).selectOption('MONTAGEM');
  await dialogo.getByLabel(/Capacidade/).fill('8');
  await dialogo.getByRole('button', { name: /Salvar|Cadastrar/ }).last().click();
  const linhaCentro = page.locator('table tbody tr', { hasText: 'PW-BANC' });
  await linhaCentro.waitFor();
  passo('centro cadastrado com código em maiúsculas e etapa Montagem', (await linhaCentro.getByText('Montagem').count()) >= 1);
  await page.getByLabel('Etapa', { exact: true }).selectOption('TESTES');
  await linhaCentro.waitFor({ state: 'detached' });
  passo('filtro por etapa esconde a bancada de montagem', true);
  await page.getByLabel('Etapa', { exact: true }).selectOption('');
  await linhaCentro.waitFor();
  await page.screenshot({ path: `${SHOTS}/52-centros-trabalho.png`, fullPage: true });
} catch (erro) {
  passo('execução do roteiro', false, String(erro).split('\n')[0]);
  await page.screenshot({ path: `${SHOTS}/_falha.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passos OK`);
process.exit(falhas ? 1 : 0);
