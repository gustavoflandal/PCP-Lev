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
import { t } from '@/i18n';

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
    criado: t('Fornecedor cadastrado'),
    atualizado: t('Fornecedor atualizado'),
    inativado: t('Fornecedor inativado'),
  });

  const colunas: Coluna<Fornecedor>[] = [
    {
      chave: 'razao_social',
      rotulo: t('Razão social'),
      ordenavel: true,
      renderizar: (f) => f.razao_social,
    },
    {
      chave: 'cnpj',
      rotulo: t('CNPJ'),
      ordenavel: true,
      renderizar: (f) => <span className="font-mono">{formatarCNPJ(f.cnpj)}</span>,
    },
    {
      chave: 'contato',
      rotulo: t('Contato'),
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
      rotulo: t('Lead time'),
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (f) => formatarDias(f.lead_time_medio),
    },
    { chave: 'ativo', rotulo: t('Situação'), renderizar: (f) => <BadgeSituacao ativo={f.ativo} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Fornecedores')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Quem abastece as partes e peças usadas na produção.')}
        </p>
      </div>

      <BarraDeFiltros
        busca={lista.busca}
        aoBuscar={lista.definirBusca}
        rotuloBusca={t('Buscar por razão social, CNPJ ou contato')}
        filtroAtivo={lista.filtroAtivo}
        aoFiltrarSituacao={lista.definirFiltroAtivo}
      >
        {podeIncluir && (
          <Botao icone="plus" onClick={crud.abrirNovo}>
            {t('Novo fornecedor')}
          </Botao>
        )}
      </BarraDeFiltros>

      <div>
        <Tabela<Fornecedor>
          rotulo={t('Fornecedores')}
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(f) => f.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio={t('Nenhum fornecedor cadastrado. Cadastre o primeiro para começar.')}
          acoes={(f) => (
            <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
              <Botao
                variante="fantasma"
                icone="paperclip"
                aria-label={t('Documentos de {razao_social}', { razao_social: f.razao_social })}
                onClick={() => documentos.abrir({ id: f.id, nome: f.razao_social })}
              >
                {t('Documentos')}
              </Botao>
              {podeVerDePara && (
                <Botao
                  variante="fantasma"
                  icone="link"
                  aria-label={t('Itens do fornecedor (de-para) de {razao_social}', { razao_social: f.razao_social })}
                  onClick={() => definirDeParaDe(f)}
                >
                  {t('De-para')}
                </Botao>
              )}
              {podeEditar && (
                <Botao
                  variante="fantasma"
                  icone="pencil"
                  aria-label={t('Editar {razao_social}', { razao_social: f.razao_social })}
                  onClick={() => crud.abrirEdicao(f)}
                >
                  {t('Editar')}
                </Botao>
              )}
              {podeInativar && f.ativo && (
                <Botao
                  variante="fantasma"
                  icone="trash-2"
                  aria-label={t('Inativar {razao_social}', { razao_social: f.razao_social })}
                  onClick={() => crud.pedirInativacao(f)}
                >
                  {t('Inativar')}
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
        titulo={crud.emEdicao ? t('Editar fornecedor') : t('Novo fornecedor')}
        descricao={t('Campos com * são obrigatórios.')}
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
        titulo={t('Inativar fornecedor')}
        mensagem={
          crud.aInativar
            ? t('Inativar o fornecedor {razao_social}? Ele deixa de aparecer nas listas de seleção. O histórico é preservado.', { razao_social: crud.aInativar.razao_social })
            : ''
        }
        rotuloConfirmar={t('Inativar')}
        rotuloOcupado={t('Inativando…')}
        ocupado={crud.inativando}
        aoConfirmar={crud.confirmarInativacao}
        aoCancelar={crud.cancelarInativacao}
      />
    </div>
  );
}
