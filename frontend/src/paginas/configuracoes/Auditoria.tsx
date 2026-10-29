import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, type TomBadge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { marcar, t, td } from '@/i18n';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import { baixarArquivo } from '@/lib/arquivos';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarDataHora } from '@/lib/formato';
import { listarAuditoria, queryDeExportacaoAuditoria } from '@/servicos/auditoria';
import type { FiltrosAuditoria, OperacaoAuditoria, RegistroAuditoria } from '@/tipos/auditoria';
import { PERMISSOES, usePode } from '@/lib/permissoes';

const LIMITE = 20;

/** Espelha auditoria.TabelasAuditadas no backend (migration 007) -- so o
 * rotulo de exibicao muda aqui, a lista de valores tem que bater com o que
 * o backend aceita no filtro `tabela`. */
const tabelasAuditadas = () => [
  { valor: 'usuarios', rotulo: t('Usuários') },
  { valor: 'fornecedores', rotulo: t('Fornecedores') },
  { valor: 'clientes', rotulo: t('Clientes') },
  { valor: 'produtos_acabados', rotulo: t('Produtos acabados') },
  { valor: 'partes_pecas', rotulo: t('Partes e peças') },
  { valor: 'estrutura_produto', rotulo: t('Estrutura de produtos') },
  { valor: 'itens_estrutura_produto', rotulo: t('Itens de estrutura') },
  { valor: 'centros_trabalho', rotulo: t('Centros de trabalho') },
  { valor: 'cotacoes', rotulo: t('Cotações') },
  { valor: 'pedidos_compra', rotulo: t('Pedidos de compra') },
  { valor: 'pedidos_venda', rotulo: t('Pedidos de venda') },
  { valor: 'itens_pedido_venda', rotulo: t('Itens de pedido de venda') },
  { valor: 'ordens_producao', rotulo: t('Ordens de produção') },
  { valor: 'apontamento_producao', rotulo: t('Apontamentos') },
  { valor: 'numeros_serie', rotulo: t('Números de série') },
  { valor: 'metrologia_serie', rotulo: t('Metrologia') },
  { valor: 'reserva_estoque', rotulo: t('Reserva de estoque') },
  { valor: 'configuracao_negocio', rotulo: t('Parâmetros de negócio') },
  { valor: 'configuracao_smtp', rotulo: t('Servidor de e-mail') },
  { valor: 'perfis', rotulo: t('Perfis de acesso') },
  { valor: 'perfil_permissoes', rotulo: t('Permissões dos perfis') },
  { valor: 'usuario_permissoes', rotulo: t('Permissões individuais') },
  // Migrations 018/019 (v1.2): anexos, recebimento fiscal, lotes e series.
  { valor: 'anexos', rotulo: t('Anexos (fotos e documentos)') },
  { valor: 'fornecedor_itens', rotulo: t('Itens do fornecedor (de-para)') },
  { valor: 'notas_fiscais_entrada', rotulo: t('Notas fiscais de entrada') },
  { valor: 'itens_nf_entrada', rotulo: t('Itens de nota fiscal de entrada') },
  { valor: 'lotes', rotulo: t('Lotes') },
  { valor: 'series_componente', rotulo: t('Séries de componentes') },
];

const operacoes = () => [
  { valor: 'INSERT', rotulo: t('Incluído') },
  { valor: 'UPDATE', rotulo: t('Alterado') },
  { valor: 'DELETE', rotulo: t('Excluído') },
];

