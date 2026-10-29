/** Traducoes para espanhol -- grupo "ajuda". Chave: texto em portugues. */
const traducoes: Record<string, string> = {
  Ajuda: 'Ayuda',

  // Entrar
  'Ajuda · Entrar': 'Ayuda · Ingresar',
  'Use o usuário e a senha fornecidos pelo administrador do sistema.':
    'Use el usuario y la contraseña proporcionados por el administrador del sistema.',
  'O ícone de olho ao lado da senha mostra o que foi digitado, para conferir antes de enviar.':
    'El ícono de ojo junto a la contraseña muestra lo que se escribió, para verificarlo antes de enviar.',
  'Se a sessão cair por inatividade, basta entrar de novo — nada do que já foi salvo se perde.':
    'Si la sesión se cierra por inactividad, basta con ingresar de nuevo: nada de lo que ya se guardó se pierde.',
  'Depois de 5 senhas erradas seguidas, a conta fica bloqueada por alguns minutos. Para liberar antes, peça ao administrador que redefina a sua senha.':
    'Después de 5 contraseñas incorrectas seguidas, la cuenta queda bloqueada por unos minutos. Para liberarla antes, pida al administrador que restablezca su contraseña.',

  // Painel
  'Ajuda · Painel': 'Ayuda · Panel',
  'O painel mostra os números de agora de cada módulo que você acompanha: OPs em atraso, pedidos de compra a receber e em atraso, insumos críticos, notas aguardando efetivação, lotes e metrologia vencendo em 30 dias e pedidos de venda.':
    'El panel muestra las cifras actuales de cada módulo que usted sigue: OP con retraso, órdenes de compra por recibir y con retraso, insumos críticos, notas esperando confirmación, lotes y metrología que vencen en 30 días y pedidos de venta.',
  'Os números se atualizam sozinhos a cada minuto; "Atualizar agora" busca na hora. Clique num cartão para abrir a tela correspondente.':
    'Las cifras se actualizan solas cada minuto; "Actualizar ahora" las busca de inmediato. Haga clic en una tarjeta para abrir la pantalla correspondiente.',
  'Cartão com ícone de alerta e borda laranja pede atenção (atraso, item crítico, vencimento próximo).':
    'Una tarjeta con ícono de alerta y borde naranja requiere atención (retraso, ítem crítico, vencimiento próximo).',
  'Os painéis de cada setor, com gráficos e período, ficam no grupo Painéis do menu.':
    'Los paneles de cada sector, con gráficos y período, están en el grupo Paneles del menú.',
  'O cartão "Conexão com o servidor" avisa quando a API está fora do ar: nenhuma tela de cadastro vai funcionar até ela voltar.':
    'La tarjeta "Conexión con el servidor" avisa cuando la API está fuera de servicio: ninguna pantalla de registro funcionará hasta que vuelva.',

  // Paineis (comum)
  'Período (30, 90, 180 ou 365 dias) vale para os números de fluxo — comprado, entregue, concluído, testado, lead time. Os números de agora (em aberto, em atraso, críticos, a vencer) não dependem do período.':
    'El período (30, 90, 180 o 365 días) vale para las cifras de flujo: comprado, entregado, concluido, probado, lead time. Las cifras actuales (abiertas, con retraso, críticas, por vencer) no dependen del período.',
  'Atualização automática: escolha de 30 s a 10 min, ou Desligada. "Atualizar agora" busca os números na hora; o horário da última atualização fica ao lado.':
    'Actualización automática: elija de 30 s a 10 min, o Desactivada. "Actualizar ahora" busca las cifras de inmediato; la hora de la última actualización queda al lado.',
  '"Ver dados", ao lado do título de cada gráfico, mostra a mesma informação em tabela, para conferir os números.':
    '"Ver datos", junto al título de cada gráfico, muestra la misma información en una tabla, para verificar las cifras.',
  'Modo TV: tela cheia, sem menu nem cabeçalho e com letra maior, para deixar o painel numa TV da fábrica. Enquanto a aba estiver visível, a sessão não cai por inatividade. Esc ou "Sair do modo TV" voltam ao normal.':
    'Modo TV: pantalla completa, sin menú ni encabezado y con letra más grande, para dejar el panel en un televisor de la fábrica. Mientras la pestaña esté visible, la sesión no se cierra por inactividad. Esc o "Salir del modo TV" vuelven a la vista normal.',
  'Período, atualização e modo TV ficam no endereço da página: salve o endereço como favorito na TV para o painel abrir pronto.':
    'El período, la actualización y el modo TV quedan en la dirección de la página: guarde la dirección como favorita en el televisor para que el panel abra listo.',

  // Painel de compras
  'Ajuda · Painel de compras': 'Ayuda · Panel de compras',
  'PCs em aberto, em atraso, lead time real médio (do pedido à última nota) e percentual recebido no prazo.':
    'OC abiertas, con retraso, lead time real promedio (del pedido a la última nota) y porcentaje recibido a tiempo.',
  'Gráficos: pedidos por situação, valor comprado por mês, fornecedores com mais atrasos e lead time por fornecedor (os 8 maiores).':
    'Gráficos: pedidos por situación, valor comprado por mes, proveedores con más retrasos y lead time por proveedor (los 8 mayores).',

  // Painel de estoque
  'Ajuda · Painel de recebimento e estoque': 'Ayuda · Panel de recepción e inventario',
  'Valor em estoque pelo custo médio, itens críticos, notas aguardando efetivação e lotes vencidos ou vencendo em 30 dias.':
    'Valor del inventario al costo promedio, ítems críticos, notas esperando confirmación y lotes vencidos o que vencen en 30 días.',
  'O valor em estoque e o gráfico dos itens de maior valor só aparecem para quem pode ver custos.':
    'El valor del inventario y el gráfico de los ítems de mayor valor solo aparecen para quienes pueden ver costos.',
  'Gráficos: valor efetivado por mês, notas por situação, lotes por faixa de vencimento e os 10 itens de maior valor.':
    'Gráficos: valor confirmado por mes, notas por situación, lotes por rango de vencimiento y los 10 ítems de mayor valor.',

  // Painel de producao
  'Ajuda · Painel de produção': 'Ayuda · Panel de producción',
  'OPs abertas, liberadas, concluídas no período e em atraso, lead time médio (da liberação à conclusão) e horas apontadas.':
    'OP abiertas, liberadas, concluidas en el período y con retraso, lead time promedio (de la liberación a la conclusión) y horas registradas.',
  'Gráficos: OPs por etapa, concluídas por semana, horas por centro de trabalho e produtos com mais OPs em atraso.':
    'Gráficos: OP por etapa, concluidas por semana, horas por centro de trabajo y productos con más OP con retraso.',

  // Painel de vendas
  'Ajuda · Painel de vendas e expedição': 'Ayuda · Panel de ventas y despacho',
  'Carteira (valor dos pedidos ainda não entregues), pedidos em atraso, valor entregue no período e entregas no prazo (OTD).':
    'Cartera (valor de los pedidos aún no entregados), pedidos con retraso, valor entregado en el período y entregas a tiempo (OTD).',
  'Gráficos: pedidos por situação, valor entregue por mês, OTD por mês e os 8 principais clientes por valor.':
    'Gráficos: pedidos por situación, valor entregado por mes, OTD por mes y los 8 principales clientes por valor.',

  // Painel de qualidade
  'Ajuda · Painel de qualidade': 'Ayuda · Panel de calidad',
  'Unidades testadas, aprovadas e reprovadas no período, taxa de aprovação e verificações metrológicas vencidas ou vencendo em 30 dias.':
    'Unidades probadas, aprobadas y reprobadas en el período, tasa de aprobación y verificaciones metrológicas vencidas o que vencen en 30 días.',
  'Gráficos: aprovação por semana, produtos com mais reprovações e metrologia por faixa de vencimento.':
    'Gráficos: aprobación por semana, productos con más reprobaciones y metrología por rango de vencimiento.',

  // Fornecedores
  'Ajuda · Fornecedores': 'Ayuda · Proveedores',
  'Use "Novo fornecedor" para cadastrar; CNPJ pode ser digitado com ou sem pontuação.':
    'Use "Nuevo proveedor" para registrar; el CNPJ puede escribirse con o sin puntuación.',
  'Busque por razão social, CNPJ ou contato, e filtre por situação (Ativos, Inativos ou Todos).':
    'Busque por razón social, CNPJ o contacto, y filtre por situación (Activos, Inactivos o Todos).',
  'Clique no cabeçalho de uma coluna para ordenar por ela; clique de novo para inverter.':
    'Haga clic en el encabezado de una columna para ordenar por ella; haga clic de nuevo para invertir el orden.',
  '"Inativar" preserva o histórico e tira o fornecedor das listas de seleção; para reativar, edite o registro e mude a situação.':
    '"Inactivar" preserva el historial y quita al proveedor de las listas de selección; para reactivarlo, edite el registro y cambie la situación.',
  '"Itens do fornecedor (de-para)" liga o código e a unidade do fornecedor à nossa peça, com o fator de conversão (ex.: caixa com 100). A importação do XML da NF-e reconhece os itens por aqui.':
    '"Ítems del proveedor (equivalencias)" vincula el código y la unidad del proveedor con nuestra pieza, con el factor de conversión (ej.: caja con 100). La importación del XML de la NF-e reconoce los ítems por aquí.',
  '"Documentos" guarda contrato, certificado de qualidade, documentos cadastrais e tabela de preços (PDF ou imagem). Com validade informada, o documento entra em Documentos a vencer; "Nova versão" renova sem apagar a anterior.':
    '"Documentos" guarda contrato, certificado de calidad, documentos de registro y lista de precios (PDF o imagen). Con vigencia informada, el documento entra en Documentos por vencer; "Nueva versión" renueva sin borrar la anterior.',

  // Clientes
  'Ajuda · Clientes': 'Ayuda · Clientes',
  'Use "Novo cliente" para cadastrar; tipo, razão social e CNPJ são obrigatórios. O CNPJ pode ser digitado com ou sem pontuação.':
    'Use "Nuevo cliente" para registrar; tipo, razón social y CNPJ son obligatorios. El CNPJ puede escribirse con o sin puntuación.',
  'Busque por razão social, nome fantasia, CNPJ, cidade ou nº do contrato, e filtre por situação e tipo.':
    'Busque por razón social, nombre comercial, CNPJ, ciudad o n.º de contrato, y filtre por situación y tipo.',
  'O selo "Contrato vencido" aparece quando o fim da vigência já passou — é só um aviso: o cliente continua utilizável. Para renovar, edite a vigência.':
    'La etiqueta "Contrato vencido" aparece cuando el fin de la vigencia ya pasó; es solo un aviso: el cliente sigue siendo utilizable. Para renovar, edite la vigencia.',
  '"Documentos" guarda contrato, documentos cadastrais e termos de aceite do cliente. Com validade informada, o documento entra em Documentos a vencer.':
    '"Documentos" guarda contrato, documentos de registro y actas de aceptación del cliente. Con vigencia informada, el documento entra en Documentos por vencer.',
  '"Inativar" preserva o histórico; para reativar, edite o registro e mude a situação.':
    '"Inactivar" preserva el historial; para reactivar, edite el registro y cambie la situación.',

  // Centros de trabalho
  'Ajuda · Centros de trabalho': 'Ayuda · Centros de trabajo',
  'Cada centro de trabalho (bancada ou posto) pertence a uma etapa da produção: Separação, Montagem, Testes ou Expedição.':
    'Cada centro de trabajo (banco o puesto) pertenece a una etapa de la producción: Separación, Montaje, Pruebas o Despacho.',
  'O código (ex.: MONT-01) identifica o centro nas ordens de produção e não pode ser alterado depois de cadastrado.':
    'El código (ej.: MONT-01) identifica el centro en las órdenes de producción y no puede modificarse después de registrado.',
  'A capacidade em horas por dia é opcional (até 24) e será usada no planejamento da produção.':
    'La capacidad en horas por día es opcional (hasta 24) y se usará en la planificación de la producción.',
  'O custo por hora (R$) é opcional e entra no custo real das ordens de produção (horas apontadas × custo/hora).':
    'El costo por hora (R$) es opcional y entra en el costo real de las órdenes de producción (horas registradas × costo/hora).',
  'Busque por código ou nome, e filtre por situação e etapa. "Inativar" preserva o histórico.':
    'Busque por código o nombre, y filtre por situación y etapa. "Inactivar" preserva el historial.',

  // Partes e pecas
  'Ajuda · Partes e peças': 'Ayuda · Partes y piezas',
  'Use "Nova peça" para cadastrar; código e descrição são obrigatórios.':
    'Use "Nueva pieza" para registrar; código y descripción son obligatorios.',
  'Estoque mínimo e máximo definem a faixa de reposição usada pelo módulo de estoque.':
    'El inventario mínimo y máximo definen el rango de reposición usado por el módulo de inventario.',
  'Controle do item: série, lote e validade (só com lote) passam a ser exigidos no recebimento; "Validade mínima" recusa lote com menos dias restantes e a "Máscara" (expressão regular, sem ^ e $) confere o formato da série.':
    'Control del ítem: serie, lote y vencimiento (solo con lote) pasan a ser exigidos en la recepción; "Validez mínima" rechaza lotes con menos días restantes y la "Máscara" (expresión regular, sin ^ ni $) verifica el formato de la serie.',
  '"Item crítico" exige foto principal: ela não pode ser removida sem outra no lugar. A coluna Foto mostra o selo "Sem foto" quando falta.':
    '"Ítem crítico" exige foto principal: no puede eliminarse sin otra en su lugar. La columna Foto muestra la etiqueta "Sin foto" cuando falta.',
  '"Mídia e documentos" abre as fotos (principal + galeria de até 10, JPG/PNG/WebP até 5 MB, com giro de 90° antes de enviar) e os documentos em PDF (até 25 MB), com categoria, validade e histórico de versões.':
    '"Multimedia y documentos" abre las fotos (principal + galería de hasta 10, JPG/PNG/WebP de hasta 5 MB, con giro de 90° antes de enviar) y los documentos en PDF (hasta 25 MB), con categoría, vigencia e historial de versiones.',
  'Busque por código ou descrição, e filtre por situação (Ativos, Inativos ou Todos).':
    'Busque por código o descripción, y filtre por situación (Activos, Inactivos o Todos).',

  // Produtos acabados
  'Ajuda · Produtos acabados': 'Ayuda · Productos terminados',
  'Use "Novo produto" para cadastrar; código, descrição e preço de venda são obrigatórios.':
    'Use "Nuevo producto" para registrar; código, descripción y precio de venta son obligatorios.',
  'O lead time de produção informa o módulo de produção sobre o prazo esperado.':
    'El lead time de producción informa al módulo de producción sobre el plazo esperado.',
  'Marque "Exige metrologia (Inmetro)" para radares: cada unidade precisa da verificação metrológica antes de sair de Testes.':
    'Marque "Exige metrología (Inmetro)" para radares: cada unidad necesita la verificación metrológica antes de salir de Pruebas.',
  'Controle do item: série, lote, validade (só com lote), item crítico (exige foto principal) e certificado no recebimento.':
    'Control del ítem: serie, lote, vencimiento (solo con lote), ítem crítico (exige foto principal) y certificado en la recepción.',
  '"Mídia e documentos" abre as fotos (principal + galeria de até 10) e os documentos em PDF versionados; um documento pode apontar a revisão da BOM a que se refere.':
    '"Multimedia y documentos" abre las fotos (principal + galería de hasta 10) y los documentos en PDF versionados; un documento puede indicar la revisión de la BOM a la que se refiere.',
  '"Nova versão" substitui o documento sem apagar o anterior: as versões antigas ficam em "Versões anteriores".':
    '"Nueva versión" reemplaza el documento sin borrar el anterior: las versiones antiguas quedan en "Versiones anteriores".',

  // Estrutura de produtos
  'Ajuda · Estrutura de produtos': 'Ayuda · Estructura de productos',
  'Cada produto acabado pode ter uma estrutura (BOM): a lista de partes/peças e a quantidade de cada uma para montar 1 unidade.':
    'Cada producto terminado puede tener una estructura (BOM): la lista de partes/piezas y la cantidad de cada una para montar 1 unidad.',
  'Uma estrutura nunca é editada nem apagada. "Nova versão" abre uma tela com os itens da versão exibida: adicione ou retire itens e, ao salvar, a nova versão terá exatamente os itens da tela e passará a ser a vigente.':
    'Una estructura nunca se edita ni se borra. "Nueva versión" abre una pantalla con los ítems de la versión mostrada: agregue o quite ítems y, al guardar, la nueva versión tendrá exactamente los ítems de la pantalla y pasará a ser la vigente.',
  'O painel do produto mostra sempre a versão mais recente. Na lista "Versões" você vê todas, consulta os itens de cada uma e pode definir qualquer versão como vigente.':
    'El panel del producto siempre muestra la versión más reciente. En la lista "Versiones" usted ve todas, consulta los ítems de cada una y puede definir cualquier versión como vigente.',
  'Só existe uma versão vigente por produto de cada vez, e é ela que vale em Produtos acabados e nas ordens de produção.':
    'Solo existe una versión vigente por producto a la vez, y es la que rige en Productos terminados y en las órdenes de producción.',

  // Cotacoes
  'Ajuda · Cotações': 'Ayuda · Cotizaciones',
  'Uma cotação nasce em Rascunho, com ao menos um item; "Enviar" registra que foi encaminhada ao fornecedor.':
    'Una cotización nace en Borrador, con al menos un ítem; "Enviar" registra que fue remitida al proveedor.',
  'Depois de enviada, "Registrar resposta" grava o preço negociado por item e recalcula o valor total.':
    'Una vez enviada, "Registrar respuesta" guarda el precio negociado por ítem y recalcula el valor total.',
  'Uma cotação Respondida pode ser convertida num pedido de compra — o preço vai travado, igual ao negociado.':
    'Una cotización Respondida puede convertirse en una orden de compra; el precio queda fijo, igual al negociado.',
  'Cancelar preserva o histórico; uma cotação cancelada não volta a nenhum status anterior.':
    'Cancelar preserva el historial; una cotización cancelada no vuelve a ningún estado anterior.',

  // Pedidos de compra
  'Ajuda · Pedidos de compra': 'Ayuda · Órdenes de compra',
  'Um pedido nasce em Rascunho; "Emitir" o envia ao fornecedor.':
    'Una orden nace en Borrador; "Emitir" la envía al proveedor.',
  'O bloco "Pedidos em atraso" no topo da lista mostra os que passaram da data de entrega prevista.':
    'El bloque "Pedidos con retraso" en la parte superior de la lista muestra los que pasaron la fecha de entrega prevista.',
  'Um pedido pode ser criado a partir de uma cotação respondida (tela da cotação) ou manualmente aqui.':
    'Una orden puede crearse a partir de una cotización respondida (pantalla de la cotización) o manualmente aquí.',
  'Cancelar só é possível enquanto o pedido não estiver Concluído ou já Cancelado.':
    'Cancelar solo es posible mientras la orden no esté Concluida o ya Cancelada.',
  'O recebimento é pela nota fiscal: no pedido aguardando entrega (ou recebido parcial), "Lançar nota fiscal" abre a nota já com o pedido escolhido; as notas do pedido aparecem no detalhe.':
    'La recepción se hace por la nota fiscal: en la orden en espera de entrega (o recibida parcialmente), "Registrar nota fiscal" abre la nota ya con la orden elegida; las notas de la orden aparecen en el detalle.',
  '"Encerrar com saldo pendente" fecha o pedido sem receber o restante (motivo de 10 a 255 caracteres) — para quando o fornecedor não vai entregar.':
    '"Cerrar con saldo pendiente" cierra la orden sin recibir el resto (motivo de 10 a 255 caracteres), para cuando el proveedor no va a entregar.',
  'Em "Documentos" do pedido, anexe a proposta ou cotação, o pedido assinado e a comunicação com o fornecedor. Pedido concluído ou cancelado ainda aceita anexo, mas nenhum documento pode ser removido.':
    'En "Documentos" de la orden, adjunte la propuesta o cotización, la orden firmada y la comunicación con el proveedor. Una orden concluida o cancelada aún acepta adjuntos, pero ningún documento puede eliminarse.',

  // Notas de entrada
  'Ajuda · Notas fiscais de entrada': 'Ayuda · Notas fiscales de entrada',
  'Nada entra no estoque sem nota: escolha o pedido de compra (aguardando entrega ou recebido parcial) — fornecedor e CNPJ vêm dele.':
    'Nada entra al inventario sin nota: elija la orden de compra (en espera de entrega o recibida parcialmente); proveedor y CNPJ vienen de ella.',
  'Modelo 55 (NF-e) exige a chave de acesso de 44 dígitos; o contador abaixo do campo mostra quantos já foram digitados.':
    'El modelo 55 (NF-e) exige la clave de acceso de 44 dígitos; el contador debajo del campo muestra cuántos ya se escribieron.',
  'Adicione os itens do pedido que chegaram (ou uma bonificação, sem pedido, com justificativa). Informe a quantidade da nota, o fator de conversão e a quantidade contada: a diferença fica pendente com o fornecedor, o estoque anda pelo que foi contado.':
    'Agregue los ítems de la orden que llegaron (o una bonificación, sin orden, con justificación). Informe la cantidad de la nota, el factor de conversión y la cantidad contada: la diferencia queda pendiente con el proveedor y el inventario se mueve según lo contado.',
  'Peça com lote: divida a linha em lotes (número, quantidade, fabricação e validade, se exigida) — a soma precisa fechar com o recebido. Certificado de conformidade em PDF quando a peça exige.':
    'Pieza con lote: divida la línea en lotes (número, cantidad, fabricación y vencimiento, si se exige); la suma debe coincidir con lo recibido. Certificado de conformidad en PDF cuando la pieza lo exige.',
  'Peça com série: bipe as séries no campo (Enter adiciona e limpa), cole uma lista (uma por linha) ou gere uma faixa (prefixo + início + fim, ex.: SN-1001 a SN-1050). O contador mostra quantas faltam.':
    'Pieza con serie: escanee las series en el campo (Enter agrega y limpia), pegue una lista (una por línea) o genere un rango (prefijo + inicio + fin, ej.: SN-1001 a SN-1050). El contador muestra cuántas faltan.',
  '"Salvar rascunho" guarda mesmo incompleto. "Conferir" salva e mostra as pendências: bloqueio (vermelho) impede; aprovação (âmbar) exige quem tem "Aprovar divergência de preço"; aviso só informa.':
    '"Guardar borrador" guarda aunque esté incompleto. "Verificar" guarda y muestra las pendientes: un bloqueo (rojo) impide; una aprobación (ámbar) requiere a quien tenga "Aprobar divergencia de precio"; un aviso solo informa.',
  '"Efetivar" dá a entrada no estoque, cria lotes e séries, atualiza o custo médio e o saldo do pedido — tudo de uma vez. Nota efetivada fica só leitura; o estorno (com motivo) só é aceito se o material ainda não foi reservado ou consumido.':
    '"Confirmar" da entrada al inventario, crea lotes y series, actualiza el costo promedio y el saldo de la orden, todo de una vez. Una nota confirmada queda de solo lectura; la reversión (con motivo) solo se acepta si el material aún no fue reservado ni consumido.',
  '"Importar XML" lê a NF-e: itens não reconhecidos são vinculados à peça uma vez e o vínculo fica memorizado para as próximas notas do fornecedor. O XML fica anexado à nota.':
    '"Importar XML" lee la NF-e: los ítems no reconocidos se vinculan a la pieza una sola vez y el vínculo queda memorizado para las próximas notas del proveedor. El XML queda adjunto a la nota.',
  'Anexe o DANFE, certificados e fotos da mercadoria, do lacre e de avarias em "Anexos e fotos do recebimento".':
    'Adjunte el DANFE, certificados y fotos de la mercancía, del precinto y de averías en "Adjuntos y fotos de la recepción".',

  // Lotes
  'Ajuda · Lotes': 'Ayuda · Lotes',
  'Lotes nascem na efetivação da nota fiscal (ou num ajuste de estoque) de peças com controle de lote.':
    'Los lotes nacen en la confirmación de la nota fiscal (o en un ajuste de inventario) de piezas con control de lote.',
  'Filtre por "Vencendo em N dias" para planejar o consumo; o selo mostra vencido (vermelho), a vencer em até 30 dias (laranja) ou válido.':
    'Filtre por "Venciendo en N días" para planificar el consumo; la etiqueta muestra vencido (rojo), por vencer en hasta 30 días (naranja) o válido.',
  'Abra um lote para o caminho "do lote ao campo": a nota de entrada, as OPs que consumiram e as unidades produzidas, com pedido e cliente. "Direta" quer dizer que a série do componente está instalada naquela unidade.':
    'Abra un lote para ver el camino "del lote al campo": la nota de entrada, las OP que lo consumieron y las unidades producidas, con pedido y cliente. "Directa" significa que la serie del componente está instalada en esa unidad.',

  // Pedidos de venda
  'Ajuda · Pedidos de venda': 'Ayuda · Pedidos de venta',
  'Um pedido nasce Aberto, com o cliente, a entrega prometida e os produtos acabados; o preço unitário vem do preço de venda do produto e pode ser ajustado.':
    'Un pedido nace Abierto, con el cliente, la entrega prometida y los productos terminados; el precio unitario viene del precio de venta del producto y puede ajustarse.',
  'No detalhe do pedido, "Gerar OP" cria a ordem de produção de cada item — o produto precisa ter estrutura (BOM) ativa.':
    'En el detalle del pedido, "Generar OP" crea la orden de producción de cada ítem; el producto debe tener una estructura (BOM) activa.',
  'Só é possível editar um pedido Aberto e sem OP ativa. Cancelar o pedido cancela as OPs ainda abertas; com OP liberada, cancele a OP antes.':
    'Solo es posible editar un pedido Abierto y sin OP activa. Cancelar el pedido cancela las OP aún abiertas; con una OP liberada, cancele primero la OP.',
  'Quando todas as OPs concluem, o pedido fica "Pronto para envio": use "Registrar entrega" para baixar o estoque e encerrar o pedido.':
    'Cuando todas las OP se concluyen, el pedido queda "Listo para envío": use "Registrar entrega" para dar de baja el inventario y cerrar el pedido.',
  'O selo "Atrasado" aparece quando a entrega prometida já passou e o pedido ainda não foi entregue.':
    'La etiqueta "Retrasado" aparece cuando la entrega prometida ya pasó y el pedido aún no fue entregado.',
  'Em "Documentos" do pedido, anexe o contrato ou edital, o pedido do cliente, o termo de aceite e a ordem de serviço. Pedido entregue ou cancelado ainda aceita anexo (o termo de aceite chega depois), mas nenhum documento pode ser removido.':
    'En "Documentos" del pedido, adjunte el contrato o licitación, el pedido del cliente, el acta de aceptación y la orden de servicio. Un pedido entregado o cancelado aún acepta adjuntos (el acta de aceptación llega después), pero ningún documento puede eliminarse.',

  // Kanban
  'Ajuda · Kanban de produção': 'Ayuda · Kanban de producción',
  'O quadro mostra as OPs liberadas nas quatro etapas fixas: Separação, Montagem, Testes e Expedição. Ele se atualiza sozinho a cada 30 segundos.':
    'El tablero muestra las OP liberadas en las cuatro etapas fijas: Separación, Montaje, Pruebas y Despacho. Se actualiza solo cada 30 segundos.',
  'Cada cartão mostra a OP, o produto, a quantidade, o cliente, o prazo e quem está apontando agora. O selo "Atrasada" indica prazo vencido.':
    'Cada tarjeta muestra la OP, el producto, la cantidad, el cliente, el plazo y quién está registrando ahora. La etiqueta "Retrasada" indica plazo vencido.',
  'Clique no cartão para abrir a OP, apontar e avançar a etapa.':
    'Haga clic en la tarjeta para abrir la OP, registrar tiempos y avanzar de etapa.',

  // Ordens de producao
  'Ajuda · Ordens de produção': 'Ayuda · Órdenes de producción',
  '"Liberar OP" reserva todo o material da BOM de uma vez (tudo ou nada). Se faltar alguma peça, a tela lista o que falta e nada é reservado.':
    '"Liberar OP" reserva todo el material de la BOM de una vez (todo o nada). Si falta alguna pieza, la pantalla lista lo que falta y no se reserva nada.',
  'Para trabalhar numa etapa, escolha o centro de trabalho e "Iniciar apontamento"; ao terminar, "Encerrar apontamento". O operador é sempre quem está logado.':
    'Para trabajar en una etapa, elija el centro de trabajo y "Iniciar registro de tiempo"; al terminar, "Finalizar registro de tiempo". El operador es siempre quien tiene la sesión iniciada.',
  '"Avançar etapa" exige ao menos um apontamento encerrado na etapa. Ao sair da Separação o material reservado é baixado do estoque.':
    '"Avanzar etapa" exige al menos un registro de tiempo finalizado en la etapa. Al salir de Separación, el material reservado se da de baja del inventario.',
  'Em Testes, registre Aprovado ou Reprovado em cada unidade (a reprovação exige descrever o defeito). Se o produto exige metrologia, preencha-a em todas as unidades.':
    'En Pruebas, registre Aprobado o Reprobado en cada unidad (la reprobación exige describir el defecto). Si el producto exige metrología, complétela en todas las unidades.',
  'Na Expedição, "Concluir OP" coloca as unidades no estoque de produto acabado. Cancelar só é possível antes do consumo do material.':
    'En Despacho, "Concluir OP" coloca las unidades en el inventario de producto terminado. Cancelar solo es posible antes del consumo del material.',
  'O quadro de custo (orçado × realizado) só aparece para quem tem a permissão "Ver custo real das OPs".':
    'El cuadro de costos (presupuestado × realizado) solo aparece para quienes tienen el permiso "Ver costo real de las OP".',
  'Em "Documentos e laudos", anexe laudos de teste, relatórios de inspeção, fotos da produção e desenhos. Laudos e relatórios aparecem na ficha as-built de cada unidade. OP concluída ou cancelada ainda aceita anexo, sem remoção.':
    'En "Documentos e informes", adjunte informes de prueba, reportes de inspección, fotos de la producción y planos. Los informes y reportes aparecen en la ficha as-built de cada unidad. Una OP concluida o cancelada aún acepta adjuntos, sin eliminación.',

  // Rastreabilidade
  'Ajuda · Rastreabilidade': 'Ayuda · Trazabilidad',
  'Digite ou bipe o número de série da unidade (ex.: RAD-200-2026-00001) e pressione Enter para abrir a ficha as-built.':
    'Escriba o escanee el número de serie de la unidad (ej.: RAD-200-2026-00001) y presione Enter para abrir la ficha as-built.',
  'A ficha mostra o pedido e o cliente, a OP, os componentes da BOM, quem trabalhou em cada etapa e quando, o teste e a metrologia.':
    'La ficha muestra el pedido y el cliente, la OP, los componentes de la BOM, quién trabajó en cada etapa y cuándo, la prueba y la metrología.',
  '"Componentes com série" e "Lotes consumidos" levam do equipamento ao fornecedor: série e lote de cada componente, a nota de entrada e o fornecedor.':
    '"Componentes con serie" y "Lotes consumidos" llevan del equipo al proveedor: serie y lote de cada componente, la nota de entrada y el proveedor.',
  'O QR Code da ficha abre esta mesma tela — útil para colar na etiqueta do equipamento.':
    'El código QR de la ficha abre esta misma pantalla; útil para pegarlo en la etiqueta del equipo.',
  '"Laudos e inspeções" lista os laudos de teste e relatórios de inspeção anexados à OP da unidade; "Abrir" mostra o arquivo em nova aba.':
    '"Informes e inspecciones" lista los informes de prueba y reportes de inspección adjuntos a la OP de la unidad; "Abrir" muestra el archivo en una nueva pestaña.',

  // Metrologia
  'Ajuda · Metrologia': 'Ayuda · Metrología',
  'Lista as unidades com verificação metrológica (Inmetro) vencida ou que vence no período escolhido (30, 60 ou 90 dias).':
    'Lista las unidades con verificación metrológica (Inmetro) vencida o que vence en el período elegido (30, 60 o 90 días).',
  'Clique no número de série para abrir a ficha da unidade e ver o cliente e o lacre.':
    'Haga clic en el número de serie para abrir la ficha de la unidad y ver el cliente y el precinto.',
  'A metrologia de cada unidade é registrada no detalhe da OP, na seção Unidades.':
    'La metrología de cada unidad se registra en el detalle de la OP, en la sección Unidades.',

  // Preferencias
  'Ajuda · Preferências': 'Ayuda · Preferencias',
  'Tema, alto contraste, densidade e tamanho de fonte mudam a interface imediatamente ao selecionar — não é preciso salvar.':
    'El tema, el alto contraste, la densidad y el tamaño de fuente cambian la interfaz inmediatamente al seleccionarlos; no es necesario guardar.',
  'A preferência fica salva na sua conta: vale em qualquer computador que você usar para entrar no sistema.':
    'La preferencia queda guardada en su cuenta: vale en cualquier computadora que use para ingresar al sistema.',
  'Tema "Automático" segue a configuração de claro/escuro do sistema operacional.':
    'El tema "Automático" sigue la configuración de claro/oscuro del sistema operativo.',
  'Densidade "Compacta" mostra mais linhas por tela nas listas; "Confortável" deixa alvos maiores, melhor para tablet.':
    'La densidad "Compacta" muestra más filas por pantalla en las listas; "Confortable" deja objetivos más grandes, mejor para tableta.',

  // Necessidade de compra
  'Ajuda · Necessidade de compra': 'Ayuda · Necesidad de compra',
  'Lista as peças ativas cujo saldo está abaixo do estoque mínimo cadastrado, agrupadas pelo fornecedor padrão de cada uma.':
    'Lista las piezas activas cuyo saldo está por debajo del inventario mínimo registrado, agrupadas por el proveedor predeterminado de cada una.',
  'A "Necessidade" é a quantidade sugerida para repor: estoque mínimo menos o saldo atual.':
    'La "Necesidad" es la cantidad sugerida para reponer: inventario mínimo menos el saldo actual.',
  '"Gerar cotação" leva para o formulário de nova cotação já com o fornecedor e os itens preenchidos — só falta informar o preço negociado.':
    '"Generar cotización" lleva al formulario de nueva cotización ya con el proveedor y los ítems completados; solo falta informar el precio negociado.',
  'Peças sem fornecedor padrão aparecem à parte, sem essa opção: cadastre um fornecedor padrão na peça primeiro.':
    'Las piezas sin proveedor predeterminado aparecen aparte, sin esta opción: registre primero un proveedor predeterminado en la pieza.',

  // Empresa
  'Ajuda · Dados da empresa': 'Ayuda · Datos de la empresa',
  'Razão social é o único campo obrigatório; os demais podem ficar em branco até serem definidos.':
    'La razón social es el único campo obligatorio; los demás pueden quedar en blanco hasta que se definan.',
  '"Buscar CEP" preenche logradouro, bairro, cidade e UF automaticamente a partir do CEP informado.':
    '"Buscar CEP" completa calle, barrio, ciudad y UF automáticamente a partir del CEP informado.',
  'O logotipo aparece no cabeçalho e na tela de login de todo mundo que usa o sistema — escolha a variante clara e a escura para cada tema.':
    'El logotipo aparece en el encabezado y en la pantalla de inicio de sesión de todos los que usan el sistema; elija la variante clara y la oscura para cada tema.',
  'Só quem tem a permissão desta tela (em Perfis e permissões) acessa e edita.':
    'Solo quien tiene el permiso de esta pantalla (en Perfiles y permisos) accede y edita.',

  // Auditoria
  'Ajuda · Auditoria': 'Ayuda · Auditoría',
  'Toda inclusão, alteração e exclusão nos cadastros e módulos principais fica registrada aqui automaticamente — não precisa ativar nada.':
    'Toda inclusión, modificación y eliminación en los registros y módulos principales queda registrada aquí automáticamente; no es necesario activar nada.',
  'Filtre por período, tabela ou tipo de ação para achar um evento específico mais rápido.':
    'Filtre por período, tabla o tipo de acción para encontrar un evento específico más rápido.',
  '"Ver detalhes" mostra campo a campo o que mudou, com o valor anterior e o novo — não o dado bruto do banco.':
    '"Ver detalles" muestra campo por campo lo que cambió, con el valor anterior y el nuevo, no el dato bruto de la base de datos.',
  'Só quem tem a permissão desta tela (em Perfis e permissões) acessa.':
    'Solo quien tiene el permiso de esta pantalla (en Perfiles y permisos) accede.',

  // Regional
  'Ajuda · Parâmetros regionais': 'Ayuda · Parámetros regionales',
  'Formato de data e hora valem para o sistema inteiro — a mudança aparece para todos os usuários, não só para quem editou.':
    'El formato de fecha y hora vale para todo el sistema; el cambio se ve para todos los usuarios, no solo para quien lo editó.',
  'A pré-visualização mostra o efeito da escolha antes de salvar.':
    'La vista previa muestra el efecto de la elección antes de guardar.',

  // Negocio
  'Ajuda · Parâmetros de negócio': 'Ayuda · Parámetros de negocio',
  'Tolerância de recebimento: quanto a mais do que foi pedido pode ser recebido em cada item (0% = nada além do pedido).':
    'Tolerancia de recepción: cuánto más de lo pedido puede recibirse en cada ítem (0% = nada más allá de la orden).',
  'Divergência de preço: diferença aceita entre o preço da nota e o do pedido; acima dela, a nota é bloqueada ou exige aprovação de quem tem "Aprovar divergência de preço".':
    'Divergencia de precio: diferencia aceptada entre el precio de la nota y el de la orden; por encima de ella, la nota se bloquea o exige la aprobación de quien tenga "Aprobar divergencia de precio".',
  'Alçada do Gestor: acima do valor configurado, só quem tem a permissão "Emitir acima da alçada" consegue emitir o pedido de compra.':
    'Límite de autoridad del Gestor: por encima del valor configurado, solo quien tiene el permiso "Emitir por encima del límite de autoridad" puede emitir la orden de compra.',
  'Mínimo de cotações: a partir do valor configurado, cada peça do pedido precisa de cotações respondidas de fornecedores diferentes nos últimos 90 dias.':
    'Mínimo de cotizaciones: a partir del valor configurado, cada pieza de la orden necesita cotizaciones respondidas de proveedores diferentes en los últimos 90 días.',
  'Lead time padrão: valor inicial ao cadastrar fornecedor ou parte/peça nova — não muda os cadastros existentes.':
    'Lead time predeterminado: valor inicial al registrar un proveedor o una parte/pieza nueva; no modifica los registros existentes.',

  // Integracoes
  'Ajuda · Integrações': 'Ayuda · Integraciones',
  'Servidor de e-mail: preencha os dados do SMTP da empresa (o setor de TI ou o provedor de e-mail informa host, porta e criptografia).':
    'Servidor de correo: complete los datos del SMTP de la empresa (el sector de TI o el proveedor de correo informa host, puerto y cifrado).',
  'A senha é gravada cifrada e nunca aparece de novo — para trocar, digite a nova; para manter, deixe em branco.':
    'La contraseña se guarda cifrada y nunca vuelve a aparecer; para cambiarla, escriba la nueva; para mantenerla, déjela en blanco.',
  '"Enviar e-mail de teste" usa a configuração salva: salve antes de testar. Se falhar, a mensagem do servidor de e-mail aparece na tela.':
    '"Enviar correo de prueba" usa la configuración guardada: guarde antes de probar. Si falla, el mensaje del servidor de correo aparece en la pantalla.',

  // Perfis
  'Ajuda · Perfis e permissões': 'Ayuda · Perfiles y permisos',
  'Escolha um perfil à esquerda e marque o que ele pode fazer em cada módulo. Salve para valer — a mudança vale na hora para quem usa o perfil.':
    'Elija un perfil a la izquierda y marque lo que puede hacer en cada módulo. Guarde para que tenga efecto; el cambio vale de inmediato para quien usa el perfil.',
  'Permissões "Sensíveis" (ajustar estoque, emitir acima da alçada, integrações, editar perfis) merecem cuidado redobrado.':
    'Los permisos "Sensibles" (ajustar inventario, emitir por encima del límite de autoridad, integraciones, editar perfiles) merecen especial cuidado.',
  'O Administrador tem tudo, sempre, e não pode ser alterado. Perfis do sistema não podem ser excluídos; os personalizados, só sem usuários.':
    'El Administrador tiene todo, siempre, y no puede modificarse. Los perfiles del sistema no pueden eliminarse; los personalizados, solo si no tienen usuarios.',
  '"Novo perfil" permite começar copiando as permissões de um perfil existente.':
    '"Nuevo perfil" permite comenzar copiando los permisos de un perfil existente.',

  // Usuarios
  'Ajuda · Usuários': 'Ayuda · Usuarios',
  '"Novo usuário" cadastra a pessoa com uma senha temporária (já sugerida): entregue-a ao usuário, que cria a própria senha no primeiro acesso.':
    '"Nuevo usuario" registra a la persona con una contraseña temporal (ya sugerida): entréguesela al usuario, que crea su propia contraseña en el primer acceso.',
  '"Situação" bloqueia (suspensão temporária) ou inativa (desligamento) — vale na hora, mesmo com a sessão aberta. Usuário nunca é excluído: o histórico fica.':
    '"Situación" bloquea (suspensión temporal) o inactiva (desvinculación); vale de inmediato, incluso con la sesión abierta. Un usuario nunca se elimina: el historial se conserva.',
  '"Senha" define uma nova senha temporária para quem esqueceu a sua.':
    '"Contraseña" define una nueva contraseña temporal para quien olvidó la suya.',
  '"Permissões" concede ou retira uma permissão só para esta pessoa, sobre o perfil, com justificativa registrada na auditoria.':
    '"Permisos" concede o retira un permiso solo para esta persona, sobre el perfil, con justificación registrada en la auditoría.',
  'Ninguém altera o próprio cadastro aqui, nem atribui um perfil ou concede uma permissão que não tem. Só um Administrador altera outro Administrador.':
    'Nadie modifica su propio registro aquí, ni asigna un perfil ni concede un permiso que no tiene. Solo un Administrador modifica a otro Administrador.',

  // Trocar senha
  'Ajuda · Trocar senha': 'Ayuda · Cambiar contraseña',
  'Com a senha temporária recebida do administrador, escolha uma senha só sua (ao menos 10 caracteres, sem o seu login) para continuar.':
    'Con la contraseña temporal recibida del administrador, elija una contraseña solo suya (al menos 10 caracteres, sin su usuario) para continuar.',
  'Esqueceu a senha? Peça ao administrador uma nova senha temporária.':
    '¿Olvidó la contraseña? Pida al administrador una nueva contraseña temporal.',

  // Banco
  'Ajuda · Banco de dados': 'Ayuda · Base de datos',
  'Diagnóstico somente leitura: nada aqui altera o banco, e usuário, senha e string de conexão nunca aparecem.':
    'Diagnóstico de solo lectura: nada aquí modifica la base de datos, y el usuario, la contraseña y la cadena de conexión nunca aparecen.',
  '"Testar conexão" executa uma consulta mínima e mostra o tempo de resposta.':
    '"Probar conexión" ejecuta una consulta mínima y muestra el tiempo de respuesta.',
  'Muitas conexões "em uso" por muito tempo, ou latência alta, indicam carga ou problema de rede — avise o responsável pela infraestrutura.':
    'Muchas conexiones "en uso" por mucho tiempo, o una latencia alta, indican carga o un problema de red; avise al responsable de la infraestructura.',

  // Documentos a vencer
  'Ajuda · Documentos a vencer': 'Ayuda · Documentos por vencer',
  'Lista a versão vigente de cada documento de produto, peça, fornecedor ou cliente já vencido ou que vence no prazo escolhido (30, 60 ou 90 dias). Cada cadastro só aparece para quem pode vê-lo.':
    'Lista la versión vigente de cada documento de producto, pieza, proveedor o cliente ya vencido o que vence en el plazo elegido (30, 60 o 90 días). Cada registro solo aparece para quien puede verlo.',
  '"Vencido" (vermelho) pede ação já; "Vence em N dias" (laranja) indica os que vencem em até 30 dias.':
    '"Vencido" (rojo) requiere acción inmediata; "Vence en N días" (naranja) indica los que vencen en hasta 30 días.',
  'Para renovar, envie uma "Nova versão" com a nova validade: em "Mídia e documentos" do produto ou da peça, ou em "Documentos" do fornecedor ou do cliente — o nome do fornecedor ou do cliente na lista abre os documentos dele.':
    'Para renovar, envíe una "Nueva versión" con la nueva vigencia: en "Multimedia y documentos" del producto o de la pieza, o en "Documentos" del proveedor o del cliente; el nombre del proveedor o del cliente en la lista abre sus documentos.',

  // Estoque
  'Ajuda · Estoque': 'Ayuda · Inventario',
  'O saldo de cada peça nasce em zero, sempre em situação Crítica, assim que ela é cadastrada.':
    'El saldo de cada pieza nace en cero, siempre en situación Crítica, apenas se registra.',
  'A coluna Foto mostra a foto principal da peça, para conferir o item no armazém sem abrir o cadastro.':
    'La columna Foto muestra la foto principal de la pieza, para verificar el ítem en el almacén sin abrir el registro.',
  'Situação Crítica significa saldo menor ou igual ao estoque mínimo cadastrado na peça; filtre por situação para ver só o que precisa de atenção.':
    'La situación Crítica significa saldo menor o igual al inventario mínimo registrado en la pieza; filtre por situación para ver solo lo que requiere atención.',
  '"Ajustar" registra uma entrada ou saída avulsa (use um número negativo para saída), com motivo obrigatório — útil para corrigir uma contagem física.':
    '"Ajustar" registra una entrada o salida avulsa (use un número negativo para salida), con motivo obligatorio; útil para corregir un conteo físico.',
  'A entrada de material comprado é pela nota fiscal de entrada (Recebimento): a efetivação da nota atualiza este saldo.':
    'La entrada de material comprado se hace por la nota fiscal de entrada (Recepción): la confirmación de la nota actualiza este saldo.',
  '"Kardex" lista cada movimento da peça com o saldo depois dele e o documento de origem (nota, OP ou pedido de venda, com link). "Origem do saldo" mostra os lotes e as notas que cobrem o saldo atual — e o que ficou sem documento.':
    '"Kardex" lista cada movimiento de la pieza con el saldo posterior y el documento de origen (nota, OP o pedido de venta, con enlace). "Origen del saldo" muestra los lotes y las notas que cubren el saldo actual, y lo que quedó sin documento.',
  'No ajuste de peça com lote, informe o lote (e a validade, se exigida); com série, informe uma série por unidade ajustada. É também o caminho do inventário de abertura.':
    'En el ajuste de una pieza con lote, informe el lote (y el vencimiento, si se exige); con serie, informe una serie por unidad ajustada. Es también el camino del inventario de apertura.',

  // Generico
  'Use a navegação lateral para trocar de tela.': 'Use la navegación lateral para cambiar de pantalla.',
  'Em qualquer lista, busque, filtre por situação e clique no cabeçalho de uma coluna para ordenar.':
    'En cualquier lista, busque, filtre por situación y haga clic en el encabezado de una columna para ordenar.',
};

export default traducoes;
