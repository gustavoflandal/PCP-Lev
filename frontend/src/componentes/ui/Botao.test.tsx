import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Botao } from './Botao';

describe('Botao', () => {
  it('exibe o rotulo e aciona o clique', async () => {
    const aoClicar = vi.fn();
    render(<Botao onClick={aoClicar}>Liberar pedido</Botao>);

    await userEvent.click(screen.getByRole('button', { name: 'Liberar pedido' }));

    expect(aoClicar).toHaveBeenCalledOnce();
  });

  it('no estado ocupado troca o rotulo e impede novo clique', async () => {
    const aoClicar = vi.fn();
    render(
      <Botao ocupado rotuloOcupado="Liberando…" onClick={aoClicar}>
        Liberar pedido
      </Botao>,
    );

    const botao = screen.getByRole('button', { name: 'Liberando…' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(botao);
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it('sem rotuloOcupado mantem o rotulo original ao ficar ocupado', () => {
    render(
      <Botao ocupado onClick={vi.fn()}>
        Salvar
      </Botao>,
    );

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('desabilitado nao aciona o clique', async () => {
    const aoClicar = vi.fn();
    render(
      <Botao disabled onClick={aoClicar}>
        Cancelar OP
      </Botao>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar OP' }));

    expect(aoClicar).not.toHaveBeenCalled();
  });

  it('e alcancavel por teclado e aciona com Enter', async () => {
    const aoClicar = vi.fn();
    render(<Botao onClick={aoClicar}>Gerar OP</Botao>);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Gerar OP' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(aoClicar).toHaveBeenCalledOnce();
  });

  it('marca o icone como decorativo para nao poluir o leitor de tela', () => {
    render(
      <Botao icone="plus" variante="primaria">
        Novo produto
      </Botao>,
    );

    const botao = screen.getByRole('button', { name: 'Novo produto' });
    expect(botao.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('usa o tipo button por padrao para nao submeter formularios sem querer', () => {
    render(<Botao>Filtrar</Botao>);

    expect(screen.getByRole('button', { name: 'Filtrar' })).toHaveAttribute('type', 'button');
  });
});
