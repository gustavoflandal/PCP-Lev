package i18n

// Traducoes para espanhol das mensagens da API (chave: texto em portugues).
// Os arquivos es_*.go acrescentam o restante, agrupados por modulo.
func init() {
	Registrar(Espanhol, map[string]string{
		"Dados invalidos":                   "Datos inválidos",
		"Campo obrigatorio":                 "Campo obligatorio",
		"E-mail invalido":                   "Correo electrónico inválido",
		"Valor invalido":                    "Valor inválido",
		"Deve conter apenas digitos":        "Debe contener solo dígitos",
		"Erro interno do servidor":          "Error interno del servidor",
		"Corpo da requisicao invalido":      "Cuerpo de la solicitud inválido",
		"Deve ter no minimo %s caracteres":  "Debe tener como mínimo %s caracteres",
		"Deve ter no maximo %s caracteres":  "Debe tener como máximo %s caracteres",
		"Deve ser maior ou igual a %s":      "Debe ser mayor o igual a %s",
		"Deve ser menor ou igual a %s":      "Debe ser menor o igual a %s",
		"Deve ser maior que %s":             "Debe ser mayor que %s",
		"Deve ter exatamente %s caracteres": "Debe tener exactamente %s caracteres",
		"Deve ser um dos valores: %s":       "Debe ser uno de los valores: %s",
	})
}
