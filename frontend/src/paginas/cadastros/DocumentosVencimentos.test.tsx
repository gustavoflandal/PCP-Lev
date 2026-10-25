import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { hojeAAAAMMDD } from '@/tipos/producao';
import {
  entrarComoPerfil,
  instalarServidorFalso,
  renderizarComProvedores,
  type ServidorFalso,
} from '@/testes/utilitarios';
import { DocumentosVencimentos } from './DocumentosVencimentos';

/** Data AAAA-MM-DD a `dias` de hoje (fuso do navegador, como a tela). */
function daquiA(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return hojeAAAAMMDD(d);
}

describe('DocumentosVencimentos', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
  });

  it('lista vencidos e a vencer com o selo de cada um', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/anexos/vencimentos',
        status: 200,
        corpo: {
          sucesso: true,
          dados: [
            {
              anexo_id: 1, entidade: 'parte_peca', entidade_id: 3, entidade_codigo: 'CON-001',
              categoria: 'Certificado de Conformidade', titulo: 'Certificado RoHS', data_validade: daquiA(-2), vencido: true,
            },
            {
              anexo_id: 2, entidade: 'produto_acabado', entidade_id: 5, entidade_codigo: 'RAD-01',
              categoria: 'Laudo de Ensaio', titulo: '', data_validade: daquiA(10), vencido: false,
            },
          ],
        },
      },
    ]);

    renderizarComProvedores(<DocumentosVencimentos />);

    await screen.findByText('CON-001');
    const tabela = screen.getByRole('table', { name: 'Documentos a vencer' });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(3);
    expect(within(linhas[1]).getByText('Peça')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('CON-001')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('Certificado RoHS')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('Vencido')).toBeInTheDocument();
    expect(within(linhas[2]).getByText('Produto')).toBeInTheDocument();
    expect(within(linhas[2]).getByText('Vence em 10 dias')).toBeInTheDocument();
    expect(servidor.requisicoes[0].params).toEqual({ dias: 30 });
  });

  it('troca o prazo e consulta de novo', async () => {
    servidor.responder([{ metodo: 'get', url: '/anexos/vencimentos', status: 200, corpo: { sucesso: true, dados: [] } }]);

    renderizarComProvedores(<DocumentosVencimentos />);
    expect(await screen.findByText('Nenhum documento vencido ou vencendo neste prazo.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Prazo'), '90');

    await screen.findByText('Nenhum documento vencido ou vencendo neste prazo.');
    expect(servidor.requisicoes.map((r) => r.params.dias)).toEqual([30, 90]);
  });

  it('erro da API aparece com nova tentativa', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/anexos/vencimentos',
        status: 403,
        corpo: { sucesso: false, erro: { codigo: 'ACESSO_NEGADO', mensagem: 'Seu perfil nao tem permissao para estes anexos' } },
      },
    ]);

    renderizarComProvedores(<DocumentosVencimentos />);

    expect(await screen.findByText('Seu perfil nao tem permissao para estes anexos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('fornecedor e cliente aparecem pela razao social, com link para os documentos do cadastro (3.1)', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/anexos/vencimentos',
        status: 200,
        corpo: {
          sucesso: true,
          dados: [
            {
              anexo_id: 7, entidade: 'fornecedor', entidade_id: 3, entidade_codigo: 'Componentes Silva Ltda',
              categoria: 'Certificado de Qualidade', titulo: 'ISO 9001', data_validade: daquiA(-1), vencido: true,
            },
            {
              anexo_id: 8, entidade: 'cliente', entidade_id: 9, entidade_codigo: 'DER Teste',
              categoria: 'Contrato', titulo: 'Contrato 2026', data_validade: daquiA(20), vencido: false,
            },
          ],
        },
      },
    ]);

    renderizarComProvedores(<DocumentosVencimentos />);

    const fornecedor = await screen.findByRole('link', { name: 'Abrir documentos de Componentes Silva Ltda' });
    expect(fornecedor).toHaveAttribute('href', '/fornecedores?documentos=3&nome=Componentes+Silva+Ltda');
    expect(screen.getByRole('link', { name: 'Abrir documentos de DER Teste' })).toHaveAttribute(
      'href',
      '/clientes?documentos=9&nome=DER+Teste',
    );
    const linhas = within(screen.getByRole('table', { name: 'Documentos a vencer' })).getAllByRole('row');
    expect(within(linhas[1]).getByText('Fornecedor')).toBeInTheDocument();
    expect(within(linhas[2]).getByText('Cliente')).toBeInTheDocument();
  });
});
