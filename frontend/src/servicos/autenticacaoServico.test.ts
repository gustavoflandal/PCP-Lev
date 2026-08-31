import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { atualizarPreferencias } from './autenticacaoServico';

describe('atualizarPreferencias', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('envia PUT para /auth/preferencias e desembrulha o usuario atualizado', async () => {
    const corpo = { tema: 'escuro' as const, alto_contraste: true, densidade: 'compacta' as const, tamanho_fonte: 'grande' as const };
    servidor.responder([
      {
        metodo: 'put', url: '/auth/preferencias', status: 200,
        corpo: { sucesso: true, dados: { id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN', ...corpo } },
      },
    ]);

    const atualizado = await atualizarPreferencias(corpo);

    expect(servidor.requisicoes[0].corpo).toEqual(corpo);
    expect(atualizado.tema).toBe('escuro');
    expect(atualizado.alto_contraste).toBe(true);
  });
});