const ROTULO_OPERACAO: Record<OperacaoAuditoria, string> = {
  INSERT: marcar('Incluído'),
  UPDATE: marcar('Alterado'),
  DELETE: marcar('Excluído'),
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
  return tabelasAuditadas().find((item) => item.valor === tabela)?.rotulo ?? tabela;
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'boolean') return valor ? t('Sim') : t('Não');
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
  const autorizado = usePode(PERMISSOES.configAuditoria);
  const podeExportar = usePode(PERMISSOES.configAuditoriaExportar);
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
    // O backend ja rejeita quem nao e ADMIN com 403; sem isto, um nao-admin
    // que abrisse a URL direto dispararia a requisicao mesmo caindo na
    // mensagem de acesso restrito logo abaixo.
    enabled: autorizado,
  });

  const erro = consulta.error ? (separarErro(consulta.error).geral ?? t('Não foi possível carregar a auditoria.')) : null;

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
      mostrarToast(separarErro(erroExportacao).geral ?? t('Não foi possível exportar a auditoria.'), 'pending');
    } finally {
      definirExportando(false);
    }
  }

  const colunas: Coluna<RegistroAuditoria>[] = [
    { chave: 'data_hora', rotulo: t('Data/hora'), renderizar: (r) => formatarDataHora(r.data_hora) },
    { chave: 'usuario_nome', rotulo: t('Usuário'), renderizar: (r) => r.usuario_nome ?? '—' },
    { chave: 'tabela', rotulo: t('Tabela'), renderizar: (r) => rotuloDaTabela(r.tabela) },
    {
      chave: 'operacao',
      rotulo: t('Ação'),
      renderizar: (r) => (
        <Badge tom={TOM_OPERACAO[r.operacao]} icone={ICONE_OPERACAO[r.operacao]}>
          {td(ROTULO_OPERACAO[r.operacao])}
        </Badge>
      ),
    },
    { chave: 'endereco_ip', rotulo: 'IP', renderizar: (r) => r.endereco_ip ?? '—' },
  ];

  if (!autorizado) {
    return (
      <div className="mx-auto flex max-w-[600px] flex-col gap-4">
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          {t('Acesso restrito: seu perfil não tem permissão para esta tela.')}
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
        <h1 className="text-title text-texto-primary">{t('Auditoria')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Trilha de alterações do sistema — quem, quando e o que mudou em cada registro.')}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-[160px]">
            <Campo
              rotulo={t('De')}
              type="date"
              value={dataInicio}
              onChange={(evento) => aoMudarFiltro(() => definirDataInicio(evento.target.value))}
            />
          </div>
          <div className="w-[160px]">
            <Campo
              rotulo={t('Até')}
              type="date"
              value={dataFim}
              onChange={(evento) => aoMudarFiltro(() => definirDataFim(evento.target.value))}
            />
          </div>
          <div className="w-[220px]">
            <Selecao
              rotulo={t('Tabela')}
              placeholder={t('Todas')}
              opcoes={tabelasAuditadas()}
              value={tabela}
              onChange={(evento) => aoMudarFiltro(() => definirTabela(evento.target.value))}
            />
          </div>
          <div className="w-[160px]">
            <Selecao
              rotulo={t('Ação')}
              placeholder={t('Todas')}
              opcoes={operacoes()}
              value={operacao}
              onChange={(evento) => aoMudarFiltro(() => definirOperacao(evento.target.value))}
            />
          </div>
        </div>

        {podeExportar && (
          <Botao variante="secundaria" icone="save" ocupado={exportando} rotuloOcupado={t('Exportando…')} onClick={exportar}>
            {t('Exportar CSV')}
          </Botao>
        )}
      </div>

      <div>
        <Tabela<RegistroAuditoria>
          rotulo={t('Auditoria')}
          colunas={colunas}
          itens={consulta.data?.itens ?? []}
          chaveDe={(r) => r.id}
          ordenarPor="data_hora"
          ordem="desc"
          aoOrdenar={() => {}}
          carregando={consulta.isPending}
          erro={erro}
          aoTentarDeNovo={() => void consulta.refetch()}
          vazio={t('Nenhum registro de auditoria para os filtros selecionados.')}
          acoes={(r) => (
            <Botao variante="fantasma" onClick={() => definirRegistroEmDetalhe(r)}>
              {t('Ver detalhes')}
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
        titulo={t('Detalhes da alteração')}
        descricao={
          registroEmDetalhe
            ? `${rotuloDaTabela(registroEmDetalhe.tabela)} · ${formatarDataHora(registroEmDetalhe.data_hora)}`
            : undefined
        }
      >
        {diferencas.length === 0 ? (
          <p className="text-body text-texto-secondary">{t('Nenhum campo com valor registrado para este evento.')}</p>
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
