package i18n

// Perfis e permissoes (chave: texto em portugues).
func init() {
	Registrar(Espanhol, map[string]string{
		"perfil nao encontrado": "perfil no encontrado",
		"o perfil Administrador tem todas as permissoes e nao pode ser alterado":                                "el perfil Administrador tiene todos los permisos y no puede ser modificado",
		"perfis do sistema nao podem ser excluidos -- ajuste as permissoes dele":                                "los perfiles del sistema no pueden eliminarse -- ajuste sus permisos",
		"o perfil tem usuarios -- mude o perfil deles antes de excluir":                                         "el perfil tiene usuarios -- cambie el perfil de ellos antes de eliminar",
		"o codigo do perfil deve ter de 2 a 30 caracteres: letras maiusculas, numeros e _, comecando por letra": "el código del perfil debe tener de 2 a 30 caracteres: letras mayúsculas, números y _, comenzando con una letra",
		"ja existe um perfil com este codigo":                                                                   "ya existe un perfil con este código",
		"informe o nome do perfil (ate 80 caracteres)":                                                          "informe el nombre del perfil (hasta 80 caracteres)",
		"a descricao do perfil vai ate 255 caracteres":                                                          "la descripción del perfil admite hasta 255 caracteres",
		"ninguem edita o proprio perfil -- peca a outro administrador":                                          "nadie edita su propio perfil -- pida a otro administrador",
		"voce so pode editar um perfil cujas permissoes voce tambem tem":                                        "usted solo puede editar un perfil cuyos permisos usted también tenga",
	})
}
