package api

import (
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
)

// usuarioRepo isola a construcao do repositorio para manter routes.go legivel
// conforme novos modulos forem registrados.
func usuarioRepo(dep Dependencias) usuario.Repositorio {
	return repository.NovoUsuarioRepositorio(dep.Pool)
}
