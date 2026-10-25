import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useId, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarData } from '@/lib/formato';
import { anexar, enviarArquivo } from '@/servicos/arquivos';
import { CATEGORIAS_DOCUMENTO_PRODUTO, LIMITE_PDF_BYTES, TIPO_PDF, type Anexo } from '@/tipos/arquivos';
import { corpoNovoAnexo, useEstruturasDoProduto, type EntidadeComMidia } from './comum';

const OPCOES_CATEGORIA = CATEGORIAS_DOCUMENTO_PRODUTO.map((c) => ({ valor: c, rotulo: c }));

/** Forma, nao regra: categoria, tamanhos e datas sao conferidos de novo pela API. */
const esquema = z
  .object({
    categoria: z.string().min(1, 'Escolha a categoria do documento'),
    titulo: z.string().trim().max(150, 'O título aceita até 150 caracteres'),
    descricao: z.string().trim().max(500, 'A descrição aceita até 500 caracteres'),
    versao: z.string().trim().max(20, 'A versão aceita até 20 caracteres'),
    data_emissao: z.string(),
    data_validade: z.string(),
    fornecedor_id: z.string(),
    estrutura_produto_id: z.string(),
  })
  .refine((v) => !v.data_emissao || !v.data_validade || v.data_validade >= v.data_emissao, {
    path: ['data_validade'],
    message: 'A validade não pode ser anterior à emissão',
  });

type Formulario = z.infer<typeof esquema>;

export interface FormularioDocumentoProps {
  entidade: EntidadeComMidia;
  entidadeId: number;
  /** Presente ao enviar uma nova versao: as anteriores ficam no historico. */
  base?: Anexo;
  aoConcluir: () => void;
  aoCancelar: () => void;
}

