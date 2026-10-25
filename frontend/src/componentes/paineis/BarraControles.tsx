import { Botao } from '@/componentes/ui/Botao';
import { Selecao } from '@/componentes/ui/Selecao';
import {
  INTERVALOS_ATUALIZACAO,
  ROTULO_ATUALIZACAO,
  ROTULO_PERIODO,
  type ControlesPainel,
  type IntervaloAtualizacao,
} from '@/hooks/useControlesPainel';
import type { TelaModoTV } from '@/hooks/useTelaModoTV';
import { formatarHorario } from '@/lib/paineis';
import { PERIODOS_PAINEL, type PeriodoPainel } from '@/tipos/paineis';

const OPCOES_PERIODO = PERIODOS_PAINEL.map((d) => ({ valor: String(d), rotulo: ROTULO_PERIODO[d] }));
const OPCOES_ATUALIZACAO = INTERVALOS_ATUALIZACAO.map((s) => ({ valor: String(s), rotulo: ROTULO_ATUALIZACAO[s] }));

export interface BarraControlesProps {
  controles: ControlesPainel;
  modoTV: TelaModoTV;
  /** Instante (ms) da ultima resposta do servidor; 0 = ainda nao chegou. */
  atualizadoEm: number;
  atualizando: boolean;
  aoAtualizar: () => void;
}

function Atualizado({ atualizadoEm }: { atualizadoEm: number }) {
  return (
    <p data-atualizado-em className="text-label text-texto-secondary tabular">
      {atualizadoEm > 0 ? `Atualizado às ${formatarHorario(atualizadoEm)}` : 'Aguardando a primeira atualização'}
    </p>
  );
}

/**
 * Cabecalho de controles de cada painel: periodo, atualizacao automatica,
 * horario da ultima atualizacao, "Atualizar agora" e Modo TV. No modo TV,
 * os seletores viram texto (ninguem opera a TV) e fica o botao de sair.
 */
export function BarraControles({ controles, modoTV, atualizadoEm, atualizando, aoAtualizar }: BarraControlesProps) {
  const { dias, atualizar, tv, definirDias, definirAtualizar } = controles;

  if (tv) {
    return (
      <div role="toolbar" aria-label="Controles do painel" className="flex flex-wrap items-center justify-end gap-4">
        <p className="text-label text-texto-secondary">
          {ROTULO_PERIODO[dias]} · atualização {atualizar === 0 ? 'desligada' : `a cada ${ROTULO_ATUALIZACAO[atualizar]}`}
        </p>
        <Atualizado atualizadoEm={atualizadoEm} />
        {!modoTV.telaCheia && modoTV.telaCheiaDisponivel && (
          <Botao variante="secundaria" icone="maximize" onClick={modoTV.pedirTelaCheia}>
            Tela cheia
          </Botao>
        )}
        <Botao variante="secundaria" icone="minimize-2" onClick={modoTV.sair}>
          Sair do modo TV
        </Botao>
      </div>
    );
  }

  return (
    <>
    {/* No papel/PDF: os seletores somem e o periodo vira texto. */}
    <p className="hidden text-label text-texto-secondary print:block">
      {ROTULO_PERIODO[dias]}
      {atualizadoEm > 0 && ` · dados de ${formatarHorario(atualizadoEm)}`}
    </p>
    <div role="toolbar" aria-label="Controles do painel" className="flex flex-wrap items-end gap-4 print:hidden">
      <div className="w-[12rem]">
        <Selecao
          rotulo="Período"
          value={String(dias)}
          opcoes={OPCOES_PERIODO}
          onChange={(e) => definirDias(Number(e.target.value) as PeriodoPainel)}
        />
      </div>
      <div className="w-[12rem]">
        <Selecao
          rotulo="Atualização automática"
          value={String(atualizar)}
          opcoes={OPCOES_ATUALIZACAO}
          onChange={(e) => definirAtualizar(Number(e.target.value) as IntervaloAtualizacao)}
        />
      </div>
      <div className="flex min-h-[2.5rem] items-center">
        <Atualizado atualizadoEm={atualizadoEm} />
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <Botao variante="secundaria" icone="refresh-cw" ocupado={atualizando} rotuloOcupado="Atualizando…" onClick={aoAtualizar}>
          Atualizar agora
        </Botao>
        <Botao variante="secundaria" icone="monitor" onClick={modoTV.entrar}>
          Modo TV
        </Botao>
      </div>
    </div>
    </>
  );
}

/** Painel inicial: so o horario e "Atualizar agora" (atualiza sozinho a cada minuto). */
export function BarraAtualizacao({
  atualizadoEm,
  atualizando,
  aoAtualizar,
}: Pick<BarraControlesProps, 'atualizadoEm' | 'atualizando' | 'aoAtualizar'>) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Atualizado atualizadoEm={atualizadoEm} />
      <Botao variante="secundaria" icone="refresh-cw" ocupado={atualizando} rotuloOcupado="Atualizando…" onClick={aoAtualizar}>
        Atualizar agora
      </Botao>
    </div>
  );
}
