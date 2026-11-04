import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import { t, td } from '@/i18n';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarDataHora } from '@/lib/formato';
import {
  chaveChavesApi,
  chaveEndpointsApi,
  criarChaveApi,
  listarChavesApi,
  listarEndpointsApi,
  revogarChaveApi,
} from '@/servicos/integracao';
import type { ChaveApi, ChaveApiCriada, EndpointIntegracao } from '@/tipos/integracao';

const CLASSE_AVISO =
  'rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending';

const CLASSE_BLOCO_CODIGO =
  'overflow-x-auto whitespace-pre-wrap break-all rounded-campo border border-borda-subtle bg-surface-sunken p-3 font-mono text-label text-texto-primary';

/** Copia para a area de transferencia; false quando o navegador nao permite. */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function urlBase(): string {
  return window.location.origin;
}

/** Exemplo de chamada pronto para colar no terminal. */
function exemploCurl(endpoint: EndpointIntegracao): string {
  const caminho = endpoint.caminho.replace(/\{[^}]+\}/g, '1');
  return `curl -H "X-API-Key: SUA_CHAVE" "${urlBase()}${caminho}"`;
}

function BotaoCopiar({ texto, rotulo, aoCopiar }: { texto: string; rotulo: string; aoCopiar: (ok: boolean) => void }) {
  return (
    <Botao variante="secundaria" icone="clipboard-list" aria-label={rotulo} onClick={() => void copiar(texto).then(aoCopiar)}>
      {t('Copiar')}
    </Botao>
  );
}

/** Dialogo de criacao: formulario e, depois de criada, o segredo (so desta vez). */
function NovaChave({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const [nome, definirNome] = useState('');
  const [descricao, definirDescricao] = useState('');
  const [criada, definirCriada] = useState<ChaveApiCriada | null>(null);

  const mutacao = useMutation({
    mutationFn: () => criarChaveApi({ nome: nome.trim(), descricao: descricao.trim() }),
    onSuccess: (resposta) => {
      definirCriada(resposta);
      void clienteQuery.invalidateQueries({ queryKey: chaveChavesApi });
    },
  });
  const { geral, porCampo } = separarErro(mutacao.error);

  function fechar() {
    definirNome('');
    definirDescricao('');
    definirCriada(null);
    mutacao.reset();
    aoFechar();
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo={criada ? t('Chave criada') : t('Nova chave de API')}
      descricao={criada ? undefined : t('A chave identifica o ERP nas consultas. Crie uma por sistema.')}
      rodape={
        criada ? (
          <Botao onClick={fechar}>{t('Concluir')}</Botao>
        ) : (
          <>
            <Botao variante="secundaria" onClick={fechar} disabled={mutacao.isPending}>
              {t('Cancelar')}
            </Botao>
            <Botao
              icone="plus"
              ocupado={mutacao.isPending}
              rotuloOcupado={t('Criando…')}
              disabled={nome.trim() === ''}
              onClick={() => mutacao.mutate()}
            >
              {t('Criar chave')}
            </Botao>
          </>
        )
      }
    >
      {criada ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className={CLASSE_AVISO}>
            {t('Copie a chave agora e guarde-a em local seguro. Por segurança, ela não será mostrada de novo.')}
          </p>
          <p className="text-label text-texto-secondary">{criada.nome}</p>
          <pre aria-label={t('Chave de API')} className={CLASSE_BLOCO_CODIGO}>
            {criada.chave}
          </pre>
          <div className="flex justify-end">
            <BotaoCopiar
              texto={criada.chave}
              rotulo={t('Copiar a chave de API')}
              aoCopiar={(ok) => mostrarToast(ok ? t('Chave copiada') : t('Não foi possível copiar. Selecione e copie manualmente.'), ok ? 'done' : 'pending')}
            />
          </div>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (nome.trim() !== '') mutacao.mutate();
          }}
        >
          {geral && (
            <p role="alert" className={CLASSE_AVISO}>
              {geral}
            </p>
          )}
          <Campo
            rotulo={t('Nome')}
            obrigatorio
            ajuda={t('Ex.: ERP Protheus — produção')}
            maxLength={80}
            value={nome}
            onChange={(evento) => definirNome(evento.target.value)}
            erro={porCampo.nome}
          />
          <Campo
            rotulo={t('Descrição')}
            maxLength={255}
            value={descricao}
            onChange={(evento) => definirDescricao(evento.target.value)}
            erro={porCampo.descricao}
          />
        </form>
      )}
    </Modal>
  );
}