/** Envio de documento tecnico (PDF) ou de nova versao de um documento existente. */
export function FormularioDocumento({ entidade, entidadeId, base, aoConcluir, aoCancelar }: FormularioDocumentoProps) {
  const idArquivo = useId();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { opcoes: opcoesFornecedor } = useFornecedoresAtivos();
  const ehProduto = entidade === 'produto_acabado';
  const estruturas = useEstruturasDoProduto(ehProduto ? entidadeId : null);
  const opcoesEstrutura = (estruturas.data ?? []).map((e) => ({
    valor: String(e.id),
    rotulo: `Versão ${e.versao} — desde ${formatarData(e.data_vigencia_inicio)}${e.ativo ? ' (ativa)' : ''}`,
  }));

  const [pdf, definirPdf] = useState<File | null>(null);
  const [erroArquivo, definirErroArquivo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      categoria: base?.categoria ?? '',
      titulo: base?.titulo ?? '',
      descricao: base?.descricao ?? '',
      versao: '',
      data_emissao: '',
      data_validade: '',
      fornecedor_id: base?.fornecedor_id ? String(base.fornecedor_id) : '',
      estrutura_produto_id: base?.estrutura_produto_id ? String(base.estrutura_produto_id) : '',
    },
  });

  const mutacao = useMutation({
    mutationFn: async ({ arquivo, valores }: { arquivo: File; valores: Formulario }) => {
      const enviado = await enviarArquivo(arquivo, arquivo.name);
      return anexar(
        corpoNovoAnexo(entidade, entidadeId, enviado.id, {
          tipo: 'DOCUMENTO',
          categoria: valores.categoria,
          titulo: valores.titulo.trim(),
          descricao: valores.descricao.trim(),
          versao: valores.versao.trim(),
          data_emissao: valores.data_emissao || null,
          data_validade: valores.data_validade || null,
          fornecedor_id: valores.fornecedor_id ? Number(valores.fornecedor_id) : null,
          estrutura_produto_id: ehProduto && valores.estrutura_produto_id ? Number(valores.estrutura_produto_id) : null,
          substitui_anexo_id: base?.id ?? null,
        }),
      );
    },
    onSuccess: () => {
      mostrarToast(base ? 'Nova versão enviada' : 'Documento enviado');
      aoConcluir();
    },
  });

  const erroApi = mutacao.error ? separarErro(mutacao.error) : null;
  const erroDe = (campo: keyof Formulario): string | undefined =>
    errors[campo]?.message ?? erroApi?.porCampo[campo];

  function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0] ?? null;
    definirErroArquivo(null);
    definirPdf(null);
    if (!arquivo) return;
    if (arquivo.type !== TIPO_PDF) {
      definirErroArquivo('Documento técnico precisa ser PDF.');
      return;
    }
    if (arquivo.size > LIMITE_PDF_BYTES) {
      definirErroArquivo('O PDF passa de 25 MB. Reduza o arquivo e envie de novo.');
      return;
    }
    definirPdf(arquivo);
  }

  return (
    <form
      noValidate
      aria-label={base ? 'Nova versão do documento' : 'Novo documento'}
      onSubmit={handleSubmit((valores) => {
        if (!pdf) {
          definirErroArquivo(erroArquivo ?? 'Escolha o arquivo PDF do documento.');
          return;
        }
        mutacao.mutate({ arquivo: pdf, valores });
      })}
      className="flex flex-col gap-4 rounded-cartao border border-borda-strong p-4"
    >
      <h4 className="text-subtitle text-texto-primary">
        {base ? `Nova versão — ${base.titulo || base.categoria}` : 'Novo documento'}
      </h4>

      {erroApi?.geral && (
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          {erroApi.geral}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={idArquivo} className="text-label text-texto-secondary">
          Arquivo PDF (até 25 MB)
          <span aria-hidden="true" className="ml-1 text-estado-pending">
            *
          </span>
        </label>
        <input
          id={idArquivo}
          type="file"
          accept={TIPO_PDF}
          required
          aria-invalid={erroArquivo ? true : undefined}
          aria-describedby={erroArquivo ? `${idArquivo}-erro` : undefined}
          onChange={aoEscolher}
          className="text-body text-texto-primary file:mr-3 file:h-[2.5rem] file:rounded-campo file:border file:border-borda-strong file:bg-surface-raised file:px-4 file:text-body"
        />
        {erroArquivo && (
          <p id={`${idArquivo}-erro`} role="alert" className="text-label text-estado-pending">
            {erroArquivo}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Selecao
          rotulo="Categoria"
          obrigatorio
          placeholder="Escolha a categoria"
          opcoes={OPCOES_CATEGORIA}
          erro={erroDe('categoria')}
          {...register('categoria')}
        />
        <Campo rotulo="Título" erro={erroDe('titulo')} {...register('titulo')} />
      </div>

      <Campo rotulo="Descrição" erro={erroDe('descricao')} {...register('descricao')} />

      <div className="grid gap-4 md:grid-cols-3">
        <Campo rotulo="Versão" ajuda="Ex.: Rev. B, 2.1" erro={erroDe('versao')} {...register('versao')} />
        <Campo rotulo="Data de emissão" type="date" erro={erroDe('data_emissao')} {...register('data_emissao')} />
        <Campo rotulo="Data de validade" type="date" erro={erroDe('data_validade')} {...register('data_validade')} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Selecao
          rotulo="Fornecedor de origem"
          placeholder="Não informado"
          opcoes={opcoesFornecedor}
          erro={erroDe('fornecedor_id')}
          {...register('fornecedor_id')}
        />
        {ehProduto && (
          <Selecao
            rotulo="Revisão da BOM"
            placeholder="Não vinculado"
            opcoes={opcoesEstrutura}
            ajuda={estruturas.isSuccess && opcoesEstrutura.length === 0 ? 'O produto ainda não tem estrutura cadastrada.' : undefined}
            erro={erroDe('estrutura_produto_id')}
            {...register('estrutura_produto_id')}
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Botao variante="secundaria" onClick={aoCancelar} disabled={mutacao.isPending}>
          Cancelar
        </Botao>
        <Botao type="submit" icone="upload" ocupado={mutacao.isPending} rotuloOcupado="Enviando…">
          {base ? 'Enviar nova versão' : 'Enviar documento'}
        </Botao>
      </div>
    </form>
  );
}
