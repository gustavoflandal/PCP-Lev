import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { SessaoSincronizada } from './SessaoSincronizada';

describe('SessaoSincronizada', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    servidor = instalarServidorFalso();
    entrarComoPerfil('OPERADOR');
  });

  it('atualiza as permissoes da sessao com o que o /auth/eu devolve', async () => {
    servidor.responder([{
      metodo: 'get', url: '/auth/eu', status: 200,
      corpo: { dados: { id: 1, permissoes: ['estoque.ajustar'], perfil_nome: 'Almoxarife sênior' } },
    }]);

    renderizarComProvedores(<SessaoSincronizada />);

    await waitFor(() => expect(useAutenticacao.getState().usuario?.permissoes).toEqual(['estoque.ajustar']));
    expect(useAutenticacao.getState().usuario?.perfil_nome).toBe('Almoxarife sênior');
    expect(JSON.parse(sessionStorage.getItem('pcp.sessao') ?? '{}').usuario.permissoes).toEqual(['estoque.ajustar']);
  });

  it('resposta sem permissoes (ex.: falha parcial) nao apaga as da sessao', async () => {
    const antes = useAutenticacao.getState().usuario?.permissoes;
    servidor.responder([{ metodo: 'get', url: '/auth/eu', status: 200, corpo: { dados: { id: 1 } } }]);

    renderizarComProvedores(<SessaoSincronizada />);
    await waitFor(() => expect(servidor.requisicoes.length).toBeGreaterThan(0));

    expect(useAutenticacao.getState().usuario?.permissoes).toEqual(antes);
  });

  it('resposta de outro usuario (cache antigo) nao e aplicada', async () => {
    const antes = useAutenticacao.getState().usuario?.permissoes;
    servidor.responder([{
      metodo: 'get', url: '/auth/eu', status: 200,
      corpo: { dados: { id: 999, permissoes: ['configuracoes.perfis'], perfil_nome: 'Administrador' } },
    }]);

    renderizarComProvedores(<SessaoSincronizada />);
    await waitFor(() => expect(servidor.requisicoes.length).toBeGreaterThan(0));

    expect(useAutenticacao.getState().usuario?.permissoes).toEqual(antes);
  });
});
