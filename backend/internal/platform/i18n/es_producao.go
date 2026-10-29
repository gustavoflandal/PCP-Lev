package i18n

// Producao (ordens de producao, apontamentos, series, metrologia) e estrutura
// de produto (BOM).
func init() {
	Registrar(Espanhol, map[string]string{
		// ordem de producao
		"ordem de producao nao encontrada":                                                                       "orden de producción no encontrada",
		"item de pedido de venda nao encontrado":                                                                 "ítem de pedido de venta no encontrado",
		"este item ja tem uma ordem de producao":                                                                 "este ítem ya tiene una orden de producción",
		"so e possivel gerar OP de pedido Aberto ou Em Producao":                                                 "solo es posible generar OP de un pedido Abierto o En Producción",
		"o produto nao tem estrutura (BOM) ativa -- cadastre antes de gerar a OP":                                "el producto no tiene estructura (BOM) activa -- regístrela antes de generar la OP",
		"esta acao nao e permitida na situacao atual da OP":                                                      "esta acción no está permitida en la situación actual de la OP",
		"nao ha material disponivel para liberar a OP":                                                           "no hay material disponible para liberar la OP",
		"ja existe um apontamento em andamento nesta OP -- encerre-o antes":                                      "ya existe un registro de tiempo en curso en esta OP -- ciérrelo antes",
		"nao ha apontamento seu em andamento nesta OP":                                                           "no hay registro de tiempo suyo en curso en esta OP",
		"escolha um centro de trabalho ativo da etapa atual da OP":                                               "elija un centro de trabajo activo de la etapa actual de la OP",
		"encerre ao menos um apontamento nesta etapa antes de avancar":                                           "cierre al menos un registro de tiempo en esta etapa antes de avanzar",
		"todas as unidades precisam estar aprovadas no teste antes de avancar":                                   "todas las unidades deben estar aprobadas en la prueba antes de avanzar",
		"este produto exige metrologia -- registre-a em todas as unidades antes de avancar":                      "este producto exige metrología -- regístrela en todas las unidades antes de avanzar",
		"o material desta OP ja foi consumido -- ela nao pode mais ser cancelada":                                "el material de esta OP ya fue consumido -- ya no puede cancelarse",
		"numero de serie nao encontrado":                                                                         "número de serie no encontrado",
		"o resultado de teste so e registrado com a OP na etapa Testes":                                          "el resultado de la prueba solo se registra con la OP en la etapa Pruebas",
		"descreva o resultado do teste (ate 500 caracteres) -- obrigatorio na reprovacao":                        "describa el resultado de la prueba (hasta 500 caracteres) -- obligatorio en la reprobación",
		"este produto nao exige metrologia":                                                                      "este producto no exige metrología",
		"informe aprovacao de modelo, lacre (ate 60 caracteres), data de verificacao e validade posterior a ela": "informe aprobación de modelo, sello (hasta 60 caracteres), fecha de verificación y vigencia posterior a ella",
		"as observacoes vao ate 500 caracteres":                                                                  "las observaciones admiten hasta 500 caracteres",
		"necessaria %d, disponivel %d":                                                                           "necesaria %d, disponible %d",
		"O identificador da OP deve ser numerico":                                                                "El identificador de la OP debe ser numérico",
		"O identificador da serie deve ser numerico":                                                             "El identificador de la serie debe ser numérico",
		"Informe item_pedido_venda_id":                                                                           "Informe item_pedido_venda_id",
		"Informe aprovado (true/false) e o resultado":                                                            "Informe aprovado (true/false) y el resultado",

		// estrutura de produto
		"informe o produto acabado":                                 "informe el producto terminado",
		"o produto acabado informado nao existe":                    "el producto terminado informado no existe",
		"uma das pecas informadas nao existe":                       "una de las piezas informadas no existe",
		"a mesma peca nao pode aparecer duas vezes na estrutura":    "la misma pieza no puede aparecer dos veces en la estructura",
		"informe a data de inicio da vigencia":                      "informe la fecha de inicio de la vigencia",
		"a data de fim da vigencia deve ser posterior ao inicio":    "la fecha de fin de la vigencia debe ser posterior al inicio",
		"este produto ja possui uma estrutura ativa, use versionar": "este producto ya tiene una estructura activa, use versionar",
		"estrutura de produto nao encontrada":                       "estructura de producto no encontrada",
		"O identificador da estrutura deve ser numerico":            "El identificador de la estructura debe ser numérico",
	})
}
