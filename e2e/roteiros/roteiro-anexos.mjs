// Roteiro de navegador real -- Fase 3.1 (anexos) e midia de peca (v1.2 R1).
// Usa a OP concluida do roteiro da Fase 3 (OP_ID/SERIE no ambiente) e o
// fornecedor do roteiro da v1.2.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://frontend';
const SHOTS = '/shots';
const OP_ID = process.env.OP_ID;
const SERIE = process.env.SERIE;
const resultados = [];
let n = 0;
function passo(nome, ok, detalhe = '') {
  n += 1;
  resultados.push({ n, nome, ok, detalhe });
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${n}. ${nome}${detalhe ? ' -- ' + detalhe : ''}`);
}
const hoje = new Date();
const data = (dias) => new Date(hoje.getTime() + dias * 86400000).toISOString().slice(0, 10);
const pdf = (texto) => `%PDF-1.4\n1 0 obj<<>>endobj\n% ${texto}\ntrailer<<>>\n%%EOF\n`;
writeFileSync('/tmp/laudo-ensaio.pdf', pdf('laudo ' + Date.now()));
writeFileSync('/tmp/iso-9001.pdf', pdf('iso ' + Date.now()));
writeFileSync('/tmp/datasheet-placa.pdf', pdf('datasheet ' + Date.now()));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const link = (nome) => page.getByRole('navigation', { name: 'Módulos do sistema' }).getByRole('link', { name: nome, exact: true });
const toast = (texto) => page.getByText(texto).last().waitFor();

async function enviarDocumento(escopo, arquivo, categoria, extra = {}) {
  await escopo.getByRole('button', { name: 'Anexar documento' }).click();
  const form = escopo.getByRole('form', { name: 'Enviar documento' });
  await form.locator('input[type=file]').setInputFiles(arquivo);
  await form.getByLabel(/^Categoria/).selectOption(categoria);
  if (extra.titulo) await form.getByLabel(/^Título/).fill(extra.titulo);
  if (extra.validade) await form.getByLabel(/^Data de validade/).fill(extra.validade);
  await form.getByRole('button', { name: 'Enviar documento' }).click();
  await form.waitFor({ state: 'detached' });
}

try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Usuário').fill('admin');
  await page.getByLabel('Senha', { exact: true }).fill('Admin@123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  // Uma imagem real para a foto: recorte da propria tela.
  await page.screenshot({ path: '/tmp/foto-placa.png', clip: { x: 0, y: 0, width: 480, height: 320 } });

  // 1) Midia da peca (R1): foto principal e datasheet
  await link('Partes e peças').click();
  await page.getByRole('button', { name: 'Mídia e documentos de PW12-PLACA' }).click();
  const midia = page.getByRole('dialog', { name: /Mídia e documentos — PW12-PLACA/ });
  await midia.getByLabel(/Nova foto/).setInputFiles('/tmp/foto-placa.png');
  await midia.getByRole('button', { name: 'Enviar foto' }).click();
  await midia.getByRole('img', { name: /PW12-PLACA/ }).first().waitFor();
  passo('foto principal enviada', true);
  await midia.getByRole('button', { name: 'Novo documento' }).click();
  const formDoc = midia.getByRole('form', { name: 'Novo documento' });
  await formDoc.getByLabel(/Arquivo PDF/).setInputFiles('/tmp/datasheet-placa.pdf');
  await formDoc.getByLabel(/Categoria/).selectOption('Datasheet');
  await formDoc.getByRole('button', { name: /^Enviar/ }).click();
  await formDoc.waitFor({ state: 'detached' });
  passo('datasheet anexado à peça', (await midia.getByText('Datasheet').count()) >= 1);
  await page.screenshot({ path: `${SHOTS}/67-midia-peca.png`, fullPage: true });
  await page.keyboard.press('Escape');

  // 2) Laudo na OP concluida: anexa, mas nao remove
  await page.goto(`${BASE}/producao/ops/${OP_ID}`);
  const docsOP = page.getByRole('region', { name: 'Documentos e laudos' }).or(page.locator('section', { hasText: 'Documentos e laudos' })).first();
  await docsOP.waitFor();
  await enviarDocumento(docsOP, '/tmp/laudo-ensaio.pdf', 'Laudo de Teste', { titulo: 'Ensaio de funcionamento' });
  await docsOP.getByText('Ensaio de funcionamento').first().waitFor();
  passo('laudo anexado à OP concluída', true);
  passo('OP encerrada: sem botão de remover', (await docsOP.getByRole('button', { name: /^Remover/ }).count()) === 0);
  await page.screenshot({ path: `${SHOTS}/68-op-documentos.png`, fullPage: true });

  // 3) Laudo na ficha as-built
  await page.goto(`${BASE}/rastreabilidade/${SERIE}`);
  await page.getByText('Laudos e inspeções').first().waitFor();
  await page.getByText('Ensaio de funcionamento').first().waitFor();
  passo('ficha as-built mostra o laudo', (await page.getByRole('link', { name: /Abrir/ }).count()) >= 1);
  await page.screenshot({ path: `${SHOTS}/69-ficha-laudos.png`, fullPage: true });

  // 4) Certificado do fornecedor com validade -> documentos a vencer
  await link('Fornecedores').click();
  await page.getByRole('button', { name: 'Documentos de Eletrônica PW12 Ltda' }).click();
  const docsForn = page.getByRole('dialog').last();
  await enviarDocumento(docsForn, '/tmp/iso-9001.pdf', 'Certificado de Qualidade', { titulo: 'ISO 9001', validade: data(10) });
  await docsForn.getByText('ISO 9001').first().waitFor();
  passo('certificado anexado ao fornecedor', true);
  await page.screenshot({ path: `${SHOTS}/70-fornecedor-documentos.png`, fullPage: true });
  await page.keyboard.press('Escape');

  await link('Documentos a vencer').click();
  await page.getByText('Eletrônica PW12 Ltda').first().waitFor();
  passo('vencimentos listam o certificado do fornecedor', (await page.getByText('ISO 9001').count()) >= 1);
  await page.screenshot({ path: `${SHOTS}/71-documentos-vencer.png`, fullPage: true });
} catch (e) {
  passo('execução sem exceção', false, String(e).slice(0, 400));
  await page.screenshot({ path: `${SHOTS}/erro-anexos.png`, fullPage: true });
} finally {
  await browser.close();
}
const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passos ok`);
process.exit(falhas ? 1 : 0);
