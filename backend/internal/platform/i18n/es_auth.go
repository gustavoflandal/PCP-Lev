package i18n

// Autenticacao, sessao e gestao de usuarios (chave: texto em portugues).
func init() {
	Registrar(Espanhol, map[string]string{
		// domain/auth, domain/usuario
		"a nova senha deve ser diferente da atual": "la nueva contraseña debe ser diferente de la actual",
		"token invalido": "token inválido",
		"token expirado": "token expirado",
		"a senha deve ter de 10 a 72 caracteres, nao pode ser uma senha comum nem conter o login": "la contraseña debe tener de 10 a 72 caracteres, no puede ser una contraseña común ni contener el usuario (login)",
		"muitas tentativas de senha: aguarde alguns minutos e tente de novo":                      "demasiados intentos de contraseña: espere unos minutos e intente de nuevo",
		"usuario ou senha invalidos":        "usuario o contraseña inválidos",
		"usuario inativo":                   "usuario inactivo",
		"usuario bloqueado":                 "usuario bloqueado",
		"usuario nao encontrado":            "usuario no encontrado",
		"preferencia de aparencia invalida": "preferencia de apariencia inválida",
		"token invalido: %s":                "token inválido: %s",

		// domain/usuario/gestao.go
		"o usuario (login) deve ter de 3 a 50 caracteres: letras minusculas, numeros, ponto, hifen ou sublinhado": "el usuario (login) debe tener de 3 a 50 caracteres: letras minúsculas, números, punto, guion o guion bajo",
		"informe o nome (ate 100 caracteres)":                       "informe el nombre (hasta 100 caracteres)",
		"informe um e-mail valido (ate 100 caracteres)":             "informe un correo electrónico válido (hasta 100 caracteres)",
		"matricula e telefone vao ate 30 caracteres; setor, ate 60": "matrícula y teléfono admiten hasta 30 caracteres; sector, hasta 60",
		"informe o perfil":                                         "informe el perfil",
		"o perfil informado nao existe":                            "el perfil informado no existe",
		"ja existe um usuario com este login, e-mail ou matricula": "ya existe un usuario con este login, correo electrónico o matrícula",
		"situacao invalida":                                        "situación inválida",
		"ninguem altera o proprio cadastro, perfil, situacao ou permissoes por aqui -- peca a outro administrador": "nadie modifica su propio registro, perfil, situación o permisos por aquí -- pida a otro administrador",
		"so e possivel atribuir um perfil cujas permissoes o seu proprio perfil tem":                               "solo es posible asignar un perfil cuyos permisos su propio perfil también tenga",
		"so um Administrador altera um usuario Administrador":                                                      "solo un Administrador puede modificar a un usuario Administrador",
		"este e o ultimo Administrador ativo -- ative ou crie outro antes":                                         "este es el último Administrador activo -- active o cree otro antes",
		"a justificativa deve ter ao menos 10 caracteres (ate 255)":                                                "la justificación debe tener al menos 10 caracteres (hasta 255)",
		"o Administrador tem todas as permissoes -- permissoes individuais nao se aplicam":                         "el Administrador tiene todos los permisos -- los permisos individuales no se aplican",
		"permissao fora do catalogo":                                                                   "permiso fuera del catálogo",
		"so e possivel conceder permissoes que o seu proprio perfil tem":                               "solo es posible conceder permisos que su propio perfil tenga",
		"este usuario nao tem esta permissao individual":                                               "este usuario no tiene este permiso individual",
		"este usuario tem permissoes que voce nao tem -- peca a quem as tenha (ou a um Administrador)": "este usuario tiene permisos que usted no tiene -- pídalo a quien los tenga (o a un Administrador)",
		"o usuario foi alterado por outra pessoa enquanto voce editava -- recarregue e tente de novo":  "el usuario fue modificado por otra persona mientras usted lo editaba -- recargue e intente de nuevo",

		// api/handlers/auth.go, usuarios.go, middleware
		"Usuario ou senha invalidos":                                                                     "Usuario o contraseña inválidos",
		"Usuario inativo, procure o administrador":                                                       "Usuario inactivo, comuníquese con el administrador",
		"Usuario bloqueado, procure o administrador":                                                     "Usuario bloqueado, comuníquese con el administrador",
		"Usuario inativo ou bloqueado, procure o administrador":                                          "Usuario inactivo o bloqueado, comuníquese con el administrador",
		"Muitas tentativas de senha para este usuario. Aguarde alguns minutos e tente de novo.":          "Demasiados intentos de contraseña para este usuario. Espere unos minutos e intente de nuevo.",
		"Muitas tentativas de senha. Aguarde alguns minutos e tente de novo.":                            "Demasiados intentos de contraseña. Espere unos minutos e intente de nuevo.",
		"Sua sessao foi encerrada (senha alterada ou acesso revisto pelo administrador). Entre de novo.": "Su sesión fue cerrada (contraseña cambiada o acceso revisado por el administrador). Ingrese de nuevo.",
		"Senha alterada":                                                 "Contraseña cambiada",
		"Token de acesso ausente":                                        "Token de acceso ausente",
		"Token de acesso invalido":                                       "Token de acceso inválido",
		"Sessao expirada, faca login novamente":                          "Sesión expirada, inicie sesión nuevamente",
		"Senha atual invalida":                                           "Contraseña actual inválida",
		"Usuario nao encontrado":                                         "Usuario no encontrado",
		"Troque a senha antes de continuar":                              "Cambie la contraseña antes de continuar",
		"Seu perfil nao tem permissao para esta operacao":                "Su perfil no tiene permiso para esta operación",
		"Seu perfil nao tem permissao para estes anexos":                 "Su perfil no tiene permiso para estos adjuntos",
		"O identificador do usuario deve ser numerico":                   "El identificador del usuario debe ser numérico",
		"Senha temporaria definida; o usuario a troca no proximo acesso": "Contraseña temporal definida; el usuario la cambia en el próximo acceso",
		"Informe concedida (true/false) e a justificativa":               "Informe concedida (true/false) y la justificación",
	})
}
