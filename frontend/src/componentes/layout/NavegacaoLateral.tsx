import { NavLink } from 'react-router-dom';
import { icones, type NomeIcone } from '@/componentes/ui/icones';
import { cn } from '@/lib/cn';
import { PERMISSOES, type Permissao } from '@/lib/permissoes';
import { useAutenticacao } from '@/store/autenticacao';

interface ItemNavegacao {
  rota: string;
  rotulo: string;
  icone: NomeIcone;
  /** Sem a permissao, o item nao aparece (a tela responderia 403). */
  permissao?: Permissao;
}

const PAINEL: ItemNavegacao = { rota: '/', rotulo: 'Painel', icone: 'layout-dashboard' };

// Paineis por setor: cada um com a sua permissao (concedivel por usuario).
const PAINEIS: ItemNavegacao[] = [
  { rota: '/paineis/compras', rotulo: 'Compras', icone: 'shopping-cart', permissao: PERMISSOES.paineisCompras },
  { rota: '/paineis/estoque', rotulo: 'Recebimento e estoque', icone: 'warehouse', permissao: PERMISSOES.paineisEstoque },
  { rota: '/paineis/producao', rotulo: 'Produção', icone: 'factory', permissao: PERMISSOES.paineisProducao },
  { rota: '/paineis/vendas', rotulo: 'Vendas e expedição', icone: 'truck', permissao: PERMISSOES.paineisVendas },
  { rota: '/paineis/qualidade', rotulo: 'Qualidade', icone: 'clipboard-check', permissao: PERMISSOES.paineisQualidade },
];

const CADASTROS: ItemNavegacao[] = [
  { rota: '/produtos-acabados', rotulo: 'Produtos acabados', icone: 'package', permissao: PERMISSOES.produtosVisualizar },
  { rota: '/partes-pecas', rotulo: 'Partes e peças', icone: 'boxes', permissao: PERMISSOES.pecasVisualizar },
  { rota: '/clientes', rotulo: 'Clientes', icone: 'briefcase', permissao: PERMISSOES.clientesVisualizar },
  { rota: '/fornecedores', rotulo: 'Fornecedores', icone: 'users', permissao: PERMISSOES.fornecedoresVisualizar },
  { rota: '/centros-trabalho', rotulo: 'Centros de trabalho', icone: 'wrench', permissao: PERMISSOES.centrosVisualizar },
  { rota: '/documentos/vencimentos', rotulo: 'Documentos a vencer', icone: 'calendar-clock', permissao: PERMISSOES.produtosVisualizar },
];

const ESTRUTURA: ItemNavegacao[] = [{ rota: '/estrutura-produtos', rotulo: 'Estrutura de produtos', icone: 'settings', permissao: PERMISSOES.estruturaVisualizar }];

const COMPRAS: ItemNavegacao[] = [
  { rota: '/cotacoes', rotulo: 'Cotações', icone: 'clipboard-list', permissao: PERMISSOES.cotacoesVisualizar },
  { rota: '/pedidos-compra', rotulo: 'Pedidos de compra', icone: 'shopping-cart', permissao: PERMISSOES.pedidosVisualizar },
  { rota: '/necessidade-compra', rotulo: 'Necessidade de compra', icone: 'alert-triangle', permissao: PERMISSOES.necessidadeVisualizar },
];

const VENDAS: ItemNavegacao[] = [
  { rota: '/pedidos-venda', rotulo: 'Pedidos de venda', icone: 'receipt', permissao: PERMISSOES.vendasVisualizar },
];

const PRODUCAO: ItemNavegacao[] = [
  { rota: '/producao/kanban', rotulo: 'Kanban', icone: 'kanban', permissao: PERMISSOES.producaoVisualizar },
  { rota: '/producao/ops', rotulo: 'Ordens de produção', icone: 'factory', permissao: PERMISSOES.producaoVisualizar },
  { rota: '/rastreabilidade', rotulo: 'Rastreabilidade', icone: 'scan-line', permissao: PERMISSOES.producaoVisualizar },
  { rota: '/producao/metrologia', rotulo: 'Metrologia', icone: 'gauge', permissao: PERMISSOES.producaoVisualizar },
];

// Recebimento fiscal (v1.2): toda entrada de insumo comprado nasce de uma nota.
const RECEBIMENTO: ItemNavegacao[] = [
  { rota: '/notas-entrada', rotulo: 'Notas fiscais de entrada', icone: 'file-input', permissao: PERMISSOES.notasVisualizar },
];

