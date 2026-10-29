import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { icones, type NomeIcone } from '@/componentes/ui/icones';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatarValor, type FormatoValor } from '@/lib/paineis';

/**
 * Tom de estado do indicador -- so quando o numero tem significado (§2):
 * atraso e alerta sao `warning`; vencido e reprovado, `pending`.
 */
export type TomIndicador = 'warning' | 'pending';

const ESTILO_TOM: Record<TomIndicador, { borda: string; texto: string; icone: NomeIcone }> = {
  warning: { borda: 'border-l-estado-warning', texto: 'text-estado-warning', icone: 'alert-triangle' },
  pending: { borda: 'border-l-estado-pending', texto: 'text-estado-pending', icone: 'alert-triangle' },
};

export interface CartaoIndicadorProps {
  rotulo: string;
  valor: number | null | undefined;
  formato?: FormatoValor;
  /** Linha abaixo do numero (ex.: o valor em R$ dos pedidos em aberto). */
  complemento?: ReactNode;
  /** Frase quando o valor vem null (nao ha dado no periodo). */
  semDado?: string;
  /** Tom de estado; so aplicado com valor maior que zero. */
  tom?: TomIndicador;
  /** Tela correspondente, quando o usuario pode ve-la. */
  para?: string;
  carregando?: boolean;
}

/**
 * Cartao de indicador dos paineis: rotulo, numero grande em tabular-nums e,
 * quando ha significado, o tom de estado com icone e borda esquerda -- a
 * informacao nunca depende so da cor (o rotulo diz o que o numero e).
 */
export function CartaoIndicador({
  rotulo,
  valor,
  formato = 'numero',
  complemento,
  semDado,
  tom,
  para,
  carregando,
}: CartaoIndicadorProps) {
  const idRotulo = useId();

  if (carregando) {
    return (
      <div
        data-testid="esqueleto-indicador"
        aria-busy="true"
        aria-label={t('{rotulo}: carregando', { rotulo })}
        className="flex flex-col gap-2 rounded-cartao border border-borda-subtle bg-surface-raised p-4"
      >
        <span className="block h-3 w-1/2 rounded-campo bg-surface-sunken" />
        <span className="block h-8 w-1/3 rounded-campo bg-surface-sunken" />
      </div>
    );
  }

  const semValor = valor === null || valor === undefined;
  const estilo = tom && !semValor && valor > 0 ? ESTILO_TOM[tom] : undefined;
  const Icone = estilo ? icones[estilo.icone] : undefined;

  const conteudo = (
    <>
      <p id={idRotulo} className="text-label text-texto-secondary">
        {rotulo}
      </p>
      <p
        data-valor-indicador
        className={cn('flex items-center gap-2 text-display tabular', estilo ? estilo.texto : 'text-texto-primary')}
      >
        {Icone && <Icone size={24} aria-hidden="true" className="shrink-0" />}
        {formatarValor(valor, formato)}
      </p>
      {semValor && semDado ? (
        <p className="text-label text-texto-secondary">{semDado}</p>
      ) : (
        complemento && <p className="text-label text-texto-secondary tabular">{complemento}</p>
      )}
    </>
  );

  const classes = cn(
    'flex h-full flex-col gap-1 rounded-cartao border border-borda-subtle bg-surface-raised p-4',
    estilo && cn('border-l-[3px]', estilo.borda),
  );

  return (
    <div role="group" aria-labelledby={idRotulo} className="h-full">
      {para ? (
        <Link to={para} className={cn(classes, 'hover:bg-surface-sunken')}>
          {conteudo}
        </Link>
      ) : (
        <div className={classes}>{conteudo}</div>
      )}
    </div>
  );
}
