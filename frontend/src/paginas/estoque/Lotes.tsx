import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SeloValidadeLote } from '@/componentes/recebimento/Selos';
import { CaixaMarcacao } from '@/componentes/ui/CaixaMarcacao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useDebounce } from '@/hooks/useDebounce';
import { formatarData } from '@/lib/formato';
import { ErroApi } from '@/servicos/api';
import { listarLotes } from '@/servicos/rastreio';
import type { Lote } from '@/tipos/rastreio';

const OPCOES_VENCIMENTO = [
  { valor: '0', rotulo: 'Qualquer validade' },
  { valor: '7', rotulo: 'Vencendo em 7 dias' },
  { valor: '30', rotulo: 'Vencendo em 30 dias' },
  { valor: '60', rotulo: 'Vencendo em 60 dias' },
  { valor: '90', rotulo: 'Vencendo em 90 dias' },
];

/** /lotes — lotes de componentes com saldo, validade e o caminho "do lote ao campo". */
export function Lotes() {
  const [busca, definirBusca] = useState('');
  const [vencendo, definirVencendo] = useState('0');
  const [comSaldo, definirComSaldo] = useState(true);
  const buscaAdiada = useDebounce(busca);

  const consulta = useQuery({
    queryKey: ['lotes', buscaAdiada, vencendo, comSaldo],
    queryFn: () => listarLotes({ busca: buscaAdiada, vencendo_dias: Number(vencendo), com_saldo: comSaldo }),
    placeholderData: keepPreviousData,
  });

  const colunas: Coluna<Lote>[] = [
    {
      chave: 'numero_lote',
      rotulo: 'Lote',
      renderizar: (l) => (
        <Link to={`/lotes/${l.id}`} className="font-mono text-brand hover:underline">
          {l.numero_lote}
        </Link>
      ),
    },
    {
      chave: 'peca',
      rotulo: 'Peça',
      renderizar: (l) => (
        <span>
          <span className="font-mono">{l.peca_codigo}</span> {l.peca_descricao}
        </span>
      ),
    },
    { chave: 'fornecedor', rotulo: 'Fornecedor', renderizar: (l) => l.fornecedor_nome || '—' },
    { chave: 'fabricacao', rotulo: 'Fabricação', renderizar: (l) => formatarData(l.data_fabricacao ?? undefined) },
    {
      chave: 'validade',
      rotulo: 'Validade',
      renderizar: (l) => (
        <span className="flex flex-wrap items-center gap-2">
          {formatarData(l.validade ?? undefined)}
          <SeloValidadeLote validade={l.validade} vencido={l.vencido} />
        </span>
      ),
    },
    { chave: 'saldo', rotulo: 'Saldo', alinhamento: 'direita', renderizar: (l) => l.quantidade_atual },
    { chave: 'reservado', rotulo: 'Reservado', alinhamento: 'direita', renderizar: (l) => l.quantidade_reservada },
  ];

  const erro = consulta.error
    ? consulta.error instanceof ErroApi
      ? consulta.error.message
      : 'Não foi possível carregar os lotes. Tente de novo.'
    : null;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Lotes</h1>
        <p className="text-body text-texto-secondary">
          Lotes de componentes recebidos por nota fiscal (ou ajuste). Abra um lote para ver de onde veio e onde foi parar.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-[320px] max-w-full">
          <Campo
            rotulo="Buscar por lote ou peça"
            value={busca}
            onChange={(e) => definirBusca(e.target.value)}
            placeholder="Digite para filtrar"
          />
        </div>
        <div className="w-[220px]">
          <Selecao rotulo="Vencimento" opcoes={OPCOES_VENCIMENTO} value={vencendo} onChange={(e) => definirVencendo(e.target.value)} />
        </div>
        <CaixaMarcacao
          className="mb-2"
          rotulo="Só lotes com saldo"
          checked={comSaldo}
          onChange={(e) => definirComSaldo(e.target.checked)}
        />
      </div>

      <Tabela<Lote>
        rotulo="Lotes"
        colunas={colunas}
        itens={consulta.data ?? []}
        chaveDe={(l) => l.id}
        ordenarPor="validade"
        ordem="asc"
        aoOrdenar={() => {}}
        carregando={consulta.isPending}
        erro={erro}
        aoTentarDeNovo={() => void consulta.refetch()}
        vazio={
          vencendo !== '0'
            ? 'Nenhum lote vencendo neste prazo.'
            : 'Nenhum lote encontrado. Os lotes nascem na efetivação da nota fiscal de itens com controle de lote.'
        }
      />
    </div>
  );
}
