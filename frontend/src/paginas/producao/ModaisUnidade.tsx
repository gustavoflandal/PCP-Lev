import { useState, type ChangeEvent } from 'react';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Modal } from '@/componentes/ui/Modal';
import type { Metrologia, Serie } from '@/tipos/producao';

function AlertaErro({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;
  return (
    <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
      {mensagem}
    </p>
  );
}

export interface ModalTesteProps {
  serie: Serie;
  /** true = aprovar, false = reprovar. */
  aprovado: boolean;
  ocupado: boolean;
  erro: string | null;
  aoFechar: () => void;
  aoEnviar: (resultado: string) => void;
}

/** Resultado de teste de uma unidade. Na reprovacao, a descricao e obrigatoria. */
export function ModalTeste({ serie, aprovado, ocupado, erro, aoFechar, aoEnviar }: ModalTesteProps) {
  const [resultado, definirResultado] = useState(serie.resultado_teste ?? '');
  const [erroLocal, definirErroLocal] = useState<string | undefined>();

  function enviar() {
    const texto = resultado.trim();
    if (!aprovado && texto === '') {
      definirErroLocal('Descreva o defeito encontrado — obrigatório na reprovação');
      return;
    }
    if (texto.length > 500) {
      definirErroLocal('Use até 500 caracteres');
      return;
    }
    aoEnviar(texto);
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={aprovado ? `Aprovar unidade ${serie.numero}` : `Reprovar unidade ${serie.numero}`}
    >
      <div className="flex flex-col gap-4">
        <AlertaErro mensagem={erro} />
        <Campo
          rotulo="Resultado do teste"
          obrigatorio={!aprovado}
          ajuda={aprovado ? 'Opcional. Ex.: leitura de velocidade conforme' : 'O que falhou e o que foi medido'}
          erro={erroLocal}
          value={resultado}
          onChange={(e) => {
            definirResultado(e.target.value);
            definirErroLocal(undefined);
          }}
        />
        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </Botao>
          <Botao icone={aprovado ? 'check-circle-2' : 'alert-triangle'} ocupado={ocupado} rotuloOcupado="Registrando…" onClick={enviar}>
            {aprovado ? 'Registrar aprovação' : 'Registrar reprovação'}
          </Botao>
        </div>
      </div>
    </Modal>
  );
}

export interface ModalMetrologiaProps {
  serie: Serie;
  ocupado: boolean;
  erro: string | null;
  aoFechar: () => void;
  aoEnviar: (corpo: Metrologia) => void;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

type CamposMetrologia = keyof Metrologia;

/** Verificacao metrologica (Inmetro) de uma unidade; regravar substitui a anterior. */
export function ModalMetrologia({ serie, ocupado, erro, aoFechar, aoEnviar }: ModalMetrologiaProps) {
  const [valores, definirValores] = useState<Metrologia>({
    numero_aprovacao_modelo: serie.metrologia?.numero_aprovacao_modelo ?? '',
    data_verificacao: serie.metrologia?.data_verificacao ?? '',
    numero_lacre: serie.metrologia?.numero_lacre ?? '',
    validade: serie.metrologia?.validade ?? '',
    observacoes: serie.metrologia?.observacoes ?? '',
  });
  const [erros, definirErros] = useState<Partial<Record<CamposMetrologia, string>>>({});

  const campo = (nome: CamposMetrologia) => ({
    value: valores[nome],
    erro: erros[nome],
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      definirValores((v) => ({ ...v, [nome]: e.target.value }));
      definirErros((atual) => ({ ...atual, [nome]: undefined }));
    },
  });

  function enviar() {
    const v = Object.fromEntries(Object.entries(valores).map(([k, x]) => [k, x.trim()])) as unknown as Metrologia;
    const novos: Partial<Record<CamposMetrologia, string>> = {};
    if (!v.numero_aprovacao_modelo || v.numero_aprovacao_modelo.length > 60) {
      novos.numero_aprovacao_modelo = 'Informe o nº da aprovação de modelo (até 60 caracteres)';
    }
    if (!v.numero_lacre || v.numero_lacre.length > 60) novos.numero_lacre = 'Informe o nº do lacre (até 60 caracteres)';
    if (!DATA.test(v.data_verificacao)) novos.data_verificacao = 'Informe a data no formato AAAA-MM-DD';
    if (!DATA.test(v.validade)) novos.validade = 'Informe a data no formato AAAA-MM-DD';
    else if (DATA.test(v.data_verificacao) && v.validade <= v.data_verificacao) {
      novos.validade = 'A validade precisa ser depois da data de verificação';
    }
    if (v.observacoes.length > 500) novos.observacoes = 'Use até 500 caracteres';
    if (Object.keys(novos).length > 0) {
      definirErros(novos);
      return;
    }
    aoEnviar(v);
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Metrologia da unidade ${serie.numero}`}>
      <div className="flex flex-col gap-4">
        <AlertaErro mensagem={erro} />
        <div className="grid gap-4 md:grid-cols-2">
          <Campo rotulo="Nº da aprovação de modelo (Inmetro)" obrigatorio tipoDado="codigo" {...campo('numero_aprovacao_modelo')} />
          <Campo rotulo="Nº do lacre" obrigatorio tipoDado="codigo" {...campo('numero_lacre')} />
          <Campo rotulo="Data da verificação" obrigatorio ajuda="Formato AAAA-MM-DD" {...campo('data_verificacao')} />
          <Campo rotulo="Validade" obrigatorio ajuda="Formato AAAA-MM-DD" {...campo('validade')} />
        </div>
        <Campo rotulo="Observações" {...campo('observacoes')} />
        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </Botao>
          <Botao icone="save" ocupado={ocupado} rotuloOcupado="Salvando…" onClick={enviar}>
            Salvar metrologia
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
