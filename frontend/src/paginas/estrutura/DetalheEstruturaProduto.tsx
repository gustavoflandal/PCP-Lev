import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarData } from '@/lib/formato';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { obter } from '@/servicos/cadastros';
import { ativarEstrutura, listarEstruturasPorProduto } from '@/servicos/estrutura';
import type { ProdutoAcabado } from '@/tipos/cadastros';
import type { Estrutura, ItemEstrutura } from '@/tipos/estrutura';
import { t } from '@/i18n';

export function DetalheEstruturaProduto() {
  const podeIncluir = usePode(PERMISSOES.estruturaIncluir);
  const { produtoId } = useParams<{ produtoId: string }>();
  const id = Number(produtoId);
  const navegar = useNavigate();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { porId: pecaPorId } = usePartesPecasAtivas();
  // Versao escolhida na lista; sem escolha, o painel mostra a mais recente.
  const [escolhidaId, setEscolhidaId] = useState<number | null>(null);

  const produtoQuery = useQuery({
    queryKey: ['produtos-acabados', id],
    queryFn: () => obter<ProdutoAcabado>('produtos-acabados', id),
  });
  const historicoQuery = useQuery({
    queryKey: ['estruturas', id],
    queryFn: () => listarEstruturasPorProduto(id),
  });

  const ativacao = useMutation({
    mutationFn: (estrutura: Estrutura) => ativarEstrutura(estrutura.id),
    onSuccess: (ativada) => {
      void clienteQuery.invalidateQueries({ queryKey: ['estruturas', id] });
      void clienteQuery.invalidateQueries({ queryKey: ['produtos-acabados'] });
      mostrarToast(t('Versão {n} definida como vigente', { n: ativada.versao }));
    },
  });

  if (produtoQuery.isPending || historicoQuery.isPending) {
    return <p className="text-body text-texto-secondary">{t('Carregando…')}</p>;
  }
  if (produtoQuery.isError || historicoQuery.isError || !produtoQuery.data) {
    return <p className="text-body text-estado-pending">{t('Não foi possível carregar a estrutura do produto.')}</p>;
  }

  const produto = produtoQuery.data;
  // Da mais recente para a mais antiga, sem depender da ordem da API.
  const versoes = [...(historicoQuery.data ?? [])].sort((a, b) => b.versao - a.versao);
  const maisRecente = versoes[0];
  const exibida = versoes.find((e) => e.id === escolhidaId) ?? maisRecente;
  const { geral: erroAtivacao } = separarErro(ativacao.error);

  const colunasItens: Coluna<ItemEstrutura>[] = [
    { chave: 'parte_peca_id', rotulo: t('Peça'), renderizar: (i) => pecaPorId.get(i.parte_peca_id) ?? '—' },
    { chave: 'quantidade', rotulo: t('Quantidade'), alinhamento: 'direita', renderizar: (i) => i.quantidade },
  ];

  const colunasVersoes: Coluna<Estrutura>[] = [
    { chave: 'versao', rotulo: t('Versão'), renderizar: (e) => `v.${e.versao}` },
    {
      chave: 'vigencia',
      rotulo: t('Vigência'),
      renderizar: (e) =>
        e.data_vigencia_fim
          ? t('{data} até {data2}', { data: formatarData(e.data_vigencia_inicio), data2: formatarData(e.data_vigencia_fim) })
          : t('desde {data}', { data: formatarData(e.data_vigencia_inicio) }),
    },
    {
      chave: 'itens',
      rotulo: t('Itens'),
      alinhamento: 'direita',
      renderizar: (e) => e.itens?.length ?? 0,
    },
    {
      chave: 'situacao',
      rotulo: t('Situação'),
      renderizar: (e) =>
        e.ativo ? (
          <Badge tom="done" icone="check-circle-2">
            {t('Vigente')}
          </Badge>
        ) : (
          <Badge tom="neutral" icone="history">
            {t('Anterior')}
          </Badge>
        ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-texto-primary">{produto.codigo}</h1>
          <p className="text-body text-texto-secondary">{produto.descricao}</p>
        </div>
        {podeIncluir && (
          <Botao
            icone={exibida ? 'refresh-cw' : 'plus'}
            onClick={() =>
              navegar(
                exibida ? `/estrutura-produtos/${id}/nova?base=${exibida.id}` : `/estrutura-produtos/${id}/nova`,
              )
            }
          >
            {exibida ? t('Nova versão') : t('Criar estrutura')}
          </Botao>
        )}
      </div>

      {erroAtivacao && (
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          {erroAtivacao}
        </p>
      )}

      {exibida ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-subtitle text-texto-primary">
              Versão {exibida.versao}
              {exibida.ativo ? t(' — vigente desde {data}', { data: formatarData(exibida.data_vigencia_inicio) }) : ''}
            </h2>
            {exibida.ativo ? (
              <Badge tom="done" icone="check-circle-2">
                {t('Vigente')}
              </Badge>
            ) : (
              <Badge tom="warning" icone="history">
                {t('Não vigente')}
              </Badge>
            )}
          </div>
          <Tabela<ItemEstrutura>
            rotulo={t('Itens da versão {versao}', { versao: exibida.versao })}
            colunas={colunasItens}
            itens={exibida.itens ?? []}
            chaveDe={(i) => i.id}
            ordenarPor="parte_peca_id"
            ordem="asc"
            aoOrdenar={() => {}}
            vazio={t('Nenhum item nesta versão.')}
          />
        </div>
      ) : (
        <p className="text-body text-texto-secondary">{t('Este produto ainda não tem estrutura cadastrada.')}</p>
      )}

      {versoes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-subtitle text-texto-primary">{t('Versões')}</h2>
          <p className="text-body text-texto-secondary">
            {t(
              'O painel acima mostra a versão mais recente. A versão vigente é a que vale nos produtos acabados e pode ser qualquer uma delas.',
            )}
          </p>
          <Tabela<Estrutura>
            rotulo={t('Versões da estrutura')}
            colunas={colunasVersoes}
            itens={versoes}
            chaveDe={(e) => e.id}
            ordenarPor="versao"
            ordem="desc"
            aoOrdenar={() => {}}
            vazio={t('Nenhuma versão cadastrada.')}
            acoes={(e) => (
              <div className="flex justify-end gap-1">
                <Botao
                  variante="fantasma"
                  icone="eye"
                  disabled={e.id === exibida?.id}
                  aria-label={t('Ver itens da versão {versao}', { versao: e.versao })}
                  onClick={() => setEscolhidaId(e.id)}
                >
                  {e.id === exibida?.id ? t('Exibida') : t('Ver itens')}
                </Botao>
                {podeIncluir && !e.ativo && (
                  <Botao
                    variante="secundaria"
                    icone="check-circle-2"
                    aria-label={t('Definir a versão {versao} como vigente', { versao: e.versao })}
                    ocupado={ativacao.isPending && ativacao.variables?.id === e.id}
                    rotuloOcupado={t('Definindo…')}
                    disabled={ativacao.isPending}
                    onClick={() => ativacao.mutate(e)}
                  >
                    {t('Definir como vigente')}
                  </Botao>
                )}
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
