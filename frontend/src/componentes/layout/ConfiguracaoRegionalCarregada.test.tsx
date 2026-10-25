import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { formatarData } from '@/lib/formato';
import { CONFIGURACAO_REGIONAL_PADRAO, useConfiguracaoRegional } from '@/store/configuracaoRegional';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { ConfiguracaoRegionalCarregada } from './ConfiguracaoRegionalCarregada';

// Le a store via getState(), como as tabelas reais -- nao assina a store, entao
// so mostra o formato certo se ja estiver aplicado no primeiro render.
function CelulaDeData() {
  return <span>Validade: {formatarData('2026-08-31')}</span>;
}

describe('ConfiguracaoRegionalCarregada', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    useConfiguracaoRegional.setState({ configuracao: CONFIGURACAO_REGIONAL_PADRAO });
  });

  it('so desenha o conteudo depois de aplicar a configuracao (carga a frio)', async () => {
    servidor.responder([{
      metodo: 'get', url: '/configuracoes/regional', status: 200,
      corpo: { dados: { formato_data: 'AAAA-MM-DD', formato_hora: '24H', updated_at: '2026-08-31T10:00:00-03:00' } },
    }]);

    renderizarComProvedores(<ConfiguracaoRegionalCarregada><CelulaDeData /></ConfiguracaoRegionalCarregada>);

    expect(screen.getByText('Carregando…')).toBeInTheDocument();
    expect(await screen.findByText('Validade: 2026-08-31')).toBeInTheDocument();
  });

  it('se a busca falhar, segue com os defaults em vez de bloquear o sistema', async () => {
    servidor.responder([{ metodo: 'get', url: '/configuracoes/regional', status: 500, corpo: { sucesso: false } }]);

    renderizarComProvedores(<ConfiguracaoRegionalCarregada><CelulaDeData /></ConfiguracaoRegionalCarregada>);

    expect(await screen.findByText('Validade: 31/08/2026')).toBeInTheDocument();
  });
});
