// Roteiro de navegador real -- v1.2 (recebimento fiscal). Dados semeados por
// pw12-dados.sql (fornecedor PW12, 3 pecas: lote+validade, serie, simples; PC).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://frontend';
const SHOTS = '/shots';
const resultados = [];
let n = 0;
function passo(nome, ok, detalhe = '') {
  n += 1;
  resultados.push({ n, nome, ok, detalhe });
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${n}. ${nome}${detalhe ? ' -- ' + detalhe : ''}`);
}
const hoje = new Date();
const data = (dias) => new Date(hoje.getTime() + dias * 86400000).toISOString().slice(0, 10);

// Chave de acesso com DV (modulo 11) e o cabecalho da nota.
function chave(numero) {
  const aamm = data(0).slice(2, 4) + data(0).slice(5, 7);
  const base = `31${aamm}12012012000115` + '55' + '001' + String(numero).padStart(9, '0') + '1' + String(numero).padStart(8, '0');
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i -= 1) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = soma % 11;
  return base + String(r < 2 ? 0 : 11 - r);
}
const numero = 1200 + Math.floor(Math.random() * 800);
const ch = chave(numero);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
 <NFe><infNFe Id="NFe${ch}" versao="4.00">
  <ide><mod>55</mod><serie>1</serie><nNF>${numero}</nNF><dhEmi>${data(-1)}T09:30:00-03:00</dhEmi></ide>
  <emit><CNPJ>12012012000115</CNPJ><xNome>Eletronica PW12 Ltda</xNome></emit>
  <det nItem="1"><prod><cProd>CX-M3</cProd><xProd>PARAFUSO M3 CX C/100</xProd><CFOP>5102</CFOP><uCom>CX</uCom>
   <qCom>2.0000</qCom><vUnCom>10.0000</vUnCom><vProd>20.00</vProd></prod></det>
  <det nItem="2"><prod><cProd>PL-778</cProd><xProd>PLACA CONTROLADORA</xProd><CFOP>5102</CFOP><uCom>UN</uCom>
   <qCom>4.0000</qCom><vUnCom>50.0000</vUnCom><vProd>200.00</vProd>
   <rastro><nLote>LX-${numero}</nLote><qLote>4.000</qLote><dFab>${data(-60)}</dFab><dVal>${data(365)}</dVal></rastro></prod></det>
  <det nItem="3"><prod><cProd>CN-1</cProd><xProd>CONECTOR SERIAL</xProd><CFOP>5102</CFOP><uCom>UN</uCom>
   <qCom>2.0000</qCom><vUnCom>20.0000</vUnCom><vProd>40.00</vProd></prod></det>
  <total><ICMSTot><vProd>260.00</vProd><vFrete>13.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vIPI>0.00</vIPI><vST>0.00</vST><vNF>273.00</vNF></ICMSTot></total>
 </infNFe></NFe>
 <protNFe><infProt><chNFe>${ch}</chNFe></infProt></protNFe>
</nfeProc>`;
writeFileSync('/tmp/nfe-pw12.xml', xml);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const link = (nome) => page.getByRole('navigation', { name: 'Módulos do sistema' }).getByRole('link', { name: nome, exact: true });
const toast = (texto) => page.getByText(texto).last().waitFor();

try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Usuário').fill('admin');
  await page.getByLabel('Senha', { exact: true }).fill('Admin@123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  passo('menu com Recebimento e Lotes', (await link('Notas fiscais de entrada').count()) === 1 && (await link('Lotes').count()) === 1);

  // 1) Importar XML: previa, vinculos memorizados, rascunho
  await link('Notas fiscais de entrada').click();
  await page.getByRole('button', { name: 'Importar XML' }).click();
  const modal = page.getByRole('dialog', { name: 'Importar XML da NF-e' });
  const pc = modal.getByLabel(/Pedido de compra/);
  await pc.locator('option', { hasText: 'PW12-PC1' }).first().waitFor({ state: 'attached' });
  const valorPC = await pc.locator('option', { hasText: 'PW12-PC1' }).first().getAttribute('value');
  await pc.selectOption(valorPC);
  await modal.locator('input[type=file]').setInputFiles('/tmp/nfe-pw12.xml');
  await modal.getByRole('button', { name: 'Ler XML' }).click();
  await modal.getByLabel('Itens do XML').waitFor();
  const naoReconhecidos = await modal.getByText('Não reconhecido', { exact: true }).count();
  passo('prévia: parafuso reconhecido pelo de-para; placa e conector não', naoReconhecidos === 2, `${naoReconhecidos} não reconhecidos`);
  await page.screenshot({ path: `${SHOTS}/59-importar-xml-previa.png`, fullPage: true });
  for (const [codigo, peca] of [['PL-778', 'PW12-PLACA'], ['CN-1', 'PW12-CON']]) {
    const sel = modal.getByLabel(`Peça do item ${codigo}`);
    const opcao = await sel.locator('option', { hasText: peca }).first().getAttribute('value');
    await sel.selectOption(opcao);
    await modal.getByLabel(`Fator — ${codigo}`).fill('1');
    await modal.getByRole('button', { name: 'Vincular e memorizar' }).first().click();
    await modal.getByLabel(`Peça do item ${codigo}`).waitFor({ state: 'detached' });
  }
  passo('vínculos memorizados: todos os itens reconhecidos', (await modal.getByText('Todos os itens reconhecidos').count()) === 1);
  await modal.getByRole('button', { name: 'Criar rascunho' }).click();
  await page.waitForURL(/\/notas-entrada\/\d+$/);
  await toast('Rascunho criado a partir do XML');
  passo('rascunho criado com o XML anexado', true, page.url());

  // 2) Series do conector e conferencia
  const bipar = page.getByLabel(/Bipar ou digitar série/).first();
  await bipar.fill('SN-0001');
  await bipar.press('Enter');
  await bipar.fill('SN-0002');
  await bipar.press('Enter');
  await page.getByRole('button', { name: 'Conferir' }).click();
  await toast('Nota conferida');
  passo('nota conferida (lote do XML, séries bipadas)', (await page.getByRole('button', { name: 'Efetivar nota' }).count()) === 1);
  await page.screenshot({ path: `${SHOTS}/60-nota-conferida.png`, fullPage: true });

  // 3) Efetivar
  await page.getByRole('button', { name: 'Efetivar nota' }).click();
  await toast('Nota efetivada — estoque atualizado');
  passo('nota efetivada', (await page.getByRole('button', { name: 'Estornar nota' }).count()) === 1);
  await page.screenshot({ path: `${SHOTS}/61-nota-efetivada.png`, fullPage: true });
  const urlNota = page.url();

  // 4) Lotes e rastreio do lote
  await link('Lotes').click();
  const loteLink = page.getByRole('link', { name: `LX-${numero}`, exact: true });
  await loteLink.waitFor();
  passo('lote LX criado com saldo', true);
  await page.screenshot({ path: `${SHOTS}/62-lotes.png`, fullPage: true });
  await loteLink.click();
  await page.waitForURL(/\/lotes\/\d+$/);
  await page.getByText(`${numero}/1`).first().waitFor();
  passo('rastreio do lote mostra a nota de entrada', true);
  await page.screenshot({ path: `${SHOTS}/63-rastreio-lote.png`, fullPage: true });

  // 5) Estoque: kardex e origem do saldo
  await link('Estoque').click();
  await page.getByRole('button', { name: 'Kardex de PW12-PLACA' }).click();
  const kardex = page.getByRole('dialog').last();
  await kardex.getByText(`LX-${numero}`).first().waitFor();
  passo('kardex com o lote e o documento', true);
  await page.screenshot({ path: `${SHOTS}/64-kardex.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Origem do saldo de PW12-PAR' }).click();
  const origem = page.getByRole('dialog').last();
  await origem.getByText(`${numero}/1`).first().waitFor();
  passo('origem do saldo do parafuso: 200 un. da nota', (await origem.getByText('200').count()) >= 1);
  await page.screenshot({ path: `${SHOTS}/65-origem-saldo.png`, fullPage: true });
  await page.keyboard.press('Escape');

  // 6) Estorno
  await page.goto(urlNota);
  await page.getByRole('button', { name: 'Estornar nota' }).click();
  const est = page.getByRole('dialog', { name: 'Estornar nota fiscal' });
  await est.getByLabel(/Motivo do estorno/).fill('Teste do roteiro: nota lançada para demonstração');
  await est.getByRole('button', { name: /Estornar/ }).last().click();
  await toast('Nota estornada');
  passo('nota estornada', (await page.getByText('Estornada').count()) >= 1);

  await link('Notas fiscais de entrada').click();
  await page.getByText(String(numero)).first().waitFor();
  passo('lista mostra a nota com selo XML', (await page.getByText('XML', { exact: true }).count()) >= 1);
  await page.screenshot({ path: `${SHOTS}/66-notas-entrada.png`, fullPage: true });
} catch (e) {
  passo('execução sem exceção', false, String(e).slice(0, 400));
  await page.screenshot({ path: `${SHOTS}/erro-recebimento.png`, fullPage: true });
} finally {
  await browser.close();
}
const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passos ok`);
process.exit(falhas ? 1 : 0);
