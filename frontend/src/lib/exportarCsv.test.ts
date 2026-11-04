import { describe, expect, it } from 'vitest';
import { montarCsv } from './exportarCsv';

function montar(html: string): HTMLElement {
  const raiz = document.createElement('div');
  raiz.innerHTML = html;
  return raiz;
}

describe('montarCsv', () => {
  it('exporta cabecalho e linhas, sem a coluna de acoes', () => {
    const raiz = montar(`
      <table aria-label="Clientes">
        <thead><tr><th>Código</th><th>Descrição</th><th class="print:hidden">Ações</th></tr></thead>
        <tbody>
          <tr><td>A1</td><td>Radar; "VMS"</td><td><button>Editar</button></td></tr>
          <tr><td>A2</td><td>Placa</td><td><button>Editar</button></td></tr>
        </tbody>
      </table>`);

    expect(montarCsv(raiz)).toBe('Código;Descrição\r\nA1;"Radar; ""VMS"""\r\nA2;Placa');
  });

  it('converte os indicadores de foto/documento em Sim/Nao', () => {
    const raiz = montar(`
      <table>
        <thead><tr><th>Código</th><th>Foto</th></tr></thead>
        <tbody>
          <tr><td>A1</td><td><button aria-label="Ver fotos de A1"><svg></svg></button></td></tr>
          <tr><td>A2</td><td><span role="img" aria-label="Sem foto cadastrada"><svg></svg></span></td></tr>
        </tbody>
      </table>`);

    expect(montarCsv(raiz)).toBe('Código;Foto\r\nA1;Sim\r\nA2;Não');
  });

  it('ignora a linha de estado vazio e devolve vazio quando nao ha dados', () => {
    const raiz = montar(`
      <table>
        <thead><tr><th>Código</th><th>Descrição</th></tr></thead>
        <tbody><tr><td colspan="2">Nenhum registro.</td></tr></tbody>
      </table>`);

    expect(montarCsv(raiz)).toBe('');
  });

  it('le o valor digitado de campos e separa varias tabelas com o titulo', () => {
    const raiz = montar(`
      <table aria-label="Itens"><thead><tr><th>Qtd</th></tr></thead>
        <tbody><tr><td><input value="5" /></td></tr></tbody></table>
      <table aria-label="Versões"><thead><tr><th>Versão</th></tr></thead>
        <tbody><tr><td>v.1</td></tr></tbody></table>`);

    expect(montarCsv(raiz)).toBe('Itens\r\nQtd\r\n5\r\n\r\nVersões\r\nVersão\r\nv.1');
  });
});
