import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { icones } from '@/componentes/ui/icones';
import { useToasts } from '@/componentes/ui/Toast';
import { cn } from '@/lib/cn';
import { formatarBytes, formatarData, formatarDataHora } from '@/lib/formato';
import { listarAnexos, removerAnexo } from '@/servicos/arquivos';
import { CATEGORIAS_ANEXO_REGISTRO, type Anexo, type EntidadeRegistro } from '@/tipos/arquivos';
import { agruparVersoes, chaveAnexos, mensagemDeErro, type GrupoDeVersoes } from './comum';
import { FormularioAnexo } from './FormularioAnexo';
import { LinkAbrir, LinkBaixar } from './LinksDoArquivo';
import { Miniatura } from './Miniatura';
import { SeloValidade } from './SeloValidade';

/** URLs assinadas vivem 5 minutos: a lista se renova antes de expirarem. */
const VALIDADE_CACHE_MS = 60_000;
const RENOVAR_URLS_MS = 4 * 60_000;

/** O que o vazio sugere anexar em cada registro. */
const SUGESTAO_VAZIO: Record<EntidadeRegistro, string> = {
  ordem_producao: 'Anexe laudos de teste, relatórios de inspeção e fotos da produção.',
  fornecedor: 'Anexe contrato, certificado de qualidade, documentos cadastrais e tabela de preços.',
  pedido_compra: 'Anexe a proposta do fornecedor, o pedido assinado e a comunicação trocada.',
  pedido_venda: 'Anexe o contrato ou edital, o pedido do cliente e o termo de aceite.',
  cliente: 'Anexe contrato, documentos cadastrais e termos de aceite.',
};

export interface AnexosDoRegistroProps {
  entidade: EntidadeRegistro;
  entidadeId: number;
  /** Permissao de alterar os anexos da entidade (permissoesDeAnexo no backend). */
  podeEditar: boolean;
  /**
   * Registro encerrado (OP concluida/cancelada, PC concluido/cancelado, PV
   * entregue/cancelado): ainda aceita anexo, mas nenhum pode ser removido.
   */
  encerrado?: boolean;
}

interface GrupoDeCategoria {
  categoria: string;
  documentos: GrupoDeVersoes[];
}

/** Grupos na ordem da lista fechada da entidade; categoria fora dela vai ao fim. */
function agruparPorCategoria(entidade: EntidadeRegistro, anexos: Anexo[]): GrupoDeCategoria[] {
  const ordem = CATEGORIAS_ANEXO_REGISTRO[entidade];
  const porCategoria = new Map<string, Anexo[]>();
  for (const a of anexos) {
    const categoria = a.categoria || 'Outro';
    porCategoria.set(categoria, [...(porCategoria.get(categoria) ?? []), a]);
  }
  const posicao = (c: string) => {
    const i = ordem.indexOf(c);
    return i < 0 ? ordem.length : i;
  };
  return [...porCategoria.entries()]
    .sort(([a], [b]) => posicao(a) - posicao(b) || a.localeCompare(b, 'pt-BR'))
    .map(([categoria, lista]) => ({
      categoria,
      documentos: agruparVersoes(lista).sort((x, y) => y.vigente.id - x.vigente.id),
    }));
}

function nomeDoAnexo(a: Anexo): string {
  return a.titulo || a.arquivo.nome_original;
}

/**
 * Documentos de um registro operacional (OP, fornecedor, pedido de compra,
 * pedido de venda, cliente), agrupados por categoria, com versoes e validade.
 */
