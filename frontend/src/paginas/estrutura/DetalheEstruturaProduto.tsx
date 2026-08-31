import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Botao } from '@/componentes/ui/Botao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { formatarData } from '@/lib/formato';
import { obter } from '@/servicos/cadastros';
import { listarEstruturasPorProduto } from '@/servicos/estrutura';
import type { ProdutoAcabado } from '@/tipos/cadastros';
import type { ItemEstrutura } from '@/tipos/estrutura';

export function DetalheEstruturaProduto() {
  const { produtoId } = useParams<{ produtoId: string }>();
  const id = Number(produtoId);
  const navegar = useNavigate();
  const { porId: pecaPorId } = usePartesPecasAtivas();

  const produtoQuery = useQuery({
    queryKey: ['produtos-acabados', id],
    queryFn: () => obter<ProdutoAcabado>('produtos-acabados', id),
  });
  const historicoQuery = useQuery({
    queryKey: ['estruturas', id],
    queryFn: () => listarEstruturasPorProduto(id),
  });

  if (produtoQuery.isPending || historicoQuery.isPending) {
    return <p className="text-body text-texto-secondary">Carregando…</p>;
  }
  if (produtoQuery.isError || historicoQuery.isError || !produtoQuery.data) {
    return <p className="text-body text-estado-pending">Não foi possível carregar a estrutura do produto.</p>;
  }

  const produto = produtoQuery.data;
  const historico = historicoQuery.data ?? [];
  const ativa = historico.find((e) => e.ativo);
  const antigas = historico.filter((e) => !e.ativo);

  const colunasItens: Coluna<ItemEstrutura>[] = [
    { chave: 'parte_peca_id', rotulo: 'Peça', renderizar: (i) => pecaPorId.get(i.parte_peca_id) ?? '—' },
    { chave: 'quantidade', rotulo: 'Quantidade', alinhamento: 'direita', renderizar: (i) => i.quantidade },
  ];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-texto-primary">{produto.codigo}</h1>
          <p className="text-body text-texto-secondary">{produto.descricao}</p>
        </div>
        <Botao icone={ativa ? 'refresh-cw' : 'plus'} onClick={() => navegar(`/estrutura-produtos/${id}/nova`)}>
          {ativa ? 'Nova versão' : 'Criar estrutura'}
        </Botao>
      </div>

      {ativa ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-subtitle text-texto-primary">
            Versão {ativa.versao} — vigente desde {formatarData(ativa.data_vigencia_inicio)}
          </h2>
          <Tabela<ItemEstrutura>
            rotulo={`Itens da versão ${ativa.versao}`}
            colunas={colunasItens}
            itens={ativa.itens}
            chaveDe={(i) => i.id}
            ordenarPor="parte_peca_id"
            ordem="asc"
            aoOrdenar={() => {}}
            vazio="Nenhum item nesta versão."
          />
        </div>
      ) : (
        <p className="text-body text-texto-secondary">Este produto ainda não tem estrutura cadastrada.</p>
      )}

      {antigas.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-subtitle text-texto-primary">Histórico</h2>
          <ul className="flex flex-col gap-1 text-body text-texto-secondary">
            {antigas.map((e) => (
              <li key={e.id}>
                Versão {e.versao} — {formatarData(e.data_vigencia_inicio)} até{' '}
                {e.data_vigencia_fim ? formatarData(e.data_vigencia_fim) : '—'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
