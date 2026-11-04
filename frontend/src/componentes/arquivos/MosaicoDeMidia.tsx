import { useQuery } from '@tanstack/react-query';
import { Botao } from '@/componentes/ui/Botao';
import { icones } from '@/componentes/ui/icones';
import { ErroApi } from '@/servicos/api';
import { listarAnexos } from '@/servicos/arquivos';
import { agruparVersoes, chaveAnexos, type EntidadeComMidia } from './comum';
import { t } from '@/i18n';

export interface MosaicoDeMidiaProps {
  tipo: 'FOTO' | 'DOCUMENTO';
  entidade: EntidadeComMidia;
  entidadeId: number;
  codigo: string;
}

/**
 * Mosaico somente leitura das fotos ou dos documentos de um registro: abre a
 * partir do indicador na lista do cadastro. Cada item abre em nova aba.
 */
export function MosaicoDeMidia({ tipo, entidade, entidadeId, codigo }: MosaicoDeMidiaProps) {
  const consulta = useQuery({
    queryKey: chaveAnexos(entidade, entidadeId),
    queryFn: () => listarAnexos(entidade, entidadeId),
    refetchOnMount: 'always',
  });
  const IconeDocumento = icones['file-text'];

  if (consulta.isPending) {
    return <span aria-busy="true" aria-label={t('Carregando…')} className="block h-32 w-full animate-pulse rounded-cartao bg-surface-sunken" />;
  }
  if (consulta.isError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="text-body text-estado-pending">
          {consulta.error instanceof ErroApi ? consulta.error.message : t('Não foi possível carregar a mídia e os documentos. Tente de novo.')}
        </p>
        <Botao variante="secundaria" icone="refresh-cw" onClick={() => void consulta.refetch()}>
          {t('Tentar de novo')}
        </Botao>
      </div>
    );
  }

  const anexos = consulta.data.filter((a) => a.tipo === tipo);

  if (anexos.length === 0) {
    return <p className="text-body text-texto-secondary">{tipo === 'FOTO' ? t('Nenhuma foto cadastrada.') : t('Nenhum documento cadastrado.')}</p>;
  }

  if (tipo === 'FOTO') {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {anexos.map((foto) => (
          <li key={foto.id}>
            <a
              href={foto.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-cartao border border-borda-subtle bg-surface-sunken"
            >
              <img
                src={foto.miniatura_url ?? foto.url}
                alt={(entidade === 'parte_peca' ? t('Foto da peça {codigo}', { codigo }) : t('Foto do produto {codigo}', { codigo })) + (foto.titulo ? ` — ${foto.titulo}` : '')}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {agruparVersoes(anexos).map(({ chave, vigente }) => (
        <li key={chave}>
          <a
            href={vigente.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full flex-col gap-2 rounded-cartao border border-borda-subtle bg-surface-raised p-3 hover:bg-surface-sunken"
          >
            <IconeDocumento size={32} aria-hidden="true" className="text-texto-secondary" />
            <span className="text-body font-medium text-texto-primary">{vigente.titulo || vigente.arquivo.nome_original}</span>
            <span className="text-label text-texto-secondary">
              {[vigente.categoria, vigente.versao && `v.${vigente.versao}`].filter(Boolean).join(' · ')}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
