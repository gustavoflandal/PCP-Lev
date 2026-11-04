import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Botao } from '@/componentes/ui/Botao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import { separarErro } from '@/lib/errosDeFormulario';
import { importarPlanilha } from '@/servicos/importacao';
import type { ErroImportacao, ResumoAbaImportacao } from '@/tipos/importacao';
import { t, td } from '@/i18n';

const SEM_FUNCAO = () => {};

export function Importar() {
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, definirArquivo] = useState<File | null>(null);

  const importacao = useMutation({
    mutationFn: importarPlanilha,
    onSuccess: (resultado) => {
      if (resultado.importado) {
        // Os cadastros mudaram: as listas e seletores precisam recarregar.
        void clienteQuery.invalidateQueries();
        mostrarToast(t('Importação concluída'));
        definirArquivo(null);
        if (entrada.current) entrada.current.value = '';
      }
    },
  });

  const resultado = importacao.data;
  const { geral: erroGeral } = separarErro(importacao.error);

  const colunasResumo: Coluna<ResumoAbaImportacao>[] = [
    { chave: 'aba', rotulo: t('Cadastro'), renderizar: (r) => td(r.aba) },
    { chave: 'lidas', rotulo: t('Linhas lidas'), alinhamento: 'direita', renderizar: (r) => r.lidas },
    { chave: 'importadas', rotulo: t('Importadas'), alinhamento: 'direita', renderizar: (r) => r.importadas },
    { chave: 'ignoradas', rotulo: t('Já existiam (ignoradas)'), alinhamento: 'direita', renderizar: (r) => r.ignoradas },
  ];
  const colunasErros: Coluna<ErroImportacao>[] = [
    { chave: 'aba', rotulo: t('Aba'), renderizar: (e) => td(e.aba) },
    { chave: 'linha', rotulo: t('Linha'), alinhamento: 'direita', renderizar: (e) => e.linha },
    { chave: 'coluna', rotulo: t('Coluna'), renderizar: (e) => e.coluna || '—' },
    { chave: 'mensagem', rotulo: t('Problema'), renderizar: (e) => e.mensagem },
  ];

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Importar cadastros')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Envie a planilha preenchida a partir do gabarito. O sistema confere tudo antes de gravar: se houver qualquer problema, nada é importado e você vê onde corrigir.')}
        </p>
      </div>

      <form
        className="flex flex-col gap-3 rounded-cartao border border-borda-subtle bg-surface-raised p-6"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (arquivo) importacao.mutate(arquivo);
        }}
      >
        <label className="flex flex-col gap-1 text-label text-texto-secondary">
          {t('Planilha (.xlsx)')}
          <input
            ref={entrada}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(evento) => {
              definirArquivo(evento.target.files?.[0] ?? null);
              importacao.reset();
            }}
            className="text-body text-texto-primary"
          />
        </label>
        <div>
          <Botao type="submit" icone="upload" disabled={!arquivo} ocupado={importacao.isPending} rotuloOcupado={t('Conferindo e importando…')}>
            {t('Importar')}
          </Botao>
        </div>

        {importacao.isError && (
          <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
            {erroGeral || t('Não foi possível importar a planilha. Tente de novo.')}
          </p>
        )}
      </form>

      {resultado && !resultado.importado && (
        <section className="flex flex-col gap-2" aria-label={t('Problemas encontrados')}>
          <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
            {t('Nada foi importado: a planilha tem {n} problema(s). Corrija e envie de novo.', { n: resultado.erros.length })}
          </p>
          <Tabela<ErroImportacao>
            rotulo={t('Problemas da planilha')}
            colunas={colunasErros}
            itens={resultado.erros}
            chaveDe={(e) => `${e.aba}-${e.linha}-${e.coluna ?? ''}-${e.mensagem}`}
            ordenarPor="aba"
            ordem="asc"
            aoOrdenar={SEM_FUNCAO}
            vazio={t('Nenhum problema.')}
          />
        </section>
      )}

      {resultado && resultado.importado && (
        <section className="flex flex-col gap-2" aria-label={t('Resultado da importação')}>
          <p role="status" className="rounded-campo border border-estado-done bg-estado-done-bg px-3 py-2 text-body text-estado-done">
            {t('Importação concluída sem problemas.')}
          </p>
          <Tabela<ResumoAbaImportacao>
            rotulo={t('Resumo da importação')}
            colunas={colunasResumo}
            itens={resultado.resumo}
            chaveDe={(r) => r.aba}
            ordenarPor="aba"
            ordem="asc"
            aoOrdenar={SEM_FUNCAO}
            vazio={t('A planilha não tinha dados para importar.')}
          />
        </section>
      )}
    </div>
  );
}
