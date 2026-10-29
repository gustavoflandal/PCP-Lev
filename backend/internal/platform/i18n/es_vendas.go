package i18n

// Vendas: pedidos de venda (pedidos de venta).
func init() {
	Registrar(Espanhol, map[string]string{
		"informe o numero do pedido (ate 50 caracteres)":                                 "informe el número del pedido (hasta 50 caracteres)",
		"ja existe um pedido de venda com este numero":                                   "ya existe un pedido de venta con este número",
		"informe o cliente":                                                              "informe el cliente",
		"o cliente informado nao existe ou esta inativo":                                 "el cliente informado no existe o está inactivo",
		"informe a data do pedido e uma data de entrega prometida posterior a ela":       "informe la fecha del pedido y una fecha de entrega prometida posterior a ella",
		"o pedido precisa de ao menos um item":                                           "el pedido necesita al menos un ítem",
		"cada item precisa de produto, quantidade maior que zero e preco maior que zero": "cada ítem necesita producto, cantidad mayor que cero y precio mayor que cero",
		"o mesmo produto aparece em mais de um item -- some as quantidades":              "el mismo producto aparece en más de un ítem -- sume las cantidades",
		"um dos produtos nao existe ou esta inativo":                                     "uno de los productos no existe o está inactivo",
		"as observacoes vao ate 1000 caracteres":                                         "las observaciones admiten hasta 1000 caracteres",
		"pedido de venda nao encontrado":                                                 "pedido de venta no encontrado",
		"esta acao nao e permitida na situacao atual do pedido":                          "esta acción no está permitida en la situación actual del pedido",
		"o pedido tem OP liberada ou concluida -- cancele as OPs antes":                  "el pedido tiene OP liberada o concluida -- cancele las OP antes",
		"nao ha produto acabado em estoque suficiente para esta entrega":                 "no hay producto terminado en inventario suficiente para esta entrega",
		"um item deste pedido ja teve OP liberada (mesmo que cancelada) -- os itens nao podem mais ser alterados; cancele o pedido e crie outro": "un ítem de este pedido ya tuvo una OP liberada (aunque cancelada) -- los ítems ya no pueden modificarse; cancele el pedido y cree otro",
		"O identificador do pedido deve ser numerico": "El identificador del pedido debe ser numérico",
	})
}
