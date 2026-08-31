import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { useToasts } from '@/componentes/ui/Toast';
import { chaveDadosEmpresa, useDadosEmpresa } from '@/hooks/useDadosEmpresa';
import { separarErro } from '@/lib/errosDeFormulario';
import {
  atualizarDadosEmpresa,
  atualizarFavicon,
  atualizarLogoClaro,
  atualizarLogoEscuro,
  urlFavicon,
  urlLogoClaro,
  urlLogoEscuro,
} from '@/servicos/empresa';
import { useAutenticacao } from '@/store/autenticacao';
import type { CorpoAtualizarEmpresa, DadosEmpresa as DadosDaEmpresa } from '@/tipos/empresa';

/**
 * Validacao de forma, nao de regra: o dominio no backend (razao social
 * obrigatoria, CNPJ opcional mas com digito verificador, UF de 2 letras) e a
 * autoridade. Aqui so evitamos o ida-e-volta obvio.
 */
const esquema = z.object({
  razao_social: z.string().trim().min(1, 'Informe a razão social'),
  nome_fantasia: z.string().trim().default(''),
  cnpj: z.string().trim().default(''),
  inscricao_estadual: z.string().trim().default(''),
  inscricao_municipal: z.string().trim().default(''),
  cnae: z.string().trim().default(''),
  cep: z.string().trim().default(''),
  logradouro: z.string().trim().default(''),
  numero: z.string().trim().default(''),
  complemento: z.string().trim().default(''),
  bairro: z.string().trim().default(''),
  cidade: z.string().trim().default(''),
  uf: z.string().trim().max(2, 'A UF tem 2 letras').default(''),
  telefone: z.string().trim().default(''),
  email: z.string().trim().default(''),
  site: z.string().trim().default(''),
  rodape_padrao: z.string().trim().default(''),
  condicoes_gerais_compra: z.string().trim().default(''),
  responsavel_tecnico: z.string().trim().default(''),
});

type Formulario = z.input<typeof esquema>;

const CAMPOS_VAZIOS: Formulario = {
  razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '', inscricao_municipal: '',
  cnae: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  telefone: '', email: '', site: '', rodape_padrao: '', condicoes_gerais_compra: '', responsavel_tecnico: '',
};

function paraFormulario(empresa: DadosDaEmpresa | undefined): Formulario {
  if (!empresa) return CAMPOS_VAZIOS;
  return {
    razao_social: empresa.razao_social,
    nome_fantasia: empresa.nome_fantasia,
    cnpj: empresa.cnpj,
    inscricao_estadual: empresa.inscricao_estadual,
    inscricao_municipal: empresa.inscricao_municipal,
    cnae: empresa.cnae,
    cep: empresa.cep,
    logradouro: empresa.logradouro,
    numero: empresa.numero,
    complemento: empresa.complemento,
    bairro: empresa.bairro,
    cidade: empresa.cidade,
    uf: empresa.uf,
    telefone: empresa.telefone,
    email: empresa.email,
    site: empresa.site,
    rodape_padrao: empresa.rodape_padrao,
    condicoes_gerais_compra: empresa.condicoes_gerais_compra,
    responsavel_tecnico: empresa.responsavel_tecnico,
  };
}

/** Le o arquivo escolhido e devolve o base64 sem o prefixo `data:...;base64,`
 * (o backend recebe so os bytes codificados, o mime vem à parte). */
function lerArquivoComoBase64(arquivo: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const resultado = leitor.result as string;
      resolve({ base64: resultado.slice(resultado.indexOf(',') + 1), mime: arquivo.type });
    };
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

interface RespostaViaCep {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

interface CampoLogotipoProps {
  titulo: string;
  aceita: string;
  temImagem: boolean | undefined;
  url: string;
  ocupado: boolean;
  aoEnviar: (arquivo: File) => void;
  aoRemover: () => void;
}

/** Upload + preview + remocao de uma imagem da empresa (logo claro/escuro,
 * favicon) -- os tres campos de imagem da tela repetem exatamente esta forma. */
function CampoLogotipo({ titulo, aceita, temImagem, url, ocupado, aoEnviar, aoRemover }: CampoLogotipoProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function aoMudarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    // Limpa o valor do input mesmo sem arquivo escolhido (cancelou o
    // dialogo): sem isso, escolher o MESMO arquivo de novo nao dispara onChange.
    evento.target.value = '';
    if (arquivo) aoEnviar(arquivo);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label text-texto-secondary">{titulo}</span>
      <div className="flex items-center gap-3">
        {temImagem ? (
          <img
            src={url}
            alt={titulo}
            className="h-12 w-12 rounded-campo border border-borda-subtle bg-surface-sunken object-contain"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-campo border border-dashed border-borda-subtle text-label text-texto-disabled">
            —
          </div>
        )}
        <input ref={inputRef} type="file" accept={aceita} className="hidden" onChange={aoMudarArquivo} />
        <Botao variante="secundaria" ocupado={ocupado} onClick={() => inputRef.current?.click()}>
          {temImagem ? 'Trocar' : 'Enviar'}
        </Botao>
        {temImagem && (
          <Botao variante="fantasma" disabled={ocupado} onClick={aoRemover}>
            Remover
          </Botao>
        )}
      </div>
    </div>
  );
}

