import { useState } from 'react';
import { ModalDocumentosDoCadastro } from '@/componentes/arquivos/DocumentosDoCadastro';
import { useDocumentosDoCadastro } from '@/componentes/arquivos/linkDocumentos';
import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { BadgeSituacao } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useCadastroCrud } from '@/hooks/useCadastroCrud';
import { useListagem } from '@/hooks/useListagem';
import { formatarCNPJ, formatarDias } from '@/lib/formato';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import type { Fornecedor } from '@/tipos/cadastros';
import { DeParaFornecedor } from './DeParaFornecedor';
import { FormularioFornecedor } from './FormularioFornecedor';

export function Fornecedores() {
  const podeIncluir = usePode(PERMISSOES.fornecedoresIncluir);
  const podeEditar = usePode(PERMISSOES.fornecedoresEditar);
  const podeInativar = usePode(PERMISSOES.fornecedoresInativar);
  // De-para (v1.2): ver com notas_entrada.visualizar, editar com notas_entrada.lancar.
  const podeVerDePara = usePode(PERMISSOES.notasVisualizar);
  const podeEditarDePara = usePode(PERMISSOES.notasLancar);
  const [deParaDe, definirDeParaDe] = useState<Fornecedor | null>(null);
  // Documentos (3.1): ver vem com a propria tela; anexar e remover, com editar.
  const documentos = useDocumentosDoCadastro();

  const lista = useListagem<Fornecedor>('fornecedores', 'razao_social');
  const crud = useCadastroCrud<Fornecedor>('fornecedores', {
    criado: 'Fornecedor cadastrado',
    atualizado: 'Fornecedor atualizado',
    inativado: 'Fornecedor inativado',
  });

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
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
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
        {podeIncluir && (
          <Botao icone="plus" onClick={crud.abrirNovo}>
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
          acoes={(f) => (
            <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
              <Botao
                variante="fantasma"
                icone="paperclip"
                aria-label={`Documentos de ${f.razao_social}`}
                onClick={() => documentos.abrir({ id: f.id, nome: f.razao_social })}
              >
                Documentos
              </Botao>
              {podeVerDePara && (
                <Botao
                  variante="fantasma"
                  icone="link"
                  aria-label={`Itens do fornecedor (de-para) de ${f.razao_social}`}
                  onClick={() => definirDeParaDe(f)}
                >
                  De-para
                </Botao>
              )}
              {podeEditar && (
                <Botao
                  variante="fantasma"
                  icone="pencil"
                  aria-label={`Editar ${f.razao_social}`}
                  onClick={() => crud.abrirEdicao(f)}
                >
                  Editar
                </Botao>
              )}
              {podeInativar && f.ativo && (
                <Botao
                  variante="fantasma"
                  icone="trash-2"
                  aria-label={`Inativar ${f.razao_social}`}
                  onClick={() => crud.pedirInativacao(f)}
                >
                  Inativar
                </Botao>
              )}
            </span>
          )}
        />
        <Paginacao
          pagina={lista.paginacao.pagina}
          totalPaginas={lista.paginacao.total_paginas}
          total={lista.paginacao.total}
          aoMudar={lista.definirPagina}
        />
      </div>

      <Modal
        aberto={crud.formularioAberto}
        aoFechar={crud.fecharFormulario}
        titulo={crud.emEdicao ? 'Editar fornecedor' : 'Novo fornecedor'}
        descricao="Campos com * são obrigatórios."
      >
        <FormularioFornecedor
          // A chave remonta o formulario ao trocar de registro: sem isso os
          // defaultValues do react-hook-form ficam presos no primeiro item.
          key={crud.emEdicao?.id ?? 'novo'}
          inicial={crud.emEdicao ?? undefined}
          ocupado={crud.salvando}
          erroGeral={crud.erroGeral}
          errosPorCampo={crud.errosPorCampo}
          aoEnviar={crud.salvar}
          aoCancelar={crud.fecharFormulario}
        />
      </Modal>

      <ModalDocumentosDoCadastro
        entidade="fornecedor"
        registro={documentos.aberto}
        podeEditar={podeEditar}
        aoFechar={documentos.fechar}
      />

      {deParaDe && <DeParaFornecedor fornecedor={deParaDe} podeEditar={podeEditarDePara} aoFechar={() => definirDeParaDe(null)} />}

      <Confirmacao
        aberto={crud.aInativar !== null}
        titulo="Inativar fornecedor"
        mensagem={
          crud.aInativar
            ? `Inativar o fornecedor ${crud.aInativar.razao_social}? Ele deixa de aparecer nas listas de seleção. O histórico é preservado.`
            : ''
        }
        rotuloConfirmar="Inativar"
        rotuloOcupado="Inativando…"
        ocupado={crud.inativando}
        aoConfirmar={crud.confirmarInativacao}
        aoCancelar={crud.cancelarInativacao}
      />
    </div>
  );
}
