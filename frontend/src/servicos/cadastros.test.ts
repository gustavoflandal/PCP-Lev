import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { atualizar, criar, excluir, listar, obter } from './cadastros';
import type { Fornecedor } from '@/tipos/cadastros';

const parametros = {
  pagina: 1,
  limite: 20,
  ordenar_por: 'razao_social',
  ordem: 'asc' as const,
  busca: '',
  filtro_ativo: null,
};

const fornecedor = {
  id: 1,
  razao_social: 'Componentes Eletronicos LTDA',
  cnpj: '11222333000181',
  contato_nome: 'Joao Silva',
  contato_email: 'joao@componentes.com.br',
  contato_telefone: '11999999999',
  endereco: 'Rua das Pecas, 100',
  lead_time_medio: 7,
  condicao_pagamento: '30 dias',
  ativo: true,
  created_at: '2026-08-29T12:00:00Z',
  updated_at: '2026-08-29T12:00:00Z',
};

const paginaVazia = {
  sucesso: true,
  dados: [],
  paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 },
};

describe('servico de cadastros', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('listar desembrulha o envelope em itens e paginacao', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/fornecedores',
        status: 200,
        corpo: {
          sucesso: true,
          dados: [fornecedor],
          paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 },
        },
      },
    ]);

    const pagina = await listar<Fornecedor>('fornecedores', parametros);

    expect(pagina.itens).toHaveLength(1);
    expect(pagina.itens[0].razao_social).toBe('Componentes Eletronicos LTDA');
    expect(pagina.paginacao.total).toBe(1);
  });

  it('listar omite busca vazia e filtro nulo da query', async () => {
    servidor.responder([{ metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaVazia }]);

    await listar<Fornecedor>('fornecedores', parametros);

    const enviados = servidor.requisicoes[0].params;
    expect(enviados).not.toHaveProperty('busca');
    expect(enviados).not.toHaveProperty('filtro_ativo');
    expect(enviados).toMatchObject({
      pagina: 1,
      limite: 20,
      ordenar_por: 'razao_social',
      ordem: 'asc',
    });
  });

  it('listar envia busca e filtro quando informados', async () => {
    servidor.responder([{ metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaVazia }]);

    await listar<Fornecedor>('fornecedores', { ...parametros, busca: 'radares', filtro_ativo: true });

    expect(servidor.requisicoes[0].params).toMatchObject({ busca: 'radares', filtro_ativo: true });
  });

  it('obter devolve o registro de dentro do envelope', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores/1', status: 200, corpo: { sucesso: true, dados: fornecedor } },
    ]);

    const encontrado = await obter<Fornecedor>('fornecedores', 1);

    expect(encontrado.id).toBe(1);
  });

  it('criar envia o corpo e devolve o registro criado', async () => {
    servidor.responder([
      { metodo: 'post', url: '/fornecedores', status: 201, corpo: { sucesso: true, dados: fornecedor } },
    ]);

    const criado = await criar<Fornecedor>('fornecedores', { razao_social: 'Componentes Eletronicos LTDA' });

    expect(servidor.requisicoes[0].corpo).toEqual({ razao_social: 'Componentes Eletronicos LTDA' });
    expect(criado.cnpj).toBe('11222333000181');
  });

  it('atualizar usa PUT no id informado', async () => {
    servidor.responder([
      { metodo: 'put', url: '/fornecedores/1', status: 200, corpo: { sucesso: true, dados: fornecedor } },
    ]);

    await atualizar<Fornecedor>('fornecedores', 1, { razao_social: 'Outra Razao' });

    expect(servidor.requisicoes[0].url).toBe('/fornecedores/1');
  });

  it('excluir usa DELETE e nao espera corpo', async () => {
    servidor.responder([{ metodo: 'delete', url: '/fornecedores/1', status: 204 }]);

    await expect(excluir('fornecedores', 1)).resolves.toBeUndefined();
  });

  it('erro da API chega normalizado como ErroApi', async () => {
    servidor.responder([
      {
        metodo: 'post',
        url: '/fornecedores',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'ja existe um fornecedor com este CNPJ' },
        },
      },
    ]);

    await expect(criar<Fornecedor>('fornecedores', {})).rejects.toMatchObject({
      codigo: 'CONFLITO',
      message: 'ja existe um fornecedor com este CNPJ',
    });
  });
});
