import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIGURACAO_REGIONAL_PADRAO, configuracaoRegionalAtual, useConfiguracaoRegional } from './configuracaoRegional';

describe('store/configuracaoRegional', () => {
  beforeEach(() => {
    useConfiguracaoRegional.setState({ configuracao: CONFIGURACAO_REGIONAL_PADRAO });
  });

  it('comeca com os defaults da migration', () => {
    expect(configuracaoRegionalAtual()).toEqual(CONFIGURACAO_REGIONAL_PADRAO);
  });

  it('aplicar atualiza o que configuracaoRegionalAtual devolve, fora do React', () => {
    useConfiguracaoRegional.getState().aplicar({ formato_data: 'AAAA-MM-DD', formato_hora: '12H' });

    expect(configuracaoRegionalAtual()).toEqual({ formato_data: 'AAAA-MM-DD', formato_hora: '12H' });
  });
});
