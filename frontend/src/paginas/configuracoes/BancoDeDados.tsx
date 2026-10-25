import { useMutation, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { formatarBytes, formatarMilissegundos } from '@/lib/formato';
import { buscarStatusBanco, chaveStatusBanco, testarConexaoBanco } from '@/servicos/banco';
import type { StatusBanco } from '@/tipos/banco';
import { PERMISSOES, usePode } from '@/lib/permissoes';

const CLASSE_AVISO =
  'rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending';

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section
      aria-label={titulo}
      className="flex flex-col gap-3 rounded-cartao border border-borda-subtle bg-surface-raised p-6"
    >
      <h2 className="text-subtitle text-texto-primary">{titulo}</h2>
      {children}
    </section>
  );
}

function Itens({ linhas }: { linhas: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-body">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="contents">
          <dt className="text-texto-secondary">{rotulo}</dt>
          <dd className="text-texto-primary">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function TesteDeConexao() {
  const teste = useMutation({ mutationFn: testarConexaoBanco });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Botao
        variante="secundaria"
        icone="refresh-cw"
        ocupado={teste.isPending}
        rotuloOcupado="Testando…"
        onClick={() => teste.mutate()}
      >
        Testar conexão
      </Botao>
      <p role="status" className="text-body">
        {teste.isSuccess && (
          <span className="text-estado-done">Conexão OK em {formatarMilissegundos(teste.data.latencia_ms)}</span>
        )}
        {teste.isError && <span className="text-estado-pending">Falha ao conectar ao banco de dados.</span>}
      </p>
    </div>
  );
}

function Painel({ status }: { status: StatusBanco }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Cartao titulo="Conexão">
        <Itens
          linhas={[
            ['Situação', <Badge tom="done" icone="check-circle-2">Conectado</Badge>],
            ['Latência', formatarMilissegundos(status.latencia_ms)],
          ]}
        />
        <TesteDeConexao />
      </Cartao>

      <Cartao titulo="Identificação">
        <Itens
          linhas={[
            ['Servidor', <span className="font-mono">{status.host}</span>],
            ['Banco', <span className="font-mono">{status.banco}</span>],
            ['PostgreSQL', status.versao],
          ]}
        />
      </Cartao>

      <Cartao titulo="Pool de conexões">
        <Itens
          linhas={[
            ['Em uso', status.pool.em_uso],
            ['Ociosas', status.pool.ociosas],
            ['Abertas', `${status.pool.total} de ${status.pool.maximo}`],
            ['Ativas no servidor', status.conexoes_ativas],
          ]}
        />
      </Cartao>

      <Cartao titulo="Último backup">
        <p className="text-body text-texto-primary">Nenhum backup registrado.</p>
        <p className="text-label text-texto-secondary">
          O agendamento e o histórico de backups entram com o módulo Backup e Manutenção.
        </p>
      </Cartao>

      <div className="lg:col-span-2">
        <Cartao titulo="Armazenamento">
          <Itens linhas={[['Tamanho do banco', formatarBytes(status.tamanho_bytes)]]} />
          <div className="overflow-x-auto border border-borda-subtle">
            <table className="w-full border-collapse" aria-label="Maiores tabelas">
              <thead>
                <tr className="bg-surface-sunken">
                  <th scope="col" className="border-b border-borda-subtle px-3 py-2 text-left text-label text-texto-secondary">
                    Tabela
                  </th>
                  <th scope="col" className="border-b border-borda-subtle px-3 py-2 text-right text-label text-texto-secondary">
                    Tamanho
                  </th>
                  <th scope="col" className="border-b border-borda-subtle px-3 py-2 text-right text-label text-texto-secondary">
                    Linhas (estimativa)
                  </th>
                </tr>
              </thead>
              <tbody>
                {status.maiores_tabelas.map((tabela) => (
                  <tr key={tabela.tabela} className="border-b border-borda-subtle last:border-b-0">
                    <td className="px-3 py-2 font-mono text-body text-texto-primary">{tabela.tabela}</td>
                    <td className="px-3 py-2 text-right text-body text-texto-primary">{formatarBytes(tabela.tamanho_bytes)}</td>
                    <td className="px-3 py-2 text-right text-body text-texto-primary">
                      {tabela.linhas_estimadas === null ? '—' : tabela.linhas_estimadas.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      </div>
    </div>
  );
}

export function BancoDeDados() {
  const autorizado = usePode(PERMISSOES.configBanco);
  const consulta = useQuery({
    queryKey: chaveStatusBanco,
    queryFn: buscarStatusBanco,
    enabled: autorizado,
    // Diagnostico: sempre o retrato do momento ao abrir a tela.
    staleTime: 0,
  });

  if (!autorizado) {
    return (
      <div className="mx-auto flex max-w-[600px] flex-col gap-4">
        <p role="alert" className={CLASSE_AVISO}>
          Acesso restrito: seu perfil não tem permissão para esta tela.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-texto-primary">Banco de dados</h1>
          <p className="text-body text-texto-secondary">
            Diagnóstico somente leitura. Usuário, senha e string de conexão nunca são exibidos.
          </p>
        </div>
        <Botao
          variante="secundaria"
          icone="refresh-cw"
          ocupado={consulta.isFetching}
          rotuloOcupado="Atualizando…"
          onClick={() => consulta.refetch()}
        >
          Atualizar
        </Botao>
      </div>

      {consulta.isPending && <p className="text-body text-texto-secondary">Consultando o banco de dados…</p>}
      {consulta.isError && (
        <p role="alert" className={CLASSE_AVISO}>
          Não foi possível consultar o banco de dados. Use “Atualizar” para tentar de novo.
        </p>
      )}
      {/* Com erro, nao mostra o retrato anterior: "Conectado" ao lado do
          alerta seria contraditorio justamente na tela de diagnostico. */}
      {consulta.data && !consulta.isError && <Painel status={consulta.data} />}
    </div>
  );
}
