package empresa

import "context"

// Repositorio e a porta de persistencia do singleton de configuracao.
type Repositorio interface {
	Buscar(ctx context.Context) (Empresa, error)
	Atualizar(ctx context.Context, dados Dados, atualizadoPor string) (Empresa, error)

	BuscarLogoClaro(ctx context.Context) ([]byte, string, error)
	BuscarLogoEscuro(ctx context.Context) ([]byte, string, error)
	BuscarFavicon(ctx context.Context) ([]byte, string, error)

	AtualizarLogoClaro(ctx context.Context, dados []byte, tipo, atualizadoPor string) error
	AtualizarLogoEscuro(ctx context.Context, dados []byte, tipo, atualizadoPor string) error
	AtualizarFavicon(ctx context.Context, dados []byte, tipo, atualizadoPor string) error
}

// Servico reune os casos de uso de dados da empresa.
type Servico struct{ repo Repositorio }

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

// Buscar devolve a configuracao atual.
func (s *Servico) Buscar(ctx context.Context) (Empresa, error) {
	return s.repo.Buscar(ctx)
}

// Atualizar normaliza, valida e grava os campos de texto.
func (s *Servico) Atualizar(ctx context.Context, dados Dados, atualizadoPor string) (Empresa, error) {
	dados.Normalizar()
	if err := dados.Validar(); err != nil {
		return Empresa{}, err
	}
	return s.repo.Atualizar(ctx, dados, atualizadoPor)
}

// BuscarLogoClaro devolve os bytes do logo claro para servir via HTTP.
func (s *Servico) BuscarLogoClaro(ctx context.Context) ([]byte, string, error) {
	return s.repo.BuscarLogoClaro(ctx)
}

// BuscarLogoEscuro devolve os bytes do logo escuro para servir via HTTP.
func (s *Servico) BuscarLogoEscuro(ctx context.Context) ([]byte, string, error) {
	return s.repo.BuscarLogoEscuro(ctx)
}

// BuscarFavicon devolve os bytes do favicon para servir via HTTP.
func (s *Servico) BuscarFavicon(ctx context.Context) ([]byte, string, error) {
	return s.repo.BuscarFavicon(ctx)
}

// AtualizarLogoClaro valida e grava o logo claro; dados vazio remove a
// imagem atual em vez de rejeitar a chamada. Tambem atualiza updated_at --
// a URL da imagem nao muda quando o conteudo muda (sem parametro de versao),
// entao o frontend usa esse carimbo para invalidar o preview em cache.
func (s *Servico) AtualizarLogoClaro(ctx context.Context, dados []byte, mimeDeclarado, atualizadoPor string) error {
	return s.atualizarImagem(ctx, dados, mimeDeclarado, false, atualizadoPor, s.repo.AtualizarLogoClaro)
}

// AtualizarLogoEscuro valida e grava o logo escuro.
func (s *Servico) AtualizarLogoEscuro(ctx context.Context, dados []byte, mimeDeclarado, atualizadoPor string) error {
	return s.atualizarImagem(ctx, dados, mimeDeclarado, false, atualizadoPor, s.repo.AtualizarLogoEscuro)
}

// AtualizarFavicon valida e grava o favicon (so aceita PNG).
func (s *Servico) AtualizarFavicon(ctx context.Context, dados []byte, mimeDeclarado, atualizadoPor string) error {
	return s.atualizarImagem(ctx, dados, mimeDeclarado, true, atualizadoPor, s.repo.AtualizarFavicon)
}

func (s *Servico) atualizarImagem(
	ctx context.Context, dados []byte, mimeDeclarado string, ehFavicon bool, atualizadoPor string,
	gravar func(ctx context.Context, dados []byte, tipo, atualizadoPor string) error,
) error {
	if len(dados) == 0 {
		return gravar(ctx, nil, "", atualizadoPor)
	}
	tipo, err := ValidarImagem(dados, mimeDeclarado, ehFavicon)
	if err != nil {
		return err
	}
	return gravar(ctx, dados, tipo, atualizadoPor)
}
