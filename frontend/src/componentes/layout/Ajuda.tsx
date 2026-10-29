import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Botao } from '@/componentes/ui/Botao';
import { Modal } from '@/componentes/ui/Modal';
import { marcar, t, td, useIdioma } from '@/i18n';

interface ConteudoAjuda {
  titulo: string;
  itens: string[];
}

/**
 * Dica por rota. Cada tela ensina o essencial da propria tela — nao repete o
 * manual inteiro, so o que ajuda quem esta operando agora.
 */
const CONTEUDO_POR_ROTA: Record<string, ConteudoAjuda> = {
  '/login': {
    titulo: marcar('Ajuda · Entrar'),
    itens: [
      marcar('Use o usuário e a senha fornecidos pelo administrador do sistema.'),
      marcar('O ícone de olho ao lado da senha mostra o que foi digitado, para conferir antes de enviar.'),
      marcar('Se a sessão cair por inatividade, basta entrar de novo — nada do que já foi salvo se perde.'),
      marcar('Depois de 5 senhas erradas seguidas, a conta fica bloqueada por alguns minutos. Para liberar antes, peça ao administrador que redefina a sua senha.'),
    ],
  },
  '/': {
    titulo: marcar('Ajuda · Painel'),
    itens: [
      marcar('O painel mostra os números de agora de cada módulo que você acompanha: OPs em atraso, pedidos de compra a receber e em atraso, insumos críticos, notas aguardando efetivação, lotes e metrologia vencendo em 30 dias e pedidos de venda.'),
      marcar('Os números se atualizam sozinhos a cada minuto; "Atualizar agora" busca na hora. Clique num cartão para abrir a tela correspondente.'),
      marcar('Cartão com ícone de alerta e borda laranja pede atenção (atraso, item crítico, vencimento próximo).'),
      marcar('Os painéis de cada setor, com gráficos e período, ficam no grupo Painéis do menu.'),
      marcar('O cartão "Conexão com o servidor" avisa quando a API está fora do ar: nenhuma tela de cadastro vai funcionar até ela voltar.'),
    ],
  },
  '/paineis/compras': {
    titulo: marcar('Ajuda · Painel de compras'),
    itens: [
      marcar('PCs em aberto, em atraso, lead time real médio (do pedido à última nota) e percentual recebido no prazo.'),
      marcar('Gráficos: pedidos por situação, valor comprado por mês, fornecedores com mais atrasos e lead time por fornecedor (os 8 maiores).'),
      marcar('Período (30, 90, 180 ou 365 dias) vale para os números de fluxo — comprado, entregue, concluído, testado, lead time. Os números de agora (em aberto, em atraso, críticos, a vencer) não dependem do período.'),
      marcar('Atualização automática: escolha de 30 s a 10 min, ou Desligada. "Atualizar agora" busca os números na hora; o horário da última atualização fica ao lado.'),
      marcar('"Ver dados", ao lado do título de cada gráfico, mostra a mesma informação em tabela, para conferir os números.'),
      marcar('Modo TV: tela cheia, sem menu nem cabeçalho e com letra maior, para deixar o painel numa TV da fábrica. Enquanto a aba estiver visível, a sessão não cai por inatividade. Esc ou "Sair do modo TV" voltam ao normal.'),
      marcar('Período, atualização e modo TV ficam no endereço da página: salve o endereço como favorito na TV para o painel abrir pronto.'),
    ],
  },
  '/paineis/estoque': {
    titulo: marcar('Ajuda · Painel de recebimento e estoque'),
    itens: [
      marcar('Valor em estoque pelo custo médio, itens críticos, notas aguardando efetivação e lotes vencidos ou vencendo em 30 dias.'),
      marcar('O valor em estoque e o gráfico dos itens de maior valor só aparecem para quem pode ver custos.'),
      marcar('Gráficos: valor efetivado por mês, notas por situação, lotes por faixa de vencimento e os 10 itens de maior valor.'),
      marcar('Período (30, 90, 180 ou 365 dias) vale para os números de fluxo — comprado, entregue, concluído, testado, lead time. Os números de agora (em aberto, em atraso, críticos, a vencer) não dependem do período.'),
      marcar('Atualização automática: escolha de 30 s a 10 min, ou Desligada. "Atualizar agora" busca os números na hora; o horário da última atualização fica ao lado.'),
      marcar('"Ver dados", ao lado do título de cada gráfico, mostra a mesma informação em tabela, para conferir os números.'),
      marcar('Modo TV: tela cheia, sem menu nem cabeçalho e com letra maior, para deixar o painel numa TV da fábrica. Enquanto a aba estiver visível, a sessão não cai por inatividade. Esc ou "Sair do modo TV" voltam ao normal.'),
      marcar('Período, atualização e modo TV ficam no endereço da página: salve o endereço como favorito na TV para o painel abrir pronto.'),
    ],
  },
  '/paineis/producao': {
    titulo: marcar('Ajuda · Painel de produção'),
    itens: [
      marcar('OPs abertas, liberadas, concluídas no período e em atraso, lead time médio (da liberação à conclusão) e horas apontadas.'),
      marcar('Gráficos: OPs por etapa, concluídas por semana, horas por centro de trabalho e produtos com mais OPs em atraso.'),
      marcar('Período (30, 90, 180 ou 365 dias) vale para os números de fluxo — comprado, entregue, concluído, testado, lead time. Os números de agora (em aberto, em atraso, críticos, a vencer) não dependem do período.'),
      marcar('Atualização automática: escolha de 30 s a 10 min, ou Desligada. "Atualizar agora" busca os números na hora; o horário da última atualização fica ao lado.'),
      marcar('"Ver dados", ao lado do título de cada gráfico, mostra a mesma informação em tabela, para conferir os números.'),
      marcar('Modo TV: tela cheia, sem menu nem cabeçalho e com letra maior, para deixar o painel numa TV da fábrica. Enquanto a aba estiver visível, a sessão não cai por inatividade. Esc ou "Sair do modo TV" voltam ao normal.'),
      marcar('Período, atualização e modo TV ficam no endereço da página: salve o endereço como favorito na TV para o painel abrir pronto.'),
    ],
  },
  '/paineis/vendas': {
    titulo: marcar('Ajuda · Painel de vendas e expedição'),
    itens: [
      marcar('Carteira (valor dos pedidos ainda não entregues), pedidos em atraso, valor entregue no período e entregas no prazo (OTD).'),
      marcar('Gráficos: pedidos por situação, valor entregue por mês, OTD por mês e os 8 principais clientes por valor.'),
      marcar('Período (30, 90, 180 ou 365 dias) vale para os números de fluxo — comprado, entregue, concluído, testado, lead time. Os números de agora (em aberto, em atraso, críticos, a vencer) não dependem do período.'),
      marcar('Atualização automática: escolha de 30 s a 10 min, ou Desligada. "Atualizar agora" busca os números na hora; o horário da última atualização fica ao lado.'),
      marcar('"Ver dados", ao lado do título de cada gráfico, mostra a mesma informação em tabela, para conferir os números.'),
      marcar('Modo TV: tela cheia, sem menu nem cabeçalho e com letra maior, para deixar o painel numa TV da fábrica. Enquanto a aba estiver visível, a sessão não cai por inatividade. Esc ou "Sair do modo TV" voltam ao normal.'),
      marcar('Período, atualização e modo TV ficam no endereço da página: salve o endereço como favorito na TV para o painel abrir pronto.'),
    ],
  },
  '/paineis/qualidade': {
    titulo: marcar('Ajuda · Painel de qualidade'),
    itens: [
      marcar('Unidades testadas, aprovadas e reprovadas no período, taxa de aprovação e verificações metrológicas vencidas ou vencendo em 30 dias.'),
      marcar('Gráficos: aprovação por semana, produtos com mais reprovações e metrologia por faixa de vencimento.'),
      marcar('Período (30, 90, 180 ou 365 dias) vale para os números de fluxo — comprado, entregue, concluído, testado, lead time. Os números de agora (em aberto, em atraso, críticos, a vencer) não dependem do período.'),
      marcar('Atualização automática: escolha de 30 s a 10 min, ou Desligada. "Atualizar agora" busca os números na hora; o horário da última atualização fica ao lado.'),
      marcar('"Ver dados", ao lado do título de cada gráfico, mostra a mesma informação em tabela, para conferir os números.'),
      marcar('Modo TV: tela cheia, sem menu nem cabeçalho e com letra maior, para deixar o painel numa TV da fábrica. Enquanto a aba estiver visível, a sessão não cai por inatividade. Esc ou "Sair do modo TV" voltam ao normal.'),
      marcar('Período, atualização e modo TV ficam no endereço da página: salve o endereço como favorito na TV para o painel abrir pronto.'),
    ],
  },
  '/fornecedores': {
    titulo: marcar('Ajuda · Fornecedores'),
    itens: [
      marcar('Use "Novo fornecedor" para cadastrar; CNPJ pode ser digitado com ou sem pontuação.'),
      marcar('Busque por razão social, CNPJ ou contato, e filtre por situação (Ativos, Inativos ou Todos).'),
      marcar('Clique no cabeçalho de uma coluna para ordenar por ela; clique de novo para inverter.'),
      marcar('"Inativar" preserva o histórico e tira o fornecedor das listas de seleção; para reativar, edite o registro e mude a situação.'),
      marcar('"Itens do fornecedor (de-para)" liga o código e a unidade do fornecedor à nossa peça, com o fator de conversão (ex.: caixa com 100). A importação do XML da NF-e reconhece os itens por aqui.'),
      marcar('"Documentos" guarda contrato, certificado de qualidade, documentos cadastrais e tabela de preços (PDF ou imagem). Com validade informada, o documento entra em Documentos a vencer; "Nova versão" renova sem apagar a anterior.'),
    ],
  },
  '/clientes': {
    titulo: marcar('Ajuda · Clientes'),
    itens: [
      marcar('Use "Novo cliente" para cadastrar; tipo, razão social e CNPJ são obrigatórios. O CNPJ pode ser digitado com ou sem pontuação.'),
      marcar('Busque por razão social, nome fantasia, CNPJ, cidade ou nº do contrato, e filtre por situação e tipo.'),
      marcar('O selo "Contrato vencido" aparece quando o fim da vigência já passou — é só um aviso: o cliente continua utilizável. Para renovar, edite a vigência.'),
      marcar('"Documentos" guarda contrato, documentos cadastrais e termos de aceite do cliente. Com validade informada, o documento entra em Documentos a vencer.'),
      marcar('"Inativar" preserva o histórico; para reativar, edite o registro e mude a situação.'),
    ],
  },
  '/centros-trabalho': {
    titulo: marcar('Ajuda · Centros de trabalho'),
    itens: [
      marcar('Cada centro de trabalho (bancada ou posto) pertence a uma etapa da produção: Separação, Montagem, Testes ou Expedição.'),
      marcar('O código (ex.: MONT-01) identifica o centro nas ordens de produção e não pode ser alterado depois de cadastrado.'),
      marcar('A capacidade em horas por dia é opcional (até 24) e será usada no planejamento da produção.'),
      marcar('O custo por hora (R$) é opcional e entra no custo real das ordens de produção (horas apontadas × custo/hora).'),
      marcar('Busque por código ou nome, e filtre por situação e etapa. "Inativar" preserva o histórico.'),
    ],
  },
  '/partes-pecas': {
    titulo: marcar('Ajuda · Partes e peças'),
    itens: [
      marcar('Use "Nova peça" para cadastrar; código e descrição são obrigatórios.'),
      marcar('Estoque mínimo e máximo definem a faixa de reposição usada pelo módulo de estoque.'),
      marcar('Controle do item: série, lote e validade (só com lote) passam a ser exigidos no recebimento; "Validade mínima" recusa lote com menos dias restantes e a "Máscara" (expressão regular, sem ^ e $) confere o formato da série.'),
      marcar('"Item crítico" exige foto principal: ela não pode ser removida sem outra no lugar. A coluna Foto mostra o selo "Sem foto" quando falta.'),
      marcar('"Mídia e documentos" abre as fotos (principal + galeria de até 10, JPG/PNG/WebP até 5 MB, com giro de 90° antes de enviar) e os documentos em PDF (até 25 MB), com categoria, validade e histórico de versões.'),
      marcar('Busque por código ou descrição, e filtre por situação (Ativos, Inativos ou Todos).'),
      marcar('"Inativar" preserva o histórico; para reativar, edite o registro e mude a situação.'),
    ],
  },
  '/produtos-acabados': {
    titulo: marcar('Ajuda · Produtos acabados'),
    itens: [
      marcar('Use "Novo produto" para cadastrar; código, descrição e preço de venda são obrigatórios.'),
      marcar('O lead time de produção informa o módulo de produção sobre o prazo esperado.'),
      marcar('Marque "Exige metrologia (Inmetro)" para radares: cada unidade precisa da verificação metrológica antes de sair de Testes.'),
      marcar('Controle do item: série, lote, validade (só com lote), item crítico (exige foto principal) e certificado no recebimento.'),
      marcar('"Mídia e documentos" abre as fotos (principal + galeria de até 10) e os documentos em PDF versionados; um documento pode apontar a revisão da BOM a que se refere.'),
      marcar('"Nova versão" substitui o documento sem apagar o anterior: as versões antigas ficam em "Versões anteriores".'),
      marcar('Busque por código ou descrição, e filtre por situação (Ativos, Inativos ou Todos).'),
      marcar('"Inativar" preserva o histórico; para reativar, edite o registro e mude a situação.'),
    ],
  },
  '/estrutura-produtos': {
    titulo: marcar('Ajuda · Estrutura de produtos'),
    itens: [
      marcar('Cada produto acabado pode ter uma estrutura (BOM): a lista de partes/peças e a quantidade de cada uma para montar 1 unidade.'),
      marcar('Uma estrutura nunca é editada nem apagada. "Nova versão" abre uma tela com os itens da versão exibida: adicione ou retire itens e, ao salvar, a nova versão terá exatamente os itens da tela e passará a ser a vigente.'),
      marcar('O painel do produto mostra sempre a versão mais recente. Na lista "Versões" você vê todas, consulta os itens de cada uma e pode definir qualquer versão como vigente.'),
      marcar('Só existe uma versão vigente por produto de cada vez, e é ela que vale em Produtos acabados e nas ordens de produção.'),
    ],
  },
  '/cotacoes': {
    titulo: marcar('Ajuda · Cotações'),
    itens: [
      marcar('Uma cotação nasce em Rascunho, com ao menos um item; "Enviar" registra que foi encaminhada ao fornecedor.'),
      marcar('Depois de enviada, "Registrar resposta" grava o preço negociado por item e recalcula o valor total.'),
      marcar('Uma cotação Respondida pode ser convertida num pedido de compra — o preço vai travado, igual ao negociado.'),
      marcar('Cancelar preserva o histórico; uma cotação cancelada não volta a nenhum status anterior.'),
    ],
  },
  '/pedidos-compra': {
    titulo: marcar('Ajuda · Pedidos de compra'),
    itens: [
      marcar('Um pedido nasce em Rascunho; "Emitir" o envia ao fornecedor.'),
      marcar('O bloco "Pedidos em atraso" no topo da lista mostra os que passaram da data de entrega prevista.'),
      marcar('Um pedido pode ser criado a partir de uma cotação respondida (tela da cotação) ou manualmente aqui.'),
      marcar('Cancelar só é possível enquanto o pedido não estiver Concluído ou já Cancelado.'),
      marcar('O recebimento é pela nota fiscal: no pedido aguardando entrega (ou recebido parcial), "Lançar nota fiscal" abre a nota já com o pedido escolhido; as notas do pedido aparecem no detalhe.'),
      marcar('"Encerrar com saldo pendente" fecha o pedido sem receber o restante (motivo de 10 a 255 caracteres) — para quando o fornecedor não vai entregar.'),
      marcar('Em "Documentos" do pedido, anexe a proposta ou cotação, o pedido assinado e a comunicação com o fornecedor. Pedido concluído ou cancelado ainda aceita anexo, mas nenhum documento pode ser removido.'),
    ],
  },
  '/notas-entrada': {
    titulo: marcar('Ajuda · Notas fiscais de entrada'),
    itens: [
      marcar('Nada entra no estoque sem nota: escolha o pedido de compra (aguardando entrega ou recebido parcial) — fornecedor e CNPJ vêm dele.'),
      marcar('Modelo 55 (NF-e) exige a chave de acesso de 44 dígitos; o contador abaixo do campo mostra quantos já foram digitados.'),
      marcar('Adicione os itens do pedido que chegaram (ou uma bonificação, sem pedido, com justificativa). Informe a quantidade da nota, o fator de conversão e a quantidade contada: a diferença fica pendente com o fornecedor, o estoque anda pelo que foi contado.'),
      marcar('Peça com lote: divida a linha em lotes (número, quantidade, fabricação e validade, se exigida) — a soma precisa fechar com o recebido. Certificado de conformidade em PDF quando a peça exige.'),
      marcar('Peça com série: bipe as séries no campo (Enter adiciona e limpa), cole uma lista (uma por linha) ou gere uma faixa (prefixo + início + fim, ex.: SN-1001 a SN-1050). O contador mostra quantas faltam.'),
      marcar('"Salvar rascunho" guarda mesmo incompleto. "Conferir" salva e mostra as pendências: bloqueio (vermelho) impede; aprovação (âmbar) exige quem tem "Aprovar divergência de preço"; aviso só informa.'),
      marcar('"Efetivar" dá a entrada no estoque, cria lotes e séries, atualiza o custo médio e o saldo do pedido — tudo de uma vez. Nota efetivada fica só leitura; o estorno (com motivo) só é aceito se o material ainda não foi reservado ou consumido.'),
      marcar('"Importar XML" lê a NF-e: itens não reconhecidos são vinculados à peça uma vez e o vínculo fica memorizado para as próximas notas do fornecedor. O XML fica anexado à nota.'),
      marcar('Anexe o DANFE, certificados e fotos da mercadoria, do lacre e de avarias em "Anexos e fotos do recebimento".'),
    ],
  },
  '/lotes': {
    titulo: marcar('Ajuda · Lotes'),
    itens: [
      marcar('Lotes nascem na efetivação da nota fiscal (ou num ajuste de estoque) de peças com controle de lote.'),
      marcar('Filtre por "Vencendo em N dias" para planejar o consumo; o selo mostra vencido (vermelho), a vencer em até 30 dias (laranja) ou válido.'),
      marcar('Abra um lote para o caminho "do lote ao campo": a nota de entrada, as OPs que consumiram e as unidades produzidas, com pedido e cliente. "Direta" quer dizer que a série do componente está instalada naquela unidade.'),
    ],
  },
  '/pedidos-venda': {
    titulo: marcar('Ajuda · Pedidos de venda'),
    itens: [
      marcar('Um pedido nasce Aberto, com o cliente, a entrega prometida e os produtos acabados; o preço unitário vem do preço de venda do produto e pode ser ajustado.'),
      marcar('No detalhe do pedido, "Gerar OP" cria a ordem de produção de cada item — o produto precisa ter estrutura (BOM) ativa.'),
      marcar('Só é possível editar um pedido Aberto e sem OP ativa. Cancelar o pedido cancela as OPs ainda abertas; com OP liberada, cancele a OP antes.'),
      marcar('Quando todas as OPs concluem, o pedido fica "Pronto para envio": use "Registrar entrega" para baixar o estoque e encerrar o pedido.'),
      marcar('O selo "Atrasado" aparece quando a entrega prometida já passou e o pedido ainda não foi entregue.'),
      marcar('Em "Documentos" do pedido, anexe o contrato ou edital, o pedido do cliente, o termo de aceite e a ordem de serviço. Pedido entregue ou cancelado ainda aceita anexo (o termo de aceite chega depois), mas nenhum documento pode ser removido.'),
    ],
  },
  '/producao/kanban': {
    titulo: marcar('Ajuda · Kanban de produção'),
    itens: [
      marcar('O quadro mostra as OPs liberadas nas quatro etapas fixas: Separação, Montagem, Testes e Expedição. Ele se atualiza sozinho a cada 30 segundos.'),
      marcar('Cada cartão mostra a OP, o produto, a quantidade, o cliente, o prazo e quem está apontando agora. O selo "Atrasada" indica prazo vencido.'),
      marcar('Clique no cartão para abrir a OP, apontar e avançar a etapa.'),
    ],
  },
  '/producao/ops': {
    titulo: marcar('Ajuda · Ordens de produção'),
    itens: [
      marcar('"Liberar OP" reserva todo o material da BOM de uma vez (tudo ou nada). Se faltar alguma peça, a tela lista o que falta e nada é reservado.'),
      marcar('Para trabalhar numa etapa, escolha o centro de trabalho e "Iniciar apontamento"; ao terminar, "Encerrar apontamento". O operador é sempre quem está logado.'),
      marcar('"Avançar etapa" exige ao menos um apontamento encerrado na etapa. Ao sair da Separação o material reservado é baixado do estoque.'),
      marcar('Em Testes, registre Aprovado ou Reprovado em cada unidade (a reprovação exige descrever o defeito). Se o produto exige metrologia, preencha-a em todas as unidades.'),
      marcar('Na Expedição, "Concluir OP" coloca as unidades no estoque de produto acabado. Cancelar só é possível antes do consumo do material.'),
      marcar('O quadro de custo (orçado × realizado) só aparece para quem tem a permissão "Ver custo real das OPs".'),
      marcar('Em "Documentos e laudos", anexe laudos de teste, relatórios de inspeção, fotos da produção e desenhos. Laudos e relatórios aparecem na ficha as-built de cada unidade. OP concluída ou cancelada ainda aceita anexo, sem remoção.'),
    ],
  },
  '/rastreabilidade': {
    titulo: marcar('Ajuda · Rastreabilidade'),
    itens: [
      marcar('Digite ou bipe o número de série da unidade (ex.: RAD-200-2026-00001) e pressione Enter para abrir a ficha as-built.'),
      marcar('A ficha mostra o pedido e o cliente, a OP, os componentes da BOM, quem trabalhou em cada etapa e quando, o teste e a metrologia.'),
      marcar('"Componentes com série" e "Lotes consumidos" levam do equipamento ao fornecedor: série e lote de cada componente, a nota de entrada e o fornecedor.'),
      marcar('O QR Code da ficha abre esta mesma tela — útil para colar na etiqueta do equipamento.'),
      marcar('"Laudos e inspeções" lista os laudos de teste e relatórios de inspeção anexados à OP da unidade; "Abrir" mostra o arquivo em nova aba.'),
    ],
  },
  '/producao/metrologia': {
    titulo: marcar('Ajuda · Metrologia'),
    itens: [
      marcar('Lista as unidades com verificação metrológica (Inmetro) vencida ou que vence no período escolhido (30, 60 ou 90 dias).'),
      marcar('Clique no número de série para abrir a ficha da unidade e ver o cliente e o lacre.'),
      marcar('A metrologia de cada unidade é registrada no detalhe da OP, na seção Unidades.'),
    ],
  },
  '/preferencias': {
    titulo: marcar('Ajuda · Preferências'),
    itens: [
      marcar('Tema, alto contraste, densidade e tamanho de fonte mudam a interface imediatamente ao selecionar — não é preciso salvar.'),
      marcar('A preferência fica salva na sua conta: vale em qualquer computador que você usar para entrar no sistema.'),
      marcar('Tema "Automático" segue a configuração de claro/escuro do sistema operacional.'),
      marcar('Densidade "Compacta" mostra mais linhas por tela nas listas; "Confortável" deixa alvos maiores, melhor para tablet.'),
    ],
  },
  '/necessidade-compra': {
    titulo: marcar('Ajuda · Necessidade de compra'),
    itens: [
      marcar('Lista as peças ativas cujo saldo está abaixo do estoque mínimo cadastrado, agrupadas pelo fornecedor padrão de cada uma.'),
      marcar('A "Necessidade" é a quantidade sugerida para repor: estoque mínimo menos o saldo atual.'),
      marcar('"Gerar cotação" leva para o formulário de nova cotação já com o fornecedor e os itens preenchidos — só falta informar o preço negociado.'),
      marcar('Peças sem fornecedor padrão aparecem à parte, sem essa opção: cadastre um fornecedor padrão na peça primeiro.'),
    ],
  },
  '/configuracoes/empresa': {
    titulo: marcar('Ajuda · Dados da empresa'),
    itens: [
      marcar('Razão social é o único campo obrigatório; os demais podem ficar em branco até serem definidos.'),
      marcar('"Buscar CEP" preenche logradouro, bairro, cidade e UF automaticamente a partir do CEP informado.'),
      marcar('O logotipo aparece no cabeçalho e na tela de login de todo mundo que usa o sistema — escolha a variante clara e a escura para cada tema.'),
      marcar('Só quem tem a permissão desta tela (em Perfis e permissões) acessa e edita.'),
    ],
  },
  '/configuracoes/auditoria': {
    titulo: marcar('Ajuda · Auditoria'),
    itens: [
      marcar('Toda inclusão, alteração e exclusão nos cadastros e módulos principais fica registrada aqui automaticamente — não precisa ativar nada.'),
      marcar('Filtre por período, tabela ou tipo de ação para achar um evento específico mais rápido.'),
      marcar('"Ver detalhes" mostra campo a campo o que mudou, com o valor anterior e o novo — não o dado bruto do banco.'),
      marcar('Só quem tem a permissão desta tela (em Perfis e permissões) acessa.'),
    ],
  },
  '/configuracoes/regional': {
    titulo: marcar('Ajuda · Parâmetros regionais'),
    itens: [
      marcar('Formato de data e hora valem para o sistema inteiro — a mudança aparece para todos os usuários, não só para quem editou.'),
      marcar('A pré-visualização mostra o efeito da escolha antes de salvar.'),
      marcar('Só quem tem a permissão desta tela (em Perfis e permissões) acessa e edita.'),
    ],
  },
  '/configuracoes/negocio': {
    titulo: marcar('Ajuda · Parâmetros de negócio'),
    itens: [
      marcar('Tolerância de recebimento: quanto a mais do que foi pedido pode ser recebido em cada item (0% = nada além do pedido).'),
      marcar('Divergência de preço: diferença aceita entre o preço da nota e o do pedido; acima dela, a nota é bloqueada ou exige aprovação de quem tem "Aprovar divergência de preço".'),
      marcar('Alçada do Gestor: acima do valor configurado, só quem tem a permissão "Emitir acima da alçada" consegue emitir o pedido de compra.'),
      marcar('Mínimo de cotações: a partir do valor configurado, cada peça do pedido precisa de cotações respondidas de fornecedores diferentes nos últimos 90 dias.'),
      marcar('Lead time padrão: valor inicial ao cadastrar fornecedor ou parte/peça nova — não muda os cadastros existentes.'),
      marcar('Só quem tem a permissão desta tela (em Perfis e permissões) acessa e edita.'),
    ],
  },
  '/configuracoes/integracoes': {
    titulo: marcar('Ajuda · Integrações'),
    itens: [
      marcar('Servidor de e-mail: preencha os dados do SMTP da empresa (o setor de TI ou o provedor de e-mail informa host, porta e criptografia).'),
      marcar('A senha é gravada cifrada e nunca aparece de novo — para trocar, digite a nova; para manter, deixe em branco.'),
      marcar('"Enviar e-mail de teste" usa a configuração salva: salve antes de testar. Se falhar, a mensagem do servidor de e-mail aparece na tela.'),
      marcar('Só quem tem a permissão desta tela (em Perfis e permissões) acessa.'),
    ],
  },
  '/configuracoes/perfis': {
    titulo: marcar('Ajuda · Perfis e permissões'),
    itens: [
      marcar('Escolha um perfil à esquerda e marque o que ele pode fazer em cada módulo. Salve para valer — a mudança vale na hora para quem usa o perfil.'),
      marcar('Permissões "Sensíveis" (ajustar estoque, emitir acima da alçada, integrações, editar perfis) merecem cuidado redobrado.'),
      marcar('O Administrador tem tudo, sempre, e não pode ser alterado. Perfis do sistema não podem ser excluídos; os personalizados, só sem usuários.'),
      marcar('"Novo perfil" permite começar copiando as permissões de um perfil existente.'),
    ],
  },
  '/configuracoes/usuarios': {
    titulo: marcar('Ajuda · Usuários'),
    itens: [
      marcar('"Novo usuário" cadastra a pessoa com uma senha temporária (já sugerida): entregue-a ao usuário, que cria a própria senha no primeiro acesso.'),
      marcar('"Situação" bloqueia (suspensão temporária) ou inativa (desligamento) — vale na hora, mesmo com a sessão aberta. Usuário nunca é excluído: o histórico fica.'),
      marcar('"Senha" define uma nova senha temporária para quem esqueceu a sua.'),
      marcar('"Permissões" concede ou retira uma permissão só para esta pessoa, sobre o perfil, com justificativa registrada na auditoria.'),
      marcar('Ninguém altera o próprio cadastro aqui, nem atribui um perfil ou concede uma permissão que não tem. Só um Administrador altera outro Administrador.'),
    ],
  },
  '/trocar-senha': {
    titulo: marcar('Ajuda · Trocar senha'),
    itens: [
      marcar('Com a senha temporária recebida do administrador, escolha uma senha só sua (ao menos 10 caracteres, sem o seu login) para continuar.'),
      marcar('Esqueceu a senha? Peça ao administrador uma nova senha temporária.'),
    ],
  },
  '/configuracoes/banco': {
    titulo: marcar('Ajuda · Banco de dados'),
    itens: [
      marcar('Diagnóstico somente leitura: nada aqui altera o banco, e usuário, senha e string de conexão nunca aparecem.'),
      marcar('"Testar conexão" executa uma consulta mínima e mostra o tempo de resposta.'),
      marcar('Muitas conexões "em uso" por muito tempo, ou latência alta, indicam carga ou problema de rede — avise o responsável pela infraestrutura.'),
      marcar('Só quem tem a permissão desta tela (em Perfis e permissões) acessa.'),
    ],
  },
  '/documentos/vencimentos': {
    titulo: marcar('Ajuda · Documentos a vencer'),
    itens: [
      marcar('Lista a versão vigente de cada documento de produto, peça, fornecedor ou cliente já vencido ou que vence no prazo escolhido (30, 60 ou 90 dias). Cada cadastro só aparece para quem pode vê-lo.'),
      marcar('"Vencido" (vermelho) pede ação já; "Vence em N dias" (laranja) indica os que vencem em até 30 dias.'),
      marcar('Para renovar, envie uma "Nova versão" com a nova validade: em "Mídia e documentos" do produto ou da peça, ou em "Documentos" do fornecedor ou do cliente — o nome do fornecedor ou do cliente na lista abre os documentos dele.'),
    ],
  },
  '/estoque': {
    titulo: marcar('Ajuda · Estoque'),
    itens: [
      marcar('O saldo de cada peça nasce em zero, sempre em situação Crítica, assim que ela é cadastrada.'),
      marcar('A coluna Foto mostra a foto principal da peça, para conferir o item no armazém sem abrir o cadastro.'),
      marcar('Situação Crítica significa saldo menor ou igual ao estoque mínimo cadastrado na peça; filtre por situação para ver só o que precisa de atenção.'),
      marcar('"Ajustar" registra uma entrada ou saída avulsa (use um número negativo para saída), com motivo obrigatório — útil para corrigir uma contagem física.'),
      marcar('A entrada de material comprado é pela nota fiscal de entrada (Recebimento): a efetivação da nota atualiza este saldo.'),
      marcar('"Kardex" lista cada movimento da peça com o saldo depois dele e o documento de origem (nota, OP ou pedido de venda, com link). "Origem do saldo" mostra os lotes e as notas que cobrem o saldo atual — e o que ficou sem documento.'),
      marcar('No ajuste de peça com lote, informe o lote (e a validade, se exigida); com série, informe uma série por unidade ajustada. É também o caminho do inventário de abertura.'),
    ],
  },
};

