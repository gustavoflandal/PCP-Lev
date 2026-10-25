import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useId, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { separarErro } from '@/lib/errosDeFormulario';
import { anexar, enviarArquivo } from '@/servicos/arquivos';
import {
  CATEGORIAS_ANEXO_REGISTRO,
  LIMITE_IMAGEM_BYTES,
  LIMITE_PDF_BYTES,
  TIPO_PDF,
  TIPOS_IMAGEM,
  type Anexo,
  type EntidadeRegistro,
} from '@/tipos/arquivos';
import { corpoNovoAnexo } from './comum';

/** O que o servico de arquivos aceita como anexo de registro: imagem ou PDF. */
const ACEITOS = [...TIPOS_IMAGEM, TIPO_PDF].join(',');

/** Forma, nao regra: a API confere categoria, tamanho e datas de novo. */
const esquema = z
  .object({
    categoria: z.string().min(1, 'Escolha a categoria do documento'),
    titulo: z.string().trim().max(150, 'O título aceita até 150 caracteres'),
    descricao: z.string().trim().max(500, 'A descrição aceita até 500 caracteres'),
    data_emissao: z.string(),
    data_validade: z.string(),
  })
  .refine((v) => !v.data_emissao || !v.data_validade || v.data_validade >= v.data_emissao, {
    path: ['data_validade'],
    message: 'A validade não pode ser anterior à emissão',
  });

type Formulario = z.infer<typeof esquema>;

const CAMPOS = ['categoria', 'titulo', 'descricao', 'data_emissao', 'data_validade'] as const;

/** Titulo vazio vira o nome do arquivo sem extensao: a lista de vencimentos mostra o titulo. */
function tituloDoArquivo(nome: string): string {
  return nome.replace(/\.[^.]+$/, '').slice(0, 150);
}

/** Confere tipo e tamanho antes de subir: evita esperar o upload para ouvir 400. */
function problemaDoArquivo(arquivo: File): string | null {
  const imagem = (TIPOS_IMAGEM as readonly string[]).includes(arquivo.type);
  if (!imagem && arquivo.type !== TIPO_PDF) {
    return 'Envie um PDF ou uma imagem JPG, PNG ou WebP.';
  }
  if (imagem && arquivo.size > LIMITE_IMAGEM_BYTES) {
    return 'A imagem passa de 5 MB. Reduza o arquivo e envie de novo.';
  }
  if (!imagem && arquivo.size > LIMITE_PDF_BYTES) {
    return 'O PDF passa de 25 MB. Reduza o arquivo e envie de novo.';
  }
  return null;
}

export interface FormularioAnexoProps {
  entidade: EntidadeRegistro;
  entidadeId: number;
  /** Presente ao enviar uma nova versao: a anterior fica no historico. */
  base?: Anexo;
  aoConcluir: () => void;
  aoCancelar: () => void;
}

/** Envio de documento de um registro operacional (ou de nova versao dele). */
export function FormularioAnexo({ entidade, entidadeId, base, aoConcluir, aoCancelar }: FormularioAnexoProps) {
  const idArquivo = useId();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const opcoesCategoria = CATEGORIAS_ANEXO_REGISTRO[entidade].map((c) => ({ valor: c, rotulo: c }));
  const [arquivo, definirArquivo] = useState<File | null>(null);
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
      data_emissao: '',
      data_validade: '',
    },
  });

  const mutacao = useMutation({
    mutationFn: async ({ arquivo: escolhido, valores }: { arquivo: File; valores: Formulario }) => {
      const enviado = await enviarArquivo(escolhido, escolhido.name);
      return anexar(
        corpoNovoAnexo(entidade, entidadeId, enviado.id, {
          tipo: 'ANEXO',
          categoria: valores.categoria,
          titulo: valores.titulo.trim() || tituloDoArquivo(escolhido.name),
          descricao: valores.descricao.trim(),
          data_emissao: valores.data_emissao || null,
          data_validade: valores.data_validade || null,
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
  const erroDe = (campo: keyof Formulario): string | undefined => errors[campo]?.message ?? erroApi?.porCampo[campo];
  // Erro de campo que nao esta no formulario (arquivo_id, tipo...) sobe para o topo.
  const foraDoFormulario = erroApi
    ? Object.entries(erroApi.porCampo)
        .filter(([campo]) => !(CAMPOS as readonly string[]).includes(campo))
        .map(([, mensagem]) => mensagem)
    : [];
  const geral = erroApi?.geral ?? (foraDoFormulario.length > 0 ? foraDoFormulario.join(' ') : null);

  function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    const escolhido = evento.target.files?.[0] ?? null;
    definirArquivo(null);
    definirErroArquivo(null);
    if (!escolhido) return;
    const problema = problemaDoArquivo(escolhido);
    if (problema) {
      definirErroArquivo(problema);
      return;
    }
    definirArquivo(escolhido);
  }

  const nomeBase = base ? base.titulo || base.arquivo.nome_original : '';

  return (
    <form
      noValidate
      aria-label={base ? `Nova versão de ${nomeBase}` : 'Enviar documento'}
      onSubmit={handleSubmit((valores) => {
        if (!arquivo) {
          definirErroArquivo(erroArquivo ?? 'Escolha o arquivo do documento.');
          return;
        }
        mutacao.mutate({ arquivo, valores });
      })}
      className="flex flex-col gap-4 rounded-cartao border border-borda-strong bg-surface-raised p-4"
    >
      <h4 className="text-subtitle text-texto-primary">{base ? `Nova versão — ${nomeBase}` : 'Enviar documento'}</h4>
      {base && (
        <p className="text-label text-texto-secondary">A versão atual sai de vigência e fica no histórico do documento.</p>
      )}

      {geral && (
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          {geral}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={idArquivo} className="text-label text-texto-secondary">
          Arquivo (PDF até 25 MB ou imagem até 5 MB)
          <span aria-hidden="true" className="ml-1 text-estado-pending">
            *
          </span>
        </label>
        <input
          id={idArquivo}
          type="file"
          accept={ACEITOS}
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
          opcoes={opcoesCategoria}
          erro={erroDe('categoria')}
          {...register('categoria')}
        />
        <Campo rotulo="Título" ajuda="Em branco, vale o nome do arquivo" erro={erroDe('titulo')} {...register('titulo')} />
      </div>

      <Campo rotulo="Descrição" erro={erroDe('descricao')} {...register('descricao')} />

      <div className="grid gap-4 md:grid-cols-2">
        <Campo rotulo="Data de emissão" type="date" erro={erroDe('data_emissao')} {...register('data_emissao')} />
        <Campo
          rotulo="Data de validade"
          type="date"
          ajuda="Com validade, o documento entra em Documentos a vencer"
          erro={erroDe('data_validade')}
          {...register('data_validade')}
        />
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
