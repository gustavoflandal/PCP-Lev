import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { cn } from '@/lib/cn';
import { separarErro } from '@/lib/errosDeFormulario';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import {
  atualizarPerfil,
  chaveCatalogo,
  chavePerfis,
  criarPerfil,
  excluirPerfil,
  listarCatalogo,
  listarPerfis,
} from '@/servicos/acesso';
import { agruparPorModulo, ROTULO_MODULO, ROTULO_PERMISSAO } from '@/lib/rotulosPermissoes';
import type { PerfilAcesso, PermissaoCatalogo } from '@/tipos/acesso';

const CLASSE_AVISO =
  'rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending';

function mesmoConjunto(a: Set<string>, b: string[]): boolean {
  return a.size === b.length && b.every((p) => a.has(p));
}

function MatrizDoPerfil({
  perfil,
  catalogo,
  aoMudarSujo,
}: {
  perfil: PerfilAcesso;
  catalogo: PermissaoCatalogo[];
  aoMudarSujo: (sujo: boolean) => void;
}) {
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const queryClient = useQueryClient();
  const somenteLeitura = perfil.codigo === 'ADMIN';
  const [marcadas, definirMarcadas] = useState(() => new Set(perfil.permissoes));
  const [nome, definirNome] = useState(perfil.nome);
  const [descricao, definirDescricao] = useState(perfil.descricao);
  const [confirmandoExclusao, definirConfirmandoExclusao] = useState(false);

  const sujo = !mesmoConjunto(marcadas, perfil.permissoes) || nome !== perfil.nome || descricao !== perfil.descricao;
  useEffect(() => aoMudarSujo(sujo), [sujo, aoMudarSujo]);

  const salvar = useMutation({
    mutationFn: () =>
      atualizarPerfil(perfil.codigo, {
        nome,
        descricao,
        // Na ordem do catalogo, para a trilha de auditoria ficar legivel.
        permissoes: catalogo.map((p) => p.codigo).filter((c) => marcadas.has(c)),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chavePerfis });
      // A sessao de quem esta editando pode depender deste perfil.
      void queryClient.invalidateQueries({ queryKey: ['auth', 'eu'] });
      mostrarToast(`Perfil ${nome} salvo`);
    },
    onError: (erro) => mostrarToast(separarErro(erro).geral ?? 'Não foi possível salvar o perfil.', 'pending'),
  });

  const excluir = useMutation({
    mutationFn: () => excluirPerfil(perfil.codigo),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chavePerfis });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'eu'] });
      mostrarToast(`Perfil ${perfil.nome} excluído`);
    },
    onError: (erro) => mostrarToast(separarErro(erro).geral ?? 'Não foi possível excluir o perfil.', 'pending'),
    onSettled: () => definirConfirmandoExclusao(false),
  });

  function alternar(codigo: string) {
    definirMarcadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(codigo)) nova.delete(codigo);
      else nova.add(codigo);
      return nova;
    });
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    salvar.mutate();
  }

  return (
    <form aria-label={`Permissões do perfil ${perfil.nome}`} className="flex flex-col gap-4" onSubmit={aoEnviar}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-subtitle text-texto-primary">{perfil.nome}</h2>
          <p className="font-mono text-label text-texto-secondary">{perfil.codigo}</p>
        </div>
        {!somenteLeitura && (
          <div className="flex gap-2">
            {!perfil.sistema && (
              <Botao
                type="button"
                variante="fantasma"
                icone="trash-2"
                disabled={perfil.usuarios > 0}
                aria-describedby={perfil.usuarios > 0 ? 'motivo-sem-excluir' : undefined}
                onClick={() => definirConfirmandoExclusao(true)}
              >
                Excluir perfil
              </Botao>
            )}
            <Botao type="submit" icone="save" disabled={!sujo} ocupado={salvar.isPending} rotuloOcupado="Salvando…">
              Salvar
            </Botao>
          </div>
        )}
      </div>

      {!perfil.sistema && perfil.usuarios > 0 && (
        <p id="motivo-sem-excluir" className="text-label text-texto-secondary">
          Para excluir este perfil, mude antes o perfil dos usuários que o usam.
        </p>
      )}

      {somenteLeitura ? (
        <p className="rounded-campo border border-borda-subtle bg-surface-sunken px-3 py-2 text-body text-texto-secondary">
          O Administrador tem todas as permissões, sempre — inclusive as que forem criadas no futuro. Não pode ser
          alterado, para ninguém trancar o sistema para fora.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome do perfil" value={nome} maxLength={80} onChange={(e) => definirNome(e.target.value)} />
          <Campo rotulo="Descrição" value={descricao} maxLength={255} onChange={(e) => definirDescricao(e.target.value)} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {agruparPorModulo(catalogo).map(([modulo, permissoes]) => (
          <fieldset key={modulo} className="flex flex-col gap-2 rounded-cartao border border-borda-subtle bg-surface-raised p-4">
            <legend className="px-1 text-label font-medium text-texto-primary">{ROTULO_MODULO[modulo] ?? modulo}</legend>
            {permissoes.map((p) => (
              <label key={p.codigo} className="flex min-h-linha items-center gap-2 text-body text-texto-primary">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand"
                  checked={somenteLeitura || marcadas.has(p.codigo)}
                  disabled={somenteLeitura}
                  onChange={() => alternar(p.codigo)}
                />
                {ROTULO_PERMISSAO[p.codigo] ?? p.descricao}
                {p.sensivel && (
                  <Badge tom="warning" icone="alert-triangle">
                    Sensível
                  </Badge>
                )}
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      <Confirmacao
        aberto={confirmandoExclusao}
        titulo="Excluir perfil"
        mensagem={`Excluir o perfil ${perfil.nome}? Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Excluir"
        rotuloOcupado="Excluindo…"
        ocupado={excluir.isPending}
        aoConfirmar={() => excluir.mutate()}
        aoCancelar={() => definirConfirmandoExclusao(false)}
      />
    </form>
  );
}

function NovoPerfil({ perfis, aberto, aoFechar, aoCriar }: {
  perfis: PerfilAcesso[];
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: (codigo: string) => void;
}) {
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const queryClient = useQueryClient();
  const [codigo, definirCodigo] = useState('');
  const [nome, definirNome] = useState('');
  const [copiarDe, definirCopiarDe] = useState('');

  function fechar() {
    definirCodigo('');
    definirNome('');
    definirCopiarDe('');
    aoFechar();
  }

  const criar = useMutation({
    mutationFn: () =>
      criarPerfil({
        codigo,
        nome,
        descricao: '',
        permissoes: perfis.find((p) => p.codigo === copiarDe)?.permissoes ?? [],
      }),
    onSuccess: (criado) => {
      void queryClient.invalidateQueries({ queryKey: chavePerfis });
      mostrarToast(`Perfil ${criado.nome} criado`);
      definirCodigo('');
      definirNome('');
      definirCopiarDe('');
      aoCriar(criado.codigo);
    },
    onError: (erro) => mostrarToast(separarErro(erro).geral ?? 'Não foi possível criar o perfil.', 'pending'),
  });

  return (
    <Modal aberto={aberto} aoFechar={fechar} titulo="Novo perfil" descricao="Comece do zero ou copie as permissões de um perfil existente.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          criar.mutate();
        }}
      >
        <Campo
          rotulo="Código"
          ajuda="Letras maiúsculas, números e _ (ex.: COMPRADOR_JUNIOR). Não muda depois."
          value={codigo}
          maxLength={30}
          onChange={(e) => definirCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
        />
        <Campo rotulo="Nome" value={nome} maxLength={80} onChange={(e) => definirNome(e.target.value)} />
        <Selecao
          rotulo="Copiar permissões de"
          placeholder="Nenhum — começar sem permissões"
          opcoes={perfis.map((p) => ({ valor: p.codigo, rotulo: p.nome }))}
          value={copiarDe}
          onChange={(e) => definirCopiarDe(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundaria" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" icone="plus" disabled={!codigo || !nome.trim()} ocupado={criar.isPending} rotuloOcupado="Criando…">
            Criar perfil
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

export function PerfisPermissoes() {
  const autorizado = usePode(PERMISSOES.configPerfis);
  const perfis = useQuery({ queryKey: chavePerfis, queryFn: listarPerfis, enabled: autorizado, staleTime: 0 });
  const catalogo = useQuery({ queryKey: chaveCatalogo, queryFn: listarCatalogo, enabled: autorizado, staleTime: Infinity });
  const [selecionado, definirSelecionado] = useState<string | null>(null);
  const [sujo, definirSujo] = useState(false);
  const [pedidoDeTroca, definirPedidoDeTroca] = useState<string | null>(null);
  const [criando, definirCriando] = useState(false);

  const lista = useMemo(() => perfis.data ?? [], [perfis.data]);
  const atual = lista.find((p) => p.codigo === selecionado) ?? lista[0];

  function selecionar(codigo: string) {
    if (codigo === atual?.codigo) return;
    if (sujo) {
      definirPedidoDeTroca(codigo);
      return;
    }
    definirSelecionado(codigo);
  }

  if (!autorizado) {
    return (
      <div className="mx-auto flex max-w-[600px] flex-col gap-4">
        <p role="alert" className={CLASSE_AVISO}>
          Acesso restrito: seu perfil não tem permissão para esta tela.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-texto-primary">Perfis e permissões</h1>
          <p className="text-body text-texto-secondary">
            O que cada perfil pode fazer no sistema. Mudanças valem na hora para quem usa o perfil.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Botao
            icone="plus"
            onClick={() => definirCriando(true)}
            disabled={!perfis.data || sujo}
            aria-describedby={sujo ? 'aviso-rascunho' : undefined}
          >
            Novo perfil
          </Botao>
          {sujo && (
            <p id="aviso-rascunho" className="text-label text-texto-secondary">
              Salve ou descarte as alterações antes de criar outro perfil.
            </p>
          )}
        </div>
      </div>

      {(perfis.isPending || catalogo.isPending) && <p className="text-body text-texto-secondary">Carregando perfis…</p>}
      {(perfis.isError || catalogo.isError) && (
        <p role="alert" className={CLASSE_AVISO}>
          Não foi possível carregar os perfis. Recarregue a página para tentar de novo.
        </p>
      )}

      {atual && catalogo.data && (
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <ul aria-label="Perfis" className="flex flex-col gap-1">
            {lista.map((p) => (
              <li key={p.codigo}>
                <button
                  type="button"
                  aria-current={p.codigo === atual.codigo ? 'true' : undefined}
                  onClick={() => selecionar(p.codigo)}
                  className={cn(
                    'flex w-full flex-col items-start rounded-campo px-3 py-2 text-left',
                    p.codigo === atual.codigo ? 'bg-brand-subtle text-brand' : 'hover:bg-surface-sunken',
                  )}
                >
                  <span className="text-body font-medium">{p.nome}</span>
                  <span className="text-label text-texto-secondary">
                    {p.usuarios === 1 ? '1 usuário' : `${p.usuarios} usuários`}
                    {p.sistema ? ' · sistema' : ' · personalizado'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {/* key: trocar de perfil remonta a matriz com o estado do novo perfil. */}
          <MatrizDoPerfil
            key={`${atual.codigo}:${atual.permissoes.join(',')}:${atual.nome}`}
            perfil={atual}
            catalogo={catalogo.data}
            aoMudarSujo={definirSujo}
          />
        </div>
      )}

      <NovoPerfil
        perfis={lista}
        aberto={criando}
        aoFechar={() => definirCriando(false)}
        aoCriar={(codigo) => {
          definirCriando(false);
          definirSujo(false);
          definirSelecionado(codigo);
        }}
      />

      <Confirmacao
        aberto={pedidoDeTroca !== null}
        titulo="Descartar alterações?"
        mensagem="As permissões alteradas neste perfil ainda não foram salvas."
        rotuloConfirmar="Descartar"
        rotuloOcupado="…"
        aoConfirmar={() => {
          definirSujo(false);
          definirSelecionado(pedidoDeTroca);
          definirPedidoDeTroca(null);
        }}
        aoCancelar={() => definirPedidoDeTroca(null)}
      />
    </div>
  );
}
