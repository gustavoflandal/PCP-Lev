import { useMutation } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { mensagemDeErro } from '@/componentes/arquivos/comum';
import { enviarArquivo, obterUrlArquivo } from '@/servicos/arquivos';
import { LIMITE_PDF_BYTES, TIPO_PDF } from '@/tipos/arquivos';

export interface CampoCertificadoProps {
  /** Ex.: "lote L-01 da PLACA-01" (entra nos rotulos acessiveis). */
  rotulo: string;
  arquivoId: string | null | undefined;
  aoMudar: (arquivoId: string | null) => void;
  desabilitado?: boolean;
}

/**
 * Certificado de conformidade (PDF) do lote ou do item: sobe o arquivo
 * (POST /arquivos) e guarda so o id -- a nota grava o vinculo ao salvar.
 */
export function CampoCertificado({ rotulo, arquivoId, aoMudar, desabilitado }: CampoCertificadoProps) {
  const idCampo = useId();
  const entradaRef = useRef<HTMLInputElement>(null);
  const [nome, definirNome] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const envio = useMutation({
    mutationFn: (arquivo: File) => enviarArquivo(arquivo, arquivo.name),
    onMutate: () => definirErro(null),
    onSuccess: (arquivo) => {
      definirNome(arquivo.nome_original);
      aoMudar(arquivo.id);
    },
    onError: (e) => definirErro(mensagemDeErro(e, 'Não foi possível enviar o certificado. Tente de novo.')),
  });

  const abrir = useMutation({
    mutationFn: () => obterUrlArquivo(arquivoId ?? ''),
    onSuccess: (u) => window.open(u.url, '_blank', 'noopener'),
    onError: (e) => definirErro(mensagemDeErro(e, 'Não foi possível abrir o certificado.')),
  });

  function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.type && arquivo.type !== TIPO_PDF) {
      definirErro('Envie o certificado em PDF.');
      return;
    }
    if (arquivo.size > LIMITE_PDF_BYTES) {
      definirErro('O PDF passa de 25 MB: reduza o arquivo e envie de novo.');
      return;
    }
    envio.mutate(arquivo);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-label text-texto-secondary">Certificado de conformidade</span>
      <div className="flex flex-wrap items-center gap-2">
        {arquivoId ? (
          <>
            <Badge tom="done" icone="check-circle-2">
              {nome ? `Anexado: ${nome}` : 'Certificado anexado'}
            </Badge>
            {/* Link (nao botao): continua acionavel com a nota em so leitura,
                dentro do fieldset desabilitado. */}
            <a
              href="#certificado"
              role="button"
              aria-label={`Abrir certificado — ${rotulo}`}
              aria-busy={abrir.isPending || undefined}
              onClick={(e) => {
                e.preventDefault();
                abrir.mutate();
              }}
              className="text-body text-brand hover:underline"
            >
              Abrir
            </a>
            {!desabilitado && (
              <Botao variante="fantasma" icone="x" aria-label={`Remover certificado — ${rotulo}`} onClick={() => aoMudar(null)}>
                Remover
              </Botao>
            )}
          </>
        ) : (
          <Badge tom="warning" icone="alert-triangle">
            Falta o certificado
          </Badge>
        )}
        {!desabilitado && (
          <>
            <label htmlFor={idCampo} className="sr-only">
              {`Arquivo do certificado — ${rotulo}`}
            </label>
            <input
              id={idCampo}
              ref={entradaRef}
              type="file"
              accept={TIPO_PDF}
              className="sr-only"
              onChange={(e) => {
                escolher(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Botao
              variante="secundaria"
              icone="upload"
              ocupado={envio.isPending}
              rotuloOcupado="Enviando…"
              onClick={() => entradaRef.current?.click()}
            >
              {arquivoId ? 'Trocar PDF' : 'Enviar PDF'}
            </Botao>
          </>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-label text-estado-pending">
          {erro}
        </p>
      )}
    </div>
  );
}
