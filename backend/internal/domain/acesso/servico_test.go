package acesso_test

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// editorAdmin edita como o Administrador (tem tudo, entao concede tudo).
func editorAdmin() acesso.Editor {
	todas := map[string]bool{}
	for _, p := range acesso.Catalogo {
		todas[p] = true
	}
	return acesso.Editor{Perfil: acesso.PerfilAdmin, Permissoes: todas}
}

func montar(t *testing.T) (*acesso.Servico, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return acesso.NovoServico(repository.NovoAcessoRepositorio(pool)), pool
}

// O catalogo mora em dois lugares (constantes Go e seed da migration 014):
// este teste e o que impede um handler de exigir uma permissao que nenhum
// perfil consegue receber, ou a tela de mostrar uma que nada aplica.
func TestCatalogoDoBancoEIgualAoDoCodigo(t *testing.T) {
	servico, _ := montar(t)

	catalogo, err := servico.Catalogo(context.Background())

	require.NoError(t, err)
	codigos := make([]string, len(catalogo))
	for i, p := range catalogo {
		codigos[i] = p.Codigo
		assert.NotEmpty(t, p.Descricao, p.Codigo)
	}
	assert.Equal(t, acesso.Catalogo, codigos, "mesma lista e mesma ordem")
}

func TestMatrizSemeadaSegueASpec(t *testing.T) {
	ctx := context.Background()
	servico, _ := montar(t)
	tem := func(perfil, permissao string) bool {
		conjunto, err := servico.PermissoesDoPerfil(ctx, perfil)
		require.NoError(t, err)
		return conjunto[permissao]
	}

	// ADMIN: tudo, por regra.
	for _, p := range acesso.Catalogo {
		assert.True(t, tem("ADMIN", p), "ADMIN %s", p)
	}
	// GESTOR: operacional completo, sem configuracoes tecnicas nem acima da alcada.
	assert.True(t, tem("GESTOR", acesso.EstoqueAjustar))
	assert.True(t, tem("GESTOR", acesso.ConfigAuditoria))
	assert.False(t, tem("GESTOR", acesso.ConfigIntegracoes))
	assert.False(t, tem("GESTOR", acesso.ConfigPerfis))
	assert.False(t, tem("GESTOR", acesso.PedidosEmitirAcimaAlcada))
	// COMPRADOR: emite, nao recebe nem ajusta estoque.
	assert.True(t, tem("COMPRADOR", acesso.PedidosEmitir))
	assert.False(t, tem("COMPRADOR", acesso.PedidosReceber))
	assert.False(t, tem("COMPRADOR", acesso.EstoqueAjustar))
	// ALMOXARIFE: recebe e ajusta, nao emite.
	assert.True(t, tem("ALMOXARIFE", acesso.PedidosReceber))
	assert.True(t, tem("ALMOXARIFE", acesso.EstoqueAjustar))
	assert.False(t, tem("ALMOXARIFE", acesso.PedidosEmitir))
	// OPERADOR: so consulta.
	assert.True(t, tem("OPERADOR", acesso.EstruturaVisualizar))
	assert.False(t, tem("OPERADOR", acesso.FornecedoresVisualizar))
	// CONSULTA: ve e exporta, nao altera.
	assert.True(t, tem("CONSULTA", acesso.CotacoesVisualizar))
	assert.True(t, tem("CONSULTA", acesso.EstoqueExportar))
	assert.False(t, tem("CONSULTA", acesso.FornecedoresIncluir))
	assert.False(t, tem("CONSULTA", acesso.ConfigAuditoria))
	// Perfil inexistente: nada.
	assert.False(t, tem("NAO_EXISTE", acesso.FornecedoresVisualizar))
}

func TestCriarEditarEExcluirPerfilPersonalizado(t *testing.T) {
	ctx := context.Background()
	servico, _ := montar(t)

	criado, err := servico.CriarPerfil(ctx, editorAdmin(), "comprador_junior", acesso.Dados{
		Nome: "Comprador júnior", Permissoes: []string{acesso.CotacoesVisualizar, acesso.CotacoesIncluir, acesso.CotacoesIncluir},
	}, "admin")
	require.NoError(t, err)
	assert.Equal(t, "COMPRADOR_JUNIOR", criado.Codigo, "codigo normalizado para maiusculas")
	assert.False(t, criado.Sistema)
	assert.Equal(t, []string{acesso.CotacoesVisualizar, acesso.CotacoesIncluir}, criado.Permissoes, "sem repetidas")

	_, err = servico.CriarPerfil(ctx, editorAdmin(), "COMPRADOR_JUNIOR", acesso.Dados{Nome: "Outro"}, "admin")
	assert.ErrorIs(t, err, acesso.ErrCodigoDuplicado)

	editado, err := servico.AtualizarPerfil(ctx, editorAdmin(), "COMPRADOR_JUNIOR", acesso.Dados{
		Nome: "Comprador júnior", Permissoes: []string{acesso.CotacoesVisualizar, acesso.FornecedoresVisualizar},
	}, "admin")
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{acesso.CotacoesVisualizar, acesso.FornecedoresVisualizar}, editado.Permissoes)

	require.NoError(t, servico.ExcluirPerfil(ctx, "COMPRADOR_JUNIOR"))
	_, err = servico.BuscarPerfil(ctx, "COMPRADOR_JUNIOR")
	assert.ErrorIs(t, err, acesso.ErrPerfilNaoEncontrado)
}

