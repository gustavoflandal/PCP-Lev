package middleware

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

// chaveAutorizador identifica o resolvedor de permissoes no contexto.
const chaveAutorizador = "pcp_autorizador"

// errSemAutorizador e falha de montagem do roteador (falta Autorizacao):
// vira 500, nunca "usuario inativo" (o frontend deslogaria a pessoa).
var errSemAutorizador = errors.New("autorizador ausente no contexto -- falta middleware.Autorizacao no roteador")

// CodigoTrocaDeSenha sinaliza ao frontend que a sessao so serve para trocar
// a senha (senha inicial ou redefinida pelo Administrador).
const CodigoTrocaDeSenha = "TROCA_DE_SENHA_OBRIGATORIA"

// CodigoUsuarioInativo e o 401 de quem foi bloqueado ou inativado com a
// sessao aberta -- o frontend explica o motivo no login (nao "sessao expirada").
const CodigoUsuarioInativo = "USUARIO_INATIVO"

// MensagemUsuarioInativo acompanha CodigoUsuarioInativo.
const MensagemUsuarioInativo = "Usuario inativo ou bloqueado, procure o administrador"

// Autorizador resolve o acesso efetivo de um usuario (RBAC, doc 0 secao
// 4.7.3) -- implementado por acesso.Servico, com cache.
type Autorizador interface {
	AcessoDoUsuario(ctx context.Context, usuarioID int64) (acesso.Acesso, error)
}

// Autorizacao publica o Autorizador no contexto de toda requisicao. Global
// (e.Use), para ExigirPermissao ser uma funcao simples nos handlers -- sem
// mudar a assinatura de Registrar.
func Autorizacao(autorizador Autorizador) echo.MiddlewareFunc {
	return func(proximo echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set(chaveAutorizador, autorizador)
			return proximo(c)
		}
	}
}

// ExigirPermissao restringe a rota a quem tem a permissao (ex.:
// acesso.FornecedoresIncluir). Vai depois de Autenticacao. Usuario inativo
// ou bloqueado DEPOIS do login responde 401 (o frontend leva ao login);
// troca de senha pendente responde 403 TROCA_DE_SENHA_OBRIGATORIA.
func ExigirPermissao(permissao string) echo.MiddlewareFunc {
	return func(proximo echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims := ClaimsDoContexto(c)
			if claims == nil {
				return httpx.NaoAutorizado(c, "Token de acesso ausente")
			}
			a, err := acessoDaRequisicao(c)
			if errors.Is(err, acesso.ErrUsuarioNaoEncontrado) {
				return httpx.NaoAutorizado(c, "Usuario nao encontrado")
			}
			if err != nil {
				slog.Error("falha ao resolver permissoes", "usuario_id", claims.UsuarioID, "erro", err)
				return httpx.ErroInterno(c)
			}
			switch {
			case !a.Ativo:
				return httpx.Erro(c, http.StatusUnauthorized, CodigoUsuarioInativo, MensagemUsuarioInativo)
			case a.DeveTrocarSenha:
				return httpx.Erro(c, http.StatusForbidden, CodigoTrocaDeSenha, "Troque a senha antes de continuar")
			case !a.Permissoes[permissao]:
				return httpx.AcessoNegado(c, "Seu perfil nao tem permissao para esta operacao")
			}
			return proximo(c)
		}
	}
}

// TemPermissao diz se o usuario da requisicao tem a permissao -- para regras
// dentro de um handler (ex.: emitir acima da alcada), alem do bloqueio da rota.
func TemPermissao(c echo.Context, permissao string) (bool, error) {
	a, err := acessoDaRequisicao(c)
	if err != nil {
		return false, err
	}
	return a.Ativo && !a.DeveTrocarSenha && a.Permissoes[permissao], nil
}

// AcessoDaRequisicao expoe o acesso resolvido para handlers que precisam
// dele inteiro (ex.: regras contra escalada de privilegio).
func AcessoDaRequisicao(c echo.Context) (acesso.Acesso, error) { return acessoDaRequisicao(c) }

func acessoDaRequisicao(c echo.Context) (acesso.Acesso, error) {
	claims := ClaimsDoContexto(c)
	if claims == nil {
		return acesso.Acesso{}, acesso.ErrUsuarioNaoEncontrado
	}
	autorizador, ok := c.Get(chaveAutorizador).(Autorizador)
	if !ok {
		return acesso.Acesso{}, errSemAutorizador
	}
	return autorizador.AcessoDoUsuario(c.Request().Context(), claims.UsuarioID)
}
