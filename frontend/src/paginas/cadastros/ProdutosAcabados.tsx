import { useState } from 'react';
import { MidiaDoRegistro } from '@/componentes/arquivos/MidiaDoRegistro';
import { Miniatura } from '@/componentes/arquivos/Miniatura';
import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { BadgeSituacao } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useCadastroCrud } from '@/hooks/useCadastroCrud';
import { useListagem } from '@/hooks/useListagem';
import { formatarDias, formatarMoeda } from '@/lib/formato';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import type { ProdutoAcabado } from '@/tipos/cadastros';
import { FormularioProduto } from './FormularioProduto';
import { t } from '@/i18n';

export function ProdutosAcabados() {
  const podeIncluir = usePode(PERMISSOES.produtosIncluir);
  const podeEditar = usePode(PERMISSOES.produtosEditar);
  const podeInativar = usePode(PERMISSOES.produtosInativar);

  const lista = useListagem<ProdutoAcabado>('produtos-acabados', 'codigo');
  const crud = useCadastroCrud<ProdutoAcabado>('produtos-acabados', {
    criado: t('Produto cadastrado'),
    atualizado: t('Produto atualizado'),
    inativado: t('Produto inativado'),
  });

  const [emMidia, definirEmMidia] = useState<ProdutoAcabado | null>(null);

  const colunas: Coluna<ProdutoAcabado>[] = [
    {
      chave: 'foto',
      rotulo: t('Foto'),
      renderizar: (p) => <Miniatura url={p.foto_url} alt={t('Foto do produto {codigo}', { codigo: p.codigo })} critico={p.item_critico} />,
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
      chave: 'preco_venda',
      rotulo: t('Preço de venda'),
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (p) => formatarMoeda(p.preco_venda),
    },
    {
      chave: 'lead_time_producao',
      rotulo: t('Lead time'),
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (p) => formatarDias(p.lead_time_producao),
    },
    { chave: 'ativo', rotulo: t('Situação'), renderizar: (p) => <BadgeSituacao ativo={p.ativo} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Produtos acabados')}</h1>
        <p className="text-body text-texto-secondary">{t('O que é vendido ao cliente.')}</p>
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
            {t('Novo produto')}
          </Botao>
        )}
      </BarraDeFiltros>

      <div>
        <Tabela<ProdutoAcabado>
          rotulo={t('Produtos acabados')}
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(p) => p.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio={t('Nenhum produto acabado cadastrado. Cadastre o primeiro para começar.')}
          acoes={(p) => (
            <span className="flex items-center justify-end gap-2">
              <Botao
                variante="fantasma"
                icone="file-text"
                aria-label={t('Mídia e documentos de {codigo}', { codigo: p.codigo })}
                onClick={() => definirEmMidia(p)}
              >
                {t('Mídia e documentos')}
              </Botao>
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
        titulo={crud.emEdicao ? t('Editar produto') : t('Novo produto')}
        descricao={t('Campos com * são obrigatórios.')}
      >
        <FormularioProduto
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

      <Modal
        aberto={emMidia !== null}
        aoFechar={() => definirEmMidia(null)}
        titulo={emMidia ? t('Mídia e documentos — {codigo}', { codigo: emMidia.codigo }) : t('Mídia e documentos')}
        descricao={emMidia?.descricao}
        largura="larga"
      >
        {emMidia && (
          <MidiaDoRegistro
            entidade="produto_acabado"
            entidadeId={emMidia.id}
            codigo={emMidia.codigo}
            podeEditar={podeEditar}
            itemCritico={emMidia.item_critico}
          />
        )}
      </Modal>

      <Confirmacao
        aberto={crud.aInativar !== null}
        titulo={t('Inativar produto')}
        mensagem={
          crud.aInativar
            ? t('Inativar o produto {codigo}? Ele deixa de aparecer nas listas de seleção. O histórico é preservado.', { codigo: crud.aInativar.codigo })
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
