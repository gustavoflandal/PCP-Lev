package i18n

// Outras areas: auditoria, e-mail/SMTP, consulta (paginacao e filtros),
// valores monetarios e datas, cabecalhos de CSV.
func init() {
	Registrar(Espanhol, map[string]string{
		// auditoria
		"tabela nao faz parte da trilha de auditoria":  "la tabla no forma parte de la pista de auditoría",
		"operacao deve ser INSERT, UPDATE ou DELETE":   "la operación debe ser INSERT, UPDATE o DELETE",
		"data_inicio nao pode ser depois de data_fim":  "data_inicio no puede ser posterior a data_fim",
		"pagina deve ser um numero maior ou igual a 1": "pagina debe ser un número mayor o igual a 1",
		"limite deve ser um numero entre 1 e 200":      "limite debe ser un número entre 1 y 200",
		"data_inicio deve estar no formato AAAA-MM-DD": "data_inicio debe estar en el formato AAAA-MM-DD",
		"data_fim deve estar no formato AAAA-MM-DD":    "data_fim debe estar en el formato AAAA-MM-DD",
		"usuario_id deve ser um numero":                "usuario_id debe ser un número",

		// consulta (paginacao, filtros e ordenacao)
		"status aceita apenas: %s":                "status acepta solo: %s",
		"limite deve ser um numero entre 1 e %d":  "limite debe ser un número entre 1 y %d",
		"ordenar_por aceita apenas: %s":           "ordenar_por acepta solo: %s",
		"ordem aceita apenas: asc, desc":          "ordem acepta solo: asc, desc",
		"filtro_ativo aceita apenas: true, false": "filtro_ativo acepta solo: true, false",

		// valores monetarios e datas
		"valor monetario vazio":                              "valor monetario vacío",
		"valor monetario %q tem mais de duas casas decimais": "el valor monetario %q tiene más de dos decimales",
		"valor monetario %q invalido":                        "valor monetario %q inválido",
		"data %q invalida, use AAAA-MM-DD":                   "fecha %q inválida, use AAAA-MM-DD",

		// e-mail (configuracao SMTP)
		"a porta deve ficar entre 1 e 65535":                             "el puerto debe estar entre 1 y 65535",
		"criptografia invalida":                                          "cifrado inválido",
		"informe o servidor (host) para habilitar o envio de e-mail":     "informe el servidor (host) para habilitar el envío de correo electrónico",
		"informe um e-mail de remetente valido":                          "informe un correo electrónico de remitente válido",
		"informe a nova senha ou peca para remover a senha, nao os dois": "informe la nueva contraseña o pida eliminar la contraseña, no ambas cosas",
		"a chave mestra de segredos (CHAVE_MESTRA_SEGREDOS) nao esta configurada no servidor -- sem ela a senha nao pode ser gravada": "la clave maestra de secretos (CHAVE_MESTRA_SEGREDOS) no está configurada en el servidor -- sin ella la contraseña no puede guardarse",
		"configure e salve o servidor de e-mail antes de enviar o teste":                                                              "configure y guarde el servidor de correo electrónico antes de enviar la prueba",
		"informe um e-mail de destinatario valido":                                                                                    "informe un correo electrónico de destinatario válido",
		"o servidor de e-mail recusou ou nao respondeu":                                                                               "el servidor de correo electrónico rechazó o no respondió",
		"o servidor de e-mail recusou ou nao respondeu: %s":                                                                           "el servidor de correo electrónico rechazó o no respondió: %s",
		"a senha gravada nao pode ser decifrada (chave mestra trocada ou destino alterado) -- grave a senha de novo":                  "la contraseña guardada no puede descifrarse (clave maestra cambiada o destino modificado) -- guarde la contraseña de nuevo",
		"ao trocar servidor, porta ou usuario, digite a senha de novo (ou remova a senha gravada)":                                    "al cambiar servidor, puerto o usuario, escriba la contraseña de nuevo (o elimine la contraseña guardada)",
		"usuario e senha exigem criptografia (STARTTLS ou TLS) -- sem criptografia, deixe usuario e senha em branco":                  "usuario y contraseña exigen cifrado (STARTTLS o TLS) -- sin cifrado, deje usuario y contraseña en blanco",
		"um dos campos passou do tamanho maximo (servidor, usuario e e-mail: 255; nome: 100)":                                         "uno de los campos superó el tamaño máximo (servidor, usuario y correo electrónico: 255; nombre: 100)",

		// e-mail de teste enviado ao destinatario
		"Teste de envio — Sistema PCP":                                                          "Prueba de envío — Sistema PCP",
		"Este e um e-mail de teste do Sistema PCP, enviado por %s.":                             "Este es un correo electrónico de prueba del Sistema PCP, enviado por %s.",
		"Se voce recebeu esta mensagem, a configuracao do servidor de e-mail esta funcionando.": "Si usted recibió este mensaje, la configuración del servidor de correo electrónico está funcionando.",

		// conversa SMTP (aparecem como causa do erro de envio)
		"conectar a %s: %s":         "conectar a %s: %s",
		"iniciar conversa SMTP: %s": "iniciar conversación SMTP: %s",
		"negociar STARTTLS: %s":     "negociar STARTTLS: %s",
		"autenticar: %s":            "autenticar: %s",
		"remetente recusado: %s":    "remitente rechazado: %s",
		"destinatario recusado: %s": "destinatario rechazado: %s",
		"iniciar envio: %s":         "iniciar envío: %s",
		"enviar conteudo: %s":       "enviar contenido: %s",
		"concluir envio: %s":        "concluir envío: %s",
		"o servidor nao oferece STARTTLS -- escolha outra criptografia":                                           "el servidor no ofrece STARTTLS -- elija otro cifrado",
		"o servidor nao aceita autenticacao -- deixe usuario e senha em branco":                                   "el servidor no acepta autenticación -- deje usuario y contraseña en blanco",
		"o servidor nao oferece autenticacao PLAIN nem LOGIN":                                                     "el servidor no ofrece autenticación PLAIN ni LOGIN",
		"conexao sem criptografia -- a senha nao sera enviada":                                                    "conexión sin cifrado -- la contraseña no será enviada",
		"nome do servidor diferente do configurado":                                                               "nombre del servidor diferente del configurado",
		"desafio de autenticacao inesperado":                                                                      "desafío de autenticación inesperado",
		"usuario ou senha recusados pelo servidor (%d %s)":                                                        "usuario o contraseña rechazados por el servidor (%d %s)",
		"o servidor respondeu %d %s":                                                                              "el servidor respondió %d %s",
		"o certificado TLS do servidor nao e valido ou nao e confiavel":                                           "el certificado TLS del servidor no es válido o no es confiable",
		"o servidor nao respondeu a tempo":                                                                        "el servidor no respondió a tiempo",
		"conexao recusada -- confira servidor e porta":                                                            "conexión rechazada -- verifique servidor y puerto",
		"servidor nao encontrado -- confira o nome (host)":                                                        "servidor no encontrado -- verifique el nombre (host)",
		"falha ao negociar a criptografia TLS -- confira porta e criptografia":                                    "falla al negociar el cifrado TLS -- verifique puerto y cifrado",
		"nao foi possivel concluir a conversa com o servidor de e-mail -- confira servidor, porta e criptografia": "no fue posible concluir la conversación con el servidor de correo electrónico -- verifique servidor, puerto y cifrado",

		// cabecalhos dos relatorios CSV
		"data_hora":             "fecha_hora",
		"usuario":               "usuario",
		"tabela":                "tabla",
		"operacao":              "operacion",
		"registro_id":           "registro_id",
		"endereco_ip":           "direccion_ip",
		"codigo":                "codigo",
		"descricao":             "descripcion",
		"saldo_atual":           "saldo_actual",
		"disponivel":            "disponible",
		"estoque_minimo":        "inventario_minimo",
		"situacao":              "situacion",
		"numero_pc":             "numero_oc",
		"fornecedor":            "proveedor",
		"status":                "estado",
		"data_pedido":           "fecha_pedido",
		"data_entrega_prevista": "fecha_entrega_prevista",
		"data_entrega_real":     "fecha_entrega_real",
		"valor_total":           "valor_total",
	})
}
