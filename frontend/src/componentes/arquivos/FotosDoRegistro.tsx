import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { CaixaMarcacao } from '@/componentes/ui/CaixaMarcacao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { icones } from '@/componentes/ui/icones';
import { useToasts } from '@/componentes/ui/Toast';
import { girar90 } from '@/lib/imagem';
import { anexar, atualizarAnexo, corpoDoAnexo, enviarArquivo, removerAnexo } from '@/servicos/arquivos';
import { GALERIA_MAXIMA, LIMITE_IMAGEM_BYTES, TIPOS_IMAGEM, type Anexo } from '@/tipos/arquivos';
import { corpoNovoAnexo, mensagemDeErro, type EntidadeComMidia } from './comum';

export interface FotosDoRegistroProps {
  entidade: EntidadeComMidia;
  entidadeId: number;
  codigo: string;
  fotos: Anexo[];
  podeEditar: boolean;
  itemCritico?: boolean;
  aoMudar: () => void;
}

function nomeDaFoto(f: Anexo): string {
  return f.titulo || f.arquivo.nome_original || `foto ${f.id}`;
}

/** Foto principal + galeria (ate 10), com envio, troca da principal e remocao. */
export function FotosDoRegistro({
  entidade,
  entidadeId,
  codigo,
  fotos,
  podeEditar,
  itemCritico,
  aoMudar,
}: FotosDoRegistroProps) {
  const idTitulo = useId();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const [erro, definirErro] = useState<string | null>(null);
  const [aRemover, definirARemover] = useState<Anexo | null>(null);
  const IconePrincipal = icones.star;

  const principal = fotos.find((f) => f.principal);
  const galeria = fotos.filter((f) => !f.principal);
  const ordenadas = principal ? [principal, ...galeria] : galeria;

  const mutacaoPrincipal = useMutation({
    mutationFn: (foto: Anexo) => atualizarAnexo(foto.id, { ...corpoDoAnexo(foto), principal: true }),
    onMutate: () => definirErro(null),
    onSuccess: () => {
      mostrarToast('Foto principal definida');
      aoMudar();
    },
    onError: (e) => definirErro(mensagemDeErro(e, 'Não foi possível trocar a foto principal. Tente de novo.')),
  });

  const mutacaoRemover = useMutation({
    mutationFn: (foto: Anexo) => removerAnexo(foto.id),
    onMutate: () => definirErro(null),
    onSuccess: () => {
      mostrarToast('Foto removida');
      definirARemover(null);
      aoMudar();
    },
    onError: (e) => {
      // 409 do item critico: a mensagem da API diz o que fazer.
      definirErro(mensagemDeErro(e, 'Não foi possível remover a foto. Tente de novo.'));
      definirARemover(null);
    },
  });

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={idTitulo} className="text-subtitle text-texto-primary">
          Fotos
        </h3>
        <span className="text-label text-texto-secondary">
          Galeria: <span className="font-mono tabular">{galeria.length}</span> de {GALERIA_MAXIMA}
        </span>
      </div>

      {itemCritico && !principal && (
        <p>
          <Badge tom="warning" icone="alert-triangle">
            Item crítico sem foto principal{podeEditar ? ' — envie uma' : ''}
          </Badge>
        </p>
      )}

      {erro && (
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          {erro}
        </p>
      )}

      {ordenadas.length === 0 ? (
        <p className="text-body text-texto-secondary">
          Nenhuma foto.{podeEditar ? ' Envie a primeira: ela vira a foto principal.' : ''}
        </p>
      ) : (
        <ul aria-label={`Fotos de ${codigo}`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {ordenadas.map((foto, indice) => {
            const nome = nomeDaFoto(foto);
            return (
              <li key={foto.id} className="flex flex-col gap-2 rounded-cartao border border-borda-subtle p-2">
                <a
                  href={foto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir em tamanho real (nova aba)"
                  className="block aspect-square overflow-hidden rounded-campo bg-surface-sunken"
                >
                  <img
                    src={foto.miniatura_url ?? foto.url}
                    alt={foto.principal ? `Foto principal de ${codigo}` : `Foto ${indice + (principal ? 0 : 1)} da galeria de ${codigo}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </a>
                {foto.principal ? (
                  <span className="inline-flex items-center gap-1 text-label text-brand">
                    <IconePrincipal size={12} aria-hidden="true" />
                    Foto principal
                  </span>
                ) : (
                  <span className="text-label text-texto-secondary">Galeria</span>
                )}
                {podeEditar && (
                  <span className="flex flex-col gap-1">
                    {!foto.principal && (
                      <Botao
                        variante="fantasma"
                        icone="star"
                        className="h-auto min-h-[2rem] justify-start px-2"
                        aria-label={`Tornar principal: ${nome}`}
                        ocupado={mutacaoPrincipal.isPending && mutacaoPrincipal.variables?.id === foto.id}
                        rotuloOcupado="Definindo…"
                        onClick={() => mutacaoPrincipal.mutate(foto)}
                      >
                        Tornar principal
                      </Botao>
                    )}
                    <Botao
                      variante="fantasma"
                      icone="trash-2"
                      className="h-auto min-h-[2rem] justify-start px-2"
                      aria-label={`Remover foto: ${nome}`}
                      onClick={() => definirARemover(foto)}
                    >
                      Remover
                    </Botao>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {podeEditar && (
        <EnvioDeFoto
          entidade={entidade}
          entidadeId={entidadeId}
          temPrincipal={!!principal}
          galeriaCheia={galeria.length >= GALERIA_MAXIMA}
          aoEnviar={aoMudar}
        />
      )}

      <Confirmacao
        aberto={aRemover !== null}
        titulo="Remover foto"
        mensagem={
          aRemover?.principal
            ? 'Remover a foto principal? O registro fica sem foto principal até você escolher outra.'
            : 'Remover esta foto da galeria?'
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

interface ArquivoEscolhido {
  conteudo: Blob;
  nome: string;
}

interface EnvioDeFotoProps {
  entidade: EntidadeComMidia;
  entidadeId: number;
  temPrincipal: boolean;
  galeriaCheia: boolean;
  aoEnviar: () => void;
}

/** Escolha, pre-visualizacao, giro de 90 graus e envio de uma foto. */
function EnvioDeFoto({ entidade, entidadeId, temPrincipal, galeriaCheia, aoEnviar }: EnvioDeFotoProps) {
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const entradaRef = useRef<HTMLInputElement>(null);
  const idEntrada = useId();
  const [escolhido, definirEscolhido] = useState<ArquivoEscolhido | null>(null);
  const [previa, definirPrevia] = useState<string | null>(null);
  const [comoPrincipal, definirComoPrincipal] = useState(!temPrincipal);
  const [girando, definirGirando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  // A URL local da previa precisa ser liberada ao trocar de arquivo.
  useEffect(() => {
    if (!escolhido) {
      definirPrevia(null);
      return;
    }
    const url = URL.createObjectURL(escolhido.conteudo);
    definirPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [escolhido]);

  function limpar() {
    definirEscolhido(null);
    definirErro(null);
    if (entradaRef.current) entradaRef.current.value = '';
  }

  function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    definirErro(null);
    if (!arquivo) return;
    if (!(TIPOS_IMAGEM as readonly string[]).includes(arquivo.type)) {
      definirErro('Envie uma foto em JPG, PNG ou WebP.');
      definirEscolhido(null);
      return;
    }
    if (arquivo.size > LIMITE_IMAGEM_BYTES) {
      definirErro('A foto passa de 5 MB. Reduza a resolução e envie de novo.');
      definirEscolhido(null);
      return;
    }
    definirComoPrincipal(!temPrincipal);
    definirEscolhido({ conteudo: arquivo, nome: arquivo.name });
  }

  async function girar() {
    if (!escolhido) return;
    definirGirando(true);
    definirErro(null);
    try {
      const girada = await girar90(escolhido.conteudo);
      definirEscolhido({ conteudo: girada, nome: escolhido.nome });
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível girar a imagem.');
    } finally {
      definirGirando(false);
    }
  }

  const mutacao = useMutation({
    mutationFn: async (arquivo: ArquivoEscolhido) => {
      const enviado = await enviarArquivo(arquivo.conteudo, arquivo.nome);
      return anexar(corpoNovoAnexo(entidade, entidadeId, enviado.id, { tipo: 'FOTO', principal: comoPrincipal }));
    },
    onMutate: () => definirErro(null),
    onSuccess: () => {
      mostrarToast('Foto enviada');
      limpar();
      aoEnviar();
    },
    onError: (e) => definirErro(mensagemDeErro(e, 'Não foi possível enviar a foto. Tente de novo.')),
  });

  const bloqueadaPelaGaleria = galeriaCheia && !comoPrincipal;

  return (
    <div className="flex flex-col gap-3 rounded-cartao border border-dashed border-borda-strong p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={idEntrada} className="text-label text-texto-secondary">
          Nova foto (JPG, PNG ou WebP, até 5 MB)
        </label>
        <input
          ref={entradaRef}
          id={idEntrada}
          type="file"
          accept={TIPOS_IMAGEM.join(',')}
          onChange={aoEscolher}
          className="text-body text-texto-primary file:mr-3 file:h-[2.5rem] file:rounded-campo file:border file:border-borda-strong file:bg-surface-raised file:px-4 file:text-body"
        />
      </div>

      {erro && (
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          {erro}
        </p>
      )}

      {escolhido && (
        <div className="flex flex-wrap items-start gap-4">
          {previa && (
            <img
              src={previa}
              alt="Pré-visualização da foto a enviar"
              className="max-h-48 max-w-[16rem] rounded-campo border border-borda-subtle object-contain"
            />
          )}
          <div className="flex flex-col gap-3">
            <Botao
              variante="secundaria"
              icone="rotate-cw"
              ocupado={girando}
              rotuloOcupado="Girando…"
              disabled={mutacao.isPending}
              onClick={() => void girar()}
            >
              Girar 90°
            </Botao>
            <CaixaMarcacao
              rotulo="Usar como foto principal"
              ajuda={temPrincipal ? 'A principal atual passa para a galeria.' : 'O registro ainda não tem foto principal.'}
              checked={comoPrincipal}
              onChange={(evento) => definirComoPrincipal(evento.target.checked)}
            />
            {bloqueadaPelaGaleria && (
              <p className="text-label text-estado-warning">
                A galeria já tem {GALERIA_MAXIMA} fotos: remova uma ou envie esta como principal.
              </p>
            )}
            <div className="flex gap-2">
              <Botao variante="secundaria" onClick={limpar} disabled={mutacao.isPending}>
                Descartar
              </Botao>
              <Botao
                icone="upload"
                ocupado={mutacao.isPending}
                rotuloOcupado="Enviando…"
                disabled={girando || bloqueadaPelaGaleria}
                onClick={() => mutacao.mutate(escolhido)}
              >
                Enviar foto
              </Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
