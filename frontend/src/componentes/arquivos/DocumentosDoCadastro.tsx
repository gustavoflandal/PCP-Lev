import { Modal } from '@/componentes/ui/Modal';
import type { EntidadeRegistro } from '@/tipos/arquivos';
import { AnexosDoRegistro } from './AnexosDoRegistro';
import type { RegistroComDocumentos } from './linkDocumentos';

export interface ModalDocumentosDoCadastroProps {
  entidade: Extract<EntidadeRegistro, 'fornecedor' | 'cliente'>;
  registro: RegistroComDocumentos | null;
  podeEditar: boolean;
  aoFechar: () => void;
}

/** Modal com os documentos de um fornecedor ou cliente. */
export function ModalDocumentosDoCadastro({ entidade, registro, podeEditar, aoFechar }: ModalDocumentosDoCadastroProps) {
  const rotulo = entidade === 'fornecedor' ? 'fornecedor' : 'cliente';
  return (
    <Modal
      aberto={registro !== null}
      aoFechar={aoFechar}
      titulo={registro?.nome ? `Documentos — ${registro.nome}` : `Documentos do ${rotulo}`}
      descricao={
        entidade === 'fornecedor'
          ? 'Contrato, certificados de qualidade, documentos cadastrais e tabela de preços.'
          : 'Contrato, documentos cadastrais e termos de aceite.'
      }
      largura="larga"
    >
      {registro && <AnexosDoRegistro entidade={entidade} entidadeId={registro.id} podeEditar={podeEditar} />}
    </Modal>
  );
}
