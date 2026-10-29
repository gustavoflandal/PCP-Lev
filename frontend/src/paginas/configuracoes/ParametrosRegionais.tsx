import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Botao } from '@/componentes/ui/Botao';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { t } from '@/i18n';
import { useConfiguracaoRegionalServidor } from '@/hooks/useConfiguracaoRegionalServidor';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarDataComFormato, formatarHoraComFormato } from '@/lib/formato';
import { atualizarConfiguracaoRegional, chaveConfiguracaoRegional } from '@/servicos/regional';
import { useConfiguracaoRegional } from '@/store/configuracaoRegional';
import type { ConfiguracaoRegional, FormatoData, FormatoHora } from '@/tipos/regional';
import { PERMISSOES, usePode } from '@/lib/permissoes';

const opcoesFormatoData = (): { valor: FormatoData; rotulo: string }[] => [
  { valor: 'DD/MM/AAAA', rotulo: t('DD/MM/AAAA (31/08/2026)') },
  { valor: 'DD-MM-AAAA', rotulo: t('DD-MM-AAAA (31-08-2026)') },
  { valor: 'AAAA-MM-DD', rotulo: t('AAAA-MM-DD (2026-08-31)') },
];

const opcoesFormatoHora = (): { valor: FormatoHora; rotulo: string }[] => [
  { valor: '24H', rotulo: t('24 horas (14:30)') },
  { valor: '12H', rotulo: t('12 horas (02:30 PM)') },
];

// Data/hora de exemplo fixas para a pré-visualização -- não dependem do
// relógio do navegador, para o texto de exemplo ser sempre o mesmo.
const EXEMPLO_DATA = '2026-08-31';
const EXEMPLO_HORA = 14;
const EXEMPLO_MINUTO = 30;

function Aviso({ children }: { children: string }) {
  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-4">
      <p
        role="alert"
        className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
      >
        {children}
      </p>
    </div>
  );
}

export function ParametrosRegionais() {
  const autorizado = usePode(PERMISSOES.configRegional);
  const consulta = useConfiguracaoRegionalServidor(autorizado);

  if (!autorizado) {
    return <Aviso>{t('Acesso restrito: seu perfil não tem permissão para esta tela.')}</Aviso>;
  }

  if (consulta.isPending) {
    return <p className="text-body text-texto-secondary">{t('Carregando parâmetros regionais…')}</p>;
  }

  if (consulta.isError) {
    // O PUT grava os dois campos de uma vez -- mostrar o formulario com os
    // defaults depois de uma falha de carga deixaria "Salvar" sobrescrever a
    // configuracao real (mesmo cuidado de DadosEmpresa).
    return <Aviso>{t('Não foi possível carregar os parâmetros regionais. Recarregue a página para tentar de novo.')}</Aviso>;
  }

  return <FormularioRegional atual={consulta.data} />;
}

/** Montado so com a configuracao ja carregada: o estado nasce do valor real,
 * e um refetch posterior nao apaga uma escolha ainda nao salva. */
function FormularioRegional({ atual }: { atual: ConfiguracaoRegional }) {
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const queryClient = useQueryClient();

  const [formatoData, definirFormatoData] = useState<FormatoData>(atual.formato_data);
  const [formatoHora, definirFormatoHora] = useState<FormatoHora>(atual.formato_hora);

  const mutacao = useMutation({
    mutationFn: atualizarConfiguracaoRegional,
    onSuccess: (atualizada) => {
      queryClient.setQueryData(chaveConfiguracaoRegional, atualizada);
      useConfiguracaoRegional.getState().aplicar({
        formato_data: atualizada.formato_data,
        formato_hora: atualizada.formato_hora,
      });
      mostrarToast(t('Parâmetros regionais salvos'));
    },
    onError: (erro) => {
      mostrarToast(separarErro(erro).geral ?? t('Não foi possível salvar os parâmetros regionais.'), 'pending');
    },
  });

  const preview = `${formatarDataComFormato(EXEMPLO_DATA, formatoData)} ${formatarHoraComFormato(EXEMPLO_HORA, EXEMPLO_MINUTO, formatoHora)}`;

  return (
    <form
      className="mx-auto flex max-w-[600px] flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        mutacao.mutate({ formato_data: formatoData, formato_hora: formatoHora });
      }}
    >
      <div>
        <h1 className="text-title text-texto-primary">{t('Parâmetros regionais')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Formato de data e hora usados em todo o sistema — a mudança vale para todos os usuários.')}
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
        <Selecao
          rotulo={t('Formato de data')}
          opcoes={opcoesFormatoData()}
          value={formatoData}
          onChange={(evento) => definirFormatoData(evento.target.value as FormatoData)}
        />

        <Selecao
          rotulo={t('Formato de hora')}
          opcoes={opcoesFormatoHora()}
          value={formatoHora}
          onChange={(evento) => definirFormatoHora(evento.target.value as FormatoHora)}
        />

        <p className="text-label text-texto-secondary" aria-live="polite">
          {t('Assim: {exemplo}', { exemplo: preview })}
        </p>

        <Botao type="submit" ocupado={mutacao.isPending} rotuloOcupado={t('Salvando…')}>
          {t('Salvar')}
        </Botao>
      </div>
    </form>
  );
}
