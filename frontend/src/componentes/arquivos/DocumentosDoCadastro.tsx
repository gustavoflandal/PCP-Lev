import { Modal } from '@/componentes/ui/Modal';
import type { EntidadeRegistro } from '@/tipos/arquivos';
import { AnexosDoRegistro } from './AnexosDoRegistro';
import type { RegistroComDocumentos } from './linkDocumentos';
import { t } from '@/i18n';

export interface ModalDocumentosDoCadastroProps {
  entidade: Extract<EntidadeRegistro, 'fornecedor' | 'cliente'>;
  registro: RegistroComDocumentos | null;
  podeEditar: boolean;
  aoFechar: () => void;
}

/** Modal com os documentos de um fornecedor ou cliente. */
export function ModalDocumentosDoCadastro({ entidade, registro, podeEditar, aoFechar }: ModalDocumentosDoCadastroProps) {
  return (
    <Modal
      aberto={registro !== null}
      aoFechar={aoFechar}
      titulo={registro?.nome ? t('Documentos — {nome}', { nome: registro.nome }) : t(entidade === 'fornecedor' ? 'Documentos do fornecedor' : 'Documentos do cliente')}
      descricao={
        entidade === 'fornecedor'
          ? t('Contrato, certificados de qualidade, documentos cadastrais e tabela de preços.')
          : t('Contrato, documentos cadastrais e termos de aceite.')
      }
      largura="larga"
    >
      {registro && <AnexosDoRegistro entidade={entidade} entidadeId={registro.id} podeEditar={podeEditar} />}
    </Modal>
  );
}
