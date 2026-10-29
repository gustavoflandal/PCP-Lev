import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Botao } from '@/componentes/ui/Botao';
import { IDIOMAS, t } from '@/i18n';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { separarErro } from '@/lib/errosDeFormulario';
import { atualizarPreferencias } from '@/servicos/autenticacaoServico';
import { useAutenticacao } from '@/store/autenticacao';
import { usePreferencias, type Preferencias } from '@/store/preferencias';

const opcoesTema = () => [
  { valor: 'automatico', rotulo: t('Automático (segue o sistema)') },
  { valor: 'claro', rotulo: t('Claro') },
  { valor: 'escuro', rotulo: t('Escuro') },
];

const opcoesDensidade = () => [
  { valor: 'confortavel', rotulo: t('Confortável (linhas maiores, melhor para tablet)') },
  { valor: 'compacta', rotulo: t('Compacta (mais linhas visíveis)') },
];

const opcoesFonte = () => [
  { valor: 'padrao', rotulo: t('Padrão') },
  { valor: 'grande', rotulo: t('Grande') },
  { valor: 'extra-grande', rotulo: t('Extra grande') },
];

export function PreferenciasPagina() {
  const { preferencias, aplicar } = usePreferencias();
  const atualizarPreferenciasSessao = useAutenticacao((estado) => estado.atualizarPreferenciasSessao);
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const navegar = useNavigate();

  const mutacao = useMutation({
    mutationFn: atualizarPreferencias,
    // Reconcilia com o que o servidor de fato gravou, nao so confia na
    // aplicacao otimista -- fecha a janela de duas mudancas em voo ao mesmo
    // tempo (a segunda poderia terminar antes da primeira, e um "onError"
    // da primeira reverteria por cima do que a segunda ja tinha confirmado).
    onSuccess: (usuarioAtualizado) => {
      const novas = {
        tema: usuarioAtualizado.tema,
        alto_contraste: usuarioAtualizado.alto_contraste,
        densidade: usuarioAtualizado.densidade,
        tamanho_fonte: usuarioAtualizado.tamanho_fonte,
        idioma: usuarioAtualizado.idioma === 'es' ? ('es' as const) : ('pt-BR' as const),
      };
      aplicar(novas);
      // Sem isto, o usuario da sessao (sessionStorage) fica com a preferencia
      // de login: um F5 re-semearia o <html> com o valor antigo (ver
      // `sessaoInicial` em store/autenticacao.ts) revertendo esta troca.
      atualizarPreferenciasSessao(novas);
      mostrarToast(t('Preferências salvas'));
    },
  });

  // Aplicacao otimista: muda a tela na hora, mas reverte se o backend
  // recusar. `anterior` e capturado antes da troca, nao lido de volta do
  // estado (que ja teria mudado quando o erro chegasse).
  function mudar(campo: keyof Preferencias, valor: string | boolean) {
    const anterior = preferencias;
    const novas = { ...preferencias, [campo]: valor } as Preferencias;
    aplicar(novas);
    mutacao.mutate(novas, {
      onError: (erro) => {
        aplicar(anterior);
        mostrarToast(separarErro(erro).geral ?? t('Não foi possível salvar as preferências.'), 'pending');
      },
    });
  }

  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Preferências')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Aparência da interface e idioma, salvos para a sua conta — valem em qualquer computador que você usar.')}
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
        <Selecao
          rotulo={t('Idioma')}
          opcoes={IDIOMAS.map((i) => ({ valor: i.valor, rotulo: i.rotulo }))}
          value={preferencias.idioma}
          onChange={(evento) => mudar('idioma', evento.target.value)}
        />
        <p className="text-label text-texto-secondary">
          {t('Vale para os textos da tela, a ajuda e as mensagens do sistema.')}
        </p>

        <Selecao
          rotulo={t('Tema')}
          opcoes={opcoesTema()}
          value={preferencias.tema}
          onChange={(evento) => mudar('tema', evento.target.value)}
        />

        <label className="flex items-center gap-2 text-body text-texto-primary">
          <input
            type="checkbox"
            checked={preferencias.alto_contraste}
            onChange={(evento) => mudar('alto_contraste', evento.target.checked)}
            className="h-4 w-4 rounded-none border-borda-strong"
          />
          {t('Alto contraste')}
        </label>
        <p className="text-label text-texto-secondary">
          {t('Variante de alta legibilidade para uso sob luz intensa no chão de fábrica.')}
        </p>

        <Selecao
          rotulo={t('Densidade')}
          opcoes={opcoesDensidade()}
          value={preferencias.densidade}
          onChange={(evento) => mudar('densidade', evento.target.value)}
        />

        <Selecao
          rotulo={t('Tamanho de fonte')}
          opcoes={opcoesFonte()}
          value={preferencias.tamanho_fonte}
          onChange={(evento) => mudar('tamanho_fonte', evento.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
        <div>
          <h2 className="text-subtitle text-texto-primary">{t('Senha')}</h2>
          <p className="text-label text-texto-secondary">{t('Troque a sua senha de acesso quando quiser.')}</p>
        </div>
        <Botao variante="secundaria" icone="lock" onClick={() => navegar('/trocar-senha')}>
          {t('Alterar senha')}
        </Botao>
      </div>
    </div>
  );
}