const CONTEUDO_GENERICO: ConteudoAjuda = {
  titulo: marcar('Ajuda'),
  itens: [
    marcar('Use a navegação lateral para trocar de tela.'),
    marcar('Em qualquer lista, busque, filtre por situação e clique no cabeçalho de uma coluna para ordenar.'),
  ],
};

/**
 * Acha o conteudo pela rota exata primeiro (`/`, `/login`); rotas com
 * sub-paginas (`/cotacoes/nova`, `/cotacoes/123`) caem no prefixo da lista —
 * a ajuda da lista ja cobre o essencial de criar e abrir um registro.
 */
function conteudoDaRota(pathname: string): ConteudoAjuda {
  if (CONTEUDO_POR_ROTA[pathname]) {
    return CONTEUDO_POR_ROTA[pathname];
  }
  const raiz = Object.keys(CONTEUDO_POR_ROTA).find(
    (rota) => rota !== '/' && pathname.startsWith(`${rota}/`),
  );
  return raiz ? CONTEUDO_POR_ROTA[raiz] : CONTEUDO_GENERICO;
}

/** Botao de ajuda contextual: o conteudo do dialogo muda conforme a rota atual. */
export function Ajuda() {
  const [aberto, setAberto] = useState(false);
  useIdioma();
  const { pathname } = useLocation();
  const conteudo = conteudoDaRota(pathname);

  return (
    <>
      <Botao variante="fantasma" icone="help-circle" onClick={() => setAberto(true)}>
        {t('Ajuda')}
      </Botao>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo={td(conteudo.titulo)}>
        <ul className="flex flex-col gap-3 text-body text-texto-primary">
          {conteudo.itens.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="text-texto-secondary">
                •
              </span>
              {td(item)}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