/** Detalhe de um endpoint: parametros, exemplo de resposta e chamada de exemplo. */
function DetalheEndpoint({ endpoint, aoFechar }: { endpoint: EndpointIntegracao | null; aoFechar: () => void }) {
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const curl = endpoint ? exemploCurl(endpoint) : '';

  return (
    <Modal
      aberto={endpoint !== null}
      aoFechar={aoFechar}
      titulo={endpoint ? `${endpoint.metodo} ${endpoint.caminho}` : ''}
      descricao={endpoint ? td(endpoint.descricao) : undefined}
      largura="larga"
    >
      {endpoint && (
        <div className="flex flex-col gap-5">
          <section aria-label={t('Parâmetros')} className="flex flex-col gap-2">
            <h3 className="text-subtitle text-texto-primary">{t('Parâmetros')}</h3>
            <div className="overflow-x-auto border border-borda-subtle">
              <table className="w-full border-collapse" aria-label={t('Parâmetros do endpoint')}>
                <thead>
                  <tr className="bg-surface-sunken">
                    <th scope="col" className="border-b border-borda-subtle px-3 py-2 text-left text-label text-texto-secondary">{t('Nome')}</th>
                    <th scope="col" className="border-b border-borda-subtle px-3 py-2 text-left text-label text-texto-secondary">{t('Onde')}</th>
                    <th scope="col" className="border-b border-borda-subtle px-3 py-2 text-left text-label text-texto-secondary">{t('Descrição')}</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.parametros.map((p) => (
                    <tr key={p.nome} className="min-h-linha">
                      <td className="border-b border-borda-subtle px-3 py-2 font-mono text-body text-texto-primary">{p.nome}</td>
                      <td className="border-b border-borda-subtle px-3 py-2 text-body text-texto-primary">
                        {p.onde === 'caminho' ? t('Caminho') : t('Consulta')}
                      </td>
                      <td className="border-b border-borda-subtle px-3 py-2 text-body text-texto-primary">{td(p.descricao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-label={t('Exemplo de chamada')} className="flex flex-col gap-2">
            <h3 className="text-subtitle text-texto-primary">{t('Exemplo de chamada')}</h3>
            <pre className={CLASSE_BLOCO_CODIGO}>{curl}</pre>
            <div className="flex justify-end">
              <BotaoCopiar
                texto={curl}
                rotulo={t('Copiar o exemplo de chamada')}
                aoCopiar={(ok) => mostrarToast(ok ? t('Exemplo copiado') : t('Não foi possível copiar. Selecione e copie manualmente.'), ok ? 'done' : 'pending')}
              />
            </div>
          </section>

          <section aria-label={t('Exemplo de resposta')} className="flex flex-col gap-2">
            <h3 className="text-subtitle text-texto-primary">{t('Exemplo de resposta')}</h3>
            <pre className={CLASSE_BLOCO_CODIGO}>{endpoint.exemplo}</pre>
          </section>
        </div>
      )}
    </Modal>
  );
}

export function ApisIntegracao() {
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const [criando, definirCriando] = useState(false);
  const [aRevogar, definirARevogar] = useState<ChaveApi | null>(null);
  const [emDetalhe, definirEmDetalhe] = useState<EndpointIntegracao | null>(null);

  const chaves = useQuery({ queryKey: chaveChavesApi, queryFn: listarChavesApi });
  const endpoints = useQuery({ queryKey: chaveEndpointsApi, queryFn: listarEndpointsApi, staleTime: 5 * 60_000 });

  const revogacao = useMutation({
    mutationFn: (chave: ChaveApi) => revogarChaveApi(chave.id),
    onSuccess: () => {
      definirARevogar(null);
      void clienteQuery.invalidateQueries({ queryKey: chaveChavesApi });
      mostrarToast(t('Chave revogada'));
    },
    onError: () => definirARevogar(null),
  });
  const { geral: erroRevogacao } = separarErro(revogacao.error);

  const colunasChaves: Coluna<ChaveApi>[] = [
    {
      chave: 'nome',
      rotulo: t('Nome'),
      renderizar: (c) => (
        <span className="flex flex-col">
          <span>{c.nome}</span>
          {c.descricao && <span className="text-label text-texto-secondary">{c.descricao}</span>}
        </span>
      ),
    },
    { chave: 'prefixo', rotulo: t('Chave'), renderizar: (c) => <span className="font-mono">{c.prefixo}…</span> },
    {
      chave: 'situacao',
      rotulo: t('Situação'),
      renderizar: (c) =>
        c.ativo ? (
          <Badge tom="done" icone="check-circle-2">
            {t('Ativa')}
          </Badge>
        ) : (
          <Badge tom="neutral" icone="ban">
            {t('Revogada')}
          </Badge>
        ),
    },
    { chave: 'criada', rotulo: t('Criada em'), renderizar: (c) => formatarDataHora(c.created_at) },
    {
      chave: 'ultimo_uso',
      rotulo: t('Último uso'),
      renderizar: (c) => (c.ultimo_uso ? formatarDataHora(c.ultimo_uso) : t('Nunca usada')),
    },
  ];

  const colunasEndpoints: Coluna<EndpointIntegracao>[] = [
    {
      chave: 'metodo',
      rotulo: t('Método'),
      renderizar: (e) => (
        <Badge tom="neutral" icone="eye">
          {e.metodo}
        </Badge>
      ),
    },
    { chave: 'caminho', rotulo: t('Caminho'), renderizar: (e) => <span className="font-mono">{e.caminho}</span> },
    { chave: 'recurso', rotulo: t('Recurso'), renderizar: (e) => td(e.recurso) },
    { chave: 'descricao', rotulo: t('Descrição'), renderizar: (e) => td(e.descricao) },
  ];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div>
        <h1 className="text-title text-texto-primary">{t('APIs Integração')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Consultas somente leitura para o ERP buscar os dados do PCP. Cada chamada leva a chave de API no cabeçalho X-API-Key.')}
        </p>
      </div>

      <section aria-label={t('Como usar')} className="flex flex-col gap-2 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
        <h2 className="text-subtitle text-texto-primary">{t('Como usar')}</h2>
        <p className="text-body text-texto-secondary">{t('Endereço base das APIs:')}</p>
        <pre className={CLASSE_BLOCO_CODIGO}>{`${urlBase()}/api/integracao/v1`}</pre>
        <p className="text-label text-texto-secondary">
          {t('As respostas são JSON no mesmo formato do sistema. As listas são paginadas (pagina, limite até 200). Chave ausente, errada ou revogada responde 401.')}
        </p>
      </section>

      <section aria-label={t('Chaves de API')} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-subtitle text-texto-primary">{t('Chaves de API')}</h2>
          <Botao icone="plus" onClick={() => definirCriando(true)}>
            {t('Nova chave')}
          </Botao>
        </div>
        {erroRevogacao && (
          <p role="alert" className={CLASSE_AVISO}>
            {erroRevogacao}
          </p>
        )}
        <Tabela<ChaveApi>
          rotulo={t('Chaves de API')}
          colunas={colunasChaves}
          itens={chaves.data ?? []}
          chaveDe={(c) => c.id}
          ordenarPor="criada"
          ordem="desc"
          aoOrdenar={() => {}}
          carregando={chaves.isPending}
          erro={chaves.isError ? t('Não foi possível carregar as chaves de API.') : null}
          aoTentarDeNovo={() => void chaves.refetch()}
          vazio={t('Nenhuma chave criada. Crie a primeira para liberar o acesso do ERP.')}
          acoes={(c) =>
            c.ativo ? (
              <Botao
                variante="fantasma"
                icone="ban"
                aria-label={t('Revogar a chave {nome}', { nome: c.nome })}
                onClick={() => definirARevogar(c)}
              >
                {t('Revogar')}
              </Botao>
            ) : null
          }
        />
      </section>

      <section aria-label={t('Endpoints disponíveis')} className="flex flex-col gap-3">
        <h2 className="text-subtitle text-texto-primary">{t('Endpoints disponíveis')}</h2>
        <Tabela<EndpointIntegracao>
          rotulo={t('Endpoints disponíveis')}
          colunas={colunasEndpoints}
          itens={endpoints.data ?? []}
          chaveDe={(e) => `${e.metodo} ${e.caminho}`}
          ordenarPor="recurso"
          ordem="asc"
          aoOrdenar={() => {}}
          carregando={endpoints.isPending}
          erro={endpoints.isError ? t('Não foi possível carregar a documentação das APIs.') : null}
          aoTentarDeNovo={() => void endpoints.refetch()}
          vazio={t('Nenhum endpoint documentado.')}
          aoClicarLinha={(e) => definirEmDetalhe(e)}
          acoes={(e) => (
            <Botao
              variante="fantasma"
              icone="eye"
              aria-label={t('Ver detalhes de {caminho}', { caminho: e.caminho })}
              onClick={() => definirEmDetalhe(e)}
            >
              {t('Detalhes')}
            </Botao>
          )}
        />
      </section>

      <NovaChave aberto={criando} aoFechar={() => definirCriando(false)} />
      <DetalheEndpoint endpoint={emDetalhe} aoFechar={() => definirEmDetalhe(null)} />

      <Confirmacao
        aberto={aRevogar !== null}
        titulo={t('Revogar chave de API')}
        mensagem={
          aRevogar
            ? t('Revogar a chave {nome}? O ERP que a usa passa a receber 401 na próxima chamada. Não é possível desfazer: seria preciso criar outra chave.', { nome: aRevogar.nome })
            : ''
        }
        rotuloConfirmar={t('Revogar')}
        rotuloOcupado={t('Revogando…')}
        ocupado={revogacao.isPending}
        aoConfirmar={() => aRevogar && revogacao.mutate(aRevogar)}
        aoCancelar={() => definirARevogar(null)}
      />
    </div>
  );
}
