package i18n

// Inventario (estoque) e rastreabilidade de lotes.
func init() {
	Registrar(Espanhol, map[string]string{
		"informe a parte/peca":                                                                   "informe la parte/pieza",
		"a parte/peca informada nao existe":                                                      "la parte/pieza informada no existe",
		"informe a quantidade do ajuste (diferente de zero)":                                     "informe la cantidad del ajuste (distinta de cero)",
		"informe o motivo do ajuste":                                                             "informe el motivo del ajuste",
		"o ajuste deixaria o saldo negativo (ou abaixo do que esta reservado para OPs)":          "el ajuste dejaría el saldo negativo (o por debajo de lo reservado para las OP)",
		"saldo de estoque nao encontrado":                                                        "saldo de inventario no encontrado",
		"movimentacao nao encontrada":                                                            "movimiento no encontrado",
		"este item controla lote: informe o lote do ajuste":                                      "este ítem controla lote: informe el lote del ajuste",
		"o lote informado nao tem saldo disponivel para esta saida":                              "el lote informado no tiene saldo disponible para esta salida",
		"este item controla numero de serie: informe uma serie por unidade ajustada":             "este ítem controla número de serie: informe una serie por unidad ajustada",
		"uma das series nao existe em estoque para esta peca (ou ja existe, na entrada)":         "una de las series no existe en inventario para esta pieza (o ya existe, en la entrada)",
		"este item controla validade: informe a validade do lote (a mesma, se o lote ja existe)": "este ítem controla vigencia: informe la vigencia del lote (la misma, si el lote ya existe)",
		"lote nao encontrado":                                                                    "lote no encontrado",
		"O identificador da movimentacao deve ser numerico":                                      "El identificador del movimiento debe ser numérico",
		"O identificador do lote deve ser numerico":                                              "El identificador del lote debe ser numérico",
	})
}
