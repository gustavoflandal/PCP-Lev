import { ModalDocumentosDoCadastro } from '@/componentes/arquivos/DocumentosDoCadastro';
import { useDocumentosDoCadastro } from '@/componentes/arquivos/linkDocumentos';
import { Badge, BadgeSituacao } from '@/componentes/ui/Badge';
import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useCadastroCrud } from '@/hooks/useCadastroCrud';
import { useListagem } from '@/hooks/useListagem';
import { formatarCNPJ, formatarData } from '@/lib/formato';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { OPCOES_TIPO_CLIENTE, ROTULO_TIPO_CLIENTE, type Cliente } from '@/tipos/cadastros';
import { FormularioCliente } from './FormularioCliente';

/** Data de hoje no fuso do navegador, em AAAA-MM-DD (o mesmo formato da API). */
function hojeLocal(agora: Date = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * Contrato vencido e so um aviso: o cliente continua utilizavel. AAAA-MM-DD
 * compara certo como texto; o ultimo dia da vigencia ainda vale.
 */
function contratoVencido(vigenciaFim: string | null | undefined, hoje: string = hojeLocal()): boolean {
  return Boolean(vigenciaFim) && (vigenciaFim as string).slice(0, 10) < hoje;
}

function Vigencia({ cliente }: { cliente: Cliente }) {
  const { vigencia_inicio: inicio, vigencia_fim: fim } = cliente;
  if (!inicio && !fim) return null;
  let texto: string;
  if (inicio && fim) texto = `${formatarData(inicio)} a ${formatarData(fim)}`;
  else if (inicio) texto = `desde ${formatarData(inicio)}`;
  else texto = `até ${formatarData(fim ?? undefined)}`;
  return <span className="text-label text-texto-secondary">{texto}</span>;
}

export function Clientes() {
  const podeIncluir = usePode(PERMISSOES.clientesIncluir);
  const podeEditar = usePode(PERMISSOES.clientesEditar);
  const podeInativar = usePode(PERMISSOES.clientesInativar);
  // Documentos (3.1): ver vem com a propria tela; anexar e remover, com editar.
  const documentos = useDocumentosDoCadastro();

  const lista = useListagem<Cliente>('clientes', 'razao_social');
  const crud = useCadastroCrud<Cliente>('clientes', {
    criado: 'Cliente cadastrado',
    atualizado: 'Cliente atualizado',
    inativado: 'Cliente inativado',
  });

  const hoje = hojeLocal();

  const colunas: Coluna<Cliente>[] = [
    {
      chave: 'razao_social',
      rotulo: 'Razão social',
      ordenavel: true,
      renderizar: (c) => (
        <span className="flex flex-col">
          <span>{c.razao_social}</span>
          {c.nome_fantasia && <span className="text-label text-texto-secondary">{c.nome_fantasia}</span>}
        </span>
      ),
    },
    {
      chave: 'tipo',
      rotulo: 'Tipo',
      ordenavel: true,
      renderizar: (c) => ROTULO_TIPO_CLIENTE[c.tipo] ?? c.tipo,
    },
    {
      chave: 'cnpj',
      rotulo: 'CNPJ',
      ordenavel: true,
      renderizar: (c) => <span className="font-mono">{formatarCNPJ(c.cnpj)}</span>,
    },
    {
      chave: 'cidade',
      rotulo: 'Cidade/UF',
      ordenavel: true,
      renderizar: (c) => (c.cidade || c.uf ? [c.cidade, c.uf].filter(Boolean).join('/') : '—'),
    },
    {
      chave: 'vigencia_fim',
      rotulo: 'Contrato',
      ordenavel: true,
      renderizar: (c) =>
        c.numero_contrato || c.vigencia_inicio || c.vigencia_fim ? (
          <span className="flex flex-col items-start gap-1">
            {c.numero_contrato && <span className="font-mono">{c.numero_contrato}</span>}
            <Vigencia cliente={c} />
            {contratoVencido(c.vigencia_fim, hoje) && (
              <Badge tom="warning" icone="alert-triangle">
                Contrato vencido
              </Badge>
            )}
          </span>
        ) : (
          '—'
        ),
    },
    { chave: 'ativo', rotulo: 'Situação', renderizar: (c) => <BadgeSituacao ativo={c.ativo} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Clientes</h1>
        <p className="text-body text-texto-secondary">
          Quem compra os painéis: órgãos públicos, concessionárias e integradores, com o contrato vigente.
        </p>
      </div>

      <BarraDeFiltros
        busca={lista.busca}
        aoBuscar={lista.definirBusca}
        rotuloBusca="Buscar por razão social, CNPJ, cidade ou contrato"
        filtroAtivo={lista.filtroAtivo}
        aoFiltrarSituacao={lista.definirFiltroAtivo}
        filtrosExtras={
          <div className="w-[200px]">
            <Selecao
              rotulo="Tipo"
              placeholder="Todos"
              opcoes={OPCOES_TIPO_CLIENTE}
              value={lista.filtros.tipo ?? ''}
              onChange={(evento) => lista.definirFiltro('tipo', evento.target.value)}
            />
          </div>
        }
      >
        {podeIncluir && (
          <Botao icone="plus" onClick={crud.abrirNovo}>
            Novo cliente
          </Botao>
        )}
      </BarraDeFiltros>

      <div>
        <Tabela<Cliente>
          rotulo="Clientes"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(c) => c.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhum cliente encontrado. Ajuste os filtros ou cadastre um cliente."
          acoes={(c) => (
            <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
              <Botao
                variante="fantasma"
                icone="paperclip"
                aria-label={`Documentos de ${c.razao_social}`}
                onClick={() => documentos.abrir({ id: c.id, nome: c.razao_social })}
              >
                Documentos
              </Botao>
              {podeEditar && (
                <Botao
                  variante="fantasma"
                  icone="pencil"
                  aria-label={`Editar ${c.razao_social}`}
                  onClick={() => crud.abrirEdicao(c)}
                >
                  Editar
                </Botao>
              )}
              {podeInativar && c.ativo && (
                <Botao
                  variante="fantasma"
                  icone="trash-2"
                  aria-label={`Inativar ${c.razao_social}`}
                  onClick={() => crud.pedirInativacao(c)}
                >
                  Inativar
                </Botao>
              )}
            </span>
          )}
        />
        <Paginacao
          pagina={lista.paginacao.pagina}
          totalPaginas={lista.paginacao.total_paginas}
          total={lista.paginacao.total}
          aoMudar={lista.definirPagina}
        />
      </div>

      <Modal
        aberto={crud.formularioAberto}
        aoFechar={crud.fecharFormulario}
        titulo={crud.emEdicao ? 'Editar cliente' : 'Novo cliente'}
        descricao="Campos com * são obrigatórios."
      >
        <FormularioCliente
          // A chave remonta o formulario ao trocar de registro.
          key={crud.emEdicao?.id ?? 'novo'}
          inicial={crud.emEdicao ?? undefined}
          ocupado={crud.salvando}
          erroGeral={crud.erroGeral}
          errosPorCampo={crud.errosPorCampo}
          aoEnviar={crud.salvar}
          aoCancelar={crud.fecharFormulario}
        />
      </Modal>

      <ModalDocumentosDoCadastro
        entidade="cliente"
        registro={documentos.aberto}
        podeEditar={podeEditar}
        aoFechar={documentos.fechar}
      />

      <Confirmacao
        aberto={crud.aInativar !== null}
        titulo="Inativar cliente"
        mensagem={
          crud.aInativar
            ? `Inativar o cliente ${crud.aInativar.razao_social}? Ele deixa de aparecer nas listas de seleção. O histórico é preservado.`
            : ''
        }
        rotuloConfirmar="Inativar"
        rotuloOcupado="Inativando…"
        ocupado={crud.inativando}
        aoConfirmar={crud.confirmarInativacao}
        aoCancelar={crud.cancelarInativacao}
      />
    </div>
  );
}
