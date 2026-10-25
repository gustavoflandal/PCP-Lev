import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { criarEstrutura, listarEstruturasPorProduto, obterEstrutura, versionarEstrutura } from './estrutura';

describe('servicos/estrutura', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('criarEstrutura envia POST para /boms', async () => {
    servidor.responder([{ metodo: 'post', url: '/boms', status: 201, corpo: { dados: { id: 1, versao: 1 } } }]);
    const corpo = { produto_acabado_id: 1, data_vigencia_inicio: '2026-09-01', itens: [{ parte_peca_id: 1, quantidade: 4 }] };
    const criada = await criarEstrutura(corpo);
    expect(servidor.requisicoes[0].corpo).toEqual(corpo);
    expect(criada.versao).toBe(1);
  });

  it('versionarEstrutura envia POST para /boms/:id/versionar', async () => {
    servidor.responder([{ metodo: 'post', url: '/boms/1/versionar', status: 201, corpo: { dados: { id: 2, versao: 2 } } }]);
    const corpo = { data_vigencia_inicio: '2026-10-01', itens: [{ parte_peca_id: 1, quantidade: 6 }] };
    const nova = await versionarEstrutura(1, corpo);
    expect(servidor.requisicoes[0].corpo).toEqual(corpo);
    expect(nova.versao).toBe(2);
  });

  it('obterEstrutura busca por id', async () => {
    servidor.responder([{ metodo: 'get', url: '/boms/1', status: 200, corpo: { dados: { id: 1, versao: 1 } } }]);
    const encontrada = await obterEstrutura(1);
    expect(encontrada.id).toBe(1);
  });

  it('listarEstruturasPorProduto bate em /produtos-acabados/:id/boms', async () => {
    servidor.responder([{ metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: { dados: [{ id: 1, versao: 1 }] } }]);
    const historico = await listarEstruturasPorProduto(1);
    expect(historico).toHaveLength(1);
  });
});
