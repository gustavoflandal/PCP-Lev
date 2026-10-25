// Roteiro de navegador real -- Fase 3 (Producao). Dados semeados por
// pw3-dados.sql (cliente, radar com metrologia, BOM, estoque, centros).
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
const hoje = new Date();
const data = (dias) => new Date(hoje.getTime() + dias * 86400000).toISOString().slice(0, 10);

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
  passo('menu com Vendas e Produção',
    (await link('Pedidos de venda').count()) === 1 && (await link('Kanban').count()) === 1 && (await link('Rastreabilidade').count()) === 1);

  // 1) Pedido de venda
  await link('Pedidos de venda').click();
  await page.getByRole('button', { name: 'Novo pedido de venda' }).click();
  await page.getByLabel(/Número do pedido/).fill('PW3-001');
  await page.getByLabel(/^Cliente/).selectOption({ label: 'Prefeitura PW3' });
  await page.getByLabel(/Data do pedido/).fill(data(0));
  await page.getByLabel(/Entrega prometida/).fill(data(20));
  await page.getByLabel(/Produto acabado/).first().selectOption({ label: 'PW3-RADAR — Radar fixo PW3' });
  await page.getByLabel(/^Quantidade/).first().fill('2');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByRole('button', { name: 'Gerar OP de PW3-RADAR' }).waitFor();
  passo('pedido criado (Aberto) com o item do radar', (await page.getByText('Aberto').count()) >= 1);

  await page.getByRole('button', { name: 'Gerar OP de PW3-RADAR' }).click();
  const linkOP = page.getByRole('link', { name: /^OP-\d{4}-\d{5}$/ });
  await linkOP.waitFor();
  const numeroOP = (await linkOP.innerText()).trim();
  passo('OP gerada a partir do item', /^OP-\d{4}-\d{5}$/.test(numeroOP), numeroOP);
  await page.screenshot({ path: `${SHOTS}/53-pedido-venda.png`, fullPage: true });

  // 2) OP: liberar
  await linkOP.click();
  await page.getByRole('button', { name: 'Liberar OP' }).click();
  await toast('OP liberada');
  const unidades = page.getByRole('table', { name: 'Unidades da OP' }).locator('tbody tr');
  await unidades.first().waitFor();
  passo('liberada: 2 unidades com número de série', (await unidades.count()) === 2);
  const numeroSerie = (await unidades.first().locator('td').first().innerText()).trim();

  // 3) Kanban
  await link('Kanban').click();
  const cartao = page.getByRole('link', { name: `OP ${numeroOP}` }).or(page.getByLabel(`OP ${numeroOP}`));
  await cartao.first().waitFor();
  const coluna = page.getByLabel('Etapa Separação');
  passo('Kanban mostra a OP na coluna Separação', (await coluna.getByText(numeroOP).count()) === 1);
  await page.screenshot({ path: `${SHOTS}/54-kanban.png`, fullPage: true });
  await cartao.first().click();

  // 4) Etapas
  const avancar = page.getByRole('button', { name: /Avançar etapa|Concluir OP/ });
  async function trabalhar(etapa) {
    await page.getByLabel(new RegExp(`Centro de trabalho \\(${etapa}\\)`)).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Iniciar apontamento' }).click();
    await page.getByRole('button', { name: 'Encerrar apontamento' }).click();
    await page.getByRole('button', { name: 'Iniciar apontamento' }).waitFor();
  }
  await trabalhar('Separação');
  await avancar.click();
  await toast(/Montagem/);
  passo('Separação → Montagem (material consumido)', true);
  await trabalhar('Montagem');
  await avancar.click();
  await page.getByRole('button', { name: `Aprovar ${numeroSerie}` }).waitFor();
  passo('Montagem → Testes', true);

  await trabalhar('Testes');
  await avancar.click();
  await page.getByRole('alert').filter({ hasText: /aprovadas no teste/ }).waitFor();
  passo('sem aprovação, Testes não avança (mensagem da API)', true);

  for (let i = 0; i < 2; i++) {
    const serie = (await unidades.nth(i).locator('td').first().innerText()).trim();
    await page.getByRole('button', { name: `Aprovar ${serie}` }).click();
    await page.getByLabel('Resultado do teste').fill('Medição de velocidade dentro da tolerância');
    await page.getByRole('button', { name: 'Registrar aprovação' }).click();
    await page.getByRole('button', { name: `Metrologia de ${serie}` }).click();
    await page.getByLabel(/Nº da aprovação de modelo/).fill('INMETRO-0042/2026');
    await page.getByLabel(/Nº do lacre/).fill(`L-PW3-${i + 1}`);
    await page.getByLabel(/Data da verificação/).fill(data(0));
    await page.getByLabel(/^Validade/).fill(data(20));
    await page.getByRole('button', { name: 'Salvar metrologia' }).click();
    await page.getByRole('button', { name: 'Salvar metrologia' }).waitFor({ state: 'detached' });
  }
  passo('2 unidades aprovadas com metrologia', true);
  await page.screenshot({ path: `${SHOTS}/55-op-testes.png`, fullPage: true });
  await avancar.click();
  await page.getByLabel(/Centro de trabalho \(Expedição\)/).waitFor();
  passo('Testes → Expedição', true);
  await trabalhar('Expedição');
  await page.getByRole('button', { name: 'Concluir OP' }).click();
  await page.getByText('Concluida').or(page.getByText('Concluída')).first().waitFor();
  passo('OP concluída', true);
  const custo = await page.getByText('Total realizado').count();
  passo('custo real visível para o Administrador', custo >= 1);
  await page.screenshot({ path: `${SHOTS}/56-op-concluida-custo.png`, fullPage: true });

  // 5) Entrega
  await page.goto(`${BASE}/pedidos-venda`);
  await page.getByText('PW3-001', { exact: true }).first().click();
  await page.getByText(/Pronto para envio/i).first().waitFor();
  passo('pedido ficou Pronto para envio', true);
  await page.getByRole('button', { name: 'Registrar entrega' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar entrega' }).click();
  await page.getByText('Entregue').first().waitFor();
  passo('entrega registrada', true);

  // 6) Rastreabilidade
  await link('Rastreabilidade').click();
  await page.getByLabel('Número de série').fill(numeroSerie);
  await page.getByRole('button', { name: 'Abrir ficha' }).click();
  await page.getByText('Aponte a câmera para abrir esta ficha').waitFor();
  const qr = await page.locator('svg[role="img"], svg[aria-label*="QR"]').count();
  passo('ficha as-built com QR Code', qr >= 1);
  passo('ficha mostra metrologia e componentes',
    (await page.getByText('INMETRO-0042/2026').count()) >= 1 && (await page.getByText('PW3-PLACA').count()) >= 1);
  await page.screenshot({ path: `${SHOTS}/57-rastreabilidade.png`, fullPage: true });

  await link('Metrologia').click();
  await page.getByText(numeroSerie).first().waitFor();
  passo('verificação a vencer listada em Metrologia', true);
  await page.screenshot({ path: `${SHOTS}/58-metrologia.png`, fullPage: true });
} catch (erro) {
  passo('execução do roteiro', false, String(erro).split('\n')[0]);
  await page.screenshot({ path: `${SHOTS}/_falha.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}
const falhas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} passos OK`);
process.exit(falhas ? 1 : 0);
