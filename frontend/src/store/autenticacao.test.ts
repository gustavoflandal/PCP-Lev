import { beforeEach, describe, expect, it } from 'vitest';
import { lerSessaoSalva, useAutenticacao, type RespostaLogin } from './autenticacao';

const respostaLogin: RespostaLogin = {
  access_token: 'token-abc',
  token_type: 'Bearer',
  expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Administrador do Sistema', perfil: 'ADMIN',
    tema: 'automatico', alto_contraste: false, densidade: 'confortavel', tamanho_fonte: 'padrao',
  },
};

describe('store de autenticacao', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
  });

  it('comeca sem sessao', () => {
    const estado = useAutenticacao.getState();

    expect(estado.autenticado).toBe(false);
    expect(estado.token).toBeNull();
    expect(estado.usuario).toBeNull();
  });

  it('entrar guarda o token e o usuario', () => {
    useAutenticacao.getState().entrar(respostaLogin);

    const estado = useAutenticacao.getState();
    expect(estado.autenticado).toBe(true);
    expect(estado.token).toBe('token-abc');
    expect(estado.usuario?.nome).toBe('Administrador do Sistema');
  });

  it('entrar persiste a sessao para sobreviver ao recarregar a pagina', () => {
    useAutenticacao.getState().entrar(respostaLogin);

    expect(lerSessaoSalva()?.token).toBe('token-abc');
  });

  it('sair limpa o estado e a sessao salva', () => {
    useAutenticacao.getState().entrar(respostaLogin);

    useAutenticacao.getState().sair();

    expect(useAutenticacao.getState().autenticado).toBe(false);
    expect(lerSessaoSalva()).toBeNull();
  });

  it('registra o motivo quando a sessao expira, para avisar na tela de login', () => {
    useAutenticacao.getState().entrar(respostaLogin);

    useAutenticacao.getState().sair('expirada');

    expect(useAutenticacao.getState().motivoSaida).toBe('expirada');
  });

  it('registra o encerramento por inatividade separadamente da expiracao', () => {
    useAutenticacao.getState().entrar(respostaLogin);

    useAutenticacao.getState().sair('inatividade');

    expect(useAutenticacao.getState().motivoSaida).toBe('inatividade');
  });

  it('entrar limpa o motivo da saida anterior', () => {
    useAutenticacao.getState().sair('expirada');

    useAutenticacao.getState().entrar(respostaLogin);

    expect(useAutenticacao.getState().motivoSaida).toBeNull();
  });

  it('ignora sessao salva corrompida em vez de quebrar a aplicacao', () => {
    sessionStorage.setItem('pcp.sessao', '{isto nao e json');

    expect(lerSessaoSalva()).toBeNull();
  });

  it('ignora sessao salva sem token', () => {
    sessionStorage.setItem('pcp.sessao', JSON.stringify({ usuario: respostaLogin.usuario }));

    expect(lerSessaoSalva()).toBeNull();
  });
});
