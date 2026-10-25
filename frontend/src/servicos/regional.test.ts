import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { atualizarConfiguracaoRegional, buscarConfiguracaoRegional } from './regional';

const configuracaoFalsa = { formato_data: 'DD/MM/AAAA', formato_hora: '24H', updated_at: '2026-08-31T10:00:00-03:00' };

describe('servicos/regional', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('buscarConfiguracaoRegional busca GET /configuracoes/regional', async () => {
    servidor.responder([{ metodo: 'get', url: '/configuracoes/regional', status: 200, corpo: { dados: configuracaoFalsa } }]);

    const encontrada = await buscarConfiguracaoRegional();

    expect(encontrada.formato_data).toBe('DD/MM/AAAA');
  });

  it('atualizarConfiguracaoRegional envia PUT com o corpo informado', async () => {
    servidor.responder([{ metodo: 'put', url: '/configuracoes/regional', status: 200, corpo: { dados: configuracaoFalsa } }]);
    const corpo = { formato_data: 'AAAA-MM-DD', formato_hora: '12H' } as const;

    await atualizarConfiguracaoRegional(corpo);

    expect(servidor.requisicoes[0].corpo).toEqual(corpo);
  });
});
