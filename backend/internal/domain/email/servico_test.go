package email_test

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/email"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/cripto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type enviadorFalso struct {
	servidor email.Servidor
	msg      email.Mensagem
	erro     error
}

func (e *enviadorFalso) Enviar(_ context.Context, s email.Servidor, m email.Mensagem) error {
	e.servidor, e.msg = s, m
	return e.erro
}

func cofre(t *testing.T) *cripto.Cofre {
	t.Helper()
	c, err := cripto.NovoCofre(base64.StdEncoding.EncodeToString([]byte(strings.Repeat("k", 32))))
	require.NoError(t, err)
	return c
}

func dadosValidos() email.Dados {
	return email.Dados{
		Habilitado: true, Host: "smtp.empresa.com.br", Porta: 587, Criptografia: email.StartTLS,
		Usuario: "pcp@empresa.com.br", RemetenteEmail: "pcp@empresa.com.br", RemetenteNome: "Sistema PCP",
	}
}

func montar(t *testing.T, cifrador email.Cifrador) (*email.Servico, *enviadorFalso, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	enviador := &enviadorFalso{}
	return email.NovoServico(repository.NovoEmailRepositorio(pool), cifrador, enviador), enviador, pool
}

func TestValidar(t *testing.T) {
	casos := map[string]struct {
		mudar func(*email.Dados)
		erro  error
	}{
		"porta 0":           {func(d *email.Dados) { d.Porta = 0 }, email.ErrPortaInvalida},
		"porta 65536":       {func(d *email.Dados) { d.Porta = 65536 }, email.ErrPortaInvalida},
		"criptografia":      {func(d *email.Dados) { d.Criptografia = "SSL" }, email.ErrCriptografiaInvalida},
		"host habilitado":   {func(d *email.Dados) { d.Host = "" }, email.ErrHostObrigatorio},
		"remetente formato": {func(d *email.Dados) { d.RemetenteEmail = "Nome <a@b.com>" }, email.ErrRemetenteInvalido},
		"senha e remover":   {func(d *email.Dados) { d.Senha = "x"; d.RemoverSenha = true }, email.ErrSenhaETrocaConflitantes},
		"usuario sem TLS":   {func(d *email.Dados) { d.Criptografia = email.SemCriptografia }, email.ErrAutenticacaoSemTLS},
		"host longo":        {func(d *email.Dados) { d.Host = strings.Repeat("h", 256) }, email.ErrCampoLongoDemais},
		"nome longo":        {func(d *email.Dados) { d.RemetenteNome = strings.Repeat("n", 101) }, email.ErrCampoLongoDemais},
	}
	for nome, caso := range casos {
		t.Run(nome, func(t *testing.T) {
			d := dadosValidos()
			caso.mudar(&d)
			assert.ErrorIs(t, d.Validar(), caso.erro)
		})
	}

	desligado := email.Dados{Porta: 587, Criptografia: email.StartTLS}
	assert.NoError(t, desligado.Validar(), "desligado, host e remetente podem ficar vazios")
}

func TestAtualizarGravaSenhaCifradaENuncaADevolve(t *testing.T) {
	ctx := context.Background()
	servico, _, pool := montar(t, cofre(t))
	d := dadosValidos()
	d.Senha = "segredo-smtp"

	cfg, err := servico.Atualizar(ctx, d, "admin")

	require.NoError(t, err)
	assert.True(t, cfg.SenhaDefinida)
	var gravada string
	require.NoError(t, pool.QueryRow(ctx, `SELECT senha_cifrada FROM configuracao_smtp`).Scan(&gravada))
	assert.NotContains(t, gravada, "segredo-smtp", "nunca em texto claro no banco")
}

func TestAtualizarSemSenhaMantemAAtualERemoverApaga(t *testing.T) {
	ctx := context.Background()
	servico, enviador, _ := montar(t, cofre(t))
	d := dadosValidos()
	d.Senha = "segredo-smtp"
	_, err := servico.Atualizar(ctx, d, "admin")
	require.NoError(t, err)

	d.Senha = ""
	d.RemetenteNome = "PCP Fabrica" // mesmo destino: host, porta e usuario iguais
	cfg, err := servico.Atualizar(ctx, d, "admin")
	require.NoError(t, err)
	assert.True(t, cfg.SenhaDefinida, "PUT sem senha mantem a gravada")
	require.NoError(t, servico.EnviarTeste(ctx, "destino@empresa.com.br", "admin"))
	assert.Equal(t, "segredo-smtp", enviador.servidor.Senha, "o envio usa a senha decifrada")

	d.RemoverSenha = true
	cfg, err = servico.Atualizar(ctx, d, "admin")
	require.NoError(t, err)
	assert.False(t, cfg.SenhaDefinida)
}

func TestAtualizarComSenhaSemChaveMestraRecusa(t *testing.T) {
	servico, _, _ := montar(t, nil)
	d := dadosValidos()
	d.Senha = "segredo"

	_, err := servico.Atualizar(context.Background(), d, "admin")
	assert.ErrorIs(t, err, email.ErrChaveMestraAusente)

	d.Senha = ""
	_, err = servico.Atualizar(context.Background(), d, "admin")
	assert.NoError(t, err, "sem senha (servidor sem autenticacao) funciona sem chave mestra")
}

