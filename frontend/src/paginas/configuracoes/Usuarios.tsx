import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { marcar, t, td } from '@/i18n';
import { useToasts } from '@/componentes/ui/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { separarErro, type ErroDeFormulario } from '@/lib/errosDeFormulario';
import { formatarData, formatarDataHora } from '@/lib/formato';
import { ErroApi } from '@/servicos/api';
import {
  alterarSituacao,
  atualizarUsuario,
  chaveOpcoesUsuarios,
  chaveUsuarios,
  criarUsuario,
  gerarSenhaTemporaria,
  listarUsuarios,
  obterOpcoesUsuarios,
  redefinirSenha,
} from '@/servicos/usuarios';
import { useAutenticacao } from '@/store/autenticacao';
import type { DadosPaginacao } from '@/tipos/cadastros';
import type { CorpoUsuario, FiltrosUsuarios, SituacaoUsuario, Usuario } from '@/tipos/usuarios';
import { FormularioUsuario } from './FormularioUsuario';
import { PermissoesIndividuais } from './PermissoesIndividuais';

const PAGINACAO_VAZIA: DadosPaginacao = { pagina: 1, limite: 20, total: 0, total_paginas: 0 };

const opcoesSituacao = () => [
  { valor: 'ATIVO', rotulo: t('Ativos') },
  { valor: 'INATIVO', rotulo: t('Inativos') },
  { valor: 'BLOQUEADO', rotulo: t('Bloqueados') },
];

const ROTULO_SITUACAO: Record<SituacaoUsuario, string> = {
  ATIVO: marcar('Ativo'),
  INATIVO: marcar('Inativo'),
  BLOQUEADO: marcar('Bloqueado'),
};

function BadgeSituacaoUsuario({ situacao }: { situacao: SituacaoUsuario }) {
  if (situacao === 'ATIVO') return <Badge tom="done" icone="check-circle-2">{t('Ativo')}</Badge>;
  if (situacao === 'BLOQUEADO') return <Badge tom="blocked" icone="lock">{t('Bloqueado')}</Badge>;
  return <Badge tom="neutral" icone="circle">{t('Inativo')}</Badge>;
}

type Dialogo =
  | { tipo: 'novo' }
  | { tipo: 'editar'; usuario: Usuario }
  | { tipo: 'situacao'; usuario: Usuario }
  | { tipo: 'senha'; usuario: Usuario }
  | { tipo: 'permissoes'; usuario: Usuario };

const SEM_ERRO: ErroDeFormulario = { geral: null, porCampo: {} };

function DialogoSituacao({ usuario, aoFechar }: { usuario: Usuario; aoFechar: () => void }) {
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const queryClient = useQueryClient();
  const [situacao, definirSituacao] = useState<SituacaoUsuario>(usuario.situacao === 'ATIVO' ? 'BLOQUEADO' : 'ATIVO');
  const [desligamento, definirDesligamento] = useState('');

  const salvar = useMutation({
    mutationFn: () => alterarSituacao(usuario.id, situacao, situacao === 'INATIVO' && desligamento ? desligamento : null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveUsuarios });
      mostrarToast(t('{nome}: {situacao}', { nome: usuario.nome, situacao: td(ROTULO_SITUACAO[situacao]).toLowerCase() }));
      aoFechar();
    },
    onError: (erro) => mostrarToast(separarErro(erro).geral ?? t('Não foi possível alterar a situação.'), 'pending'),
  });

  return (
    <form
      aria-label={t('Alterar situação')}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <p className="text-body text-texto-secondary">
        {t('Situação atual:')} <strong className="text-texto-primary">{td(ROTULO_SITUACAO[usuario.situacao])}</strong>.{' '}
        {t('Bloqueio e inativação valem na hora: a pessoa perde o acesso mesmo com a sessão aberta.')}
      </p>
      <Selecao
        rotulo={t('Nova situação')}
        opcoes={[
          { valor: 'ATIVO', rotulo: t('Ativo — pode entrar') },
          { valor: 'BLOQUEADO', rotulo: t('Bloqueado — suspensão temporária') },
          { valor: 'INATIVO', rotulo: t('Inativo — desligado da empresa') },
        ]}
        value={situacao}
        onChange={(e) => definirSituacao(e.target.value as SituacaoUsuario)}
      />
      {situacao === 'INATIVO' && (
        <Campo rotulo={t('Data de desligamento')} type="date" value={desligamento} onChange={(e) => definirDesligamento(e.target.value)} />
      )}
      <div className="flex justify-end gap-2">
        <Botao type="button" variante="secundaria" onClick={aoFechar}>
          {t('Cancelar')}
        </Botao>
        <Botao type="submit" icone="save" disabled={situacao === usuario.situacao} ocupado={salvar.isPending} rotuloOcupado="Salvando…">
          {t('Salvar situação')}
        </Botao>
      </div>
    </form>
  );
}

