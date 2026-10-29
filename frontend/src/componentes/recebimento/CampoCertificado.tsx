import { useMutation } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { mensagemDeErro } from '@/componentes/arquivos/comum';
import { t } from '@/i18n';
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
    onError: (e) => definirErro(mensagemDeErro(e, t('Não foi possível enviar o certificado. Tente de novo.'))),
  });

  const abrir = useMutation({
    mutationFn: () => obterUrlArquivo(arquivoId ?? ''),
    onSuccess: (u) => window.open(u.url, '_blank', 'noopener'),
    onError: (e) => definirErro(mensagemDeErro(e, t('Não foi possível abrir o certificado.'))),
  });

  function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.type && arquivo.type !== TIPO_PDF) {
      definirErro(t('Envie o certificado em PDF.'));
      return;
    }
    if (arquivo.size > LIMITE_PDF_BYTES) {
      definirErro(t('O PDF passa de 25 MB: reduza o arquivo e envie de novo.'));
      return;
    }
    envio.mutate(arquivo);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-label text-texto-secondary">{t('Certificado de conformidade')}</span>
      <div className="flex flex-wrap items-center gap-2">
        {arquivoId ? (
          <>
            <Badge tom="done" icone="check-circle-2">
              {nome ? t('Anexado: {nome}', { nome }) : t('Certificado anexado')}
            </Badge>
            {/* Link (nao botao): continua acionavel com a nota em so leitura,
                dentro do fieldset desabilitado. */}
            <a
              href="#certificado"
              role="button"
              aria-label={t('Abrir certificado — {rotulo}', { rotulo })}
              aria-busy={abrir.isPending || undefined}
              onClick={(e) => {
                e.preventDefault();
                abrir.mutate();
              }}
              className="text-body text-brand hover:underline"
            >
              {t('Abrir')}
            </a>
            {!desabilitado && (
              <Botao variante="fantasma" icone="x" aria-label={t('Remover certificado — {rotulo}', { rotulo })} onClick={() => aoMudar(null)}>
                {t('Remover')}
              </Botao>
            )}
          </>
        ) : (
          <Badge tom="warning" icone="alert-triangle">
            {t('Falta o certificado')}
          </Badge>
        )}
        {!desabilitado && (
          <>
            <label htmlFor={idCampo} className="sr-only">
              {t('Arquivo do certificado — {rotulo}', { rotulo })}
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
              rotuloOcupado={t('Enviando…')}
              onClick={() => entradaRef.current?.click()}
            >
              {arquivoId ? t('Trocar PDF') : t('Enviar PDF')}
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