func TestEdicaoInvalidaOCache(t *testing.T) {
	ctx := context.Background()
	servico, _ := montar(t)
	antes, err := servico.PermissoesDoPerfil(ctx, "VENDAS")
	require.NoError(t, err)
	require.False(t, antes[acesso.CotacoesVisualizar])

	_, err = servico.AtualizarPerfil(ctx, editorAdmin(), "VENDAS", acesso.Dados{
		Nome: "Vendas", Permissoes: []string{acesso.ProdutosVisualizar, acesso.CotacoesVisualizar},
	}, "admin")
	require.NoError(t, err)

	depois, err := servico.PermissoesDoPerfil(ctx, "VENDAS")
	require.NoError(t, err)
	assert.True(t, depois[acesso.CotacoesVisualizar], "a autorizacao ve a mudanca na hora")
	assert.False(t, depois[acesso.EstoqueVisualizar], "o que saiu da lista foi retirado")
}

func TestRegrasDeProtecao(t *testing.T) {
	ctx := context.Background()
	servico, pool := montar(t)

	_, err := servico.AtualizarPerfil(ctx, editorAdmin(), "ADMIN", acesso.Dados{Nome: "Admin"}, "admin")
	assert.ErrorIs(t, err, acesso.ErrAdminImutavel)

	assert.ErrorIs(t, servico.ExcluirPerfil(ctx, "GESTOR"), acesso.ErrPerfilDoSistema)

	_, err = servico.CriarPerfil(ctx, editorAdmin(), "TEMP", acesso.Dados{Nome: "Temporario"}, "admin")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `UPDATE usuarios SET perfil = 'TEMP' WHERE username = 'admin'`)
	require.NoError(t, err)
	assert.ErrorIs(t, servico.ExcluirPerfil(ctx, "TEMP"), acesso.ErrPerfilEmUso)

	_, err = servico.CriarPerfil(ctx, editorAdmin(), "1INVALIDO", acesso.Dados{Nome: "x"}, "admin")
	assert.ErrorIs(t, err, acesso.ErrCodigoInvalido)
	_, err = servico.CriarPerfil(ctx, editorAdmin(), "OUTRO", acesso.Dados{Nome: "x", Permissoes: []string{"nao.existe"}}, "admin")
	assert.ErrorIs(t, err, acesso.ErrPermissaoDesconhecida)
}

func TestUsuarioSoAceitaPerfilExistente(t *testing.T) {
	ctx := context.Background()
	_, pool := montar(t)

	_, err := pool.Exec(ctx, `UPDATE usuarios SET perfil = 'NAO_EXISTE' WHERE username = 'admin'`)

	assert.Error(t, err, "FK usuarios.perfil -> perfis.codigo")
}

// Regra que impede configuracoes.perfis de virar "ADMIN na pratica".
func TestEditorSemSerAdmin(t *testing.T) {
	ctx := context.Background()
	servico, _ := montar(t)
	// O editor tem tudo o que o OPERADOR tem, mais configurar perfis.
	operador, err := servico.BuscarPerfil(ctx, "OPERADOR")
	require.NoError(t, err)
	permissoes := map[string]bool{acesso.ConfigPerfis: true}
	for _, p := range operador.Permissoes {
		permissoes[p] = true
	}
	gestor := acesso.Editor{Perfil: "GESTOR", Permissoes: permissoes}

	_, err = servico.AtualizarPerfil(ctx, gestor, "GESTOR", acesso.Dados{Nome: "Gestor", Permissoes: []string{acesso.ConfigIntegracoes}}, "gestor")
	assert.ErrorIs(t, err, acesso.ErrProprioPerfil, "nao edita o proprio perfil")

	_, err = servico.AtualizarPerfil(ctx, gestor, "OPERADOR", acesso.Dados{
		Nome: "Operador", Permissoes: append(append([]string(nil), operador.Permissoes...), acesso.ConfigIntegracoes),
	}, "gestor")
	assert.ErrorIs(t, err, acesso.ErrConcederSemTer, "nao concede o que nao tem")

	// Perfil que ele domina: retirar e manter, ok.
	_, err = servico.AtualizarPerfil(ctx, gestor, "OPERADOR", acesso.Dados{
		Nome: "Operador", Permissoes: operador.Permissoes[:len(operador.Permissoes)-1],
	}, "gestor")
	assert.NoError(t, err)

	// Perfil com permissoes que ele nao tem: nem retirar (esvaziaria um
	// perfil mais poderoso que o seu).
	_, err = servico.AtualizarPerfil(ctx, gestor, "COMPRADOR", acesso.Dados{Nome: "Comprador", Permissoes: nil}, "gestor")
	assert.ErrorIs(t, err, acesso.ErrPerfilAcimaDoEditor)

	_, err = servico.CriarPerfil(ctx, gestor, "NOVO", acesso.Dados{Nome: "Novo", Permissoes: []string{acesso.ConfigBanco}}, "gestor")
	assert.ErrorIs(t, err, acesso.ErrConcederSemTer)
}

// O frontend tem a sua copia dos codigos (frontend/src/lib/permissoes.ts). Este
// teste roda quando o repositorio inteiro esta disponivel (no container de
// testes, so com o backend montado, ele e pulado -- ver ledger).
func TestCatalogoDoFrontendIgualAoDoCodigo(t *testing.T) {
	bruto, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "frontend", "src", "lib", "permissoes.ts"))
	if err != nil {
		t.Skip("frontend fora do alcance deste ambiente de teste")
	}
	codigos := regexp.MustCompile(`'([a-z_]+\.[a-z_]+)'`).FindAllStringSubmatch(string(bruto), -1)
	frontend := make([]string, 0, len(codigos))
	for _, c := range codigos {
		frontend = append(frontend, c[1])
	}
	assert.ElementsMatch(t, acesso.Catalogo, frontend)
}