func TestEnviarTesteUsaAConfiguracaoSalva(t *testing.T) {
	ctx := context.Background()
	servico, enviador, _ := montar(t, cofre(t))
	_, err := servico.Atualizar(ctx, dadosValidos(), "admin")
	require.NoError(t, err)

	require.NoError(t, servico.EnviarTeste(ctx, "  destino@empresa.com.br ", "admin"))

	assert.Equal(t, "smtp.empresa.com.br", enviador.servidor.Host)
	assert.Equal(t, email.StartTLS, enviador.servidor.Criptografia)
	assert.Equal(t, "destino@empresa.com.br", enviador.msg.Destinatario)
	assert.Equal(t, "pcp@empresa.com.br", enviador.msg.RemetenteEmail)
}

func TestEnviarTesteSemConfiguracaoOuDestinatarioInvalido(t *testing.T) {
	servico, _, _ := montar(t, cofre(t))

	assert.ErrorIs(t, servico.EnviarTeste(context.Background(), "destino@empresa.com.br", "admin"), email.ErrNaoConfigurado)
	assert.ErrorIs(t, servico.EnviarTeste(context.Background(), "nao-e-email", "admin"), email.ErrDestinatarioInvalido)
}

func TestFalhaDoServidorNaoVazaASenha(t *testing.T) {
	ctx := context.Background()
	servico, enviador, _ := montar(t, cofre(t))
	d := dadosValidos()
	d.Senha = "segredo-smtp"
	_, err := servico.Atualizar(ctx, d, "admin")
	require.NoError(t, err)
	enviador.erro = errors.New("535 auth failed for segredo-smtp")

	err = servico.EnviarTeste(ctx, "destino@empresa.com.br", "admin")

	require.ErrorIs(t, err, email.ErrEnvioFalhou)
	assert.Contains(t, err.Error(), "535 auth failed")
	assert.NotContains(t, err.Error(), "segredo-smtp")
}

func TestSenhaGravadaComOutraChaveFicaIlegivel(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoEmailRepositorio(pool)
	d := dadosValidos()
	d.Senha = "segredo"
	_, err := email.NovoServico(repo, cofre(t), &enviadorFalso{}).Atualizar(ctx, d, "admin")
	require.NoError(t, err)

	outraChave, _ := cripto.NovoCofre(base64.StdEncoding.EncodeToString([]byte(strings.Repeat("z", 32))))
	err = email.NovoServico(repo, outraChave, &enviadorFalso{}).EnviarTeste(ctx, "destino@empresa.com.br", "admin")

	assert.ErrorIs(t, err, email.ErrSenhaIlegivel)
}

func TestTrocarDestinoSemDigitarASenhaRecusa(t *testing.T) {
	ctx := context.Background()
	servico, enviador, _ := montar(t, cofre(t))
	d := dadosValidos()
	d.Senha = "segredo-smtp"
	_, err := servico.Atualizar(ctx, d, "admin")
	require.NoError(t, err)

	// Cenario do ataque: muda so o host para um servidor proprio, mantendo a
	// senha gravada, e manda testar.
	d.Senha = ""
	d.Host = "smtp.atacante.com"
	_, err = servico.Atualizar(ctx, d, "admin")
	require.ErrorIs(t, err, email.ErrSenhaAoTrocarDestino)
	assert.Empty(t, enviador.servidor.Senha, "nada foi enviado")

	for nome, mudar := range map[string]func(*email.Dados){
		"porta":   func(d *email.Dados) { d.Host = "smtp.empresa.com.br"; d.Porta = 2525 },
		"usuario": func(d *email.Dados) { d.Host = "smtp.empresa.com.br"; d.Usuario = "outro@empresa.com.br" },
	} {
		outra := dadosValidos()
		mudar(&outra)
		_, err = servico.Atualizar(ctx, outra, "admin")
		assert.ErrorIs(t, err, email.ErrSenhaAoTrocarDestino, nome)
	}

	// Digitando a senha de novo (ou removendo), pode trocar.
	d.Senha = "nova-senha"
	_, err = servico.Atualizar(ctx, d, "admin")
	assert.NoError(t, err)
}

func TestSenhaMovidaParaOutroDestinoNoBancoFicaIlegivel(t *testing.T) {
	ctx := context.Background()
	servico, _, pool := montar(t, cofre(t))
	d := dadosValidos()
	d.Senha = "segredo-smtp"
	_, err := servico.Atualizar(ctx, d, "admin")
	require.NoError(t, err)

	// Alguem com acesso ao banco troca o host direto na tabela: a senha
	// amarrada ao destino original nao decifra para o novo.
	_, err = pool.Exec(ctx, `UPDATE configuracao_smtp SET host = 'smtp.atacante.com'`)
	require.NoError(t, err)

	assert.ErrorIs(t, servico.EnviarTeste(ctx, "destino@empresa.com.br", "admin"), email.ErrSenhaIlegivel)
}
