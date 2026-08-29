import { useState } from 'react';
import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { BadgeSituacao } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useListagem } from '@/hooks/useListagem';
import { useMutacoesCadastro } from '@/hooks/useMutacoesCadastro';
import { formatarCNPJ, formatarDias } from '@/lib/formato';
import { podeGerenciarCadastros } from '@/lib/permissoes';
import { ErroApi } from '@/servicos/api';
import { useAutenticacao } from '@/store/autenticacao';
import type { Fornecedor } from '@/tipos/cadastros';
import { FormularioFornecedor, type CorpoFornecedor } from './FormularioFornecedor';

/** Separa o erro da API em "marca o campo" e "mostra no topo do modal". */
function separarErro(erro: unknown): { geral: string | null; porCampo: Record<string, string> } {
  if (!(erro instanceof ErroApi)) {
    return { geral: erro ? 'Não foi possível salvar. Tente de novo.' : null, porCampo: {} };
  }
  if (erro.detalhes?.length) {
    return {
      geral: null,
      porCampo: Object.fromEntries(erro.detalhes.map((d) => [d.campo, d.mensagem])),
    };
  }
  return { geral: erro.message, porCampo: {} };
}

export function Fornecedores() {
  const perfil = useAutenticacao((estado) => estado.usuario?.perfil);
  const podeGerenciar = podeGerenciarCadastros(perfil);

  const lista = useListagem<Fornecedor>('fornecedores', 'razao_social');
  const mutacoes = useMutacoesCadastro('fornecedores', {
    criado: 'Fornecedor cadastrado',
    atualizado: 'Fornecedor atualizado',
    inativado: 'Fornecedor inativado',
  });

  const [emEdicao, definirEmEdicao] = useState<Fornecedor | null>(null);
  const [formularioAberto, definirFormularioAberto] = useState(false);
  const [aInativar, definirAInativar] = useState<Fornecedor | null>(null);

  const mutacaoAtiva = emEdicao ? mutacoes.atualizar : mutacoes.criar;
  const { geral, porCampo } = separarErro(mutacaoAtiva.error);

  function abrirNovo() {
    mutacoes.criar.reset();
    definirEmEdicao(null);
    definirFormularioAberto(true);
  }

  function abrirEdicao(f: Fornecedor) {
    mutacoes.atualizar.reset();
    definirEmEdicao(f);
    definirFormularioAberto(true);
  }

  function fecharFormulario() {
    definirFormularioAberto(false);
    definirEmEdicao(null);
  }

  function salvar(corpo: CorpoFornecedor) {
    const aoConcluir = { onSuccess: () => fecharFormulario() };
    if (emEdicao) {
      mutacoes.atualizar.mutate({ id: emEdicao.id, corpo }, aoConcluir);
    } else {
      mutacoes.criar.mutate(corpo, aoConcluir);
    }
  }

  const colunas: Coluna<Fornecedor>[] = [
    {
      chave: 'razao_social',
      rotulo: 'Razão social',
      ordenavel: true,
      renderizar: (f) => f.razao_social,
    },
    {
      chave: 'cnpj',
      rotulo: 'CNPJ',
      ordenavel: true,
      renderizar: (f) => <span className="font-mono">{formatarCNPJ(f.cnpj)}</span>,
    },
    {
      chave: 'contato',
      rotulo: 'Contato',
      renderizar: (f) =>
        f.contato_nome || f.contato_email ? (
          <span className="flex flex-col">
            <span>{f.contato_nome || '—'}</span>
            {f.contato_email && (
              <span className="text-label text-texto-secondary">{f.contato_email}</span>
            )}
          </span>
        ) : (
          '—'
        ),
    },
    {
      chave: 'lead_time_medio',
      rotulo: 'Lead time',
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (f) => formatarDias(f.lead_time_medio),
    },
    { chave: 'ativo', rotulo: 'Situação', renderizar: (f) => <BadgeSituacao ativo={f.ativo} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Fornecedores</h1>
        <p className="text-body text-texto-secondary">
          Quem abastece as partes e peças usadas na produção.
        </p>
      </div>

      <BarraDeFiltros
        busca={lista.busca}
        aoBuscar={lista.definirBusca}
        rotuloBusca="Buscar por razão social, CNPJ ou contato"
        filtroAtivo={lista.filtroAtivo}
        aoFiltrarSituacao={lista.definirFiltroAtivo}
      >
        {podeGerenciar && (
          <Botao icone="plus" onClick={abrirNovo}>
            Novo fornecedor
          </Botao>
        )}
      </BarraDeFiltros>

      <div>
        <Tabela<Fornecedor>
          rotulo="Fornecedores"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(f) => f.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhum fornecedor cadastrado. Cadastre o primeiro para começar."
          acoes={
            podeGerenciar
              ? (f) => (
                  <span className="flex items-center justify-end gap-2">
                    <Botao
                      variante="fantasma"
                      icone="pencil"
                      aria-label={`Editar ${f.razao_social}`}
                      onClick={() => abrirEdicao(f)}
                    >
                      Editar
                    </Botao>
                    {f.ativo && (
                      <Botao
                        variante="fantasma"
                        icone="trash-2"
                        aria-label={`Inativar ${f.razao_social}`}
                        onClick={() => definirAInativar(f)}
                      >
                        Inativar
                      </Botao>
                    )}
                  </span>
                )
              : undefined
          }
        />
        <Paginacao
          pagina={lista.paginacao.pagina}
          totalPaginas={lista.paginacao.total_paginas}
          total={lista.paginacao.total}
          aoMudar={lista.definirPagina}
        />
      </div>

      <Modal
        aberto={formularioAberto}
        aoFechar={fecharFormulario}
        titulo={emEdicao ? 'Editar fornecedor' : 'Novo fornecedor'}
        descricao="Campos com * são obrigatórios."
      >
        <FormularioFornecedor
          // A chave remonta o formulario ao trocar de registro: sem isso os
          // defaultValues do react-hook-form ficam presos no primeiro item.
          key={emEdicao?.id ?? 'novo'}
          inicial={emEdicao ?? undefined}
          ocupado={mutacaoAtiva.isPending}
          erroGeral={geral}
          errosPorCampo={porCampo}
          aoEnviar={salvar}
          aoCancelar={fecharFormulario}
        />
      </Modal>

      <Confirmacao
        aberto={aInativar !== null}
        titulo="Inativar fornecedor"
        mensagem={
          aInativar
            ? `Inativar o fornecedor ${aInativar.razao_social}? Ele deixa de aparecer nas listas de seleção. O histórico é preservado.`
            : ''
        }
        rotuloConfirmar="Inativar"
        rotuloOcupado="Inativando…"
        ocupado={mutacoes.inativar.isPending}
        aoConfirmar={() => {
          if (aInativar) {
            mutacoes.inativar.mutate(aInativar.id, { onSuccess: () => definirAInativar(null) });
          }
        }}
        aoCancelar={() => definirAInativar(null)}
      />
    </div>
  );
}