function DialogoSenha({ usuario, aoFechar }: { usuario: Usuario; aoFechar: () => void }) {
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const queryClient = useQueryClient();
  const [senha, definirSenha] = useState(() => gerarSenhaTemporaria());

  const salvar = useMutation({
    mutationFn: () => redefinirSenha(usuario.id, senha),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveUsuarios });
      mostrarToast(t('Senha temporária de {nome} definida', { nome: usuario.nome }));
      aoFechar();
    },
    onError: (erro) => mostrarToast(separarErro(erro).geral ?? t('Não foi possível redefinir a senha.'), 'pending'),
  });

  return (
    <form
      aria-label={t('Redefinir senha')}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <p className="text-body text-texto-secondary">
        {t('Entregue a senha temporária a {nome}. No próximo acesso o sistema pede uma senha nova antes de qualquer outra coisa. A senha atual deixa de valer agora.', { nome: usuario.nome })}
      </p>
      <Campo
        rotulo={t('Senha temporária')}
        tipoDado="codigo"
        autoComplete="off"
        value={senha}
        erro={senha.length < 10 ? t('Ao menos 10 caracteres') : undefined}
        onChange={(e) => definirSenha(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Botao type="button" variante="secundaria" onClick={aoFechar}>
          {t('Cancelar')}
        </Botao>
        <Botao type="submit" icone="key-round" disabled={senha.length < 8} ocupado={salvar.isPending} rotuloOcupado="Salvando…">
          {t('Redefinir senha')}
        </Botao>
      </div>
    </form>
  );
}

export function Usuarios() {
  const eu = useAutenticacao((estado) => estado.usuario?.id);
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const queryClient = useQueryClient();
  const [busca, definirBusca] = useState('');
  const buscaAdiada = useDebounce(busca);
  const [filtros, definirFiltros] = useState<FiltrosUsuarios>({
    pagina: 1, busca: '', perfil: '', situacao: 'ATIVO', ordenar_por: 'nome', ordem: 'asc',
  });
  const [dialogo, definirDialogo] = useState<Dialogo | null>(null);
  const [erroFormulario, definirErroFormulario] = useState<ErroDeFormulario>(SEM_ERRO);

  useEffect(() => {
    definirFiltros((f) => (f.busca === buscaAdiada ? f : { ...f, busca: buscaAdiada, pagina: 1 }));
  }, [buscaAdiada]);

  const opcoes = useQuery({ queryKey: chaveOpcoesUsuarios, queryFn: obterOpcoesUsuarios, staleTime: 60_000 });
  const lista = useQuery({
    queryKey: [...chaveUsuarios, filtros],
    queryFn: () => listarUsuarios(filtros),
    placeholderData: keepPreviousData,
  });

  const perfis = useMemo(() => opcoes.data?.perfis ?? [], [opcoes.data]);
  const nomeDoPerfil = (codigo: string) => td(perfis.find((p) => p.codigo === codigo)?.nome ?? codigo);
  const opcoesPerfil = perfis.map((p) => ({ valor: p.codigo, rotulo: td(p.nome) }));

  function fechar() {
    definirDialogo(null);
    definirErroFormulario(SEM_ERRO);
  }

  const salvar = useMutation({
    mutationFn: (corpo: CorpoUsuario) =>
      dialogo?.tipo === 'editar' ? atualizarUsuario(dialogo.usuario.id, corpo) : criarUsuario(corpo),
    onSuccess: (u) => {
      void queryClient.invalidateQueries({ queryKey: chaveUsuarios });
      mostrarToast(dialogo?.tipo === 'editar' ? t('Usuário {nome} atualizado', { nome: u.nome }) : t('Usuário {nome} cadastrado', { nome: u.nome }));
      fechar();
    },
    onError: (erro) => definirErroFormulario(separarErro(erro)),
  });

  function alternarOrdenacao(chave: string) {
    definirFiltros((f) => ({
      ...f,
      pagina: 1,
      ordenar_por: chave,
      ordem: f.ordenar_por === chave && f.ordem === 'asc' ? 'desc' : 'asc',
    }));
  }

  const colunas: Coluna<Usuario>[] = [
    {
      chave: 'nome',
      rotulo: t('Nome'),
      ordenavel: true,
      renderizar: (u) => (
        <span className="flex flex-col">
          <span>
            {u.nome}
            {u.id === eu && <span className="text-label text-texto-secondary"> {t('(você)')}</span>}
          </span>
          <span className="font-mono text-label text-texto-secondary">{u.username}</span>
        </span>
      ),
    },
    { chave: 'perfil', rotulo: t('Perfil'), ordenavel: true, renderizar: (u) => nomeDoPerfil(u.perfil) },
    {
      chave: 'setor',
      rotulo: t('Setor / matrícula'),
      renderizar: (u) => (
        <span className="flex flex-col">
          <span>{u.setor || '—'}</span>
          {u.matricula && <span className="font-mono text-label text-texto-secondary">{u.matricula}</span>}
        </span>
      ),
    },
    {
      chave: 'situacao',
      rotulo: t('Situação'),
      ordenavel: true,
      renderizar: (u) => (
        <span className="flex flex-col items-start gap-1">
          <BadgeSituacaoUsuario situacao={u.situacao} />
          {u.deve_trocar_senha && u.situacao === 'ATIVO' && (
            <Badge tom="warning" icone="key-round">{t('Senha temporária')}</Badge>
          )}
          {u.data_desligamento && (
            <span className="text-label text-texto-secondary">{t('Desligado em {data}', { data: formatarData(u.data_desligamento) })}</span>
          )}
        </span>
      ),
    },
    {
      chave: 'ultimo_login',
      rotulo: t('Último acesso'),
      ordenavel: true,
      renderizar: (u) => (u.ultimo_login ? formatarDataHora(u.ultimo_login) : t('Nunca entrou')),
    },
  ];

  const erroLista = lista.error
    ? lista.error instanceof ErroApi
      ? lista.error.message
      : t('Não foi possível carregar os usuários. Tente de novo.')
    : null;
  const paginacao = lista.data?.paginacao ?? PAGINACAO_VAZIA;

  const tituloDialogo: Record<Dialogo['tipo'], string> = {
    novo: t('Novo usuário'),
    editar: t('Editar usuário'),
    situacao: t('Situação do usuário'),
    senha: t('Redefinir senha'),
    permissoes: t('Permissões individuais'),
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Usuários')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Quem acessa o sistema, com qual perfil, e as exceções de cada um. Mudanças valem na hora.')}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-[320px] max-w-full">
            <Campo
              rotulo={t('Buscar por nome, login, e-mail, matrícula ou setor')}
              value={busca}
              placeholder={t('Digite para filtrar')}
              onChange={(e) => definirBusca(e.target.value)}
            />
          </div>
          <div className="w-[200px]">
            <Selecao
              rotulo={t('Perfil')}
              placeholder={t('Todos')}
              opcoes={opcoesPerfil}
              value={filtros.perfil}
              onChange={(e) => definirFiltros((f) => ({ ...f, perfil: e.target.value, pagina: 1 }))}
            />
          </div>
          <div className="w-[160px]">
            <Selecao
              rotulo={t('Situação')}
              placeholder={t('Todas')}
              opcoes={opcoesSituacao()}
              value={filtros.situacao}
              onChange={(e) => definirFiltros((f) => ({ ...f, situacao: e.target.value as SituacaoUsuario | '', pagina: 1 }))}
            />
          </div>
        </div>
        <Botao icone="plus" disabled={!opcoes.data} onClick={() => definirDialogo({ tipo: 'novo' })}>
          {t('Novo usuário')}
        </Botao>
      </div>

      <div>
        <Tabela<Usuario>
          rotulo={t('Usuários')}
          colunas={colunas}
          itens={lista.data?.itens ?? []}
          chaveDe={(u) => u.id}
          ordenarPor={filtros.ordenar_por}
          ordem={filtros.ordem}
          aoOrdenar={alternarOrdenacao}
          carregando={lista.isPending}
          erro={erroLista}
          aoTentarDeNovo={() => void lista.refetch()}
          vazio={t('Nenhum usuário com estes filtros.')}
          acoes={(u) =>
            u.id === eu ? (
              <span className="text-label text-texto-secondary">{t('Peça a outro administrador')}</span>
            ) : (
              <span className="flex flex-wrap items-center justify-end gap-1">
                <Botao variante="fantasma" icone="pencil" aria-label={t('Editar {nome}', { nome: u.nome })} onClick={() => definirDialogo({ tipo: 'editar', usuario: u })}>
                  {t('Editar')}
                </Botao>
                <Botao variante="fantasma" icone="lock" aria-label={t('Situação de {nome}', { nome: u.nome })} onClick={() => definirDialogo({ tipo: 'situacao', usuario: u })}>
                  {t('Situação')}
                </Botao>
                <Botao variante="fantasma" icone="key-round" aria-label={t('Redefinir senha de {nome}', { nome: u.nome })} onClick={() => definirDialogo({ tipo: 'senha', usuario: u })}>
                  {t('Senha')}
                </Botao>
                <Botao variante="fantasma" icone="shield-check" aria-label={t('Permissões de {nome}', { nome: u.nome })} disabled={!opcoes.data} onClick={() => definirDialogo({ tipo: 'permissoes', usuario: u })}>
                  {t('Permissões')}
                </Botao>
              </span>
            )
          }
        />
        <Paginacao
          pagina={paginacao.pagina}
          totalPaginas={paginacao.total_paginas}
          total={paginacao.total}
          aoMudar={(pagina) => definirFiltros((f) => ({ ...f, pagina }))}
        />
      </div>

      <Modal
        aberto={dialogo !== null}
        aoFechar={fechar}
        titulo={dialogo ? tituloDialogo[dialogo.tipo] : ''}
        descricao={dialogo && 'usuario' in dialogo ? `${dialogo.usuario.nome} · ${dialogo.usuario.username}` : t('Campos com * são obrigatórios.')}
      >
        {(dialogo?.tipo === 'novo' || dialogo?.tipo === 'editar') && (
          <FormularioUsuario
            key={dialogo.tipo === 'editar' ? dialogo.usuario.id : 'novo'}
            inicial={dialogo.tipo === 'editar' ? dialogo.usuario : undefined}
            perfis={opcoesPerfil}
            ocupado={salvar.isPending}
            erroGeral={erroFormulario.geral}
            errosPorCampo={erroFormulario.porCampo}
            aoEnviar={(corpo) => salvar.mutate(corpo)}
            aoCancelar={fechar}
          />
        )}
        {dialogo?.tipo === 'situacao' && <DialogoSituacao usuario={dialogo.usuario} aoFechar={fechar} />}
        {dialogo?.tipo === 'senha' && <DialogoSenha usuario={dialogo.usuario} aoFechar={fechar} />}
        {dialogo?.tipo === 'permissoes' && opcoes.data && (
          <PermissoesIndividuais
            usuario={dialogo.usuario}
            perfil={perfis.find((p) => p.codigo === dialogo.usuario.perfil)}
            catalogo={opcoes.data.permissoes}
            aoFechar={fechar}
          />
        )}
      </Modal>
    </div>
  );
}
