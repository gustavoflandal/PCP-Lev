import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/componentes/ui/Badge';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { formatarData } from '@/lib/formato';
import { ErroApi } from '@/servicos/api';
import { listarVencimentosMetrologia } from '@/servicos/producao';
import type { VencimentoMetrologia } from '@/tipos/producao';

const OPCOES_DIAS = [
  { valor: '30', rotulo: 'Próximos 30 dias' },
  { valor: '60', rotulo: 'Próximos 60 dias' },
  { valor: '90', rotulo: 'Próximos 90 dias' },
];

export function Metrologia() {
  const [dias, definirDias] = useState('30');
  const consulta = useQuery({
    queryKey: ['metrologia', 'vencimentos', dias],
    queryFn: () => listarVencimentosMetrologia(Number(dias)),
  });

  const colunas: Coluna<VencimentoMetrologia>[] = [
    {
      chave: 'numero',
      rotulo: 'Número de série',
      renderizar: (v) => (
        <Link to={`/rastreabilidade/${encodeURIComponent(v.numero)}`} className="font-mono text-brand hover:underline">
          {v.numero}
        </Link>
      ),
    },
    {
      chave: 'produto',
      rotulo: 'Produto',
      renderizar: (v) => (
        <span>
          <span className="font-mono">{v.produto_codigo}</span> — {v.produto_descricao}
        </span>
      ),
    },
    { chave: 'cliente', rotulo: 'Cliente', renderizar: (v) => v.cliente_nome || '—' },
    { chave: 'lacre', rotulo: 'Lacre', renderizar: (v) => <span className="font-mono">{v.numero_lacre}</span> },
    { chave: 'validade', rotulo: 'Validade', renderizar: (v) => formatarData(v.validade) },
    {
      chave: 'situacao',
      rotulo: 'Situação',
      renderizar: (v) =>
        v.vencida ? (
          <Badge tom="pending" icone="alert-triangle">
            Vencida
          </Badge>
        ) : (
          <Badge tom="warning" icone="clock">
            A vencer
          </Badge>
        ),
    },
  ];

  const erro = consulta.error
    ? consulta.error instanceof ErroApi
      ? consulta.error.message
      : 'Não foi possível carregar os vencimentos. Tente de novo.'
    : null;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Metrologia</h1>
        <p className="text-body text-texto-secondary">
          Unidades com verificação metrológica (Inmetro) vencida ou a vencer — programe a reverificação com o cliente.
        </p>
      </div>
      <div className="w-[220px]">
        <Selecao rotulo="Período" opcoes={OPCOES_DIAS} value={dias} onChange={(e) => definirDias(e.target.value)} />
      </div>
      <Tabela<VencimentoMetrologia>
        rotulo="Vencimentos de metrologia"
        colunas={colunas}
        itens={consulta.data ?? []}
        chaveDe={(v) => v.serie_id}
        ordenarPor="validade"
        ordem="asc"
        aoOrdenar={() => {}}
        carregando={consulta.isPending}
        erro={erro}
        aoTentarDeNovo={() => void consulta.refetch()}
        vazio="Nenhuma verificação vencida ou a vencer no período."
      />
    </div>
  );
}
