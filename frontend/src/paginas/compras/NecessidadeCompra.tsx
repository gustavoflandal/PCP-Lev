import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n';
import { Botao } from '@/componentes/ui/Botao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { listarNecessidadeCompra } from '@/servicos/compras';
import type { ItemNecessidadeCompra } from '@/tipos/compras';
import { PERMISSOES, usePode } from '@/lib/permissoes';

interface GrupoFornecedor {
  fornecedorId: number | null;
  fornecedorNome: string;
  itens: ItemNecessidadeCompra[];
}

function agruparPorFornecedor(itens: ItemNecessidadeCompra[]): GrupoFornecedor[] {
  const grupos = new Map<number | null, GrupoFornecedor>();
  for (const item of itens) {
    const chave = item.fornecedor_padrao_id ?? null;
    const grupo = grupos.get(chave);
    if (grupo) {
      grupo.itens.push(item);
    } else {
      grupos.set(chave, {
        fornecedorId: chave,
        fornecedorNome: item.fornecedor_padrao_nome ?? t('Sem fornecedor padrão'),
        itens: [item],
      });
    }
  }
  // Grupos sem fornecedor vao por ultimo -- nao ha acao a tomar neles alem
  // de cadastrar um fornecedor padrao na peca primeiro.
  return Array.from(grupos.values()).sort((a, b) => {
    if (a.fornecedorId === null) return 1;
    if (b.fornecedorId === null) return -1;
    return a.fornecedorNome.localeCompare(b.fornecedorNome);
  });
}

const colunasNecessidade = (): Coluna<ItemNecessidadeCompra>[] => [
  { chave: 'codigo', rotulo: t('Código'), renderizar: (i) => <span className="font-mono">{i.codigo}</span> },
  { chave: 'descricao', rotulo: t('Descrição'), renderizar: (i) => i.descricao },
  { chave: 'saldo_atual', rotulo: t('Saldo atual'), alinhamento: 'direita', renderizar: (i) => i.saldo_atual },
  { chave: 'estoque_minimo', rotulo: t('Estoque mínimo'), alinhamento: 'direita', renderizar: (i) => i.estoque_minimo },
  { chave: 'necessidade', rotulo: t('Necessidade'), alinhamento: 'direita', renderizar: (i) => i.necessidade },
];

export function NecessidadeCompra() {
  const navegar = useNavigate();
  const podeGerarCotacao = usePode(PERMISSOES.cotacoesIncluir);
  const consulta = useQuery({ queryKey: ['necessidade-compra'], queryFn: listarNecessidadeCompra });

  const grupos = agruparPorFornecedor(consulta.data ?? []);

  function gerarCotacao(grupo: GrupoFornecedor) {
    navegar('/cotacoes/nova', {
      state: {
        fornecedorId: grupo.fornecedorId,
        itens: grupo.itens.map((i) => ({ parte_peca_id: i.parte_peca_id, quantidade: i.necessidade })),
      },
    });
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Necessidade de compra')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Peças ativas com saldo abaixo do estoque mínimo, agrupadas pelo fornecedor padrão.')}
        </p>
      </div>

      {consulta.isPending && <p className="text-body text-texto-secondary">{t('Carregando…')}</p>}
      {consulta.isError && (
        <p className="text-body text-estado-pending">{t('Não foi possível carregar a necessidade de compra.')}</p>
      )}

      {!consulta.isPending && !consulta.isError && grupos.length === 0 && (
        <p className="text-body text-texto-secondary">
          {t('Nenhuma peça está abaixo do estoque mínimo no momento.')}
        </p>
      )}

      {grupos.map((grupo) => (
        <div key={grupo.fornecedorId ?? 'sem-fornecedor'} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-subtitle text-texto-primary">{grupo.fornecedorNome}</h2>
            {podeGerarCotacao && grupo.fornecedorId !== null && (
              <Botao icone="clipboard-list" onClick={() => gerarCotacao(grupo)}>
                {t('Gerar cotação')}
              </Botao>
            )}
          </div>
          {grupo.fornecedorId === null && (
            <p className="text-body text-texto-secondary">
              {t('Cadastre um fornecedor padrão nessas peças antes de gerar uma cotação.')}
            </p>
          )}
          <Tabela<ItemNecessidadeCompra>
            rotulo={t('Necessidade de compra — {nome}', { nome: grupo.fornecedorNome })}
            colunas={colunasNecessidade()}
            itens={grupo.itens}
            chaveDe={(i) => i.parte_peca_id}
            ordenarPor="codigo"
            ordem="asc"
            aoOrdenar={() => {}}
            vazio={t('Nenhuma peça neste grupo.')}
          />
        </div>
      ))}
    </div>
  );
}
