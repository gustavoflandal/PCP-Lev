import { useEffect, useState, type ReactNode } from 'react';
import { t } from '@/i18n';
import { useLogoEmpresa } from '@/hooks/useLogoEmpresa';
import { formatarDataHora } from '@/lib/formato';
import { nomeDoArquivo, prepararGraficos, restaurarGraficos, tituloDaTela } from '@/lib/impressao';
import { useAutenticacao } from '@/store/autenticacao';

/**
 * Cabecalho que so aparece no papel/PDF: tela, empresa, quem imprimiu e
 * quando. Escuta beforeprint/afterprint, entao vale tanto para o botao
 * "Imprimir / PDF" quanto para o Ctrl+P do navegador.
 *
 * Esta base nao consulta a API (o Modal a usa, inclusive fora do provedor de
 * consultas); a da tela inteira, com a logo da empresa, e CabecalhoImpressao.
 */
export function CabecalhoImpressaoBase({ marca, empresa }: { marca?: ReactNode; empresa?: string }) {
  const usuario = useAutenticacao((estado) => estado.usuario);
  const [impressao, definirImpressao] = useState<{ titulo: string; quando: Date } | null>(null);

  useEffect(() => {
    let tituloAnterior = document.title;
    function antes() {
      const titulo = tituloDaTela();
      const quando = new Date();
      tituloAnterior = document.title;
      document.title = nomeDoArquivo(titulo, quando);
      prepararGraficos();
      definirImpressao({ titulo, quando });
    }
    function depois() {
      document.title = tituloAnterior;
      restaurarGraficos();
    }
    window.addEventListener('beforeprint', antes);
    window.addEventListener('afterprint', depois);
    return () => {
      window.removeEventListener('beforeprint', antes);
      window.removeEventListener('afterprint', depois);
    };
  }, []);

  return (
    <div data-cabecalho-impressao className="mb-4 hidden items-end justify-between gap-4 border-b border-borda-strong pb-2 print:flex">
      <div className="flex items-center gap-3">
        {marca}
        <div>
          <p className="text-subtitle text-texto-primary">{impressao?.titulo ?? ''}</p>
          <p className="text-label text-texto-secondary">{empresa ? `${empresa} · PCP-Lev` : 'PCP-Lev'}</p>
        </div>
      </div>
      <p className="text-right text-label text-texto-secondary">
        {usuario ? t('Impresso por {nome}', { nome: usuario.nome }) : t('Impresso')}
        {impressao && <span className="block tabular">{formatarDataHora(impressao.quando.toISOString())}</span>}
      </p>
    </div>
  );
}

/** Cabecalho de impressao das telas internas, com a logo da empresa. */
export function CabecalhoImpressao() {
  const { temLogo, url: urlLogo, nomeExibido } = useLogoEmpresa();
  return (
    <CabecalhoImpressaoBase
      empresa={nomeExibido}
      marca={temLogo ? <img src={urlLogo} alt="" className="h-8 w-auto" /> : undefined}
    />
  );
}
