import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import {
  atualizarDadosEmpresa,
  atualizarFavicon,
  atualizarLogoClaro,
  buscarDadosEmpresa,
  urlFavicon,
  urlLogoClaro,
  urlLogoEscuro,
} from './empresa';

const empresaFalsa = { id: 1, razao_social: 'Industria de Paineis VMS Ltda', tem_logo_claro: true };

describe('servicos/empresa', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('buscarDadosEmpresa busca GET /configuracoes/empresa', async () => {
    servidor.responder([{ metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: empresaFalsa } }]);

    const encontrada = await buscarDadosEmpresa();

    expect(encontrada.razao_social).toBe('Industria de Paineis VMS Ltda');
  });

  it('atualizarDadosEmpresa envia PUT com o corpo informado', async () => {
    servidor.responder([{ metodo: 'put', url: '/configuracoes/empresa', status: 200, corpo: { dados: empresaFalsa } }]);
    const corpo = { razao_social: 'Industria de Paineis VMS Ltda' } as never;

    await atualizarDadosEmpresa(corpo);

    expect(servidor.requisicoes[0].corpo).toEqual(corpo);
  });

  it('atualizarLogoClaro envia PUT para .../logotipo/claro', async () => {
    servidor.responder([{ metodo: 'put', url: '/configuracoes/empresa/logotipo/claro', status: 200, corpo: { dados: empresaFalsa } }]);

    await atualizarLogoClaro({ dados_base64: 'abc', mime: 'image/png' });

    expect(servidor.requisicoes[0].corpo).toEqual({ dados_base64: 'abc', mime: 'image/png' });
  });

  it('atualizarFavicon envia PUT para .../favicon', async () => {
    servidor.responder([{ metodo: 'put', url: '/configuracoes/empresa/favicon', status: 200, corpo: { dados: empresaFalsa } }]);

    await atualizarFavicon({ dados_base64: '', mime: '' });

    expect(servidor.requisicoes[0].corpo).toEqual({ dados_base64: '', mime: '' });
  });

  it('as urls binarias apontam para os endpoints publicos de imagem', () => {
    expect(urlLogoClaro()).toMatch(/\/configuracoes\/empresa\/logotipo\/claro$/);
    expect(urlLogoEscuro()).toMatch(/\/configuracoes\/empresa\/logotipo\/escuro$/);
    expect(urlFavicon()).toMatch(/\/configuracoes\/empresa\/favicon$/);
  });
});
