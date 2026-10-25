import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Campo } from './Campo';

describe('Campo', () => {
  it('associa o rotulo ao input, sem usar placeholder como rotulo', () => {
    render(<Campo rotulo="Codigo do produto" />);

    const input = screen.getByLabelText('Codigo do produto');
    expect(input).toBeInTheDocument();
    expect(input).not.toHaveAttribute('placeholder', 'Codigo do produto');
  });

  it('aceita digitacao', async () => {
    render(<Campo rotulo="Descricao" />);

    await userEvent.type(screen.getByLabelText('Descricao'), 'Painel VMS');

    expect(screen.getByLabelText('Descricao')).toHaveValue('Painel VMS');
  });

  it('marca o campo como invalido e liga a mensagem de erro ao input', () => {
    render(<Campo rotulo="Codigo" erro="Informe o codigo — obrigatorio para o cadastro" />);

    const input = screen.getByLabelText(/Codigo/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Informe o codigo — obrigatorio para o cadastro');
  });

  it('anuncia o erro imediatamente ao leitor de tela', () => {
    render(<Campo rotulo="Codigo" erro="Campo obrigatorio" />);

    expect(screen.getByText('Campo obrigatorio')).toHaveAttribute('role', 'alert');
  });

  it('sinaliza campo obrigatorio para o leitor de tela', () => {
    render(<Campo rotulo="CNPJ" obrigatorio />);

    expect(screen.getByLabelText(/CNPJ/)).toBeRequired();
  });

  it('usa fonte monoespaçada e caixa alta em campos de codigo', () => {
    render(<Campo rotulo="LPN" tipoDado="codigo" />);

    const input = screen.getByLabelText('LPN');
    expect(input).toHaveClass('font-mono');
    expect(input).toHaveAttribute('autocapitalize', 'characters');
  });

  it('abre o teclado numerico em campos de quantidade', () => {
    render(<Campo rotulo="Quantidade" tipoDado="quantidade" />);

    expect(screen.getByLabelText('Quantidade')).toHaveAttribute('inputmode', 'numeric');
  });

  it('exibe a ajuda quando nao ha erro', () => {
    render(<Campo rotulo="Estoque minimo" ajuda="Quantidade de seguranca em unidades" />);

    expect(screen.getByLabelText('Estoque minimo')).toHaveAccessibleDescription(
      'Quantidade de seguranca em unidades',
    );
  });

  it('o erro substitui a ajuda quando ambos existem', () => {
    render(<Campo rotulo="Estoque minimo" ajuda="Quantidade de seguranca" erro="Deve ser menor que o maximo" />);

    expect(screen.getByLabelText(/Estoque minimo/)).toHaveAccessibleDescription(
      'Deve ser menor que o maximo',
    );
  });
});