const ESTOQUE: ItemNavegacao[] = [
  { rota: '/estoque', rotulo: 'Estoque', icone: 'boxes', permissao: PERMISSOES.estoqueVisualizar },
  { rota: '/lotes', rotulo: 'Lotes', icone: 'layers', permissao: PERMISSOES.estoqueVisualizar },
];

// Cada tela de configuracao aparece so para quem tem a permissao dela --
// esconder o link evita levar a uma tela que so vai mostrar "acesso restrito".
const CONFIGURACOES: ItemNavegacao[] = [
  { rota: '/configuracoes/empresa', rotulo: 'Dados da empresa', icone: 'building', permissao: PERMISSOES.configEmpresa },
  { rota: '/configuracoes/auditoria', rotulo: 'Auditoria', icone: 'history', permissao: PERMISSOES.configAuditoria },
  { rota: '/configuracoes/regional', rotulo: 'Parâmetros regionais', icone: 'clock', permissao: PERMISSOES.configRegional },
  { rota: '/configuracoes/negocio', rotulo: 'Parâmetros de negócio', icone: 'sliders', permissao: PERMISSOES.configNegocio },
  { rota: '/configuracoes/integracoes', rotulo: 'Integrações', icone: 'plug', permissao: PERMISSOES.configIntegracoes },
  { rota: '/configuracoes/banco', rotulo: 'Banco de dados', icone: 'database', permissao: PERMISSOES.configBanco },
  { rota: '/configuracoes/usuarios', rotulo: 'Usuários', icone: 'user-cog', permissao: PERMISSOES.configUsuarios },
  { rota: '/configuracoes/perfis', rotulo: 'Perfis e permissões', icone: 'shield-check', permissao: PERMISSOES.configPerfis },
];

function classesDoLink({ isActive }: { isActive: boolean }): string {
  return cn(
    'flex min-h-linha items-center gap-2 rounded-campo px-3 text-body',
    isActive ? 'bg-brand-subtle text-brand' : 'text-texto-secondary hover:bg-surface-sunken',
  );
}

function Link({ item }: { item: ItemNavegacao }) {
  const Icone = icones[item.icone];
  return (
    <NavLink to={item.rota} end={item.rota === '/'} className={classesDoLink}>
      <Icone size={16} aria-hidden="true" className="shrink-0" />
      {item.rotulo}
    </NavLink>
  );
}

function Secao({ titulo, itens, permissoes }: { titulo: string; itens: ItemNavegacao[]; permissoes: string[] }) {
  const visiveis = itens.filter((item) => !item.permissao || permissoes.includes(item.permissao));
  if (visiveis.length === 0) return null;
  return (
    <>
      <p className="mb-1 mt-6 px-3 text-label text-texto-disabled">{titulo}</p>
      <ul className="flex flex-col gap-1">
        {visiveis.map((item) => (
          <li key={item.rota}>
            <Link item={item} />
          </li>
        ))}
      </ul>
    </>
  );
}

const SEM_PERMISSOES: string[] = [];

export function NavegacaoLateral() {
  const permissoes = useAutenticacao((estado) => estado.usuario?.permissoes ?? SEM_PERMISSOES);

  return (
    <nav
      aria-label="Módulos do sistema"
      className="w-[220px] shrink-0 border-r border-borda-subtle bg-surface-raised p-3 print:hidden"
    >
      <ul className="flex flex-col gap-1">
        <li>
          <Link item={PAINEL} />
        </li>
      </ul>

      <Secao titulo="Painéis" itens={PAINEIS} permissoes={permissoes} />
      <Secao titulo="Cadastros" itens={CADASTROS} permissoes={permissoes} />
      <Secao titulo="Estrutura de produtos" itens={ESTRUTURA} permissoes={permissoes} />
      <Secao titulo="Vendas" itens={VENDAS} permissoes={permissoes} />
      <Secao titulo="Produção" itens={PRODUCAO} permissoes={permissoes} />
      <Secao titulo="Compras" itens={COMPRAS} permissoes={permissoes} />
      <Secao titulo="Recebimento" itens={RECEBIMENTO} permissoes={permissoes} />
      <Secao titulo="Estoque" itens={ESTOQUE} permissoes={permissoes} />
      <Secao titulo="Configurações" itens={CONFIGURACOES} permissoes={permissoes} />

    </nav>
  );
}
