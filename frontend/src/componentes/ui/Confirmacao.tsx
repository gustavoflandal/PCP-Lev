import { Botao } from './Botao';
import { Modal } from './Modal';

export interface ConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  /** Diz o que vai acontecer e se e reversivel. */
  mensagem: string;
  /** Verbo no infinitivo, igual ao botao que abriu a confirmacao. */
  rotuloConfirmar: string;
  /** O mesmo verbo no gerundio ("Inativando…"). Explicito porque a
   *  conjugacao em portugues nao sai de uma regra generica confiavel. */
  rotuloOcupado: string;
  ocupado?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

/**
 * Confirmacao de acao destrutiva. O rotulo do botao repete o verbo da acao —
 * "Inativar", nao "OK" — para que a pessoa leia o que esta confirmando.
 */
export function Confirmacao({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar,
  rotuloOcupado,
  ocupado,
  aoConfirmar,
  aoCancelar,
}: ConfirmacaoProps) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoCancelar}
      titulo={titulo}
      rodape={
        <>
          <Botao variante="secundaria" onClick={aoCancelar} disabled={ocupado}>
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            onClick={aoConfirmar}
            ocupado={ocupado}
            rotuloOcupado={rotuloOcupado}
          >
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      <p className="text-body text-texto-primary">{mensagem}</p>
    </Modal>
  );
}
