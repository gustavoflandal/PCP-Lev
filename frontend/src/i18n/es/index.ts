import ajuda from './ajuda';
import base from './base';
import cadastros from './cadastros';
import compras from './compras';
import configuracoes from './configuracoes';
import estoque from './estoque';
import paineis from './paineis';
import producao from './producao';
import recebimento from './recebimento';
import vendas from './vendas';

/** Dicionario completo em espanhol: um arquivo por grupo de telas, para que cada um evolua sem conflito. */
const es: Record<string, string> = {
  ...base,
  ...ajuda,
  ...cadastros,
  ...compras,
  ...configuracoes,
  ...estoque,
  ...paineis,
  ...producao,
  ...recebimento,
  ...vendas,
};

export default es;
