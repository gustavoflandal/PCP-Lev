import { api } from './api';
import type {
  PainelCompras,
  PainelEstoque,
  PainelInicio,
  PainelProducao,
  PainelQualidade,
  PainelVendas,
} from '@/tipos/paineis';

interface Envelope<T> {
  dados: T;
}

async function painel<T>(setor: string, dias: number): Promise<T> {
  const { data } = await api.get<Envelope<T>>(`/paineis/${setor}`, { params: { dias } });
  return data.dados;
}

/** Painel inicial: so os blocos dos modulos que a sessao ve. */
export async function obterPainelInicio(): Promise<PainelInicio> {
  const { data } = await api.get<Envelope<PainelInicio>>('/paineis/inicio');
  return data.dados ?? {};
}

export const obterPainelCompras = (dias: number) => painel<PainelCompras>('compras', dias);
export const obterPainelEstoque = (dias: number) => painel<PainelEstoque>('estoque', dias);
export const obterPainelProducao = (dias: number) => painel<PainelProducao>('producao', dias);
export const obterPainelVendas = (dias: number) => painel<PainelVendas>('vendas', dias);
export const obterPainelQualidade = (dias: number) => painel<PainelQualidade>('qualidade', dias);
