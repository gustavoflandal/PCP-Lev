import { icones, type NomeIcone } from '@/componentes/ui/icones';
import { marcar, t, td } from '@/i18n';
import { cn } from '@/lib/cn';
import type { PendenciaExibida } from '@/servicos/notasEntrada';
import type { NivelPendencia } from '@/tipos/notasEntrada';

const GRUPOS: { nivel: NivelPendencia; titulo: string; ajuda: string; icone: NomeIcone; classe: string }[] = [
  {
    nivel: 'BLOQUEIO',
    titulo: marcar('Bloqueios'),
    ajuda: marcar('Impedem conferir e efetivar: corrija na nota e salve de novo.'),
    icone: 'alert-triangle',
    classe: 'border-estado-pending bg-estado-pending-bg text-estado-pending',
  },
  {
    nivel: 'APROVACAO',
    titulo: marcar('Exigem aprovação'),
    ajuda: marcar('A efetivação precisa de quem tem a permissão "Aprovar divergência de preço".'),
    icone: 'shield-alert',
    classe: 'border-estado-warning bg-estado-warning-bg text-estado-warning',
  },
  {
    nivel: 'AVISO',
    titulo: marcar('Avisos'),
    ajuda: marcar('Só informam: o estoque anda pelo que foi contado; a diferença fica pendente com o fornecedor.'),
    icone: 'help-circle',
    classe: 'border-borda-subtle bg-estado-neutral-bg text-estado-neutral',
  },
];

export interface PainelPendenciasProps {
  pendencias: PendenciaExibida[];
  carregando?: boolean;
}

/** Pendencias da conferencia agrupadas por nivel (4.3.4): bloqueio, aprovacao e aviso. */
export function PainelPendencias({ pendencias, carregando }: PainelPendenciasProps) {
  const IconeOk = icones['check-circle-2'];
  if (carregando) {
    return <p className="text-body text-texto-secondary">{t('Conferindo pendências…')}</p>;
  }
  if (pendencias.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-cartao border border-estado-done bg-estado-done-bg px-3 py-2 text-body text-estado-done">
        <IconeOk size={16} aria-hidden="true" />
        {t('Nenhuma pendência: a nota pode ser conferida.')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {GRUPOS.map((g) => {
        const doGrupo = pendencias.filter((p) => p.nivel === g.nivel);
        if (doGrupo.length === 0) return null;
        const Icone = icones[g.icone];
        return (
          <section key={g.nivel} aria-label={td(g.titulo)} className={cn('rounded-cartao border px-3 py-2', g.classe)}>
            <h3 className="flex items-center gap-2 text-body font-semibold">
              <Icone size={16} aria-hidden="true" />
              {td(g.titulo)} ({doGrupo.length})
            </h3>
            <p className="text-label">{td(g.ajuda)}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {doGrupo.map((p, i) => (
                <li key={`${p.onde}-${i}`} className="text-body text-texto-primary">
                  {p.onde && <span className="font-medium">{ondeTraduzido(p.onde)}: </span>}
                  {td(p.mensagem)}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** "Item 2" vem montado pelo servico; o tipo da pendencia do cabecalho (CHAVE, DATAS...) e um codigo e fica como esta. */
function ondeTraduzido(onde: string): string {
  const item = /^Item (\d+)$/.exec(onde);
  return item ? t('Item {n}', { n: item[1] }) : td(onde);
}
