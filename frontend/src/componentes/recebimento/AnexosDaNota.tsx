import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { chaveAnexos, corpoNovoAnexo, mensagemDeErro } from '@/componentes/arquivos/comum';
import { Miniatura } from '@/componentes/arquivos/Miniatura';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { icones } from '@/componentes/ui/icones';
import { useToasts } from '@/componentes/ui/Toast';
import { formatarBytes, formatarDataHora } from '@/lib/formato';
import { anexar, enviarArquivo, listarAnexos, removerAnexo } from '@/servicos/arquivos';
import type { Anexo } from '@/tipos/arquivos';
import { CATEGORIAS_ANEXO_NOTA } from '@/tipos/notasEntrada';

/** URLs assinadas vivem 5 minutos: a lista se renova antes de expirarem. */
const RENOVAR_URLS_MS = 4 * 60_000;

export interface AnexosDaNotaProps {
  notaId: number;
  podeEditar: boolean;
  /** Nota fora de Rascunho/Conferida nao aceita remover anexo (409). */
  podeRemover?: boolean;
}

/**
 * Anexos da nota de entrada (4.3.3/4.3.6): XML, DANFE, certificados e as
 * fotos do recebimento (mercadoria, lacre, avaria). Imagem ou PDF; o XML
 * importado entra aqui sozinho.
 */
export function AnexosDaNota({ notaId, podeEditar, podeRemover = podeEditar }: AnexosDaNotaProps) {
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const chave = chaveAnexos('nota_entrada', notaId);
  const idArquivo = useId();
  const entradaRef = useRef<HTMLInputElement>(null);
  const [categoria, definirCategoria] = useState<string>('Foto da mercadoria');
  const [erro, definirErro] = useState<string | null>(null);
  const [aRemover, definirARemover] = useState<Anexo | null>(null);
  const IconeArquivo = icones['file-text'];
  const IconeAbrir = icones['external-link'];

  const consulta = useQuery({
    queryKey: chave,
    queryFn: () => listarAnexos('nota_entrada', notaId),
    refetchInterval: RENOVAR_URLS_MS,
  });

  const envio = useMutation({
    mutationFn: async (arquivo: File) => {
      const enviado = await enviarArquivo(arquivo, arquivo.name);
      return anexar(
        corpoNovoAnexo('nota_entrada', notaId, enviado.id, { tipo: 'ANEXO', categoria, titulo: arquivo.name }),
      );
    },
    onMutate: () => definirErro(null),
    onSuccess: () => {
      void clienteQuery.invalidateQueries({ queryKey: chave });
      mostrarToast('Anexo enviado');
    },
    onError: (e) => definirErro(mensagemDeErro(e, 'Não foi possível enviar o anexo. Tente de novo.')),
  });

  const remocao = useMutation({
    mutationFn: (a: Anexo) => removerAnexo(a.id),
    onSuccess: () => {
      void clienteQuery.invalidateQueries({ queryKey: chave });
      mostrarToast('Anexo removido');
      definirARemover(null);
    },
    onError: (e) => {
      definirErro(mensagemDeErro(e, 'Não foi possível remover o anexo.'));
      definirARemover(null);
    },
  });

  const anexos = consulta.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {podeEditar && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-[260px]">
            <Selecao
              rotulo="Categoria do anexo"
              opcoes={CATEGORIAS_ANEXO_NOTA.map((c) => ({ valor: c, rotulo: c }))}
              value={categoria}
              onChange={(e) => definirCategoria(e.target.value)}
            />
          </div>
          <label htmlFor={idArquivo} className="sr-only">
            Arquivo do anexo
          </label>
          <input
            id={idArquivo}
            ref={entradaRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,application/xml,text/xml,.xml"
            capture={categoria.startsWith('Foto') ? 'environment' : undefined}
            className="sr-only"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = '';
              if (arquivo) envio.mutate(arquivo);
            }}
          />
          <Botao icone="upload" ocupado={envio.isPending} rotuloOcupado="Enviando…" onClick={() => entradaRef.current?.click()}>
            Anexar arquivo
          </Botao>
        </div>
      )}

      {erro && (
        <p role="alert" className="text-body text-estado-pending">
          {erro}
        </p>
      )}

      {consulta.isPending ? (
        <p className="text-body text-texto-secondary">Carregando anexos…</p>
      ) : consulta.isError ? (
        <p role="alert" className="text-body text-estado-pending">
          {mensagemDeErro(consulta.error, 'Não foi possível carregar os anexos.')}
        </p>
      ) : anexos.length === 0 ? (
        <p className="text-body text-texto-secondary">
          Nenhum anexo. {podeEditar ? 'Anexe o DANFE, o XML e as fotos da mercadoria recebida.' : ''}
        </p>
      ) : (
        <ul aria-label="Anexos da nota" className="flex flex-col divide-y divide-borda-subtle rounded-cartao border border-borda-subtle">
          {anexos.map((a) => {
            const imagem = a.arquivo.tipo_mime.startsWith('image/');
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                {imagem ? (
                  <Miniatura url={a.miniatura_url ?? a.url} alt={`${a.categoria || 'Anexo'}: ${a.arquivo.nome_original}`} />
                ) : (
                  <IconeArquivo size={20} aria-hidden="true" className="text-texto-secondary" />
                )}
                <div className="flex min-w-[200px] flex-1 flex-col">
                  <span className="text-body text-texto-primary">{a.categoria || 'Anexo'}</span>
                  <span className="text-label text-texto-secondary">
                    {a.arquivo.nome_original} · {formatarBytes(a.arquivo.tamanho)} · {formatarDataHora(a.created_at)}
                    {a.created_by ? ` · ${a.created_by}` : ''}
                  </span>
                </div>
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-body text-brand hover:underline"
                  >
                    <IconeAbrir size={14} aria-hidden="true" />
                    Abrir
                  </a>
                )}
                {podeEditar && podeRemover && (
                  <Botao
                    variante="fantasma"
                    icone="trash-2"
                    aria-label={`Remover anexo ${a.arquivo.nome_original}`}
                    onClick={() => definirARemover(a)}
                  >
                    Remover
                  </Botao>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Confirmacao
        aberto={aRemover !== null}
        titulo="Remover anexo"
        mensagem={aRemover ? `Remover o anexo ${aRemover.arquivo.nome_original} da nota?` : ''}
        rotuloConfirmar="Remover"
        rotuloOcupado="Removendo…"
        ocupado={remocao.isPending}
        aoConfirmar={() => aRemover && remocao.mutate(aRemover)}
        aoCancelar={() => definirARemover(null)}
      />
    </div>
  );
}
