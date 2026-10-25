import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { icones } from '@/componentes/ui/icones';
import { useToasts } from '@/componentes/ui/Toast';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
import { cn } from '@/lib/cn';
import { formatarData, formatarDataHora } from '@/lib/formato';
import { removerAnexo } from '@/servicos/arquivos';
import type { Anexo } from '@/tipos/arquivos';
import { agruparVersoes, mensagemDeErro, useEstruturasDoProduto, type EntidadeComMidia } from './comum';
import { FormularioDocumento } from './FormularioDocumento';
import { LinkAbrir } from './LinksDoArquivo';
import { SeloValidade } from './SeloValidade';

export interface DocumentosDoRegistroProps {
  entidade: EntidadeComMidia;
  entidadeId: number;
  documentos: Anexo[];
  podeEditar: boolean;
  aoMudar: () => void;
}

/** Documentos tecnicos (PDF) versionados: vigente + historico de versoes. */
export function DocumentosDoRegistro({ entidade, entidadeId, documentos, podeEditar, aoMudar }: DocumentosDoRegistroProps) {
  const idTitulo = useId();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { porId: fornecedorPorId } = useFornecedoresAtivos();
  const estruturas = useEstruturasDoProduto(entidade === 'produto_acabado' ? entidadeId : null);
  const [formulario, definirFormulario] = useState<{ base?: Anexo } | null>(null);
  const [abertos, definirAbertos] = useState<Set<number>>(new Set());
  const [aRemover, definirARemover] = useState<Anexo | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const IconeDocumento = icones['file-text'];
  const IconeExpandir = icones['chevron-down'];

  const grupos = agruparVersoes(documentos);

  const mutacaoRemover = useMutation({
    mutationFn: (a: Anexo) => removerAnexo(a.id),
    onMutate: () => definirErro(null),
    onSuccess: () => {
      mostrarToast('Documento removido');
      definirARemover(null);
      aoMudar();
    },
    onError: (e) => {
      definirErro(mensagemDeErro(e, 'Não foi possível remover o documento. Tente de novo.'));
      definirARemover(null);
    },
  });

  function alternarHistorico(chave: number) {
    definirAbertos((atuais) => {
      const novos = new Set(atuais);
      if (novos.has(chave)) novos.delete(chave);
      else novos.add(chave);
      return novos;
    });
  }

  function versaoDaEstrutura(id: number): string {
    const e = estruturas.data?.find((x) => x.id === id);
    return e ? `BOM versão ${e.versao}` : `BOM nº ${id}`;
  }

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={idTitulo} className="text-subtitle text-texto-primary">
          Documentos
        </h3>
        {podeEditar && !formulario && (
          <Botao variante="secundaria" icone="plus" onClick={() => definirFormulario({})}>
            Novo documento
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
        <FormularioDocumento
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

      {grupos.length === 0 ? (
        <p className="text-body text-texto-secondary">
          Nenhum documento.{podeEditar ? ' Envie datasheet, desenho, certificado ou instrução em PDF.' : ''}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-borda-subtle rounded-cartao border border-borda-subtle">
          {grupos.map(({ chave, vigente, anteriores }) => {
            const nome = vigente.titulo || vigente.categoria;
            const aberto = abertos.has(chave);
            const idHistorico = `${idTitulo}-historico-${chave}`;
            return (
              <li key={chave} className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <IconeDocumento size={20} aria-hidden="true" className="mt-[2px] shrink-0 text-texto-secondary" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-body font-medium text-texto-primary">
                        {nome}
                        {vigente.versao && (
                          <span className="ml-2 font-mono text-label text-texto-secondary">versão {vigente.versao}</span>
                        )}
                      </p>
                      <p className="text-label text-texto-secondary">
                        {vigente.categoria}
                        {vigente.descricao && ` · ${vigente.descricao}`}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-texto-secondary">
                        {vigente.data_emissao && <span>Emissão {formatarData(vigente.data_emissao)}</span>}
                        {vigente.data_validade && (
                          <span className="inline-flex items-center gap-2">
                            Validade {formatarData(vigente.data_validade)}
                            <SeloValidade validade={vigente.data_validade} />
                          </span>
                        )}
                        {vigente.fornecedor_id && (
                          <span>
                            Fornecedor {fornecedorPorId.get(vigente.fornecedor_id) ?? `nº ${vigente.fornecedor_id}`}
                          </span>
                        )}
                        {vigente.estrutura_produto_id && <span>{versaoDaEstrutura(vigente.estrutura_produto_id)}</span>}
                        <span>Enviado em {formatarDataHora(vigente.created_at)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <LinkAbrir anexo={vigente} rotulo={`Abrir ${nome}`} />
                    {podeEditar && (
                      <>
                        <Botao
                          variante="secundaria"
                          icone="upload"
                          aria-label={`Nova versão de ${nome}`}
                          onClick={() => definirFormulario({ base: vigente })}
                        >
                          Nova versão
                        </Botao>
                        <Botao
                          variante="fantasma"
                          icone="trash-2"
                          aria-label={`Remover ${nome}`}
                          onClick={() => definirARemover(vigente)}
                        >
                          Remover
                        </Botao>
                      </>
                    )}
                  </div>
                </div>

                {anteriores.length > 0 && (
                  <div className="flex flex-col gap-2 pl-7">
                    <button
                      type="button"
                      aria-expanded={aberto}
                      aria-controls={idHistorico}
                      onClick={() => alternarHistorico(chave)}
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
                              <span className="font-mono">{v.versao ? `versão ${v.versao}` : `envio nº ${v.id}`}</span>
                              {' · '}
                              {v.arquivo.nome_original} · enviado em {formatarDataHora(v.created_at)}
                              {v.data_validade && ` · validade ${formatarData(v.data_validade)}`}
                            </span>
                            <LinkAbrir anexo={v} rotulo={`Abrir versão anterior ${v.versao || v.id} de ${nome}`} />
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
      )}

      <Confirmacao
        aberto={aRemover !== null}
        titulo="Remover documento"
        mensagem={
          aRemover
            ? `Remover a versão vigente de "${aRemover.titulo || aRemover.categoria}"? Se houver versão anterior, ela volta a valer.`
            : ''
        }
        rotuloConfirmar="Remover"
        rotuloOcupado="Removendo…"
        ocupado={mutacaoRemover.isPending}
        aoConfirmar={() => aRemover && mutacaoRemover.mutate(aRemover)}
        aoCancelar={() => definirARemover(null)}
      />
    </section>
  );
}
