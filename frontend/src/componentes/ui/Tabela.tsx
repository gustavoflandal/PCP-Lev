import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Ordem } from '@/tipos/cadastros';
import { Botao } from './Botao';
import { icones } from './icones';

export interface Coluna<T> {
  /** Nome da coluna no `ordenar_por` da API. So e usado quando ordenavel. */
  chave: string;
  rotulo: string;
  ordenavel?: boolean;
  alinhamento?: 'esquerda' | 'direita';
  renderizar: (item: T) => ReactNode;
}

export interface TabelaProps<T> {
  /** Nome acessivel da tabela. */
  rotulo: string;
  colunas: Coluna<T>[];
  itens: T[];
  chaveDe: (item: T) => string | number;
  ordenarPor: string;
  ordem: Ordem;
  aoOrdenar: (chave: string) => void;
  /** Frase do estado vazio. Diz o que fazer, nao so que esta vazio. */
  vazio: string;
  carregando?: boolean;
  erro?: string | null;
  aoTentarDeNovo?: () => void;
  acoes?: (item: T) => ReactNode;
}

const LINHAS_DO_ESQUELETO = 5;

/**
 * Tabela operacional do sistema (§6 do design system): cabecalho fixo em
 * surface-sunken, sem zebra, divisoria entre linhas, numeros a direita com
 * tabular-nums.
 *
 * Cobre os cinco estados que toda tela precisa desenhar: carregando, vazio,
 * com dados, erro e — via `acoes` ausente — sem permissao de escrita.
 */
export function Tabela<T>({
  rotulo,
  colunas,
  itens,
  chaveDe,
  ordenarPor,
  ordem,
  aoOrdenar,
  vazio,
  carregando,
  erro,
  aoTentarDeNovo,
  acoes,
}: TabelaProps<T>) {
  const IconeOrdenacao = icones['arrow-up-down'];
  const IconeFalha = icones['alert-triangle'];
  const totalColunas = colunas.length + (acoes ? 1 : 0);

  // Erro vem antes de carregando: uma nova tentativa em andamento nao pode
  // esconder do operador o motivo pelo qual a tela esta sem dados.
  const estado = erro ? 'erro' : carregando ? 'carregando' : itens.length === 0 ? 'vazio' : 'dados';

  return (
    <div className="overflow-x-auto border border-borda-subtle bg-surface-raised">
      <table className="w-full border-collapse" aria-label={rotulo}>
        <thead>
          <tr className="bg-surface-sunken">
            {colunas.map((coluna) => {
              const ordenada = coluna.ordenavel && coluna.chave === ordenarPor;
              return (
                <th
                  key={coluna.chave}
                  scope="col"
                  aria-sort={
                    !coluna.ordenavel
                      ? undefined
                      : ordenada
                        ? ordem === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                  }
                  className={cn(
                    'border-b border-borda-subtle px-3 py-2 text-label text-texto-secondary',
                    coluna.alinhamento === 'direita' ? 'text-right' : 'text-left',
                  )}
                >
                  {coluna.ordenavel ? (
                    <button
                      type="button"
                      onClick={() => aoOrdenar(coluna.chave)}
                      className={cn(
                        'inline-flex items-center gap-1 text-label text-texto-secondary',
                        'hover:text-texto-primary',
                        coluna.alinhamento === 'direita' && 'flex-row-reverse',
                      )}
                    >
                      {coluna.rotulo}
                      <IconeOrdenacao
                        size={12}
                        aria-hidden="true"
                        className={cn('shrink-0', ordenada ? 'text-brand' : 'text-texto-disabled')}
                      />
                    </button>
                  ) : (
                    coluna.rotulo
                  )}
                </th>
              );
            })}
            {acoes && (
              <th
                scope="col"
                className="border-b border-borda-subtle px-3 py-2 text-right text-label text-texto-secondary"
              >
                Ações
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {estado === 'erro' && (
            <tr>
              <td colSpan={totalColunas} className="px-3 py-8">
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="flex items-center gap-2 text-body text-estado-pending">
                    <IconeFalha size={16} aria-hidden="true" />
                    {erro}
                  </p>
                  {aoTentarDeNovo && (
                    <Botao variante="secundaria" icone="refresh-cw" onClick={aoTentarDeNovo}>
                      Tentar de novo
                    </Botao>
                  )}
                </div>
              </td>
            </tr>
          )}

          {estado === 'carregando' &&
            Array.from({ length: LINHAS_DO_ESQUELETO }, (_, indice) => (
              <tr key={indice} data-testid={indice === 0 ? 'esqueleto-tabela' : undefined}>
                {Array.from({ length: totalColunas }, (_, celula) => (
                  <td key={celula} className="border-b border-borda-subtle px-3 py-2">
                    <span className="block h-3 w-full rounded-campo bg-surface-sunken" />
                  </td>
                ))}
              </tr>
            ))}

          {estado === 'vazio' && (
            <tr>
              <td colSpan={totalColunas} className="px-3 py-8 text-center text-body text-texto-secondary">
                {vazio}
              </td>
            </tr>
          )}

          {estado === 'dados' &&
            itens.map((item) => (
              <tr key={chaveDe(item)} className="min-h-linha">
                {colunas.map((coluna) => (
                  <td
                    key={coluna.chave}
                    className={cn(
                      'border-b border-borda-subtle px-3 py-2 text-body text-texto-primary',
                      coluna.alinhamento === 'direita' && 'text-right tabular',
                    )}
                  >
                    {coluna.renderizar(item)}
                  </td>
                ))}
                {acoes && (
                  <td className="border-b border-borda-subtle px-3 py-2 text-right">{acoes(item)}</td>
                )}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
