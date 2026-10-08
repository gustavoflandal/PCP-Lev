import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TrilhaEtapas, type Etapa } from './TrilhaEtapas';

function etapas(sobrescritas: Partial<Record<string, Partial<Etapa>>> = {}): Etapa[] {
  const base: Etapa[] = [
    { chave: 'rascunho', nome: 'Rascunho', estado: 'concluida', timestamp: '10:00', executante: 'Ana' },
    { chave: 'enviada', nome: 'Enviada', estado: 'pendente-acionavel' },
    { chave: 'respondida', nome: 'Respondida', estado: 'pendente-futura' },
  ];
  return base.map((etapa) => ({ ...etapa, ...sobrescritas[etapa.chave] }));
}

describe('TrilhaEtapas', () => {
  it('e uma lista acessivel com um item por etapa', () => {
    render(<TrilhaEtapas rotulo="Status da cotação" etapas={etapas()} />);

    expect(screen.getByRole('list', { name: 'Status da cotação' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('etapa concluida mostra o rotulo com timestamp e executante', () => {
    render(<TrilhaEtapas rotulo="Status" etapas={etapas()} />);

    expect(screen.getByText('Concluída · 10:00')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('etapa pendente acionavel anuncia aria-current e o rotulo de acao', () => {
    render(<TrilhaEtapas rotulo="Status" etapas={etapas()} />);

    const botao = screen.getByRole('button', { name: /Enviada/ });
    expect(botao).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Pendente · iniciar')).toBeInTheDocument();
  });

  it('etapa pendente futura fica inerte e avisa que aguarda a anterior', () => {
    render(<TrilhaEtapas rotulo="Status" etapas={etapas()} />);

    expect(screen.getByText('Aguardando etapa anterior')).toBeInTheDocument();
    const futura = screen.getByText('Respondida').closest('[role="listitem"]');
    expect(futura).toHaveAttribute('aria-disabled', 'true');
  });

  it('etapa bloqueada mostra o rotulo de bloqueio', () => {
    render(
      <TrilhaEtapas
        rotulo="Status"
        etapas={[{ chave: 'emitido', nome: 'Emitido', estado: 'bloqueada' }]}
      />,
    );

    expect(screen.getByText('Bloqueada · aguardando aprovação')).toBeInTheDocument();
  });

  it('clicar numa etapa pendente-acionavel chama aoAcionar', async () => {
    const aoAcionar = vi.fn();
    render(
      <TrilhaEtapas
        rotulo="Status"
        etapas={[{ chave: 'enviada', nome: 'Enviada', estado: 'pendente-acionavel', aoAcionar }]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Enviada/ }));

    expect(aoAcionar).toHaveBeenCalledTimes(1);
  });

  it('etapa pendente-futura nao tem acao clicavel', () => {
    render(
      <TrilhaEtapas
        rotulo="Status"
        etapas={[{ chave: 'respondida', nome: 'Respondida', estado: 'pendente-futura' }]}
      />,
    );

    expect(screen.queryByRole('button', { name: /Respondida/ })).not.toBeInTheDocument();
  });

  it('etapa concluida sem aoAcionar nao quebra e nao vira botao', () => {
    render(
      <TrilhaEtapas
        rotulo="Status"
        etapas={[{ chave: 'rascunho', nome: 'Rascunho', estado: 'concluida', timestamp: '10:00' }]}
      />,
    );

    expect(screen.queryByRole('button', { name: /Rascunho/ })).not.toBeInTheDocument();
  });

  it('etapa concluida com aoAcionar vira botao que abre em consulta', async () => {
    const aoAcionar = vi.fn();
    render(
      <TrilhaEtapas
        rotulo="Status"
        etapas={[{ chave: 'rascunho', nome: 'Rascunho', estado: 'concluida', timestamp: '10:00', aoAcionar }]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Rascunho/ }));

    expect(aoAcionar).toHaveBeenCalledTimes(1);
  });
});
