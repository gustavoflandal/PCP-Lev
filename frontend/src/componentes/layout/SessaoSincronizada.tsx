import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/servicos/api';
import { useAutenticacao } from '@/store/autenticacao';

interface RespostaEu {
  dados: { id?: number; permissoes?: string[]; perfil_nome?: string; deve_trocar_senha?: boolean };
}

/**
 * Sem UI -- ao abrir o sistema (e a cada montagem do Shell), busca /auth/eu e
 * atualiza as permissoes da sessao. O Administrador pode ter mudado a matriz
 * de perfis desde o login; sem isto a tela ofereceria botoes que a API ja
 * nega (ou esconderia os que ela ja libera) ate o proximo login.
 */
export function SessaoSincronizada() {
  const atualizar = useAutenticacao((estado) => estado.atualizarAcessoSessao);
  const usuarioId = useAutenticacao((estado) => estado.usuario?.id);
  const { data } = useQuery({
    // Por usuario: num terminal compartilhado, quem entra depois de um logout
    // nao pode receber, nem por um instante, o /auth/eu em cache de quem saiu.
    queryKey: ['auth', 'eu', usuarioId],
    queryFn: async () => (await api.get<RespostaEu>('/auth/eu')).data.dados,
    staleTime: 0,
    enabled: usuarioId !== undefined,
  });

  useEffect(() => {
    if (data && data.id === usuarioId && Array.isArray(data.permissoes)) {
      atualizar({ permissoes: data.permissoes, perfil_nome: data.perfil_nome ?? '', deve_trocar_senha: data.deve_trocar_senha });
    }
  }, [data, usuarioId, atualizar]);

  return null;
}
