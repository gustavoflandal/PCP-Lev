package httpx

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

// validador e reutilizado entre requisicoes: a instancia guarda um cache de
// reflexao e e segura para uso concorrente.
var validador = novoValidador()

func novoValidador() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())

	// Reportar o campo pelo nome do JSON, que e o que o cliente enviou.
	v.RegisterTagNameFunc(func(campo reflect.StructField) string {
		nome := strings.Split(campo.Tag.Get("json"), ",")[0]
		if nome == "" || nome == "-" {
			return campo.Name
		}
		return nome
	})
	return v
}

// Validar aplica as regras declaradas nas tags `validate` e devolve os
// problemas encontrados, ou nil quando a requisicao esta valida.
func Validar(requisicao any) []CampoInvalido {
	err := validador.Struct(requisicao)
	if err == nil {
		return nil
	}

	var problemas validator.ValidationErrors
	if !asValidationErrors(err, &problemas) {
		return []CampoInvalido{{Campo: "requisicao", Mensagem: "Dados invalidos"}}
	}

	detalhes := make([]CampoInvalido, 0, len(problemas))
	for _, p := range problemas {
		detalhes = append(detalhes, CampoInvalido{
			Campo:    p.Field(),
			Mensagem: mensagemDe(p),
		})
	}
	return detalhes
}

func asValidationErrors(err error, destino *validator.ValidationErrors) bool {
	problemas, ok := err.(validator.ValidationErrors)
	if ok {
		*destino = problemas
	}
	return ok
}

// mensagemDe traduz a regra violada para uma mensagem em pt-BR.
func mensagemDe(p validator.FieldError) string {
	switch p.Tag() {
	case "required":
		return "Campo obrigatorio"
	case "min":
		if p.Kind() == reflect.String {
			return fmt.Sprintf("Deve ter no minimo %s caracteres", p.Param())
		}
		return fmt.Sprintf("Deve ser maior ou igual a %s", p.Param())
	case "max":
		if p.Kind() == reflect.String {
			return fmt.Sprintf("Deve ter no maximo %s caracteres", p.Param())
		}
		return fmt.Sprintf("Deve ser menor ou igual a %s", p.Param())
	case "gt":
		return fmt.Sprintf("Deve ser maior que %s", p.Param())
	case "gte":
		return fmt.Sprintf("Deve ser maior ou igual a %s", p.Param())
	case "email":
		return "E-mail invalido"
	case "oneof":
		return fmt.Sprintf("Deve ser um dos valores: %s", strings.ReplaceAll(p.Param(), " ", ", "))
	case "len":
		return fmt.Sprintf("Deve ter exatamente %s caracteres", p.Param())
	case "numeric":
		return "Deve conter apenas digitos"
	case "gtfield":
		return fmt.Sprintf("Deve ser maior que %s", p.Param())
	default:
		return "Valor invalido"
	}
}
