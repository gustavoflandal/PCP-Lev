package usuario

import "context"

// Repositorio e a porta de persistencia de usuarios. A implementacao vive em
// internal/infra/repository (DDD: o dominio declara, a infra atende).
type Repositorio interface {
	// BuscarPorUsername devolve ErrNaoEncontrado quando nao ha usuario.
	BuscarPorUsername(ctx context.Context, username string) (*Usuario, error)
	// BuscarPorID devolve ErrNaoEncontrado quando nao ha usuario.
	BuscarPorID(ctx context.Context, id int64) (*Usuario, error)
	// RegistrarLogin marca o instante do acesso bem-sucedido.
	RegistrarLogin(ctx context.Context, id int64) error
}
