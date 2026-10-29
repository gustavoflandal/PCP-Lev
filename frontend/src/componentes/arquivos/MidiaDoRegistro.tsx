import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Botao } from '@/componentes/ui/Botao';
import { icones } from '@/componentes/ui/icones';
import { ErroApi } from '@/servicos/api';
import { listarAnexos } from '@/servicos/arquivos';
import { chaveAnexos, RECURSO_DA_ENTIDADE, type EntidadeComMidia } from './comum';
import { DocumentosDoRegistro } from './DocumentosDoRegistro';
import { FotosDoRegistro } from './FotosDoRegistro';
import { t } from '@/i18n';

/**
 * As URLs assinadas vivem 5 minutos: a lista nunca fica velha mais que isso.
 * Com o painel aberto ela se renova sozinha antes de as URLs expirarem.
 */
const VALIDADE_CACHE_MS = 60_000;
const RENOVAR_URLS_MS = 4 * 60_000;

export interface MidiaDoRegistroProps {
  entidade: EntidadeComMidia;
  entidadeId: number;
  /** Codigo do registro: entra nos textos alternativos das fotos. */
  codigo: string;
  /** Sem permissao de editar o registro, o painel e so leitura. */
  podeEditar: boolean;
  /** Item critico: a falta da foto principal vira alerta. */
  itemCritico?: boolean;
}

/** Fotos (principal + galeria) e documentos tecnicos de um produto ou peca. */
export function MidiaDoRegistro({ entidade, entidadeId, codigo, podeEditar, itemCritico }: MidiaDoRegistroProps) {
  const clienteQuery = useQueryClient();
  const chave = chaveAnexos(entidade, entidadeId);
  const consulta = useQuery({
    queryKey: chave,
    queryFn: () => listarAnexos(entidade, entidadeId),
    staleTime: VALIDADE_CACHE_MS,
    refetchOnMount: 'always',
    refetchInterval: RENOVAR_URLS_MS,
  });
  const IconeFalha = icones['alert-triangle'];

  function aoMudar() {
    void clienteQuery.invalidateQueries({ queryKey: chave });
    // A miniatura da lista do cadastro muda quando a foto principal muda.
    void clienteQuery.invalidateQueries({ queryKey: [RECURSO_DA_ENTIDADE[entidade]] });
  }

  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label={t('Carregando mídia e documentos')} className="flex flex-col gap-3">
        <span className="block h-24 w-full animate-pulse rounded-cartao bg-surface-sunken" />
        <span className="block h-16 w-full animate-pulse rounded-cartao bg-surface-sunken" />
      </div>
    );
  }

  if (consulta.isError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="flex items-center gap-2 text-body text-estado-pending">
          <IconeFalha size={16} aria-hidden="true" />
          {consulta.error instanceof ErroApi
            ? consulta.error.message
            : t('Não foi possível carregar a mídia e os documentos. Tente de novo.')}
        </p>
        <Botao variante="secundaria" icone="refresh-cw" onClick={() => void consulta.refetch()}>
          {t('Tentar de novo')}
        </Botao>
      </div>
    );
  }

  const anexos = consulta.data;
  return (
    <div className="flex flex-col gap-6">
      {!podeEditar && (
        <p className="text-label text-texto-secondary">{t('Somente consulta: seu perfil não altera fotos nem documentos deste cadastro.')}</p>
      )}
      <FotosDoRegistro
        entidade={entidade}
        entidadeId={entidadeId}
        codigo={codigo}
        fotos={anexos.filter((a) => a.tipo === 'FOTO')}
        podeEditar={podeEditar}
        itemCritico={itemCritico}
        aoMudar={aoMudar}
      />
      <DocumentosDoRegistro
        entidade={entidade}
        entidadeId={entidadeId}
        documentos={anexos.filter((a) => a.tipo === 'DOCUMENTO')}
        podeEditar={podeEditar}
        aoMudar={aoMudar}
      />
    </div>
  );
}
