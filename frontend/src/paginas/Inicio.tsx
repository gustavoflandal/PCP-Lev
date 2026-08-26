import { useQuery } from '@tanstack/react-query';
import { Cartao } from '@/componentes/ui/Cartao';
import { icones } from '@/componentes/ui/icones';
import { api } from '@/servicos/api';
import { useAutenticacao } from '@/store/autenticacao';

interface RespostaSaude {
  dados: { status: string; ambiente: string };
}

/**
 * Tela inicial da Sprint 1. Os widgets do RF6.1 (OPs em atraso, PCs a receber,
 * insumos criticos) entram na Sprint 2, quando houver dados para exibir.
 */
export function Inicio() {
  const usuario = useAutenticacao((estado) => estado.usuario);

  const saude = useQuery({
    queryKey: ['saude'],
    queryFn: async () => (await api.get<RespostaSaude>('/saude')).data.dados,
    refetchInterval: 60_000,
  });

  const IconeOk = icones['check-circle-2'];
  const IconeFalha = icones['alert-triangle'];

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Início</h1>
        <p className="text-body text-texto-secondary">
          {usuario ? `Sessão aberta como ${usuario.nome}.` : 'Sessão aberta.'}
        </p>
      </div>

      <Cartao titulo="Conexão com o servidor">
        {saude.isPending && <p className="text-body text-texto-secondary">Verificando…</p>}

        {saude.isError && (
          <p className="flex items-center gap-2 text-body text-estado-pending">
            <IconeFalha size={16} aria-hidden="true" />
            Servidor indisponível. As telas de operação não funcionarão até a conexão voltar.
          </p>
        )}

        {saude.data && (
          <p className="flex items-center gap-2 text-body text-estado-done">
            <IconeOk size={16} aria-hidden="true" />
            Operacional · ambiente {saude.data.ambiente}
          </p>
        )}
      </Cartao>

      <Cartao titulo="Próximos módulos">
        <p className="text-body text-texto-secondary">
          Cadastros base, compras, estoque e o quadro Kanban de produção entram nas próximas
          sprints, na ordem do cronograma técnico.
        </p>
      </Cartao>
    </div>
  );
}
