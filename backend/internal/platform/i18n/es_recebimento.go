package i18n

// Recebimento: notas fiscais de entrada, conferencia (pendencias), XML da
// NF-e e de-para de codigos de fornecedor. Os modelos com valores numericos
// usam %s mesmo onde o codigo formata %.2f/%.4g: o valor ja chega como texto.
func init() {
	Registrar(Espanhol, map[string]string{
		"nota fiscal nao encontrada":                                                                                       "nota fiscal no encontrada",
		"informe o pedido de compra":                                                                                       "informe la orden de compra",
		"o pedido de compra nao esta aguardando entrega nem recebido parcial":                                              "la orden de compra no está esperando entrega ni recibida parcialmente",
		"modelo deve ser 55 (NF-e) ou 01":                                                                                  "el modelo debe ser 55 (NF-e) o 01",
		"informe serie (ate 3 digitos) e numero (ate 9 digitos)":                                                           "informe serie (hasta 3 dígitos) y número (hasta 9 dígitos)",
		"chave de acesso invalida: 44 digitos com digito verificador correto (obrigatoria na NF-e)":                        "clave de acceso inválida: 44 dígitos con dígito verificador correcto (obligatoria en la NF-e)",
		"informe emissao e entrada; a entrada nao pode ser anterior a emissao nem futura":                                  "informe emisión y entrada; la entrada no puede ser anterior a la emisión ni futura",
		"CFOP fora da lista de entradas aceitas":                                                                           "CFOP fuera de la lista de entradas aceptadas",
		"o CNPJ do emitente nao e o do fornecedor do pedido de compra":                                                     "el CNPJ del emisor no es el del proveedor de la orden de compra",
		"os valores da nota nao podem ser negativos":                                                                       "los valores de la nota no pueden ser negativos",
		"a nota precisa de ao menos um item":                                                                               "la nota necesita al menos un ítem",
		"cada item precisa de peca, quantidade da nota maior que zero e fator de conversao maior que zero":                 "cada ítem necesita pieza, cantidad de la nota mayor que cero y factor de conversión mayor que cero",
		"observacoes ate 1000 caracteres":                                                                                  "observaciones hasta 1000 caracteres",
		"esta nota ja foi lancada":                                                                                         "esta nota ya fue registrada",
		"esta acao nao e permitida na situacao atual da nota":                                                              "esta acción no está permitida en la situación actual de la nota",
		"a nota tem pendencias -- corrija antes de conferir/efetivar":                                                      "la nota tiene pendientes -- corrija antes de revisar/efectivizar",
		"ha divergencia de preco acima da tolerancia: precisa de quem aprove divergencias":                                 "hay divergencia de precio por encima de la tolerancia: se necesita a quien apruebe divergencias",
		"informe o motivo (de 10 a 255 caracteres)":                                                                        "informe el motivo (de 10 a 255 caracteres)",
		"o material desta nota ja foi reservado, consumido ou movimentado -- corrija por ajuste de inventario justificado": "el material de esta nota ya fue reservado, consumido o movido -- corrija mediante un ajuste de inventario justificado",
		"a nota foi alterada por outra pessoa enquanto voce conferia -- abra de novo e confira":                            "la nota fue modificada por otra persona mientras usted la revisaba -- ábrala de nuevo y revísela",
		"certificado anexado invalido -- envie o arquivo de novo":                                                          "certificado adjunto inválido -- envíe el archivo de nuevo",

		// de-para
		"informe peca, codigo do fornecedor (ate 60) e fator de conversao maior que zero": "informe pieza, código del proveedor (hasta 60) y factor de conversión mayor que cero",
		"este codigo do fornecedor ja esta vinculado a uma peca":                          "este código del proveedor ya está vinculado a una pieza",
		"vinculo de-para nao encontrado":                                                  "vínculo de-para no encontrado",

		// XML da NF-e
		"o arquivo nao e um XML de NF-e valido (nfeProc/NFe)":                  "el archivo no es un XML de NF-e válido (nfeProc/NFe)",
		"o XML nao tem itens (det)":                                            "el XML no tiene ítems (det)",
		"o XML nao e de NF-e modelo 55":                                        "el XML no es de NF-e modelo 55",
		"o CNPJ do emitente da nota nao e o do fornecedor do pedido de compra": "el CNPJ del emisor de la nota no es el del proveedor de la orden de compra",
		"XML grande demais (ate 2 MB)":                                         "XML demasiado grande (hasta 2 MB)",

		// pendencias da conferencia
		"a chave de acesso nao corresponde ao CNPJ, modelo, serie e numero informados": "la clave de acceso no corresponde al CNPJ, modelo, serie y número informados",
		"a soma dos itens (R$ %s) difere do total de produtos da nota (R$ %s)":         "la suma de los ítems (R$ %s) difiere del total de productos de la nota (R$ %s)",
		"peca inexistente ou inativa":                                                                         "pieza inexistente o inactiva",
		"bonificacao exige justificativa (ao menos 10 caracteres)":                                            "la bonificación exige justificación (al menos 10 caracteres)",
		"o item nao pertence a um pedido de compra deste fornecedor (marque como bonificacao, se for o caso)": "el ítem no pertenece a una orden de compra de este proveedor (márquelo como bonificación, si es el caso)",
		"o item de pedido de compra e de outro fornecedor":                                                    "el ítem de orden de compra es de otro proveedor",
		"o pedido de compra %s nao esta recebendo":                                                            "la orden de compra %s no está recibiendo",
		"a peca da linha nao e a do item do pedido de compra":                                                 "la pieza de la línea no es la del ítem de la orden de compra",
		"valor total do item (R$ %s) nao confere com quantidade x unitario (R$ %s)":                           "el valor total del ítem (R$ %s) no coincide con cantidad x unitario (R$ %s)",
		"fator de conversao %s difere do cadastrado no de-para (%s)":                                          "el factor de conversión %s difiere del registrado en el de-para (%s)",
		"preco unitario R$ %s diverge %s% do pedido (R$ %s), acima da tolerancia de %s%":                      "el precio unitario R$ %s diverge %s%% del pedido (R$ %s), por encima de la tolerancia de %s%%",
		"recebido %d, nota declara %s (x %s) -- a diferenca fica pendente com o fornecedor":                   "recibido %d, la nota declara %s (x %s) -- la diferencia queda pendiente con el proveedor",
		"cada lote precisa de numero e quantidade":                                                            "cada lote necesita número y cantidad",
		"lote %s com fabricacao depois da validade":                                                           "lote %s con fabricación posterior a la vigencia",
		"lote %s sem validade": "lote %s sin vigencia",
		"lote %s com %d dia(s) de validade -- o minimo do item e %d":         "lote %s con %d día(s) de vigencia -- el mínimo del ítem es %d",
		"lote %s sem certificado de conformidade anexado":                    "lote %s sin certificado de conformidad adjunto",
		"a soma dos lotes (%d) precisa ser igual a quantidade recebida (%d)": "la suma de los lotes (%d) debe ser igual a la cantidad recibida (%d)",
		"item exige certificado de conformidade anexado":                     "el ítem exige certificado de conformidad adjunto",
		"series informadas: %d de %d":                                        "series informadas: %d de %d",
		"numero de serie vazio":                                              "número de serie vacío",
		"serie %s repetida nesta nota":                                       "serie %s repetida en esta nota",
		"serie %s ja existe para esta peca":                                  "la serie %s ya existe para esta pieza",
		"serie %s fora do formato cadastrado":                                "serie %s fuera del formato registrado",
		"serie %s sem lote valido desta linha":                               "serie %s sin lote válido de esta línea",
		"item do pedido %s: recebido %d + %d passa do limite de %d":          "ítem de la orden %s: recibido %d + %d supera el límite de %d",
		"um pedido de compra da nota foi encerrado ou cancelado":             "una orden de compra de la nota fue cerrada o cancelada",
		"o saldo do pedido mudou -- confira de novo":                         "el saldo de la orden cambió -- revise de nuevo",
		"o lote %s ja existe com outra validade -- confira com o fornecedor": "el lote %s ya existe con otra vigencia -- confirme con el proveedor",
		"serie %s ja existe para a peca %s":                                  "la serie %s ya existe para la pieza %s",

		// handlers
		"O identificador da nota deve ser numerico":                "El identificador de la nota debe ser numérico",
		"O identificador deve ser numerico":                        "El identificador debe ser numérico",
		"Certificado anexado de um arquivo que voce nao pode ver":  "Certificado adjunto de un archivo que usted no puede ver",
		"Envie pedido_compra_id e o arquivo (multipart/form-data)": "Envíe pedido_compra_id y el archivo (multipart/form-data)",
		"Informe pedido_compra_id":                                 "Informe pedido_compra_id",
		"Envie o XML no campo 'arquivo'":                           "Envíe el XML en el campo 'arquivo'",
	})
}