export function DadosEmpresaPagina() {
  const perfil = useAutenticacao((estado) => estado.usuario?.perfil);
  const { data: empresa, isLoading } = useDadosEmpresa();
  const queryClient = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    values: paraFormulario(empresa),
  });

  const mutacaoDados = useMutation({
    mutationFn: atualizarDadosEmpresa,
    onSuccess: (atualizada) => {
      queryClient.setQueryData(chaveDadosEmpresa, atualizada);
      mostrarToast('Dados da empresa salvos');
    },
  });

  function mutacaoImagem(rotulo: string) {
    return {
      onSuccess: (atualizada: DadosDaEmpresa) => {
        queryClient.setQueryData(chaveDadosEmpresa, atualizada);
        mostrarToast(`${rotulo} salvo`);
      },
      onError: (erro: unknown) => {
        mostrarToast(separarErro(erro).geral ?? `Não foi possível salvar o ${rotulo.toLowerCase()}.`, 'pending' as const);
      },
    };
  }

  const mutacaoLogoClaro = useMutation({ mutationFn: atualizarLogoClaro, ...mutacaoImagem('Logotipo claro') });
  const mutacaoLogoEscuro = useMutation({ mutationFn: atualizarLogoEscuro, ...mutacaoImagem('Logotipo escuro') });
  const mutacaoFavicon = useMutation({ mutationFn: atualizarFavicon, ...mutacaoImagem('Favicon') });

  const erroDeFormulario = separarErro(mutacaoDados.error);
  const erroDe = (campo: keyof Formulario): string | undefined =>
    errors[campo]?.message ?? erroDeFormulario.porCampo[campo];

  async function buscarCep() {
    const cep = (getValues('cep') ?? '').replace(/\D/g, '');
    if (cep.length !== 8) {
      mostrarToast('Informe um CEP com 8 dígitos', 'pending');
      return;
    }

    setBuscandoCep(true);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados = (await resposta.json()) as RespostaViaCep;
      if (!resposta.ok || dados.erro) {
        mostrarToast('CEP não encontrado', 'pending');
        return;
      }
      setValue('logradouro', dados.logradouro ?? '');
      setValue('bairro', dados.bairro ?? '');
      setValue('cidade', dados.localidade ?? '');
      setValue('uf', dados.uf ?? '');
    } catch {
      mostrarToast('Não foi possível consultar o CEP agora. Preencha manualmente.', 'pending');
    } finally {
      setBuscandoCep(false);
    }
  }

  async function enviarImagem(mutacao: typeof mutacaoLogoClaro, arquivo: File) {
    const { base64, mime } = await lerArquivoComoBase64(arquivo);
    mutacao.mutate({ dados_base64: base64, mime });
  }

  function removerImagem(mutacao: typeof mutacaoLogoClaro) {
    mutacao.mutate({ dados_base64: '', mime: '' });
  }

  if (perfil !== 'ADMIN') {
    return (
      <div className="mx-auto flex max-w-[600px] flex-col gap-4">
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          Acesso restrito a administradores.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <p className="text-body text-texto-secondary">Carregando dados da empresa…</p>;
  }

  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Dados da empresa</h1>
        <p className="text-body text-texto-secondary">
          Identificação, endereço e logotipo — aparecem no cabeçalho e na tela de login de
          todo mundo que usa o sistema.
        </p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit((valores) => mutacaoDados.mutate(valores as CorpoAtualizarEmpresa))}
        className="flex flex-col gap-6"
      >
        <section className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
          <h2 className="text-subtitle text-texto-primary">Identificação</h2>
          {erroDeFormulario.geral && (
            <p
              role="alert"
              className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
            >
              {erroDeFormulario.geral}
            </p>
          )}

          <Campo rotulo="Razão social" obrigatorio erro={erroDe('razao_social')} {...register('razao_social')} />
          <div className="grid gap-4 md:grid-cols-2">
            <Campo rotulo="Nome fantasia" erro={erroDe('nome_fantasia')} {...register('nome_fantasia')} />
            <Campo rotulo="CNPJ" tipoDado="codigo" ajuda="Com ou sem pontuação" erro={erroDe('cnpj')} {...register('cnpj')} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Campo rotulo="Inscrição estadual" erro={erroDe('inscricao_estadual')} {...register('inscricao_estadual')} />
            <Campo rotulo="Inscrição municipal" erro={erroDe('inscricao_municipal')} {...register('inscricao_municipal')} />
            <Campo rotulo="CNAE" erro={erroDe('cnae')} {...register('cnae')} />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
          <h2 className="text-subtitle text-texto-primary">Endereço</h2>
          <div className="flex items-end gap-2">
            <div className="w-[200px]">
              <Campo rotulo="CEP" tipoDado="codigo" erro={erroDe('cep')} {...register('cep')} />
            </div>
            <Botao variante="secundaria" ocupado={buscandoCep} rotuloOcupado="Buscando…" onClick={buscarCep}>
              Buscar CEP
            </Botao>
          </div>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <Campo rotulo="Logradouro" erro={erroDe('logradouro')} {...register('logradouro')} />
            <Campo rotulo="Número" erro={erroDe('numero')} {...register('numero')} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo rotulo="Complemento" erro={erroDe('complemento')} {...register('complemento')} />
            <Campo rotulo="Bairro" erro={erroDe('bairro')} {...register('bairro')} />
          </div>
          <div className="grid gap-4 md:grid-cols-[3fr_1fr]">
            <Campo rotulo="Cidade" erro={erroDe('cidade')} {...register('cidade')} />
            <Campo rotulo="UF" tipoDado="codigo" erro={erroDe('uf')} {...register('uf')} />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
          <h2 className="text-subtitle text-texto-primary">Contato</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Campo rotulo="Telefone" erro={erroDe('telefone')} {...register('telefone')} />
            <Campo rotulo="E-mail institucional" type="email" erro={erroDe('email')} {...register('email')} />
            <Campo rotulo="Site" erro={erroDe('site')} {...register('site')} />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
          <h2 className="text-subtitle text-texto-primary">Documentos</h2>
          <Campo rotulo="Texto de rodapé padrão" erro={erroDe('rodape_padrao')} {...register('rodape_padrao')} />
          <Campo
            rotulo="Condições gerais de compra"
            erro={erroDe('condicoes_gerais_compra')}
            {...register('condicoes_gerais_compra')}
          />
          <Campo rotulo="Responsável técnico" erro={erroDe('responsavel_tecnico')} {...register('responsavel_tecnico')} />
        </section>

        <div className="flex items-center justify-end gap-2">
          <Botao type="submit" icone="save" ocupado={mutacaoDados.isPending} rotuloOcupado="Salvando…">
            Salvar
          </Botao>
        </div>
      </form>

      <section className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
        <h2 className="text-subtitle text-texto-primary">Logotipo</h2>
        <p className="text-label text-texto-secondary">
          PNG ou SVG, até 1&nbsp;MB. O favicon aceita só PNG, até 200&nbsp;KB.
        </p>

        <CampoLogotipo
          titulo="Logotipo (tema claro)"
          aceita="image/png,image/svg+xml"
          temImagem={empresa?.tem_logo_claro}
          url={urlLogoClaro(empresa?.updated_at)}
          ocupado={mutacaoLogoClaro.isPending}
          aoEnviar={(arquivo) => enviarImagem(mutacaoLogoClaro, arquivo)}
          aoRemover={() => removerImagem(mutacaoLogoClaro)}
        />
        <CampoLogotipo
          titulo="Logotipo (tema escuro)"
          aceita="image/png,image/svg+xml"
          temImagem={empresa?.tem_logo_escuro}
          url={urlLogoEscuro(empresa?.updated_at)}
          ocupado={mutacaoLogoEscuro.isPending}
          aoEnviar={(arquivo) => enviarImagem(mutacaoLogoEscuro, arquivo)}
          aoRemover={() => removerImagem(mutacaoLogoEscuro)}
        />
        <CampoLogotipo
          titulo="Favicon"
          aceita="image/png"
          temImagem={empresa?.tem_favicon}
          url={urlFavicon(empresa?.updated_at)}
          ocupado={mutacaoFavicon.isPending}
          aoEnviar={(arquivo) => enviarImagem(mutacaoFavicon, arquivo)}
          aoRemover={() => removerImagem(mutacaoFavicon)}
        />
      </section>
    </div>
  );
}
