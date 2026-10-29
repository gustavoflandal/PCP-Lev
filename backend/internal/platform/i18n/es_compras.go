package i18n

// Compras: cotacoes (cotizaciones) e pedidos de compra (ordenes de compra).
func init() {
	Registrar(Espanhol, map[string]string{
		// cotacao
		"informe o fornecedor":                                    "informe el proveedor",
		"informe a data de validade":                              "informe la fecha de vigencia",
		"a data de validade deve ser posterior a data de emissao": "la fecha de vigencia debe ser posterior a la fecha de emisión",
		"informe ao menos um item":                                "informe al menos un ítem",
		"a quantidade de cada item deve ser maior que zero":       "la cantidad de cada ítem debe ser mayor que cero",
		"o preco unitario de cada item deve ser maior que zero":   "el precio unitario de cada ítem debe ser mayor que cero",
		"informe o numero da cotacao":                             "informe el número de la cotización",
		"ja existe uma cotacao com este numero":                   "ya existe una cotización con este número",
		"o fornecedor ou uma das pecas informadas nao existe":     "el proveedor o una de las piezas informadas no existe",
		"cotacao nao encontrada":                                  "cotización no encontrada",
		"a cotacao nao esta em um status que permite esta acao":   "la cotización no está en un estado que permita esta acción",
		"O identificador da cotacao deve ser numerico":            "El identificador de la cotización debe ser numérico",

		// pedido de compra
		"informe a data de entrega prevista":                                                        "informe la fecha de entrega prevista",
		"a data de entrega prevista deve ser posterior a data do pedido":                            "la fecha de entrega prevista debe ser posterior a la fecha del pedido",
		"a quantidade solicitada de cada item deve ser maior que zero":                              "la cantidad solicitada de cada ítem debe ser mayor que cero",
		"informe o numero do pedido de compra":                                                      "informe el número de la orden de compra",
		"ja existe um pedido de compra com este numero":                                             "ya existe una orden de compra con este número",
		"a cotacao informada nao existe":                                                            "la cotización informada no existe",
		"pedido de compra nao encontrado":                                                           "orden de compra no encontrada",
		"o pedido de compra nao esta em um status que permite esta acao":                            "la orden de compra no está en un estado que permita esta acción",
		"a quantidade recebida excede o solicitado mais a tolerancia de recebimento configurada":    "la cantidad recibida excede lo solicitado más la tolerancia de recepción configurada",
		"o valor do pedido esta acima da alcada do Gestor -- a emissao precisa de um Administrador": "el valor de la orden está por encima del límite de autorización del Gestor -- la emisión requiere un Administrador",
		"cotacoes respondidas insuficientes para emitir este pedido":                                "cotizaciones respondidas insuficientes para emitir esta orden",
		"cotacoes respondidas insuficientes para emitir este pedido nos ultimos %d dias: %s":        "cotizaciones respondidas insuficientes para emitir esta orden en los últimos %d días: %s",
		"informe o motivo do encerramento (de 10 a 255 caracteres)":                                 "informe el motivo del cierre (de 10 a 255 caracteres)",
		"O identificador do pedido de compra deve ser numerico":                                     "El identificador de la orden de compra debe ser numérico",
	})
}
