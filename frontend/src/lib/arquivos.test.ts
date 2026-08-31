import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { baixarArquivo } from './arquivos';

describe('baixarArquivo', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    URL.createObjectURL = vi.fn(() => 'blob:teste');
    URL.revokeObjectURL = vi.fn();
  });

  it('busca o blob autenticado e aciona o download com o nome certo', async () => {
    const conteudo = new Blob(['codigo,descricao\nRES-10K,Resistor'], { type: 'text/csv' });
    servidor.responder([{ metodo: 'get', url: '/estoque/relatorio.csv', status: 200, corpo: conteudo }]);
    const cliqueEspiao = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await baixarArquivo('/estoque/relatorio.csv', 'estoque.csv');

    expect(servidor.requisicoes[0].url).toBe('/estoque/relatorio.csv');
    expect(URL.createObjectURL).toHaveBeenCalledWith(conteudo);
    expect(cliqueEspiao).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:teste');

    cliqueEspiao.mockRestore();
  });
});
