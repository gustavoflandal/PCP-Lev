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
import { t } from '@/i18n';

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
      mostrarToast(editando ? t('Vínculo atualizado') : t('Vínculo salvo'));
      definirForm(VAZIO);
      definirEditando(false);
    },
  });

  const remover = useMutation({
    mutationFn: (d: DePara) => removerDePara(d.id),
    onSuccess: () => {
      void clienteQuery.invalidateQueries({ queryKey: chave });
      mostrarToast(t('Vínculo removido'));
      definirARemover(null);
    },
    onError: (e) => {
      mostrarToast(mensagemDeErro(e, t('Não foi possível remover o vínculo.')), 'pending');
      definirARemover(null);
    },
  });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const fator = Number(form.fator_conversao.replace(',', '.'));
    const novos: typeof erros = {};
    if (!form.parte_peca_id) novos.parte_peca_id = t('Escolha a peça');
    if (form.codigo_fornecedor.trim() === '' || form.codigo_fornecedor.trim().length > 60)
      novos.codigo_fornecedor = t('Informe o código do fornecedor (até 60 caracteres)');
    if (form.unidade_fornecedor.trim().length > 10) novos.unidade_fornecedor = t('Unidade com até 10 caracteres');
    if (!Number.isFinite(fator) || fator <= 0) novos.fator_conversao = t('Fator maior que zero (ex.: 100 para caixa com 100)');
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
    { chave: 'codigo', rotulo: t('Código do fornecedor'), renderizar: (d) => <span className="font-mono">{d.codigo_fornecedor}</span> },
    { chave: 'descricao', rotulo: t('Descrição do fornecedor'), renderizar: (d) => d.descricao_fornecedor || '—' },
    { chave: 'unidade', rotulo: t('Unidade'), renderizar: (d) => d.unidade_fornecedor || '—' },
    { chave: 'fator', rotulo: t('Fator'), alinhamento: 'direita', renderizar: (d) => formatoFator.format(d.fator_conversao) },
    {
      chave: 'peca',
      rotulo: t('Peça'),
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
      titulo={t('Itens do fornecedor (de-para) — {razao_social}', { razao_social: fornecedor.razao_social })}
      descricao={t('Código e unidade do fornecedor para a nossa peça. A importação do XML reconhece os itens por aqui.')}
    >
      <div className="flex flex-col gap-4">
        <Tabela<DePara>
          rotulo={t('Vínculos de-para')}
          colunas={colunas}
          itens={consulta.data ?? []}
          chaveDe={(d) => d.id}
          ordenarPor="codigo"
          ordem="asc"
          aoOrdenar={() => {}}
          carregando={consulta.isPending}
          erro={consulta.isError ? mensagemDeErro(consulta.error, t('Não foi possível carregar os vínculos.')) : null}
          aoTentarDeNovo={() => void consulta.refetch()}
          vazio={t('Nenhum vínculo ainda. Eles nascem ao importar o XML ou podem ser cadastrados aqui.')}
          acoes={
            podeEditar
              ? (d) => (
                  <span className="flex justify-end gap-1">
                    <Botao variante="fantasma" icone="pencil" aria-label={t('Editar vínculo {codigo_fornecedor}', { codigo_fornecedor: d.codigo_fornecedor })} onClick={() => editar(d)}>
                      {t('Editar')}
                    </Botao>
                    <Botao variante="fantasma" icone="trash-2" aria-label={t('Remover vínculo {codigo_fornecedor}', { codigo_fornecedor: d.codigo_fornecedor })} onClick={() => definirARemover(d)}>
                      {t('Remover')}
                    </Botao>
                  </span>
                )
              : undefined
          }
        />

        {podeEditar && (
          <form noValidate onSubmit={enviar} aria-label={t('Vínculo de-para')} className="flex flex-col gap-3 rounded-cartao border border-borda-subtle bg-surface-sunken p-3">
            <h3 className="text-subtitle text-texto-primary">{editando ? t('Editar vínculo') : t('Novo vínculo')}</h3>
            {salvar.isError && (
              <p role="alert" className="text-body text-estado-pending">
                {mensagemDeErro(salvar.error, t('Não foi possível salvar o vínculo.'))}
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <Campo
                rotulo={t('Código do fornecedor')}
                obrigatorio
                tipoDado="codigo"
                erro={erros.codigo_fornecedor}
                disabled={editando}
                value={form.codigo_fornecedor}
                onChange={(e) => definirForm({ ...form, codigo_fornecedor: e.target.value })}
              />
              <div className="md:col-span-2">
                <Selecao
                  rotulo={t('Peça')}
                  obrigatorio
                  placeholder={t('Escolha a peça')}
                  opcoes={pecas.opcoes}
                  erro={erros.parte_peca_id}
                  value={form.parte_peca_id}
                  onChange={(e) => definirForm({ ...form, parte_peca_id: e.target.value })}
                />
              </div>
              <Campo
                rotulo={t('Descrição do fornecedor')}
                value={form.descricao_fornecedor}
                onChange={(e) => definirForm({ ...form, descricao_fornecedor: e.target.value })}
              />
              <Campo
                rotulo={t('Unidade do fornecedor')}
                erro={erros.unidade_fornecedor}
                ajuda={t('Ex.: CX, RL, PCT')}
                value={form.unidade_fornecedor}
                onChange={(e) => definirForm({ ...form, unidade_fornecedor: e.target.value })}
              />
              <Campo
                rotulo={t('Fator de conversão')}
                obrigatorio
                tipoDado="quantidade"
                erro={erros.fator_conversao}
                ajuda={t('Quantas unidades de consumo há em 1 unidade do fornecedor.')}
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
                  {t('Cancelar edição')}
                </Botao>
              )}
              <Botao type="submit" icone="save" ocupado={salvar.isPending} rotuloOcupado={t('Salvando…')}>
                {t('Salvar vínculo')}
              </Botao>
            </div>
          </form>
        )}
      </div>

      <Confirmacao
        aberto={aRemover !== null}
        titulo={t('Remover vínculo')}
        mensagem={aRemover ? t('Remover o vínculo do código {codigo_fornecedor}? As próximas importações não reconhecerão mais esse item.', { codigo_fornecedor: aRemover.codigo_fornecedor }) : ''}
        rotuloConfirmar={t('Remover')}
        rotuloOcupado={t('Removendo…')}
        ocupado={remover.isPending}
        aoConfirmar={() => aRemover && remover.mutate(aRemover)}
        aoCancelar={() => definirARemover(null)}
      />
    </Modal>
  );
}
