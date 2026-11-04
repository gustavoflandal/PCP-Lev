import { useMutation } from '@tanstack/react-query';
import { Botao } from '@/componentes/ui/Botao';
import { separarErro } from '@/lib/errosDeFormulario';
import { baixarGabarito } from '@/servicos/importacao';
import { marcar, t, td } from '@/i18n';

const NOME_DO_ARQUIVO = 'gabarito-importacao.xlsx';

function salvarArquivo(conteudo: Blob, nome: string) {
  const url = URL.createObjectURL(conteudo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const CADASTROS = [
  { aba: marcar('Clientes'), detalhe: marcar('Identificados pelo CNPJ.') },
  { aba: marcar('Fornecedores'), detalhe: marcar('Identificados pelo CNPJ.') },
  { aba: marcar('Produtos acabados'), detalhe: marcar('Identificados pelo código.') },
  { aba: marcar('Partes e peças'), detalhe: marcar('Identificadas pelo código; o fornecedor padrão é informado pelo CNPJ.') },
];

export function Gabarito() {
  const baixar = useMutation({
    mutationFn: baixarGabarito,
    onSuccess: (arquivo) => salvarArquivo(arquivo, NOME_DO_ARQUIVO),
  });
  const { geral: erro } = separarErro(baixar.error);

  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Gabarito de importação')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Planilha Excel vazia, já estruturada, para carregar os cadastros de uma só vez.')}
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-cartao border border-borda-subtle bg-surface-raised p-6">
        <h2 className="text-subtitle text-texto-primary">{t('O que o gabarito contém')}</h2>
        <ul className="flex flex-col gap-1 text-body text-texto-primary">
          {CADASTROS.map((c) => (
            <li key={c.aba}>
              <strong>{td(c.aba)}</strong> — <span className="text-texto-secondary">{td(c.detalhe)}</span>
            </li>
          ))}
        </ul>
        <p className="text-body text-texto-secondary">
          {t('A primeira aba (Instruções) explica cada coluna. Colunas obrigatórias vêm em vermelho e marcadas com *.')}
        </p>

        {baixar.isError && (
          <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
            {erro || t('Não foi possível baixar o gabarito. Tente de novo.')}
          </p>
        )}
        <div>
          <Botao icone="download" ocupado={baixar.isPending} rotuloOcupado={t('Gerando…')} onClick={() => baixar.mutate()}>
            {t('Baixar gabarito (.xlsx)')}
          </Botao>
        </div>
      </section>
    </div>
  );
}
