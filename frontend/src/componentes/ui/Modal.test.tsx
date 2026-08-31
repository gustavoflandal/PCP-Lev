import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('fechado nao renderiza nada', () => {
    render(
      <Modal aberto={false} aoFechar={vi.fn()} titulo="Novo fornecedor">
        <p>conteudo</p>
      </Modal>,
    );

    expect(screen.queryByText('conteudo')).not.toBeInTheDocument();
  });

  it('aberto anuncia o titulo como nome do dialogo', () => {
    render(
      <Modal aberto aoFechar={vi.fn()} titulo="Novo fornecedor">
        <p>conteudo</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Novo fornecedor' })).toBeInTheDocument();
  });

  it('Esc fecha', async () => {
    const aoFechar = vi.fn();
    render(
      <Modal aberto aoFechar={aoFechar} titulo="Novo fornecedor">
        <p>conteudo</p>
      </Modal>,
    );

    await userEvent.keyboard('{Escape}');

    expect(aoFechar).toHaveBeenCalled();
  });

  it('o botao de fechar tem nome acessivel', async () => {
    const aoFechar = vi.fn();
    render(
      <Modal aberto aoFechar={aoFechar} titulo="Novo fornecedor">
        <p>conteudo</p>
      </Modal>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(aoFechar).toHaveBeenCalled();
  });

  it('mostra a descricao quando informada', () => {
    render(
      <Modal aberto aoFechar={vi.fn()} titulo="Novo fornecedor" descricao="Campos com * são obrigatórios.">
        <p>conteudo</p>
      </Modal>,
    );

    expect(screen.getByText('Campos com * são obrigatórios.')).toBeInTheDocument();
  });

  it('renderiza o rodape recebido', () => {
    render(
      <Modal
        aberto
        aoFechar={vi.fn()}
        titulo="Novo fornecedor"
        rodape={<button type="button">Salvar</button>}
      >
        <p>conteudo</p>
      </Modal>,
    );

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });
});