export function AnexosDoRegistro({ entidade, entidadeId, podeEditar, encerrado = false }: AnexosDoRegistroProps) {
  const idBase = useId();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const chave = chaveAnexos(entidade, entidadeId);
  const [formulario, definirFormulario] = useState<{ base?: Anexo } | null>(null);
  const [abertos, definirAbertos] = useState<Set<number>>(new Set());
  const [aRemover, definirARemover] = useState<Anexo | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const IconeArquivo = icones['file-text'];
  const IconeExpandir = icones['chevron-down'];
  const IconeCadeado = icones.lock;
  const IconeFalha = icones['alert-triangle'];

  const consulta = useQuery({
    queryKey: chave,
    queryFn: () => listarAnexos(entidade, entidadeId),
    staleTime: VALIDADE_CACHE_MS,
    refetchInterval: RENOVAR_URLS_MS,
  });

  function aoMudar() {
    void clienteQuery.invalidateQueries({ queryKey: chave });
    // Validade nova (ou documento removido) muda a lista de vencimentos.
    void clienteQuery.invalidateQueries({ queryKey: ['anexos', 'vencimentos'] });
  }

  const mutacaoRemover = useMutation({
    mutationFn: (a: Anexo) => removerAnexo(a.id),
    onMutate: () => definirErro(null),
    onSuccess: () => {
      mostrarToast('Documento removido');
      definirARemover(null);
      aoMudar();
    },
    onError: (e) => {
      // 409 (registro encerrado) traz o texto do dominio: mostra como veio.
      definirErro(mensagemDeErro(e, 'Não foi possível remover o documento. Tente de novo.'));
      definirARemover(null);
      aoMudar();
    },
  });

  function alternarHistorico(chaveDocumento: number) {
    definirAbertos((atuais) => {
      const novos = new Set(atuais);
      if (novos.has(chaveDocumento)) novos.delete(chaveDocumento);
      else novos.add(chaveDocumento);
      return novos;
    });
  }

  const podeRemover = podeEditar && !encerrado;

  function renderizarCorpo() {
    if (consulta.isPending) {
      return (
        <div aria-busy="true" aria-label="Carregando documentos" className="flex flex-col gap-2">
          <span className="block h-16 w-full animate-pulse rounded-cartao bg-surface-sunken" />
          <span className="block h-16 w-full animate-pulse rounded-cartao bg-surface-sunken" />
        </div>
      );
    }
    if (consulta.isError) {
      return (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="flex items-center gap-2 text-body text-estado-pending">
            <IconeFalha size={16} aria-hidden="true" />
            {mensagemDeErro(consulta.error, 'Não foi possível carregar os documentos. Tente de novo.')}
          </p>
          <Botao variante="secundaria" icone="refresh-cw" onClick={() => void consulta.refetch()}>
            Tentar de novo
          </Botao>
        </div>
      );
    }
    const grupos = agruparPorCategoria(entidade, consulta.data);
    if (grupos.length === 0) {
      return (
        <p className="text-body text-texto-secondary">
          Nenhum documento anexado.{podeEditar ? ` ${SUGESTAO_VAZIO[entidade]}` : ''}
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {grupos.map(({ categoria, documentos }, indice) => {
          // Indice, nao o nome: id com espaco quebra o aria-labelledby.
          const idCategoria = `${idBase}-cat-${indice}`;
          return (
            <section key={categoria} aria-labelledby={idCategoria} className="flex flex-col gap-2">
              <h3 id={idCategoria} className="text-label uppercase tracking-[.02em] text-texto-secondary">
                {categoria} <span className="font-mono tabular">({documentos.length})</span>
              </h3>
              <ul className="flex flex-col divide-y divide-borda-subtle rounded-cartao border border-borda-subtle bg-surface-raised">
                {documentos.map(({ chave: chaveDocumento, vigente, anteriores }) => {
                  const nome = nomeDoAnexo(vigente);
                  const aberto = abertos.has(chaveDocumento);
                  const idHistorico = `${idBase}-historico-${chaveDocumento}`;
                  const imagem = vigente.arquivo.tipo_mime.startsWith('image/');
                  return (
                    <li key={chaveDocumento} className="flex flex-col gap-2 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          {imagem ? (
                            <Miniatura url={vigente.miniatura_url ?? vigente.url} alt={`${categoria}: ${nome}`} />
                          ) : (
                            <IconeArquivo size={20} aria-hidden="true" className="mt-[2px] shrink-0 text-texto-secondary" />
                          )}
                          <div className="flex min-w-0 flex-col gap-1">
                            <p className="text-body font-medium text-texto-primary">{nome}</p>
                            <p className="text-label text-texto-secondary">
                              <span className="font-mono">{vigente.arquivo.nome_original}</span> ·{' '}
                              <span className="tabular">{formatarBytes(vigente.arquivo.tamanho)}</span>
                              {vigente.descricao && ` · ${vigente.descricao}`}
                            </p>
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-texto-secondary">
                              <span>
                                Enviado em {formatarDataHora(vigente.created_at)}
                                {vigente.created_by ? ` por ${vigente.created_by}` : ''}
                              </span>
                              {vigente.data_emissao && <span>Emissão {formatarData(vigente.data_emissao)}</span>}
                              {vigente.data_validade && (
                                <span className="inline-flex items-center gap-2">
                                  Validade {formatarData(vigente.data_validade)}
                                  <SeloValidade validade={vigente.data_validade} />
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <LinkAbrir anexo={vigente} rotulo={`Abrir ${nome}`} />
                          <LinkBaixar anexo={vigente} rotulo={`Baixar ${nome}`} />
                          {podeEditar && (
                            <Botao
                              variante="secundaria"
                              icone="upload"
                              aria-label={`Nova versão de ${nome}`}
                              onClick={() => definirFormulario({ base: vigente })}
                            >
                              Nova versão
                            </Botao>
                          )}
                          {podeRemover && (
                            <Botao
                              variante="fantasma"
                              icone="trash-2"
                              aria-label={`Remover ${nome}`}
                              onClick={() => definirARemover(vigente)}
                            >
                              Remover
                            </Botao>
                          )}
                        </div>
                      </div>

                      {anteriores.length > 0 && (
                        <div className="flex flex-col gap-2 pl-8">
                          <button
                            type="button"
                            aria-expanded={aberto}
                            aria-controls={idHistorico}
                            onClick={() => alternarHistorico(chaveDocumento)}
                            className="inline-flex w-fit items-center gap-1 rounded-campo text-label text-brand hover:underline"
                          >
                            <IconeExpandir
                              size={12}
                              aria-hidden="true"
                              className={cn('motion-safe:transition-transform', aberto && 'rotate-180')}
                            />
                            Versões anteriores ({anteriores.length})
                          </button>
                          {aberto && (
                            <ul id={idHistorico} className="flex flex-col gap-2 border-l-2 border-borda-subtle pl-3">
                              {anteriores.map((v) => (
                                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-label text-texto-secondary">
                                    <span className="font-mono">{v.arquivo.nome_original}</span> · enviado em{' '}
                                    {formatarDataHora(v.created_at)}
                                    {v.created_by ? ` por ${v.created_by}` : ''}
                                    {v.data_validade && ` · validade ${formatarData(v.data_validade)}`}
                                  </span>
                                  <LinkAbrir anexo={v} rotulo={`Abrir versão anterior ${v.arquivo.nome_original} de ${nome}`} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          {!podeEditar && (
            <p className="text-label text-texto-secondary">Somente consulta: seu perfil não anexa documentos aqui.</p>
          )}
          {encerrado && (
            <p className="inline-flex items-center gap-2 text-label text-texto-secondary">
              <IconeCadeado size={14} aria-hidden="true" />
              Registro encerrado: os documentos ficam como registro e não podem ser removidos.
              {podeEditar ? ' Ainda é possível anexar.' : ''}
            </p>
          )}
        </div>
        {podeEditar && !formulario && (
          <Botao variante="secundaria" icone="plus" onClick={() => definirFormulario({})}>
            Anexar documento
          </Botao>
        )}
      </div>

      {erro && (
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          {erro}
        </p>
      )}

      {formulario && (
        <FormularioAnexo
          // Remonta ao trocar entre "novo" e "nova versao de X".
          key={formulario.base?.id ?? 'novo'}
          entidade={entidade}
          entidadeId={entidadeId}
          base={formulario.base}
          aoConcluir={() => {
            definirFormulario(null);
            aoMudar();
          }}
          aoCancelar={() => definirFormulario(null)}
        />
      )}

      {renderizarCorpo()}

      <Confirmacao
        aberto={aRemover !== null}
        titulo="Remover documento"
        mensagem={
          aRemover
            ? `Remover "${nomeDoAnexo(aRemover)}"? Se houver versão anterior, ela volta a valer.`
            : ''
        }
        rotuloConfirmar="Remover"
        rotuloOcupado="Removendo…"
        ocupado={mutacaoRemover.isPending}
        aoConfirmar={() => aRemover && mutacaoRemover.mutate(aRemover)}
        aoCancelar={() => definirARemover(null)}
      />
    </div>
  );
}
