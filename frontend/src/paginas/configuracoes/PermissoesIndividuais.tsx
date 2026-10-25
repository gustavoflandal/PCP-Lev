import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { useToasts } from '@/componentes/ui/Toast';
import { separarErro } from '@/lib/errosDeFormulario';
import { agruparPorModulo, ROTULO_MODULO, ROTULO_PERMISSAO } from '@/lib/rotulosPermissoes';
import {
  chaveUsuarios,
  definirPermissaoIndividual,
  permissoesDoUsuario,
  removerPermissaoIndividual,
} from '@/servicos/usuarios';
import type { PerfilAcesso, PermissaoCatalogo } from '@/tipos/acesso';
import type { PermissoesDoUsuario, Usuario } from '@/tipos/usuarios';

interface Pendente {
  codigo: string;
  concedida: boolean;
}

/**
 * Permissoes de um usuario: as do perfil, mais as concedidas e menos as
 * retiradas so para ele -- sempre com justificativa, que fica na auditoria.
 */
export function PermissoesIndividuais({
  usuario,
  perfil,
  catalogo,
  aoFechar,
}: {
  usuario: Usuario;
  perfil: PerfilAcesso | undefined;
  catalogo: PermissaoCatalogo[];
  aoFechar: () => void;
}) {
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const queryClient = useQueryClient();
  const chave = [...chaveUsuarios, usuario.id, 'permissoes'];
  const consulta = useQuery({ queryKey: chave, queryFn: () => permissoesDoUsuario(usuario.id), staleTime: 0 });
  const [pendente, definirPendente] = useState<Pendente | null>(null);
  const [justificativa, definirJustificativa] = useState('');

  function aplicar(dados: PermissoesDoUsuario) {
    queryClient.setQueryData(chave, dados);
  }

  const definir = useMutation({
    mutationFn: (p: Pendente) => definirPermissaoIndividual(usuario.id, p.codigo, p.concedida, justificativa),
    onSuccess: (dados, p) => {
      aplicar(dados);
      mostrarToast(p.concedida ? 'Permissão concedida' : 'Permissão retirada');
      definirPendente(null);
      definirJustificativa('');
    },
    onError: (erro) => mostrarToast(separarErro(erro).geral ?? 'Não foi possível salvar a permissão.', 'pending'),
  });

  const remover = useMutation({
    mutationFn: (codigo: string) => removerPermissaoIndividual(usuario.id, codigo),
    onSuccess: (dados) => {
      aplicar(dados);
      mostrarToast('Exceção desfeita: vale o que o perfil define');
    },
    onError: (erro) => mostrarToast(separarErro(erro).geral ?? 'Não foi possível desfazer.', 'pending'),
  });

  if (usuario.perfil === 'ADMIN') {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-campo border border-borda-subtle bg-surface-sunken px-3 py-2 text-body text-texto-secondary">
          O Administrador tem todas as permissões. Exceções individuais não se aplicam.
        </p>
        <div className="flex justify-end">
          <Botao variante="secundaria" onClick={aoFechar}>
            Fechar
          </Botao>
        </div>
      </div>
    );
  }

  const doPerfil = new Set(perfil?.permissoes ?? []);
  const individuais = new Map((consulta.data?.individuais ?? []).map((p) => [p.codigo, p]));
  const efetivas = new Set(consulta.data?.efetivas ?? []);
  const justificativaValida = justificativa.trim().length >= 10;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-texto-secondary">
        Perfil <strong className="text-texto-primary">{perfil?.nome ?? usuario.perfil}</strong>. Conceda ou retire uma
        permissão só para esta pessoa — por exemplo, para cobrir as férias de um colega. A justificativa fica registrada na
        auditoria.
      </p>

      {consulta.isPending && <p className="text-body text-texto-secondary">Carregando permissões…</p>}
      {consulta.isError && (
        <p role="alert" className="text-body text-estado-pending">
          Não foi possível carregar as permissões deste usuário.
        </p>
      )}

      {pendente && (
        <form
          aria-label="Justificar exceção"
          className="flex flex-col gap-2 rounded-cartao border border-borda-strong bg-surface-sunken p-4"
          onSubmit={(e) => {
            e.preventDefault();
            definir.mutate(pendente);
          }}
        >
          <p className="text-body text-texto-primary">
            {pendente.concedida ? 'Conceder' : 'Retirar'}:{' '}
            <strong>{ROTULO_PERMISSAO[pendente.codigo] ?? pendente.codigo}</strong>
            {' · '}
            {ROTULO_MODULO[pendente.codigo.split('.')[0]] ?? ''}
          </p>
          <Campo
            rotulo="Justificativa"
            obrigatorio
            autoFocus
            maxLength={255}
            ajuda="Ao menos 10 caracteres. Ex.: cobre as férias do comprador até 30/11."
            value={justificativa}
            onChange={(e) => definirJustificativa(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundaria" onClick={() => definirPendente(null)}>
              Cancelar
            </Botao>
            <Botao type="submit" icone="save" disabled={!justificativaValida} ocupado={definir.isPending} rotuloOcupado="Salvando…">
              Confirmar
            </Botao>
          </div>
        </form>
      )}

      {consulta.data && (
        <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
          {agruparPorModulo(catalogo).map(([modulo, permissoes]) => (
            <fieldset key={modulo} className="flex flex-col rounded-cartao border border-borda-subtle p-3">
              <legend className="px-1 text-label font-medium text-texto-primary">{ROTULO_MODULO[modulo] ?? modulo}</legend>
              <ul className="flex flex-col divide-y divide-borda-subtle">
                {permissoes.map((p) => {
                  const individual = individuais.get(p.codigo);
                  const tem = efetivas.has(p.codigo);
                  const rotulo = ROTULO_PERMISSAO[p.codigo] ?? p.descricao;
                  return (
                    <li key={p.codigo} className="flex min-h-linha flex-wrap items-center justify-between gap-2 py-1">
                      <span className="flex flex-col">
                        <span className="flex items-center gap-2 text-body text-texto-primary">
                          {rotulo}
                          {individual ? (
                            individual.concedida ? (
                              <Badge tom="done" icone="plus">Concedida individualmente</Badge>
                            ) : (
                              <Badge tom="blocked" icone="x">Retirada individualmente</Badge>
                            )
                          ) : doPerfil.has(p.codigo) ? (
                            <Badge tom="neutral" icone="check">Do perfil</Badge>
                          ) : null}
                        </span>
                        {individual && <span className="text-label text-texto-secondary">“{individual.justificativa}”</span>}
                      </span>
                      {individual ? (
                        <Botao
                          variante="fantasma"
                          icone="refresh-cw"
                          aria-label={`Desfazer exceção: ${rotulo}`}
                          ocupado={remover.isPending && remover.variables === p.codigo}
                          onClick={() => remover.mutate(p.codigo)}
                        >
                          Desfazer
                        </Botao>
                      ) : (
                        <Botao
                          variante="fantasma"
                          icone={tem ? 'x' : 'plus'}
                          aria-label={`${tem ? 'Retirar' : 'Conceder'}: ${rotulo}`}
                          onClick={() => {
                            definirJustificativa('');
                            definirPendente({ codigo: p.codigo, concedida: !tem });
                          }}
                        >
                          {tem ? 'Retirar' : 'Conceder'}
                        </Botao>
                      )}
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Botao variante="secundaria" onClick={aoFechar}>
          Fechar
        </Botao>
      </div>
    </div>
  );
}
