import { useMutation } from '@tanstack/react-query';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { separarErro } from '@/lib/errosDeFormulario';
import { atualizarPreferencias } from '@/servicos/autenticacaoServico';
import { usePreferencias, type Preferencias } from '@/store/preferencias';

const OPCOES_TEMA = [
  { valor: 'automatico', rotulo: 'Automático (segue o sistema)' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

const OPCOES_DENSIDADE = [
  { valor: 'confortavel', rotulo: 'Confortável (linhas maiores, melhor para tablet)' },
  { valor: 'compacta', rotulo: 'Compacta (mais linhas visíveis)' },
];

const OPCOES_FONTE = [
  { valor: 'padrao', rotulo: 'Padrão' },
  { valor: 'grande', rotulo: 'Grande' },
  { valor: 'extra-grande', rotulo: 'Extra grande' },
];

export function PreferenciasPagina() {
  const { preferencias, aplicar } = usePreferencias();
  const mostrarToast = useToasts((estado) => estado.mostrar);

  const mutacao = useMutation({
    mutationFn: atualizarPreferencias,
    // Reconcilia com o que o servidor de fato gravou, nao so confia na
    // aplicacao otimista -- fecha a janela de duas mudancas em voo ao mesmo
    // tempo (a segunda poderia terminar antes da primeira, e um "onError"
    // da primeira reverteria por cima do que a segunda ja tinha confirmado).
    onSuccess: (usuarioAtualizado) => {
      aplicar({
        tema: usuarioAtualizado.tema,
        alto_contraste: usuarioAtualizado.alto_contraste,
        densidade: usuarioAtualizado.densidade,
        tamanho_fonte: usuarioAtualizado.tamanho_fonte,
      });
      mostrarToast('Preferências salvas');
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
        mostrarToast(separarErro(erro).geral ?? 'Não foi possível salvar as preferências.', 'pending');
      },
    });
  }

  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Preferências</h1>
        <p className="text-body text-texto-secondary">
          Aparência da interface, salva para a sua conta — vale em qualquer computador que você usar.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
        <Selecao
          rotulo="Tema"
          opcoes={OPCOES_TEMA}
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
          Alto contraste
        </label>
        <p className="text-label text-texto-secondary">
          Variante de alta legibilidade para uso sob luz intensa no chão de fábrica.
        </p>

        <Selecao
          rotulo="Densidade"
          opcoes={OPCOES_DENSIDADE}
          value={preferencias.densidade}
          onChange={(evento) => mudar('densidade', evento.target.value)}
        />

        <Selecao
          rotulo="Tamanho de fonte"
          opcoes={OPCOES_FONTE}
          value={preferencias.tamanho_fonte}
          onChange={(evento) => mudar('tamanho_fonte', evento.target.value)}
        />
      </div>
    </div>
  );
}
