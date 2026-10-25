import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { linkDocumentosDoCadastro } from '@/componentes/arquivos/linkDocumentos';
import { SeloValidade } from '@/componentes/arquivos/SeloValidade';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { formatarData } from '@/lib/formato';
import { ErroApi } from '@/servicos/api';
import { listarVencimentosDocumentos } from '@/servicos/arquivos';
import { ROTULO_ENTIDADE, type VencimentoDocumento } from '@/tipos/arquivos';

const OPCOES_PRAZO = [
  { valor: '30', rotulo: 'Próximos 30 dias' },
  { valor: '60', rotulo: 'Próximos 60 dias' },
  { valor: '90', rotulo: 'Próximos 90 dias' },
];

const SEM_ORDENACAO = () => {};

/** Cadastros com link direto para os documentos (Fase 3.1). */
const ROTA_DO_CADASTRO: Partial<Record<VencimentoDocumento['entidade'], string>> = {
  fornecedor: '/fornecedores',
  cliente: '/clientes',
};

/** Fornecedor e cliente vem pela razao social (texto); produto e peca, pelo codigo (mono). */
function Registro({ v }: { v: VencimentoDocumento }) {
  const rota = ROTA_DO_CADASTRO[v.entidade];
  const texto = v.entidade_codigo || `nº ${v.entidade_id}`;
  if (rota) {
    return (
      <Link
        to={linkDocumentosDoCadastro(rota, v.entidade_id, v.entidade_codigo)}
        aria-label={`Abrir documentos de ${texto}`}
        className="text-brand hover:underline"
      >
        {texto}
      </Link>
    );
  }
  return <span className="font-mono">{texto}</span>;
}

/**
 * Documentos vigentes (certificados, laudos, contratos) de produto, peca,
 * fornecedor e cliente vencidos ou a vencer. Decisao da tela: o que renovar
 * antes que o recebimento, a compra ou a expedicao travem. Cada entidade so
 * aparece para quem pode ve-la (o backend filtra).
 */
export function DocumentosVencimentos() {
  const [dias, definirDias] = useState('30');
  const consulta = useQuery({
    queryKey: ['anexos', 'vencimentos', dias],
    queryFn: () => listarVencimentosDocumentos(Number(dias)),
  });

  const colunas: Coluna<VencimentoDocumento>[] = [
    {
      chave: 'registro',
      rotulo: 'Cadastro',
      renderizar: (v) => (
        <span className="flex flex-col">
          <span className="text-label text-texto-secondary">{ROTULO_ENTIDADE[v.entidade] ?? v.entidade}</span>
          <Registro v={v} />
        </span>
      ),
    },
    { chave: 'categoria', rotulo: 'Categoria', renderizar: (v) => v.categoria },
    { chave: 'titulo', rotulo: 'Título', renderizar: (v) => v.titulo || '—' },
    { chave: 'validade', rotulo: 'Validade', renderizar: (v) => <span className="tabular">{formatarData(v.data_validade)}</span> },
    { chave: 'situacao', rotulo: 'Situação', renderizar: (v) => <SeloValidade validade={v.data_validade} /> },
  ];

  const itens = consulta.data ?? [];
  const vencidos = itens.filter((v) => v.vencido).length;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Documentos a vencer</h1>
        <p className="text-body text-texto-secondary">
          Versões vigentes de documentos de produtos, peças, fornecedores e clientes já vencidas ou com validade no
          prazo escolhido. Para renovar, envie uma nova versão do documento no cadastro: em Mídia e documentos
          (produto e peça) ou em Documentos (fornecedor e cliente).
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-[220px]">
          <Selecao rotulo="Prazo" opcoes={OPCOES_PRAZO} value={dias} onChange={(e) => definirDias(e.target.value)} />
        </div>
        {consulta.isSuccess && (
          <p className="text-body text-texto-secondary" aria-live="polite">
            <span className="font-mono tabular">{itens.length}</span> {itens.length === 1 ? 'documento' : 'documentos'}
            {vencidos > 0 && (
              <>
                {' '}· <span className="font-mono tabular">{vencidos}</span> {vencidos === 1 ? 'vencido' : 'vencidos'}
              </>
            )}
          </p>
        )}
      </div>

      <Tabela<VencimentoDocumento>
        rotulo="Documentos a vencer"
        colunas={colunas}
        itens={itens}
        chaveDe={(v) => v.anexo_id}
        ordenarPor=""
        ordem="asc"
        aoOrdenar={SEM_ORDENACAO}
        carregando={consulta.isPending}
        erro={
          consulta.error
            ? consulta.error instanceof ErroApi
              ? consulta.error.message
              : 'Não foi possível carregar os documentos. Tente de novo.'
            : null
        }
        aoTentarDeNovo={() => void consulta.refetch()}
        vazio="Nenhum documento vencido ou vencendo neste prazo."
      />
    </div>
  );
}
