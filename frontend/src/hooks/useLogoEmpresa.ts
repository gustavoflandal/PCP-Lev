import { urlLogoClaro, urlLogoEscuro } from '@/servicos/empresa';
import { useTemaResolvido } from '@/store/preferencias';
import { useDadosEmpresa } from './useDadosEmpresa';

export interface LogoEmpresa {
  temLogo: boolean;
  url: string;
  /** nome_fantasia, com razao_social como reserva -- so a razao social e
   * obrigatoria no cadastro, entao o caminho minimo de configuracao (so
   * preencher a razao social e salvar) precisa mudar o que aparece no
   * cabecalho e no login, nao continuar mostrando "Sistema PCP". */
  nomeExibido: string;
}

/**
 * Escolhe a variante do logo pelo tema resolvido, caindo para a outra
 * variante quando só uma foi configurada -- sem isso, cadastrar só o logo
 * claro deixaria todo mundo em tema escuro (ou "automático" à noite) sem
 * logo nenhum, mesmo a empresa tendo um configurado. Usado pelo Cabeçalho e
 * pelo Login, que precisam exatamente da mesma escolha.
 */
export function useLogoEmpresa(): LogoEmpresa {
  const { data: empresa } = useDadosEmpresa();
  const temaResolvido = useTemaResolvido();
  const nomeExibido = empresa?.nome_fantasia || empresa?.razao_social || 'Sistema PCP';

  const preferirEscuro = temaResolvido === 'escuro';
  if (preferirEscuro ? empresa?.tem_logo_escuro : empresa?.tem_logo_claro) {
    return {
      temLogo: true,
      url: preferirEscuro ? urlLogoEscuro(empresa?.updated_at) : urlLogoClaro(empresa?.updated_at),
      nomeExibido,
    };
  }
  if (preferirEscuro ? empresa?.tem_logo_claro : empresa?.tem_logo_escuro) {
    return {
      temLogo: true,
      url: preferirEscuro ? urlLogoClaro(empresa?.updated_at) : urlLogoEscuro(empresa?.updated_at),
      nomeExibido,
    };
  }
  return { temLogo: false, url: '', nomeExibido };
}
