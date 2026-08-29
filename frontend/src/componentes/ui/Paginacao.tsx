import { Botao } from './Botao';

export interface PaginacaoProps {
  pagina: number;
  totalPaginas: number;
  total: number;
  aoMudar: (pagina: number) => void;
}

/**
 * Navegacao entre paginas da listagem. Sem numeros de pagina clicaveis: com
 * busca e filtro na tela, pular para a pagina 7 nao e um gesto real — o
 * gestor refina o filtro em vez de folhear.
 */
export function Paginacao({ pagina, totalPaginas, total, aoMudar }: PaginacaoProps) {
  // Lista vazia ja e explicada pelo estado vazio da tabela; repetir aqui polui.
  if (total === 0) {
    return null;
  }

  const registros = total === 1 ? '1 registro' : `${total} registros`;

  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-between gap-4 border-t border-borda-subtle px-3 py-2"
    >
      <p className="text-label text-texto-secondary">
        {`Página ${pagina} de ${totalPaginas} · ${registros}`}
      </p>

      <div className="flex items-center gap-2">
        <Botao
          variante="secundaria"
          icone="chevron-left"
          disabled={pagina <= 1}
          onClick={() => aoMudar(pagina - 1)}
          aria-label="Página anterior"
        >
          Anterior
        </Botao>
        <Botao
          variante="secundaria"
          icone="chevron-right"
          disabled={pagina >= totalPaginas}
          onClick={() => aoMudar(pagina + 1)}
          aria-label="Próxima página"
        >
          Próxima
        </Botao>
      </div>
    </nav>
  );
}
