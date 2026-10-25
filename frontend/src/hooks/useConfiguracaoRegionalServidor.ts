import { useQuery } from '@tanstack/react-query';
import { buscarConfiguracaoRegional, chaveConfiguracaoRegional } from '@/servicos/regional';
import { useConfiguracaoRegional } from '@/store/configuracaoRegional';

/** Busca a configuracao e ja aplica na store. Aplicar DENTRO da queryFn, antes
 * de o dado entrar no cache, e o que garante que nenhum componente renderize
 * entre a chegada do dado e a store refletir -- um useEffect rodaria so depois
 * do commit, e como formatarData le a store via getState() (nao assina), quem
 * ja renderizou com o formato antigo nao renderizaria de novo. */
async function buscarEAplicar() {
  const configuracao = await buscarConfiguracaoRegional();
  useConfiguracaoRegional.getState().aplicar({
    formato_data: configuracao.formato_data,
    formato_hora: configuracao.formato_hora,
  });
  return configuracao;
}

/**
 * Configuracao regional vinda do backend -- o Shell e a tela de Parametros
 * Regionais usam este mesmo hook, entao qualquer busca (inclusive um refetch
 * disparado pela tela) mantem a store em dia. Muda raramente: staleTime
 * infinito, a tela de edicao atualiza o cache ao salvar.
 */
export function useConfiguracaoRegionalServidor(habilitado = true) {
  return useQuery({
    queryKey: chaveConfiguracaoRegional,
    queryFn: buscarEAplicar,
    staleTime: Infinity,
    enabled: habilitado,
  });
}
