import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { PREFERENCIAS_PADRAO, usePreferencias } from '@/store/preferencias';
import { Ajuda } from './Ajuda';

function renderizar(rota = '/') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Ajuda />
    </MemoryRouter>,
  );
}

describe('Ajuda', () => {
  afterEach(() => usePreferencias.getState().aplicar(PREFERENCIAS_PADRAO));

  it('mostra um botao de ajuda com rotulo textual', () => {
    renderizar();

    expect(screen.getByRole('button', { name: 'Ajuda' })).toBeInTheDocument();
  });

  it('fechado nao mostra o conteudo de ajuda', () => {
    renderizar();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre um dialogo com o conteudo da tela atual', async () => {
    renderizar('/fornecedores');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Fornecedores/ })).toBeInTheDocument();
    expect(screen.getByText(/Novo fornecedor/)).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: partes e pecas', async () => {
    renderizar('/partes-pecas');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Partes e peças/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: produtos acabados', async () => {
    renderizar('/produtos-acabados');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Produtos acabados/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: painel', async () => {
    renderizar('/');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Painel/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: login', async () => {
    renderizar('/login');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Entrar/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: cotacoes', async () => {
    renderizar('/cotacoes');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Cotações/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: pedidos de compra', async () => {
    renderizar('/pedidos-compra');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Pedidos de compra/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: estoque', async () => {
    renderizar('/estoque');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Estoque/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: preferencias', async () => {
    renderizar('/preferencias');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Preferências/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: necessidade de compra', async () => {
    renderizar('/necessidade-compra');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Necessidade de compra/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: dados da empresa', async () => {
    renderizar('/configuracoes/empresa');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Dados da empresa/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: auditoria', async () => {
    renderizar('/configuracoes/auditoria');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Auditoria/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: parametros de negocio', async () => {
    renderizar('/configuracoes/negocio');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Parâmetros de negócio/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: integracoes', async () => {
    renderizar('/configuracoes/integracoes');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Integrações/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: perfis e permissoes', async () => {
    renderizar('/configuracoes/perfis');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Perfis e permissões/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: banco de dados', async () => {
    renderizar('/configuracoes/banco');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Banco de dados/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: parametros regionais', async () => {
    renderizar('/configuracoes/regional');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Parâmetros regionais/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: estrutura de produtos', async () => {
    renderizar('/estrutura-produtos');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Estrutura de produtos/ })).toBeInTheDocument();
  });

  it('uma sub-rota de cotacoes cai no conteudo da lista (prefixo)', async () => {
    renderizar('/cotacoes/nova');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Cotações/ })).toBeInTheDocument();
  });

  it('uma rota desconhecida mostra o conteudo generico', async () => {
    renderizar('/rota-que-nao-existe');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('fecha ao clicar em Fechar', async () => {
    renderizar('/fornecedores');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a nota fiscal de entrada (rota com id) usa a ajuda das notas', async () => {
    renderizar('/notas-entrada/5');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Notas fiscais de entrada/ })).toBeInTheDocument();
    expect(screen.getByText(/Enter adiciona e limpa/)).toBeInTheDocument();
  });

  it('a rastreabilidade do lote usa a ajuda de lotes', async () => {
    renderizar('/lotes/4');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Lotes/ })).toBeInTheDocument();
  });

  it('em espanhol traduz o botao, o titulo e os itens da ajuda', async () => {
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
    renderizar('/estrutura-produtos');

    await userEvent.click(screen.getByRole('button', { name: 'Ayuda' }));

    expect(screen.getByRole('dialog', { name: 'Ayuda · Estructura de productos' })).toBeInTheDocument();
    expect(screen.getByText(/"Nueva versión" abre una pantalla/)).toBeInTheDocument();
    expect(screen.queryByText(/Nova versão/)).not.toBeInTheDocument();
  });
});
