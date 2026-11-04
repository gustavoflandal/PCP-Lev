package i18n

// Mensagens da importacao de cadastros por planilha.
func init() {
	Registrar(Espanhol, map[string]string{
		"Envie a planilha (.xlsx) no campo 'arquivo'":                           "Envíe la planilla (.xlsx) en el campo 'arquivo'",
		"A planilha passa do tamanho máximo de 10 MB":                           "La planilla supera el tamaño máximo de 10 MB",
		"Envie uma planilha Excel no formato .xlsx (use o gabarito do sistema)": "Envíe una planilla Excel en formato .xlsx (use la plantilla del sistema)",
		"Não foi possível ler o arquivo enviado":                                "No fue posible leer el archivo enviado",
	})
}
