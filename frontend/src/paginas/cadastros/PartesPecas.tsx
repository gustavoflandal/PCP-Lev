import { useState } from 'react';
import { MidiaDoRegistro } from '@/componentes/arquivos/MidiaDoRegistro';
import { IndicadorDeMidia } from '@/componentes/arquivos/IndicadorDeMidia';
import { MosaicoDeMidia } from '@/componentes/arquivos/MosaicoDeMidia';
import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { BadgeSituacao } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useCadastroCrud } from '@/hooks/useCadastroCrud';
import { useListagem } from '@/hooks/useListagem';
import { formatarDias } from '@/lib/formato';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import type { PartePeca } from '@/tipos/cadastros';
import { FormularioPeca } from './FormularioPeca';
import { t } from '@/i18n';

export function PartesPecas() {
  const podeIncluir = usePode(PERMISSOES.pecasIncluir);
  const podeEditar = usePode(PERMISSOES.pecasEditar);
  const podeInativar = usePode(PERMISSOES.pecasInativar);

  const lista = useListagem<PartePeca>('partes-pecas', 'codigo');
  const crud = useCadastroCrud<PartePeca>('partes-pecas', {
    criado: t('Peça cadastrada'),
    atualizado: t('Peça atualizada'),
    inativado: t('Peça inativada'),
  });

  const [emMidia, definirEmMidia] = useState<{ peca: PartePeca; secao: 'fotos' | 'documentos' } | null>(null);
  const [mosaico, definirMosaico] = useState<{ peca: PartePeca; tipo: 'FOTO' | 'DOCUMENTO' } | null>(null);

  const colunas: Coluna<PartePeca>[] = [
    {
      chave: 'foto',
      rotulo: t('Foto'),
      renderizar: (p) => (
        <IndicadorDeMidia tipo="FOTO" quantidade={p.qtd_fotos} codigo={p.codigo} aoAbrir={() => definirMosaico({ peca: p, tipo: 'FOTO' })} />
      ),
    },
    {
      chave: 'documento',
      rotulo: t('Documento'),
      renderizar: (p) => (
        <IndicadorDeMidia
          tipo="DOCUMENTO"
          quantidade={p.qtd_documentos}
          codigo={p.codigo}
          aoAbrir={() => definirMosaico({ peca: p, tipo: 'DOCUMENTO' })}
        />
      ),
    },
    {
      chave: 'codigo',
      rotulo: t('Código'),
      ordenavel: true,
      renderizar: (p) => <span className="font-mono">{p.codigo}</span>,
    },
    {
      chave: 'descricao',
      rotulo: t('Descrição'),
      ordenavel: true,
      renderizar: (p) => p.descricao,
    },
    {
      chave: 'unidade_medida',
      rotulo: t('Unidade'),
      renderizar: (p) => p.unidade_medida,
    },
    {
      chave: 'estoque_minimo',
      rotulo: t('Estoque mín./máx.'),
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (p) => `${p.estoque_minimo} / ${p.estoque_maximo}`,
    },
    {
      chave: 'lead_time_compra',
      rotulo: t('Lead time'),
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (p) => formatarDias(p.lead_time_compra),
    },
    { chave: 'ativo', rotulo: t('Situação'), renderizar: (p) => <BadgeSituacao ativo={p.ativo} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Partes e peças')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Componentes comprados e consumidos na montagem.')}
        </p>
      </div>

      <BarraDeFiltros
        busca={lista.busca}
        aoBuscar={lista.definirBusca}
        rotuloBusca={t('Buscar por código ou descrição')}
        filtroAtivo={lista.filtroAtivo}
        aoFiltrarSituacao={lista.definirFiltroAtivo}
      >
        {podeIncluir && (
          <Botao icone="plus" onClick={crud.abrirNovo}>
            {t('Nova peça')}
          </Botao>
        )}
      </BarraDeFiltros>

      <div>
        <Tabela<PartePeca>
          rotulo={t('Partes e peças')}
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(p) => p.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio={t('Nenhuma parte ou peça cadastrada. Cadastre a primeira para começar.')}
          acoes={(p) => (
            <span className="flex items-center justify-end gap-2">
              {podeEditar && (
                <Botao
                  variante="fantasma"
                  icone="pencil"
                  aria-label={t('Editar {codigo}', { codigo: p.codigo })}
                  onClick={() => crud.abrirEdicao(p)}
                >
                  {t('Editar')}
                </Botao>
              )}
              {podeInativar && p.ativo && (
                <Botao
                  variante="fantasma"
                  icone="trash-2"
                  aria-label={t('Inativar {codigo}', { codigo: p.codigo })}
                  onClick={() => crud.pedirInativacao(p)}
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
        titulo={crud.emEdicao ? t('Editar peça') : t('Nova peça')}
        descricao={t('Campos com * são obrigatórios.')}
      >
        <FormularioPeca
          // A chave remonta o formulario ao trocar de registro: sem isso os
          // defaultValues do react-hook-form ficam presos no primeiro item.
          key={crud.emEdicao?.id ?? 'novo'}
          inicial={crud.emEdicao ?? undefined}
          ocupado={crud.salvando}
          erroGeral={crud.erroGeral}
          errosPorCampo={crud.errosPorCampo}
          aoEnviar={crud.salvar}
          aoCancelar={crud.fecharFormulario}
          aoGerenciarMidia={(secao) => crud.emEdicao && definirEmMidia({ peca: crud.emEdicao, secao })}
        />
      </Modal>

      <Modal
        aberto={mosaico !== null}
        aoFechar={() => definirMosaico(null)}
        titulo={
          mosaico
            ? mosaico.tipo === 'FOTO'
              ? t('Fotos — {codigo}', { codigo: mosaico.peca.codigo })
              : t('Documentos — {codigo}', { codigo: mosaico.peca.codigo })
            : ''
        }
        descricao={mosaico?.peca.descricao}
        largura="larga"
      >
        {mosaico && (
          <MosaicoDeMidia tipo={mosaico.tipo} entidade="parte_peca" entidadeId={mosaico.peca.id} codigo={mosaico.peca.codigo} />
        )}
      </Modal>

      <Modal
        aberto={emMidia !== null}
        aoFechar={() => definirEmMidia(null)}
        titulo={
          emMidia
            ? emMidia.secao === 'fotos'
              ? t('Fotos — {codigo}', { codigo: emMidia.peca.codigo })
              : t('Documentos — {codigo}', { codigo: emMidia.peca.codigo })
            : ''
        }
        descricao={emMidia?.peca.descricao}
        largura="larga"
      >
        {emMidia && (
          <MidiaDoRegistro
            entidade="parte_peca"
            entidadeId={emMidia.peca.id}
            codigo={emMidia.peca.codigo}
            podeEditar={podeEditar}
            itemCritico={emMidia.peca.item_critico}
            secao={emMidia.secao}
          />
        )}
      </Modal>

      <Confirmacao
        aberto={crud.aInativar !== null}
        titulo={t('Inativar peça')}
        mensagem={
          crud.aInativar
            ? t('Inativar a peça {codigo}? Ela deixa de aparecer nas listas de seleção. O histórico é preservado.', { codigo: crud.aInativar.codigo })
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
