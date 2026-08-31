import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, type TomBadge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import { baixarArquivo } from '@/lib/arquivos';
import { separarErro } from '@/lib/errosDeFormulario';
import { listarAuditoria, queryDeExportacaoAuditoria } from '@/servicos/auditoria';
import { useAutenticacao } from '@/store/autenticacao';
import type { FiltrosAuditoria, OperacaoAuditoria, RegistroAuditoria } from '@/tipos/auditoria';

const LIMITE = 20;

/** Espelha auditoria.TabelasAuditadas no backend (migration 007) -- so o
 * rotulo de exibicao muda aqui, a lista de valores tem que bater com o que
 * o backend aceita no filtro `tabela`. */
const TABELAS_AUDITADAS = [
  { valor: 'usuarios', rotulo: 'Usuários' },
  { valor: 'fornecedores', rotulo: 'Fornecedores' },
  { valor: 'produtos_acabados', rotulo: 'Produtos acabados' },
  { valor: 'partes_pecas', rotulo: 'Partes e peças' },
  { valor: 'estrutura_produto', rotulo: 'Estrutura de produtos' },
  { valor: 'itens_estrutura_produto', rotulo: 'Itens de estrutura' },
  { valor: 'cotacoes', rotulo: 'Cotações' },
  { valor: 'pedidos_compra', rotulo: 'Pedidos de compra' },
  { valor: 'pedidos_venda', rotulo: 'Pedidos de venda' },
  { valor: 'ordens_producao', rotulo: 'Ordens de produção' },
  { valor: 'reserva_estoque', rotulo: 'Reserva de estoque' },
];

const OPERACOES = [
  { valor: 'INSERT', rotulo: 'Incluído' },
  { valor: 'UPDATE', rotulo: 'Alterado' },
  { valor: 'DELETE', rotulo: 'Excluído' },
];

const ROTULO_OPERACAO: Record<OperacaoAuditoria, string> = {
  INSERT: 'Incluído',
  UPDATE: 'Alterado',
  DELETE: 'Excluído',
};

const TOM_OPERACAO: Record<OperacaoAuditoria, TomBadge> = {
  INSERT: 'done',
  UPDATE: 'warning',
  DELETE: 'pending',
};

const ICONE_OPERACAO = {
  INSERT: 'check-circle-2',
  UPDATE: 'pencil',
  DELETE: 'trash-2',
} as const;

function rotuloDaTabela(tabela: string): string {
  return TABELAS_AUDITADAS.find((t) => t.valor === tabela)?.rotulo ?? tabela;
}

/** A API guarda em UTC (doc 0, secao 4.6.4); o navegador converte para o
 * fuso local ao ler o ISO string, entao so falta escolher o formato pt-BR. */
