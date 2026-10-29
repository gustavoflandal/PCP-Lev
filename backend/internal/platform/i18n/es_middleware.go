package i18n

// Mensagens do roteador e dos middlewares (limite de requisicoes, erros
// genericos do Echo) e dos handlers que nao dependem de um dominio.
func init() {
	Registrar(Espanhol, map[string]string{
		"Banco de dados indisponivel":                  "Base de datos no disponible",
		"Recurso nao encontrado":                       "Recurso no encontrado",
		"Metodo nao permitido":                         "Método no permitido",
		"Requisicao invalida":                          "Solicitud inválida",
		"Requisicao excede o tamanho maximo permitido": "La solicitud excede el tamaño máximo permitido",
		"Muitas requisicoes em pouco tempo. Aguarde alguns segundos e tente de novo.": "Demasiadas solicitudes en poco tiempo. Espere unos segundos e intente de nuevo.",
		"Muitas tentativas de login. Aguarde um minuto e tente de novo.":              "Demasiados intentos de inicio de sesión. Espere un minuto e intente de nuevo.",
		"Corpo da requisicao invalido":                                                "Cuerpo de la solicitud inválido",
	})
}
