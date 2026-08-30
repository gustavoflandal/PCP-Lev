import { useQuery } from '@tanstack/react-query';
import { Cartao } from '@/componentes/ui/Cartao';
import { icones } from '@/componentes/ui/icones';
import { api } from '@/servicos/api';
import { listarPedidosEmAtraso } from '@/servicos/compras';
import { useAutenticacao } from '@/store/autenticacao';

interface RespostaSaude {
  dados: { status: string; ambiente: string };
}

interface WidgetPendente {
  titulo: string;
  /** Convite do §7: diz o que falta e quando chega. */
  vazio: string;
}

/**
 * Widgets do RF6.1 que ainda nao tem dado real por tras: o modulo
 * correspondente ainda nao existe. "Pedidos de compra a receber" saiu
 * daqui na Sprint 3 — agora e o unico com numero de verdade (ver widget
 * dedicado abaixo). Numero simulado em tela de gestao acaba virando base de
 * decisao, entao os que restam continuam so dizendo onde e quando chegam.
 */
const WIDGETS: WidgetPendente[] = [
  {
    titulo: 'Ordens de produção em atraso',
    vazio: 'Nenhuma ordem de produção ainda. O módulo de produção entra na Sprint 6.',
  },
  {
    titulo: 'Insumos em nível crítico',
    vazio: 'Nenhum insumo monitorado ainda. O controle de estoque entra na Sprint 3.',
  },
];

export function Painel() {
  const usuario = useAutenticacao((estado) => estado.usuario);

  const saude = useQuery({
    queryKey: ['saude'],
    queryFn: async () => (await api.get<RespostaSaude>('/saude')).data.dados,
    refetchInterval: 60_000,
  });

  const pedidosEmAtraso = useQuery({
    queryKey: ['pedidos-compra', 'em-atraso'],
    queryFn: listarPedidosEmAtraso,
  });

  const IconeOk = icones['check-circle-2'];
  const IconeFalha = icones['alert-triangle'];

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Painel</h1>
        <p className="text-body text-texto-secondary">
          {usuario ? `Sessão aberta como ${usuario.nome}.` : 'Sessão aberta.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Cartao key={WIDGETS[0].titulo} titulo={WIDGETS[0].titulo}>
          <p data-widget-vazio className="text-body text-texto-secondary">
            {WIDGETS[0].vazio}
          </p>
        </Cartao>

        <Cartao titulo="Pedidos de compra em atraso">
          {pedidosEmAtraso.isPending && <p className="text-body text-texto-secondary">Verificando…</p>}

          {pedidosEmAtraso.isError && (
            <p data-widget-vazio className="text-body text-texto-secondary">
              Não foi possível verificar agora.
            </p>
          )}

          {pedidosEmAtraso.data && pedidosEmAtraso.data.length === 0 && (
            <p data-widget-vazio className="text-body text-texto-secondary">
              Nenhum pedido de compra em atraso.
            </p>
          )}

          {pedidosEmAtraso.data && pedidosEmAtraso.data.length > 0 && (
            <p className="flex items-center gap-2 text-body text-estado-warning">
              <IconeFalha size={16} aria-hidden="true" />
              {pedidosEmAtraso.data.length === 1
                ? '1 pedido de compra em atraso.'
                : `${pedidosEmAtraso.data.length} pedidos de compra em atraso.`}
            </p>
          )}
        </Cartao>

        <Cartao key={WIDGETS[1].titulo} titulo={WIDGETS[1].titulo}>
          <p data-widget-vazio className="text-body text-texto-secondary">
            {WIDGETS[1].vazio}
          </p>
        </Cartao>
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
    </div>
  );
}
