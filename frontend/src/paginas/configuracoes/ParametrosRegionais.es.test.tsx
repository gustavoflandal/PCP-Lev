import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { PREFERENCIAS_PADRAO, usePreferencias } from '@/store/preferencias';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores } from '@/testes/utilitarios';
import { ParametrosRegionais } from './ParametrosRegionais';

describe('ParametrosRegionais (espanhol)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    entrarComoPerfil('ADMIN');
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
  });
  afterEach(() => usePreferencias.getState().aplicar(PREFERENCIAS_PADRAO));

  it('mostra formulario, previa e botao em espanhol', async () => {
    instalarServidorFalso().responder([
      { metodo: 'get', url: '/configuracoes/regional', status: 200, corpo: { dados: { formato_data: 'DD/MM/AAAA', formato_hora: '24H', updated_at: '2026-08-31T10:00:00-03:00' } } },
    ]);

    renderizarComProvedores(<ParametrosRegionais />);

    expect(screen.getByText('Cargando parámetros regionales…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Parámetros regionales' })).toBeInTheDocument();
    expect(screen.getByLabelText('Formato de fecha')).toHaveValue('DD/MM/AAAA');
    expect(screen.getByText('Así: 31/08/2026 14:30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });
});
