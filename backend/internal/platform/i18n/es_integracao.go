package i18n

// Mensagens da API de integracao com o ERP (chaves de API e consultas).
func init() {
	Registrar(Espanhol, map[string]string{
		"Chave de API ausente: envie o cabecalho ":              "Falta la clave de API: envíe el encabezado ",
		"Chave de API ausente: envie o cabecalho X-API-Key":     "Falta la clave de API: envíe el encabezado X-API-Key",
		"Chave de API invalida ou revogada":                     "Clave de API inválida o revocada",
		"chave de API invalida ou revogada":                     "clave de API inválida o revocada",
		"chave de API nao encontrada":                           "clave de API no encontrada",
		"a chave de API ja foi revogada":                        "la clave de API ya fue revocada",
		"informe o nome da chave (ate 80 caracteres)":           "informe el nombre de la clave (hasta 80 caracteres)",
		"a descricao vai ate 255 caracteres":                    "la descripción admite hasta 255 caracteres",
		"O identificador da chave deve ser numerico":            "El identificador de la clave debe ser numérico",
		"O identificador do cliente deve ser numerico":          "El identificador del cliente debe ser numérico",
		"O identificador do fornecedor deve ser numerico":       "El identificador del proveedor debe ser numérico",
		"O identificador do produto deve ser numerico":          "El identificador del producto debe ser numérico",
		"O identificador da estrutura deve ser numerico":        "El identificador de la estructura debe ser numérico",
		"O identificador da parte/peca deve ser numerico":       "El identificador de la parte/pieza debe ser numérico",
		"O identificador do pedido deve ser numerico":           "El identificador del pedido debe ser numérico",
		"O identificador do pedido de compra deve ser numerico": "El identificador del pedido de compra debe ser numérico",
		"tipo invalido": "tipo inválido",
		// Documentacao das APIs de integracao (integracao_docs.go).
		"Cliente Exemplo Ltda":                   "Cliente Ejemplo Ltda",
		"Fornecedor Exemplo SA":                  "Proveedor Ejemplo SA",
		"Painel de mensagem variavel":            "Panel de mensaje variable",
		"Estruturas (BOM)":                       "Estructuras (BOM)",
		"Produtos acabados":                      "Productos terminados",
		"Pedidos de venda":                       "Pedidos de venta",
		"Pedidos de compra":                      "Pedidos de compra",
		"Identificador do produto acabado.":      "Identificador del producto terminado.",
		"Lista os clientes.":                     "Lista los clientes.",
		"Lista os fornecedores.":                 "Lista los proveedores.",
		"Lista os pedidos de compra.":            "Lista los pedidos de compra.",
		"Lista os pedidos de venda.":             "Lista los pedidos de venta.",
		"Texto livre para filtrar.":              "Texto libre para filtrar.",
		"Um cliente pelo identificador.":         "Un cliente por su identificador.",
		"Um fornecedor pelo identificador.":      "Un proveedor por su identificador.",
		"Um pedido de compra com os itens.":      "Un pedido de compra con los ítems.",
		"Um produto acabado pelo identificador.": "Un producto terminado por su identificador.",
	})
}
