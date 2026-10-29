package email

import (
	"context"
	"fmt"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/i18n"
)

// Registro e a linha gravada: a configuracao publica mais a senha cifrada,
// que so o Servico enxerga.
type Registro struct {
	Configuracao
	SenhaCifrada *string
}

// Repositorio e a porta de persistencia do singleton.
type Repositorio interface {
	Buscar(ctx context.Context) (Registro, error)
	// Atualizar grava os campos; senhaCifrada nil mantem a senha atual, e
	// removerSenha a apaga.
	Atualizar(ctx context.Context, d Dados, senhaCifrada *string, removerSenha bool, autor string) (Registro, error)
}

// Cifrador guarda segredos em repouso (platform/cripto.Cofre). O contexto e
// autenticado junto (AAD): so decifra com o mesmo contexto usado para cifrar.
type Cifrador interface {
	Cifrar(texto, contexto string) (string, error)
	Decifrar(cifrado, contexto string) (string, error)
}

// Enviador entrega uma mensagem num servidor SMTP (infra/smtp).
type Enviador interface {
	Enviar(ctx context.Context, servidor Servidor, msg Mensagem) error
}

// Servico reune os casos de uso. cifrador pode ser nil (chave mestra nao
// configurada): ai so a gravacao de senha e recusada.
type Servico struct {
	repo     Repositorio
	cifrador Cifrador
	enviador Enviador
}

// NovoServico monta o servico. Passe cifrador nil (interface nil, nao um
// ponteiro nil tipado) quando nao houver chave mestra.
func NovoServico(repo Repositorio, cifrador Cifrador, enviador Enviador) *Servico {
	return &Servico{repo: repo, cifrador: cifrador, enviador: enviador}
}

// Buscar devolve a configuracao, sem a senha.
func (s *Servico) Buscar(ctx context.Context) (Configuracao, error) {
	r, err := s.repo.Buscar(ctx)
	return r.Configuracao, err
}

// Atualizar valida, cifra a senha nova (se houver) e grava.
func (s *Servico) Atualizar(ctx context.Context, d Dados, autor string) (Configuracao, error) {
	d.Normalizar()
	if err := d.Validar(); err != nil {
		return Configuracao{}, err
	}

	atual, err := s.repo.Buscar(ctx)
	if err != nil {
		return Configuracao{}, err
	}
	// Manter a senha gravada so vale para o MESMO destino: senao, qualquer
	// administrador (ou sessao sequestrada) trocaria o host para um servidor
	// proprio e usaria o "testar" para receber a senha.
	destinoMudou := !strings.EqualFold(atual.Host, d.Host) || atual.Porta != d.Porta || atual.Usuario != d.Usuario
	if atual.SenhaCifrada != nil && destinoMudou && d.Senha == "" && !d.RemoverSenha {
		return Configuracao{}, ErrSenhaAoTrocarDestino
	}

	var senhaCifrada *string
	if d.Senha != "" {
		if s.cifrador == nil {
			return Configuracao{}, ErrChaveMestraAusente
		}
		cifrada, err := s.cifrador.Cifrar(d.Senha, contextoDaSenha(d.Host, d.Porta, d.Usuario))
		if err != nil {
			return Configuracao{}, fmt.Errorf("cifrar senha do smtp: %w", err)
		}
		senhaCifrada = &cifrada
	}

	r, err := s.repo.Atualizar(ctx, d, senhaCifrada, d.RemoverSenha, autor)
	return r.Configuracao, err
}

// EnviarTeste manda um e-mail curto para o destinatario usando a
// configuracao SALVA -- o teste confirma o que o sistema vai usar de verdade,
// nao o que esta digitado na tela.
func (s *Servico) EnviarTeste(ctx context.Context, destinatario, autor string) error {
	return s.EnviarTesteIdioma(ctx, destinatario, autor, i18n.Padrao)
}

// EnviarTesteIdioma e o EnviarTeste com o texto do e-mail no idioma do
// usuario que pediu o teste.
func (s *Servico) EnviarTesteIdioma(ctx context.Context, destinatario, autor, idioma string) error {
	destinatario = strings.TrimSpace(destinatario)
	if !emailValido(destinatario) {
		return ErrDestinatarioInvalido
	}

	r, err := s.repo.Buscar(ctx)
	if err != nil {
		return err
	}
	if r.Host == "" || r.RemetenteEmail == "" {
		return ErrNaoConfigurado
	}

	senha := ""
	if r.SenhaCifrada != nil {
		if s.cifrador == nil {
			return ErrChaveMestraAusente
		}
		senha, err = s.cifrador.Decifrar(*r.SenhaCifrada, contextoDaSenha(r.Host, r.Porta, r.Usuario))
		if err != nil {
			return ErrSenhaIlegivel
		}
	}

	err = s.enviador.Enviar(ctx, Servidor{
		Host: r.Host, Porta: r.Porta, Criptografia: r.Criptografia, Usuario: r.Usuario, Senha: senha,
	}, Mensagem{
		RemetenteEmail: r.RemetenteEmail,
		RemetenteNome:  r.RemetenteNome,
		Destinatario:   destinatario,
		Assunto:        i18n.Traduzir(idioma, "Teste de envio — Sistema PCP"),
		Corpo: i18n.Traduzir(idioma, "Este e um e-mail de teste do Sistema PCP, enviado por "+autor+".") + "\r\n\r\n" +
			i18n.Traduzir(idioma, "Se voce recebeu esta mensagem, a configuracao do servidor de e-mail esta funcionando.") + "\r\n",
	})
	if err != nil {
		return fmt.Errorf("%w: %s", ErrEnvioFalhou, semSenha(err.Error(), senha))
	}
	return nil
}

// semSenha garante que a senha nunca volte numa mensagem de erro, mesmo que
// algum servidor ou biblioteca a ecoe.
func semSenha(texto, senha string) string {
	if senha == "" {
		return texto
	}
	return strings.ReplaceAll(texto, senha, "****")
}
