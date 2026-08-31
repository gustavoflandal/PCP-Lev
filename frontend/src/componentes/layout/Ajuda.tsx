import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Botao } from '@/componentes/ui/Botao';
import { Modal } from '@/componentes/ui/Modal';

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
    titulo: 'Ajuda · Entrar',
    itens: [
      'Use o usuário e a senha fornecidos pelo administrador do sistema.',
      'O ícone de olho ao lado da senha mostra o que foi digitado, para conferir antes de enviar.',
      'Se a sessão cair por inatividade, basta entrar de novo — nada do que já foi salvo se perde.',
    ],
  },
  '/': {
    titulo: 'Ajuda · Painel',
    itens: [
      'O painel mostra onde cada indicador vai aparecer assim que o modulo correspondente entrar em operacao.',
      'O cartão "Conexão com o servidor" avisa quando a API está fora do ar: nenhuma tela de cadastro vai funcionar até ela voltar.',
    ],
  },
  '/fornecedores': {
    titulo: 'Ajuda · Fornecedores',
    itens: [
      'Use "Novo fornecedor" para cadastrar; CNPJ pode ser digitado com ou sem pontuação.',
      'Busque por razão social, CNPJ ou contato, e filtre por situação (Ativos, Inativos ou Todos).',
      'Clique no cabeçalho de uma coluna para ordenar por ela; clique de novo para inverter.',
      '"Inativar" preserva o histórico e tira o fornecedor das listas de seleção; para reativar, edite o registro e mude a situação.',
    ],
  },
  '/partes-pecas': {
    titulo: 'Ajuda · Partes e peças',
    itens: [
      'Use "Nova peça" para cadastrar; código e descrição são obrigatórios.',
      'Estoque mínimo e máximo definem a faixa de reposição usada pelo módulo de estoque.',
      'Busque por código ou descrição, e filtre por situação (Ativos, Inativos ou Todos).',
      '"Inativar" preserva o histórico; para reativar, edite o registro e mude a situação.',
    ],
  },
  '/produtos-acabados': {
    titulo: 'Ajuda · Produtos acabados',
    itens: [
      'Use "Novo produto" para cadastrar; código, descrição e preço de venda são obrigatórios.',
      'O lead time de produção informa o módulo de produção sobre o prazo esperado.',
      'Busque por código ou descrição, e filtre por situação (Ativos, Inativos ou Todos).',
      '"Inativar" preserva o histórico; para reativar, edite o registro e mude a situação.',
    ],
  },
  '/estrutura-produtos': {
    titulo: 'Ajuda · Estrutura de produtos',
    itens: [
      'Cada produto acabado pode ter uma estrutura (BOM): a lista de partes/peças e a quantidade de cada uma para montar 1 unidade.',
      'Uma estrutura nunca é editada nem apagada — mudanças viram uma "Nova versão", que substitui a anterior a partir de uma data de vigência.',
      'A versão anterior fica no histórico, com a data em que deixou de valer — nada se perde.',
      'Só existe uma versão ativa por produto de cada vez.',
    ],
  },
  '/cotacoes': {
    titulo: 'Ajuda · Cotações',
    itens: [
      'Uma cotação nasce em Rascunho, com ao menos um item; "Enviar" registra que foi encaminhada ao fornecedor.',
      'Depois de enviada, "Registrar resposta" grava o preço negociado por item e recalcula o valor total.',
      'Uma cotação Respondida pode ser convertida num pedido de compra — o preço vai travado, igual ao negociado.',
      'Cancelar preserva o histórico; uma cotação cancelada não volta a nenhum status anterior.',
    ],
  },
  '/pedidos-compra': {
    titulo: 'Ajuda · Pedidos de compra',
    itens: [
      'Um pedido nasce em Rascunho; "Emitir" o envia ao fornecedor.',
      'O bloco "Pedidos em atraso" no topo da lista mostra os que passaram da data de entrega prevista.',
      'Um pedido pode ser criado a partir de uma cotação respondida (tela da cotação) ou manualmente aqui.',
      'Cancelar só é possível enquanto o pedido não estiver Concluído ou já Cancelado.',
    ],
  },
  '/preferencias': {
    titulo: 'Ajuda · Preferências',
    itens: [
      'Tema, alto contraste, densidade e tamanho de fonte mudam a interface imediatamente ao selecionar — não é preciso salvar.',
      'A preferência fica salva na sua conta: vale em qualquer computador que você usar para entrar no sistema.',
      'Tema "Automático" segue a configuração de claro/escuro do sistema operacional.',
      'Densidade "Compacta" mostra mais linhas por tela nas listas; "Confortável" deixa alvos maiores, melhor para tablet.',
    ],
  },
  '/necessidade-compra': {
    titulo: 'Ajuda · Necessidade de compra',
    itens: [
      'Lista as peças ativas cujo saldo está abaixo do estoque mínimo cadastrado, agrupadas pelo fornecedor padrão de cada uma.',
      'A "Necessidade" é a quantidade sugerida para repor: estoque mínimo menos o saldo atual.',
      '"Gerar cotação" leva para o formulário de nova cotação já com o fornecedor e os itens preenchidos — só falta informar o preço negociado.',
      'Peças sem fornecedor padrão aparecem à parte, sem essa opção: cadastre um fornecedor padrão na peça primeiro.',
    ],
  },
  '/configuracoes/empresa': {
    titulo: 'Ajuda · Dados da empresa',
    itens: [
      'Razão social é o único campo obrigatório; os demais podem ficar em branco até serem definidos.',
      '"Buscar CEP" preenche logradouro, bairro, cidade e UF automaticamente a partir do CEP informado.',
      'O logotipo aparece no cabeçalho e na tela de login de todo mundo que usa o sistema — escolha a variante clara e a escura para cada tema.',
      'Só o Administrador acessa e edita esta tela.',
    ],
  },
  '/configuracoes/auditoria': {
    titulo: 'Ajuda · Auditoria',
    itens: [
      'Toda inclusão, alteração e exclusão nos cadastros e módulos principais fica registrada aqui automaticamente — não precisa ativar nada.',
      'Filtre por período, tabela ou tipo de ação para achar um evento específico mais rápido.',
      '"Ver detalhes" mostra campo a campo o que mudou, com o valor anterior e o novo — não o dado bruto do banco.',
      'Só o Administrador acessa esta tela.',
    ],
  },
  '/estoque': {
    titulo: 'Ajuda · Estoque',
    itens: [
      'O saldo de cada peça nasce em zero, sempre em situação Crítica, assim que ela é cadastrada.',
      'Situação Crítica significa saldo menor ou igual ao estoque mínimo cadastrado na peça; filtre por situação para ver só o que precisa de atenção.',
      '"Ajustar" registra uma entrada ou saída avulsa (use um número negativo para saída), com motivo obrigatório — útil para corrigir uma contagem física.',
      'O recebimento de um pedido de compra também atualiza este saldo automaticamente — veja o detalhe do pedido em Pedidos de compra.',
    ],
  },
};

const CONTEUDO_GENERICO: ConteudoAjuda = {
  titulo: 'Ajuda',
  itens: [
    'Use a navegação lateral para trocar de tela.',
    'Em qualquer lista, busque, filtre por situação e clique no cabeçalho de uma coluna para ordenar.',
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
  const { pathname } = useLocation();
  const conteudo = conteudoDaRota(pathname);

  return (
    <>
      <Botao variante="fantasma" icone="help-circle" onClick={() => setAberto(true)}>
        Ajuda
      </Botao>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo={conteudo.titulo}>
        <ul className="flex flex-col gap-3 text-body text-texto-primary">
          {conteudo.itens.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="text-texto-secondary">
                •
              </span>
              {item}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
