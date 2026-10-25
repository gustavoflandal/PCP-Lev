# Gestão de Usuários — Design (Fase 2.2b)

Referência: `docs/0_SUMARIO_EXECUTIVO.md` §4.7.3 (cadastro de usuários, permissões
individuais, política de senha) e a spec da 2.2a (`2026-10-24-rbac-design.md`). Decidida de
forma autônoma (decisão do usuário de 24/10/2026).

## 1. Por que agora

Até aqui o sistema não tinha **nenhuma** forma de criar usuário — só o `admin` semeado. Sem
isso, os perfis da 2.2a não têm a quem ser atribuídos.

## 2. Escopo

- **Cadastro** (§4.7.3): nome, usuário (login, imutável), e-mail, matrícula, telefone, setor,
  perfil, data de admissão e de desligamento, **situação** `ATIVO` / `INATIVO` / `BLOQUEADO`.
  Usuário **nunca é excluído** — só inativado (preserva o histórico de apontamentos e a
  trilha de auditoria).
- **Senha inicial e redefinição pelo Administrador**: ele informa uma senha temporária; o
  usuário é **obrigado a trocá-la** no próximo acesso (§4.7.3 "troca obrigatória no primeiro
  acesso"). Tela de **troca de senha** (obrigatória e voluntária, pelo menu).
- **Permissões individuais** (§4.7.3): conceder ou retirar uma permissão de um usuário,
  sobrepondo o perfil, **com justificativa obrigatória** (mín. 10 caracteres), registrada na
  trilha de auditoria.
- **Efeito imediato**: as permissões passam a ser resolvidas pelo **usuário no banco**
  (perfil atual, situação, troca obrigatória, permissões individuais), não pelo perfil
  gravado no token. Trocar o perfil, inativar ou bloquear vale na requisição seguinte — o
  usuário inativo/bloqueado recebe 401 e é levado ao login.

Fora (registrado): foto, vínculo com filial e com centro de trabalho padrão (centro de
trabalho chega na Fase 2.3), bloqueio automático após N tentativas (o rate limit por IP da
Fase 4 cobre o ataque; o bloqueio de conta fica para quando houver política de senha
parametrizável), MFA, sessão única, encerramento remoto, reuso de senha, SSO.

## 3. Regras de segurança (sem escalada de privilégio)

Quem tem `configuracoes.usuarios`:

- **não altera a si mesmo** (perfil, situação, permissões individuais, senha pela tela de
  usuários — a própria senha é pela troca de senha);
- só atribui perfil **cujas permissões ele mesmo tem** (o perfil ADMIN, só um ADMIN atribui);
- só **concede** individualmente o que ele mesmo tem (retirar é livre);
- não inativa/bloqueia o **último Administrador ativo**;
- não cria permissões individuais em usuário ADMIN (ADMIN tem tudo, sempre).

## 4. Modelo (migration 015)

- `usuarios`: `matricula` (única, opcional), `telefone`, `setor`, `situacao`,
  `data_admissao`, `data_desligamento`, `deve_trocar_senha`. A coluna `ativo` vira **gerada**
  (`situacao = 'ATIVO'`), para o código existente que a lê seguir valendo.
- `usuario_permissoes` (`usuario_id`, `permissao_codigo`, `concedida`, `justificativa`,
  `created_by`, `created_at`; único por usuário+permissão) + trilha de auditoria.
- Permissão nova no catálogo: `configuracoes.usuarios` (sensível).

## 5. Aplicação

- Resolvedor: `acesso.Servico.AcessoDoUsuario(id)` → `{ativo, deveTrocarSenha, permissões}`
  com cache (geração + TTL 60 s), invalidado em toda escrita de usuário ou perfil.
  Permissões efetivas = (ADMIN ? catálogo inteiro : perfil) + concedidas − retiradas; vazio
  se não ativo ou se a troca de senha está pendente.
- `ExigirPermissao`: usuário não ativo → **401** "Usuário inativo ou bloqueado"; troca de senha
  pendente → **403** `TROCA_DE_SENHA_OBRIGATORIA`.
- `/auth/eu` e login devolvem `deve_trocar_senha`; o frontend leva para a troca antes de
  qualquer outra tela.
- Testes: o helper de token cria um usuário real por perfil (antes, todos os tokens de teste
  tinham `ID: 1`, o admin).

## 6. API (`configuracoes.usuarios`)

- `GET /usuarios` (busca, perfil, situação, paginação), `GET /usuarios/:id`
- `POST /usuarios` (com `senha_temporaria`), `PUT /usuarios/:id`
- `POST /usuarios/:id/situacao` (`situacao`, `data_desligamento` opcional)
- `POST /usuarios/:id/redefinir-senha` (`senha_temporaria`)
- `GET /usuarios/:id/permissoes` (individuais + efetivas),
  `PUT /usuarios/:id/permissoes/:codigo` (`concedida`, `justificativa`),
  `DELETE /usuarios/:id/permissoes/:codigo`
