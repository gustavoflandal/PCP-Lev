import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { mensagemDeErro } from '@/componentes/arquivos/comum';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { listarDePara, removerDePara, salvarDePara } from '@/servicos/notasEntrada';
import type { Fornecedor } from '@/tipos/cadastros';
import type { DePara } from '@/tipos/notasEntrada';

export interface DeParaFornecedorProps {
  fornecedor: Fornecedor;
  podeEditar: boolean;
  aoFechar: () => void;
}

interface FormDePara {
  parte_peca_id: string;
  codigo_fornecedor: string;
  descricao_fornecedor: string;
  unidade_fornecedor: string;
  fator_conversao: string;
}

const VAZIO: FormDePara = { parte_peca_id: '', codigo_fornecedor: '', descricao_fornecedor: '', unidade_fornecedor: '', fator_conversao: '1' };
const formatoFator = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 });

/**
 * Itens do fornecedor (de-para): o codigo dele -> a nossa peca, com a unidade
 * dele e o fator para a unidade de consumo. E o que a importacao do XML usa
 * para reconhecer os itens; salvar com um codigo ja existente atualiza o vinculo.
 */
export function DeParaFornecedor({ fornecedor, podeEditar, aoFechar }: DeParaFornecedorProps) {
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const pecas = usePartesPecasAtivas();
  const chave = ['de-para', fornecedor.id];
  const consulta = useQuery({ queryKey: chave, queryFn: () => listarDePara(fornecedor.id) });
  const [form, definirForm] = useState<FormDePara>(VAZIO);
  const [editando, definirEditando] = useState(false);
  const [erros, definirErros] = useState<Partial<Record<keyof FormDePara, string>>>({});
  const [aRemover, definirARemover] = useState<DePara | null>(null);

  const salvar = useMutation({
    mutationFn: () =>
      salvarDePara(fornecedor.id, {
        parte_peca_id: Number(form.parte_peca_id),
        codigo_fornecedor: form.codigo_fornecedor.trim(),
        descricao_fornecedor: form.descricao_fornecedor.trim(),
        unidade_fornecedor: form.unidade_fornecedor.trim(),
        fator_conversao: Number(form.fator_conversao.replace(',', '.')),
      }),
    onSuccess: () => {
      void clienteQuery.invalidateQueries({ queryKey: chave });
      mostrarToast(editando ? 'Vínculo atualizado' : 'Vínculo salvo');
      definirForm(VAZIO);
      definirEditando(false);
    },
  });

  const remover = useMutation({
    mutationFn: (d: DePara) => removerDePara(d.id),
    onSuccess: () => {
      void clienteQuery.invalidateQueries({ queryKey: chave });
      mostrarToast('Vínculo removido');
      definirARemover(null);
    },
    onError: (e) => {
      mostrarToast(mensagemDeErro(e, 'Não foi possível remover o vínculo.'), 'pending');
      definirARemover(null);
    },
  });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const fator = Number(form.fator_conversao.replace(',', '.'));
    const novos: typeof erros = {};
    if (!form.parte_peca_id) novos.parte_peca_id = 'Escolha a peça';
    if (form.codigo_fornecedor.trim() === '' || form.codigo_fornecedor.trim().length > 60)
      novos.codigo_fornecedor = 'Informe o código do fornecedor (até 60 caracteres)';
    if (form.unidade_fornecedor.trim().length > 10) novos.unidade_fornecedor = 'Unidade com até 10 caracteres';
    if (!Number.isFinite(fator) || fator <= 0) novos.fator_conversao = 'Fator maior que zero (ex.: 100 para caixa com 100)';
    definirErros(novos);
    if (Object.keys(novos).length === 0) salvar.mutate();
  }

  function editar(d: DePara) {
    definirEditando(true);
    definirErros({});
    definirForm({
      parte_peca_id: String(d.parte_peca_id),
      codigo_fornecedor: d.codigo_fornecedor,
      descricao_fornecedor: d.descricao_fornecedor,
      unidade_fornecedor: d.unidade_fornecedor,
      fator_conversao: String(d.fator_conversao),
    });
  }

  const colunas: Coluna<DePara>[] = [
    { chave: 'codigo', rotulo: 'Código do fornecedor', renderizar: (d) => <span className="font-mono">{d.codigo_fornecedor}</span> },
    { chave: 'descricao', rotulo: 'Descrição do fornecedor', renderizar: (d) => d.descricao_fornecedor || '—' },
    { chave: 'unidade', rotulo: 'Unidade', renderizar: (d) => d.unidade_fornecedor || '—' },
    { chave: 'fator', rotulo: 'Fator', alinhamento: 'direita', renderizar: (d) => formatoFator.format(d.fator_conversao) },
    {
      chave: 'peca',
      rotulo: 'Peça',
      renderizar: (d) => (
        <span>
          <span className="font-mono">{d.peca_codigo}</span> {d.peca_descricao}
        </span>
      ),
    },
  ];

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={`Itens do fornecedor (de-para) — ${fornecedor.razao_social}`}
      descricao="Código e unidade do fornecedor para a nossa peça. A importação do XML reconhece os itens por aqui."
    >
      <div className="flex flex-col gap-4">
        <Tabela<DePara>
          rotulo="Vínculos de-para"
          colunas={colunas}
          itens={consulta.data ?? []}
          chaveDe={(d) => d.id}
          ordenarPor="codigo"
          ordem="asc"
          aoOrdenar={() => {}}
          carregando={consulta.isPending}
          erro={consulta.isError ? mensagemDeErro(consulta.error, 'Não foi possível carregar os vínculos.') : null}
          aoTentarDeNovo={() => void consulta.refetch()}
          vazio="Nenhum vínculo ainda. Eles nascem ao importar o XML ou podem ser cadastrados aqui."
          acoes={
            podeEditar
              ? (d) => (
                  <span className="flex justify-end gap-1">
                    <Botao variante="fantasma" icone="pencil" aria-label={`Editar vínculo ${d.codigo_fornecedor}`} onClick={() => editar(d)}>
                      Editar
                    </Botao>
                    <Botao variante="fantasma" icone="trash-2" aria-label={`Remover vínculo ${d.codigo_fornecedor}`} onClick={() => definirARemover(d)}>
                      Remover
                    </Botao>
                  </span>
                )
              : undefined
          }
        />

        {podeEditar && (
          <form noValidate onSubmit={enviar} aria-label="Vínculo de-para" className="flex flex-col gap-3 rounded-cartao border border-borda-subtle bg-surface-sunken p-3">
            <h3 className="text-subtitle text-texto-primary">{editando ? 'Editar vínculo' : 'Novo vínculo'}</h3>
            {salvar.isError && (
              <p role="alert" className="text-body text-estado-pending">
                {mensagemDeErro(salvar.error, 'Não foi possível salvar o vínculo.')}
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <Campo
                rotulo="Código do fornecedor"
                obrigatorio
                tipoDado="codigo"
                erro={erros.codigo_fornecedor}
                disabled={editando}
                value={form.codigo_fornecedor}
                onChange={(e) => definirForm({ ...form, codigo_fornecedor: e.target.value })}
              />
              <div className="md:col-span-2">
                <Selecao
                  rotulo="Peça"
                  obrigatorio
                  placeholder="Escolha a peça"
                  opcoes={pecas.opcoes}
                  erro={erros.parte_peca_id}
                  value={form.parte_peca_id}
                  onChange={(e) => definirForm({ ...form, parte_peca_id: e.target.value })}
                />
              </div>
              <Campo
                rotulo="Descrição do fornecedor"
                value={form.descricao_fornecedor}
                onChange={(e) => definirForm({ ...form, descricao_fornecedor: e.target.value })}
              />
              <Campo
                rotulo="Unidade do fornecedor"
                erro={erros.unidade_fornecedor}
                ajuda="Ex.: CX, RL, PCT"
                value={form.unidade_fornecedor}
                onChange={(e) => definirForm({ ...form, unidade_fornecedor: e.target.value })}
              />
              <Campo
                rotulo="Fator de conversão"
                obrigatorio
                tipoDado="quantidade"
                erro={erros.fator_conversao}
                ajuda="Quantas unidades de consumo há em 1 unidade do fornecedor."
                value={form.fator_conversao}
                onChange={(e) => definirForm({ ...form, fator_conversao: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              {editando && (
                <Botao
                  variante="secundaria"
                  onClick={() => {
                    definirEditando(false);
                    definirForm(VAZIO);
                    definirErros({});
                  }}
                >
                  Cancelar edição
                </Botao>
              )}
              <Botao type="submit" icone="save" ocupado={salvar.isPending} rotuloOcupado="Salvando…">
                Salvar vínculo
              </Botao>
            </div>
          </form>
        )}
      </div>

      <Confirmacao
        aberto={aRemover !== null}
        titulo="Remover vínculo"
        mensagem={aRemover ? `Remover o vínculo do código ${aRemover.codigo_fornecedor}? As próximas importações não reconhecerão mais esse item.` : ''}
        rotuloConfirmar="Remover"
        rotuloOcupado="Removendo…"
        ocupado={remover.isPending}
        aoConfirmar={() => aRemover && remover.mutate(aRemover)}
        aoCancelar={() => definirARemover(null)}
      />
    </Modal>
  );
}
