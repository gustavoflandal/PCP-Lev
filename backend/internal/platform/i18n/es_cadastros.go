package i18n

// Cadastros: clientes, fornecedores, partes/pecas, produtos acabados, centros
// de trabalho, empresa, regional, parametros de negocio e anexos.
func init() {
	Registrar(Espanhol, map[string]string{
		// cliente
		"informe o tipo do cliente: orgao publico, concessionaria, integrador ou outro": "informe el tipo de cliente: organismo público, concesionaria, integrador u otro",
		"a razao social e obrigatoria (ate 255 caracteres)":                             "la razón social es obligatoria (hasta 255 caracteres)",
		"o CNPJ informado e invalido":                                                   "el CNPJ informado es inválido",
		"o email de contato e invalido":                                                 "el correo electrónico de contacto es inválido",
		"o telefone de contato deve ter DDD e 8 ou 9 digitos":                           "el teléfono de contacto debe tener código de área (DDD) y 8 o 9 dígitos",
		"UF invalida": "UF inválida",
		"o fim da vigencia do contrato nao pode ser antes do inicio": "el fin de la vigencia del contrato no puede ser anterior al inicio",
		"um dos campos passou do tamanho maximo":                     "uno de los campos superó el tamaño máximo",
		"ja existe um cliente com este CNPJ":                         "ya existe un cliente con este CNPJ",
		"cliente nao encontrado":                                     "cliente no encontrado",
		"O identificador do cliente deve ser numerico":               "El identificador del cliente debe ser numérico",
		"tipo invalido": "tipo inválido",

		// fornecedor
		"a razao social e obrigatoria":                                            "la razón social es obligatoria",
		"o lead time medio deve ser maior que zero":                               "el lead time promedio debe ser mayor que cero",
		"ja existe um fornecedor com este CNPJ":                                   "ya existe un proveedor con este CNPJ",
		"fornecedor nao encontrado":                                               "proveedor no encontrado",
		"o fornecedor possui pedidos de compra pendentes e nao pode ser excluido": "el proveedor tiene órdenes de compra pendientes y no puede ser eliminado",
		"O identificador do fornecedor deve ser numerico":                         "El identificador del proveedor debe ser numérico",

		// parte/peca
		"o codigo da parte/peca e obrigatorio":                                "el código de la parte/pieza es obligatorio",
		"a descricao deve ter no minimo 5 caracteres":                         "la descripción debe tener como mínimo 5 caracteres",
		"a unidade de medida e obrigatoria":                                   "la unidad de medida es obligatoria",
		"o estoque minimo nao pode ser negativo":                              "el inventario mínimo no puede ser negativo",
		"o estoque minimo deve ser menor que o estoque maximo":                "el inventario mínimo debe ser menor que el inventario máximo",
		"o lead time de compra deve ser maior que zero":                       "el lead time de compra debe ser mayor que cero",
		"ja existe uma parte/peca com este codigo":                            "ya existe una parte/pieza con este código",
		"parte/peca nao encontrada":                                           "parte/pieza no encontrada",
		"o fornecedor padrao informado nao existe":                            "el proveedor estándar informado no existe",
		"a parte/peca possui movimentacao de estoque e nao pode ser excluida": "la parte/pieza tiene movimientos de inventario y no puede ser eliminada",
		"O identificador da parte/peca deve ser numerico":                     "El identificador de la parte/pieza debe ser numérico",

		// produto acabado
		"o codigo do produto e obrigatorio":                         "el código del producto es obligatorio",
		"o preco de venda deve ser maior que zero":                  "el precio de venta debe ser mayor que cero",
		"o lead time de producao deve ser maior que zero":           "el lead time de producción debe ser mayor que cero",
		"ja existe um produto acabado com este codigo":              "ya existe un producto terminado con este código",
		"produto acabado nao encontrado":                            "producto terminado no encontrado",
		"o produto possui pedidos de venda e nao pode ser excluido": "el producto tiene pedidos de venta y no puede ser eliminado",
		"o produto esta em uso na estrutura de outro produto; remova-o das BOMs antes de desativar o uso como componente":                    "el producto está en uso en la estructura de otro producto; quítelo de las BOM antes de desactivar su uso como componente",
		"ja existe uma parte/peca com este codigo; use um codigo diferente ou remova a parte/peca antes de ativar o produto como componente": "ya existe una parte/pieza con este código; use un código diferente o elimine la parte/pieza antes de activar el producto como componente",
		"O identificador do produto deve ser numerico": "El identificador del producto debe ser numérico",

		// centro de trabalho
		"o codigo deve ter de 2 a 20 caracteres: letras maiusculas, numeros, hifen ou sublinhado":           "el código debe tener de 2 a 20 caracteres: letras mayúsculas, números, guion o guion bajo",
		"informe a etapa: separacao, montagem, testes ou expedicao":                                         "informe la etapa: separación, montaje, pruebas o despacho",
		"a capacidade deve ser maior que zero e no maximo 24 horas por dia, com no maximo uma casa decimal": "la capacidad debe ser mayor que cero y como máximo 24 horas por día, con un máximo de un decimal",
		"a descricao vai ate 255 caracteres":                                                                "la descripción admite hasta 255 caracteres",
		"o custo por hora nao pode ser negativo":                                                            "el costo por hora no puede ser negativo",
		"ja existe um centro de trabalho com este codigo":                                                   "ya existe un centro de trabajo con este código",
		"centro de trabalho nao encontrado":                                                                 "centro de trabajo no encontrado",
		"O identificador do centro de trabalho deve ser numerico":                                           "El identificador del centro de trabajo debe ser numérico",
		"etapa invalida": "etapa inválida",

		// empresa
		"a UF deve ter 2 letras":                                                          "la UF debe tener 2 letras",
		"o email institucional e invalido":                                                "el correo electrónico institucional es inválido",
		"o telefone deve ter DDD e 8 ou 9 digitos":                                        "el teléfono debe tener código de área (DDD) y 8 o 9 dígitos",
		"o CEP deve ter 8 digitos":                                                        "el CEP debe tener 8 dígitos",
		"um campo excede o tamanho maximo permitido":                                      "un campo excede el tamaño máximo permitido",
		"a imagem deve ser PNG ou SVG":                                                    "la imagen debe ser PNG o SVG",
		"a imagem excede o tamanho maximo permitido":                                      "la imagen excede el tamaño máximo permitido",
		"a imagem esta abaixo da dimensao minima exigida":                                 "la imagen está por debajo de la dimensión mínima exigida",
		"um campo excede o tamanho maximo permitido: %s deve ter no maximo %d caracteres": "un campo excede el tamaño máximo permitido: %s debe tener como máximo %d caracteres",
		"Imagem em base64 invalida":                                                       "Imagen en base64 inválida",
		"Imagem nao configurada":                                                          "Imagen no configurada",

		// regional
		"formato de data invalido": "formato de fecha inválido",
		"formato de hora invalido": "formato de hora inválido",

		// parametros de negocio
		"metodo de custeio invalido":                                          "método de costeo inválido",
		"a tolerancia de recebimento deve ficar entre 0% e 100%":              "la tolerancia de recepción debe estar entre 0% y 100%",
		"o lead time padrao deve ficar entre 1 e 365 dias":                    "el lead time estándar debe estar entre 1 y 365 días",
		"o limite de emissao do Gestor deve ficar entre 0 e 9.999.999.999,99": "el límite de emisión del Gestor debe estar entre 0 y 9.999.999.999,99",
		"o minimo de cotacoes deve ficar entre 0 e 10":                        "el mínimo de cotizaciones debe estar entre 0 y 10",
		"o valor que exige cotacoes deve ficar entre 0 e 9.999.999.999,99":    "el valor que exige cotizaciones debe estar entre 0 y 9.999.999.999,99",
		"a tolerancia de divergencia de preco deve ficar entre 0% e 100%":     "la tolerancia de divergencia de precio debe estar entre 0% y 100%",
		"a acao para divergencia de preco deve ser BLOQUEAR ou APROVAR":       "la acción para divergencia de precio debe ser BLOQUEAR o APROVAR",

		// controle de lote / serie
		"controle de validade so existe junto com controle de lote":                               "el control de vigencia solo existe junto con el control de lote",
		"a mascara de numero de serie deve ser uma expressao regular valida (ate 120 caracteres)": "la máscara del número de serie debe ser una expresión regular válida (hasta 120 caracteres)",
		"a validade minima vai de 0 a 3650 dias":                                                  "la vigencia mínima va de 0 a 3650 días",
		"numero de serie fora do formato cadastrado para o item":                                  "número de serie fuera del formato registrado para el ítem",

		// anexos e arquivos
		"entidade de anexo invalida":                                                              "entidad de adjunto inválida",
		"o registro ao qual o anexo seria vinculado nao existe":                                   "el registro al que se vincularía el adjunto no existe",
		"tipo de anexo invalido":                                                                  "tipo de adjunto inválido",
		"foto precisa ser JPG, PNG ou WebP":                                                       "la foto debe ser JPG, PNG o WebP",
		"documento tecnico precisa ser PDF":                                                       "el documento técnico debe ser PDF",
		"escolha a categoria do documento":                                                        "elija la categoría del documento",
		"a galeria ja tem 10 fotos -- remova uma antes":                                           "la galería ya tiene 10 fotos -- elimine una antes",
		"titulo ate 150, descricao ate 500, versao ate 20 e categoria ate 40 caracteres":          "título hasta 150, descripción hasta 500, versión hasta 20 y categoría hasta 40 caracteres",
		"a validade nao pode ser anterior a emissao":                                              "la vigencia no puede ser anterior a la emisión",
		"a versao anterior pertence a outro registro ou tipo":                                     "la versión anterior pertenece a otro registro o tipo",
		"anexo nao encontrado":                                                                    "adjunto no encontrado",
		"item critico precisa de foto principal -- envie outra antes de remover esta":             "el ítem crítico necesita una foto principal -- envíe otra antes de eliminar esta",
		"a nota fiscal ja foi efetivada ou encerrada: os anexos dela nao podem ser removidos":     "la nota fiscal ya fue efectivizada o cerrada: sus adjuntos no pueden eliminarse",
		"o registro esta encerrado: os anexos dele ficam como registro e nao podem ser removidos": "el registro está cerrado: sus adjuntos quedan como constancia y no pueden eliminarse",
		"identificador de arquivo invalido":                                                       "identificador de archivo inválido",
		"tipo de arquivo nao aceito -- envie JPG, PNG, WebP, PDF ou o XML da NF-e":                "tipo de archivo no aceptado -- envíe JPG, PNG, WebP, PDF o el XML de la NF-e",
		"arquivo grande demais: imagem ate 5 MB, PDF ate 25 MB, XML ate 2 MB":                     "archivo demasiado grande: imagen hasta 5 MB, PDF hasta 25 MB, XML hasta 2 MB",
		"arquivo vazio":          "archivo vacío",
		"arquivo nao encontrado": "archivo no encontrado",
		"link do arquivo invalido ou expirado -- abra de novo pela tela":        "enlace del archivo inválido o expirado -- ábralo de nuevo desde la pantalla",
		"imagem grande demais em pixels: ate 10000 px por lado e 40 megapixels": "imagen demasiado grande en píxeles: hasta 10000 px por lado y 40 megapíxeles",
		"imagem vazia": "imagen vacía",
		"tipo de arquivo nao aceito -- envie JPG, PNG, WebP, PDF ou o XML da NF-e: imagem ilegivel": "tipo de archivo no aceptado -- envíe JPG, PNG, WebP, PDF o el XML de la NF-e: imagen ilegible",
		"Envie o arquivo no campo 'arquivo' (multipart/form-data)":                                  "Envíe el archivo en el campo 'arquivo' (multipart/form-data)",
		"Nao foi possivel ler o arquivo":                                                            "No fue posible leer el archivo",
		"Informe entidade e entidade_id":                                                            "Informe entidade y entidade_id",
		"O identificador do anexo deve ser numerico":                                                "El identificador del adjunto debe ser numérico",

		// banco de dados (painel de saude)
		"banco de dados indisponivel": "base de datos no disponible",
	})
}
