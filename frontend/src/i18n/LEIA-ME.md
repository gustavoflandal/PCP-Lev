# Internacionalização (português / espanhol)

O português é o idioma de origem e funciona como **chave**. O espanhol fica em
`i18n/es/<grupo>.ts` (um arquivo por grupo de telas, `Record<string, string>`).
O idioma é uma preferência do usuário (`store/preferencias.ts`, campo `idioma`,
gravado em `usuarios.idioma`); a API também responde no idioma escolhido
(cabeçalho `Accept-Language`).

## API (`import { t, td, marcar } from '@/i18n'`)

| Função | Quando usar |
|---|---|
| `t('Texto', { n: 3 })` | Texto conhecido ao escrever o código. Interpola `{n}`. Roda **na renderização**, nunca na carga do módulo. |
| `marcar('Texto')` | Constante de módulo (listas de opções, mapas de rótulos, mensagens): devolve o próprio texto, sem traduzir, mas o teste exige a tradução no dicionário. Quem renderiza chama `td(valor)`. Quando der, prefira transformar a constante em função (`const opcoes = () => [...]` com `t('...')` dentro). |
| `td(valor)` | Texto só conhecido em execução (vindo da API, de enum, de status). Sem tradução devolve o original. As traduções entram no dicionário normalmente. |

## Regras (o teste `completude.test.ts` as verifica)

1. O primeiro argumento de `t()` e `marcar()` é **sempre um literal** (aspas
   simples, duplas ou template **sem** `${}`). Valores variáveis entram por
   `{nome}` e pelo segundo argumento.
2. Todo literal passado a `t()`/`marcar()` precisa existir como chave no
   dicionário `es`, com os mesmos `{parametros}`.
3. Não concatene frases traduzidas; traduza a frase inteira com parâmetros.
   Plural: duas chaves (`'1 item'` / `'{n} itens'`) escolhidas no código.
4. Traduza **tudo que o usuário lê**: títulos, rótulos, botões, placeholders,
   `aria-label`, `title`, mensagens de toast/erro/vazio, mensagens do zod,
   cabeçalhos de tabela, status, opções de `<select>`, textos de impressão.
5. Não traduza: dados do banco (nomes de peças, fornecedores, descrições),
   códigos, identificadores, URLs, e-mails, nomes próprios.
6. Comentários de código ficam em português; não escreva `t('...')` dentro de
   comentários (o teste os leria como uso).
7. Formatos de data, número e moeda continuam vindo de *Parâmetros regionais*
   (`lib/formato.ts`) — a língua muda só os textos (e nomes de mês/dia).

## Espanhol: estilo e glossário

Espanhol latino-americano neutro, tratamento de **usted** ("Ingrese", "Seleccione",
"Guarde"). Mantenha o glossário para o sistema inteiro soar igual:

| Português | Español |
|---|---|
| Salvar / Cancelar / Excluir / Inativar / Editar | Guardar / Cancelar / Eliminar / Inactivar / Editar |
| Novo / Nova | Nuevo / Nueva |
| Buscar / Filtrar / Limpar | Buscar / Filtrar / Limpiar |
| Parte/peça (partes e peças) | Parte/pieza (partes y piezas) |
| Produto acabado | Producto terminado |
| Estrutura de produtos (BOM) | Estructura de productos (BOM) |
| Versão vigente | Versión vigente |
| Fornecedor | Proveedor |
| Cliente | Cliente |
| Cotação | Cotización |
| Pedido de compra (PC) | Orden de compra (OC) |
| Pedido de venda | Pedido de venta |
| Necessidade de compra | Necesidad de compra |
| Ordem de produção (OP) | Orden de producción (OP) |
| Centro de trabalho | Centro de trabajo |
| Estoque / Saldo | Inventario / Saldo |
| Lote / Número de série | Lote / Número de serie |
| Nota fiscal (NF-e) | Nota fiscal (NF-e) |
| Recebimento | Recepción |
| Efetivar / Conferir | Confirmar (efectivizar) / Verificar |
| Rastreabilidade | Trazabilidad |
| Metrologia | Metrología |
| Auditoria | Auditoría |
| Perfil / Permissão | Perfil / Permiso |
| Usuário / Senha | Usuario / Contraseña |
| Painel (indicadores) | Panel |
| Atraso / Em atraso | Retraso / Con retraso |
| Lead time | Lead time (plazo de entrega) |
| Almoxarife | Almacenista |
| Ajuda | Ayuda |
| Vigência | Vigencia |
| Laudo / Certificado | Informe / Certificado |
| Entrega / Expedição | Entrega / Despacho |

Siglas e termos fiscais brasileiros (NF-e, CNPJ, CPF, CEP, ICMS, NCM, XML)
permanecem como estão.