function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()} ${hora}:${minuto}`;
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

interface CampoAlterado {
  campo: string;
  anterior: unknown;
  atual: unknown;
}

/** Compara campo a campo em vez de mostrar o JSON cru -- ilegivel para quem
 * nao e desenvolvedor. Funciona para os tres tipos de operacao sem
 * casos especiais: um INSERT nao tem `antigos`, entao todo campo de
 * `novos` aparece como "anterior: —"; o inverso vale para DELETE. */
function calcularDiferencas(
  antigos: Record<string, unknown> | undefined,
  novos: Record<string, unknown> | undefined,
): CampoAlterado[] {
  const campos = new Set([...Object.keys(antigos ?? {}), ...Object.keys(novos ?? {})]);
  const diferencas: CampoAlterado[] = [];
  for (const campo of campos) {
    const anterior = antigos?.[campo];
    const atual = novos?.[campo];
    if (JSON.stringify(anterior) !== JSON.stringify(atual)) {
      diferencas.push({ campo, anterior, atual });
    }
  }
  return diferencas.sort((a, b) => a.campo.localeCompare(b.campo));
}

export function Auditoria() {
  const perfil = useAutenticacao((estado) => estado.usuario?.perfil);
  const mostrarToast = useToasts((estado) => estado.mostrar);

  const [pagina, definirPagina] = useState(1);
  const [dataInicio, definirDataInicio] = useState('');
  const [dataFim, definirDataFim] = useState('');
  const [tabela, definirTabela] = useState('');
  const [operacao, definirOperacao] = useState('');
  const [registroEmDetalhe, definirRegistroEmDetalhe] = useState<RegistroAuditoria | null>(null);
  const [exportando, definirExportando] = useState(false);

  const filtros: FiltrosAuditoria = {
    pagina,
    limite: LIMITE,
    data_inicio: dataInicio || undefined,
    data_fim: dataFim || undefined,
    tabela: tabela || undefined,
    operacao: operacao || undefined,
  };

  const consulta = useQuery({
    queryKey: ['auditoria', filtros],
    queryFn: () => listarAuditoria(filtros),
    placeholderData: keepPreviousData,
  });

  const erro = consulta.error ? (separarErro(consulta.error).geral ?? 'Não foi possível carregar a auditoria.') : null;

  function aoMudarFiltro(aplicar: () => void) {
    aplicar();
    definirPagina(1);
  }

  async function exportar() {
    definirExportando(true);
    try {
      const query = queryDeExportacaoAuditoria({
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
        tabela: tabela || undefined,
        operacao: operacao || undefined,
      });
      await baixarArquivo(`/auditoria/exportar${query ? `?${query}` : ''}`, 'auditoria.csv');
    } catch (erroExportacao) {
      mostrarToast(separarErro(erroExportacao).geral ?? 'Não foi possível exportar a auditoria.', 'pending');
    } finally {
      definirExportando(false);
    }
  }

  const colunas: Coluna<RegistroAuditoria>[] = [
    { chave: 'data_hora', rotulo: 'Data/hora', renderizar: (r) => formatarDataHora(r.data_hora) },
    { chave: 'usuario_nome', rotulo: 'Usuário', renderizar: (r) => r.usuario_nome ?? '—' },
    { chave: 'tabela', rotulo: 'Tabela', renderizar: (r) => rotuloDaTabela(r.tabela) },
    {
      chave: 'operacao',
      rotulo: 'Ação',
      renderizar: (r) => (
        <Badge tom={TOM_OPERACAO[r.operacao]} icone={ICONE_OPERACAO[r.operacao]}>
          {ROTULO_OPERACAO[r.operacao]}
        </Badge>
      ),
    },
    { chave: 'endereco_ip', rotulo: 'IP', renderizar: (r) => r.endereco_ip ?? '—' },
  ];

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

  const diferencas = registroEmDetalhe
    ? calcularDiferencas(registroEmDetalhe.dados_antigos, registroEmDetalhe.dados_novos)
    : [];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Auditoria</h1>
        <p className="text-body text-texto-secondary">
          Trilha de alterações do sistema — quem, quando e o que mudou em cada registro.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-[160px]">
            <Campo
              rotulo="De"
              type="date"
              value={dataInicio}
              onChange={(evento) => aoMudarFiltro(() => definirDataInicio(evento.target.value))}
            />
          </div>
          <div className="w-[160px]">
            <Campo
              rotulo="Até"
              type="date"
              value={dataFim}
              onChange={(evento) => aoMudarFiltro(() => definirDataFim(evento.target.value))}
            />
          </div>
          <div className="w-[220px]">
            <Selecao
              rotulo="Tabela"
              placeholder="Todas"
              opcoes={TABELAS_AUDITADAS}
              value={tabela}
              onChange={(evento) => aoMudarFiltro(() => definirTabela(evento.target.value))}
            />
          </div>
          <div className="w-[160px]">
            <Selecao
              rotulo="Ação"
              placeholder="Todas"
              opcoes={OPERACOES}
              value={operacao}
              onChange={(evento) => aoMudarFiltro(() => definirOperacao(evento.target.value))}
            />
          </div>
        </div>

        <Botao variante="secundaria" icone="save" ocupado={exportando} rotuloOcupado="Exportando…" onClick={exportar}>
          Exportar CSV
        </Botao>
      </div>

      <div>
        <Tabela<RegistroAuditoria>
          rotulo="Auditoria"
          colunas={colunas}
          itens={consulta.data?.itens ?? []}
          chaveDe={(r) => r.id}
          ordenarPor="data_hora"
          ordem="desc"
          aoOrdenar={() => {}}
          carregando={consulta.isPending}
          erro={erro}
          aoTentarDeNovo={() => void consulta.refetch()}
          vazio="Nenhum registro de auditoria para os filtros selecionados."
          acoes={(r) => (
            <Botao variante="fantasma" onClick={() => definirRegistroEmDetalhe(r)}>
              Ver detalhes
            </Botao>
          )}
        />
        <Paginacao
          pagina={consulta.data?.paginacao.pagina ?? pagina}
          totalPaginas={consulta.data?.paginacao.total_paginas ?? 0}
          total={consulta.data?.paginacao.total ?? 0}
          aoMudar={definirPagina}
        />
      </div>

      <Modal
        aberto={registroEmDetalhe !== null}
        aoFechar={() => definirRegistroEmDetalhe(null)}
        titulo="Detalhes da alteração"
        descricao={
          registroEmDetalhe
            ? `${rotuloDaTabela(registroEmDetalhe.tabela)} · ${formatarDataHora(registroEmDetalhe.data_hora)}`
            : undefined
        }
      >
        {diferencas.length === 0 ? (
          <p className="text-body text-texto-secondary">Nenhum campo com valor registrado para este evento.</p>
        ) : (
          <ul className="flex flex-col gap-3 text-body text-texto-primary">
            {diferencas.map((d) => (
              <li key={d.campo} className="flex flex-col gap-1 border-b border-borda-subtle pb-2 last:border-0">
                <span className="text-label text-texto-secondary">{d.campo}</span>
                {registroEmDetalhe?.operacao === 'INSERT' ? (
                  <span className="text-estado-done">{formatarValor(d.atual)}</span>
                ) : registroEmDetalhe?.operacao === 'DELETE' ? (
                  <span className="text-estado-pending line-through">{formatarValor(d.anterior)}</span>
                ) : (
                  <span>
                    <span className="text-estado-pending line-through">{formatarValor(d.anterior)}</span>
                    {' → '}
                    <span className="text-estado-done">{formatarValor(d.atual)}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
