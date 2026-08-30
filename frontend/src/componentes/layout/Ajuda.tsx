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
};

const CONTEUDO_GENERICO: ConteudoAjuda = {
  titulo: 'Ajuda',
  itens: [
    'Use a navegação lateral para trocar de tela.',
    'Em qualquer lista, busque, filtre por situação e clique no cabeçalho de uma coluna para ordenar.',
  ],
};

/** Botao de ajuda contextual: o conteudo do dialogo muda conforme a rota atual. */
export function Ajuda() {
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();
  const conteudo = CONTEUDO_POR_ROTA[pathname] ?? CONTEUDO_GENERICO;

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
