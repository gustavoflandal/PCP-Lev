import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AplicarBrandingEmpresa } from '@/componentes/layout/AplicarBrandingEmpresa';
import { ExigePermissao } from '@/componentes/layout/ExigePermissao';
import { ROTA_TROCAR_SENHA, RotaProtegida } from '@/componentes/layout/RotaProtegida';
import { Shell } from '@/componentes/layout/Shell';
import { PERMISSOES } from '@/lib/permissoes';
import { CentrosTrabalho } from '@/paginas/cadastros/CentrosTrabalho';
import { Clientes } from '@/paginas/cadastros/Clientes';
import { DocumentosVencimentos } from '@/paginas/cadastros/DocumentosVencimentos';
import { Fornecedores } from '@/paginas/cadastros/Fornecedores';
import { PartesPecas } from '@/paginas/cadastros/PartesPecas';
import { ProdutosAcabados } from '@/paginas/cadastros/ProdutosAcabados';
import { Cotacoes } from '@/paginas/compras/Cotacoes';
import { DetalheCotacao } from '@/paginas/compras/DetalheCotacao';
import { DetalhePedidoCompra } from '@/paginas/compras/DetalhePedidoCompra';
import { NecessidadeCompra } from '@/paginas/compras/NecessidadeCompra';
import { NovaCotacao } from '@/paginas/compras/NovaCotacao';
import { NovoPedidoCompra } from '@/paginas/compras/NovoPedidoCompra';
import { PedidosCompra } from '@/paginas/compras/PedidosCompra';
import { Auditoria } from '@/paginas/configuracoes/Auditoria';
import { BancoDeDados } from '@/paginas/configuracoes/BancoDeDados';
import { DadosEmpresaPagina } from '@/paginas/configuracoes/DadosEmpresa';
import { Integracoes } from '@/paginas/configuracoes/Integracoes';
import { ParametrosNegocio } from '@/paginas/configuracoes/ParametrosNegocio';
import { ParametrosRegionais } from '@/paginas/configuracoes/ParametrosRegionais';
import { PerfisPermissoes } from '@/paginas/configuracoes/PerfisPermissoes';
import { Usuarios } from '@/paginas/configuracoes/Usuarios';
import { Estoque } from '@/paginas/estoque/Estoque';
import { Lotes } from '@/paginas/estoque/Lotes';
import { Movimentacoes } from '@/paginas/estoque/Movimentacoes';
import { RastreioLote } from '@/paginas/estoque/RastreioLote';
import { DetalheEstruturaProduto } from '@/paginas/estrutura/DetalheEstruturaProduto';
import { EstruturaProdutos } from '@/paginas/estrutura/EstruturaProdutos';
import { NovaEstruturaProduto } from '@/paginas/estrutura/NovaEstruturaProduto';
import { Login } from '@/paginas/Login';
import { Painel } from '@/paginas/Painel';
import { PainelCompras } from '@/paginas/paineis/PainelCompras';
import { PainelEstoque } from '@/paginas/paineis/PainelEstoque';
import { PainelProducao } from '@/paginas/paineis/PainelProducao';
import { PainelQualidade } from '@/paginas/paineis/PainelQualidade';
import { PainelVendas } from '@/paginas/paineis/PainelVendas';
import { DetalheOP } from '@/paginas/producao/DetalheOP';
import { Kanban } from '@/paginas/producao/Kanban';
import { Metrologia } from '@/paginas/producao/Metrologia';
import { OrdensProducao } from '@/paginas/producao/OrdensProducao';
import { BuscaRastreabilidade, FichaRastreabilidade } from '@/paginas/producao/Rastreabilidade';
import { PreferenciasPagina } from '@/paginas/Preferencias';
import { NotaEntrada } from '@/paginas/recebimento/NotaEntrada';
import { NotasEntrada } from '@/paginas/recebimento/NotasEntrada';
import { TrocarSenha } from '@/paginas/TrocarSenha';
import { DetalhePedidoVenda } from '@/paginas/vendas/DetalhePedidoVenda';
import { FormularioPedidoVenda } from '@/paginas/vendas/FormularioPedidoVenda';
import { PedidosVenda } from '@/paginas/vendas/PedidosVenda';
import { useAutenticacao } from '@/store/autenticacao';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Uma falha de rede na fabrica costuma ser momentanea; uma nova
      // tentativa evita mandar o operador recarregar a tela.
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// Ao sair, descarta todo o cache de consultas: num terminal compartilhado, o
// proximo usuario nao pode ver (nem por um instante) dados carregados por
// quem saiu -- inclusive as permissoes da sessao anterior.
useAutenticacao.subscribe((estado, anterior) => {
  if (anterior.autenticado && !estado.autenticado) {
    queryClient.clear();
  }
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AplicarBrandingEmpresa />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RotaProtegida />}>
          <Route path={ROTA_TROCAR_SENHA} element={<TrocarSenha />} />
          <Route element={<Shell />}>
            <Route path="/" element={<Painel />} />
            <Route path="/paineis/compras" element={<ExigePermissao permissao={PERMISSOES.paineisCompras}><PainelCompras /></ExigePermissao>} />
            <Route path="/paineis/estoque" element={<ExigePermissao permissao={PERMISSOES.paineisEstoque}><PainelEstoque /></ExigePermissao>} />
            <Route path="/paineis/producao" element={<ExigePermissao permissao={PERMISSOES.paineisProducao}><PainelProducao /></ExigePermissao>} />
            <Route path="/paineis/vendas" element={<ExigePermissao permissao={PERMISSOES.paineisVendas}><PainelVendas /></ExigePermissao>} />
            <Route path="/paineis/qualidade" element={<ExigePermissao permissao={PERMISSOES.paineisQualidade}><PainelQualidade /></ExigePermissao>} />
            <Route path="/fornecedores" element={<ExigePermissao permissao={PERMISSOES.fornecedoresVisualizar}><Fornecedores /></ExigePermissao>} />
            <Route path="/clientes" element={<ExigePermissao permissao={PERMISSOES.clientesVisualizar}><Clientes /></ExigePermissao>} />
            <Route path="/centros-trabalho" element={<ExigePermissao permissao={PERMISSOES.centrosVisualizar}><CentrosTrabalho /></ExigePermissao>} />
            <Route path="/partes-pecas" element={<ExigePermissao permissao={PERMISSOES.pecasVisualizar}><PartesPecas /></ExigePermissao>} />
            <Route path="/produtos-acabados" element={<ExigePermissao permissao={PERMISSOES.produtosVisualizar}><ProdutosAcabados /></ExigePermissao>} />
            <Route path="/documentos/vencimentos" element={<ExigePermissao permissao={PERMISSOES.produtosVisualizar}><DocumentosVencimentos /></ExigePermissao>} />
            <Route path="/estrutura-produtos" element={<ExigePermissao permissao={PERMISSOES.estruturaVisualizar}><EstruturaProdutos /></ExigePermissao>} />
            <Route path="/estrutura-produtos/:produtoId" element={<ExigePermissao permissao={PERMISSOES.estruturaVisualizar}><DetalheEstruturaProduto /></ExigePermissao>} />
            <Route path="/estrutura-produtos/:produtoId/nova" element={<ExigePermissao permissao={PERMISSOES.estruturaIncluir}><NovaEstruturaProduto /></ExigePermissao>} />
            <Route path="/cotacoes" element={<ExigePermissao permissao={PERMISSOES.cotacoesVisualizar}><Cotacoes /></ExigePermissao>} />
            <Route path="/cotacoes/nova" element={<ExigePermissao permissao={PERMISSOES.cotacoesIncluir}><NovaCotacao /></ExigePermissao>} />
            <Route path="/cotacoes/:id" element={<ExigePermissao permissao={PERMISSOES.cotacoesVisualizar}><DetalheCotacao /></ExigePermissao>} />
            <Route path="/pedidos-compra" element={<ExigePermissao permissao={PERMISSOES.pedidosVisualizar}><PedidosCompra /></ExigePermissao>} />
            <Route path="/pedidos-compra/novo" element={<ExigePermissao permissao={PERMISSOES.pedidosIncluir}><NovoPedidoCompra /></ExigePermissao>} />
            <Route path="/pedidos-compra/:id" element={<ExigePermissao permissao={PERMISSOES.pedidosVisualizar}><DetalhePedidoCompra /></ExigePermissao>} />
            <Route path="/notas-entrada" element={<ExigePermissao permissao={PERMISSOES.notasVisualizar}><NotasEntrada /></ExigePermissao>} />
            <Route path="/notas-entrada/nova" element={<ExigePermissao permissao={PERMISSOES.notasLancar}><NotaEntrada /></ExigePermissao>} />
            <Route path="/notas-entrada/:id" element={<ExigePermissao permissao={PERMISSOES.notasVisualizar}><NotaEntrada /></ExigePermissao>} />
            <Route path="/necessidade-compra" element={<ExigePermissao permissao={PERMISSOES.necessidadeVisualizar}><NecessidadeCompra /></ExigePermissao>} />
            <Route path="/pedidos-venda" element={<ExigePermissao permissao={PERMISSOES.vendasVisualizar}><PedidosVenda /></ExigePermissao>} />
            <Route path="/pedidos-venda/novo" element={<ExigePermissao permissao={PERMISSOES.vendasIncluir}><FormularioPedidoVenda /></ExigePermissao>} />
            <Route path="/pedidos-venda/:id" element={<ExigePermissao permissao={PERMISSOES.vendasVisualizar}><DetalhePedidoVenda /></ExigePermissao>} />
            <Route path="/pedidos-venda/:id/editar" element={<ExigePermissao permissao={PERMISSOES.vendasEditar}><FormularioPedidoVenda /></ExigePermissao>} />
            <Route path="/producao/kanban" element={<ExigePermissao permissao={PERMISSOES.producaoVisualizar}><Kanban /></ExigePermissao>} />
            <Route path="/producao/ops" element={<ExigePermissao permissao={PERMISSOES.producaoVisualizar}><OrdensProducao /></ExigePermissao>} />
            <Route path="/producao/ops/:id" element={<ExigePermissao permissao={PERMISSOES.producaoVisualizar}><DetalheOP /></ExigePermissao>} />
            <Route path="/producao/metrologia" element={<ExigePermissao permissao={PERMISSOES.producaoVisualizar}><Metrologia /></ExigePermissao>} />
            <Route path="/rastreabilidade" element={<ExigePermissao permissao={PERMISSOES.producaoVisualizar}><BuscaRastreabilidade /></ExigePermissao>} />
            <Route path="/rastreabilidade/:numero" element={<ExigePermissao permissao={PERMISSOES.producaoVisualizar}><FichaRastreabilidade /></ExigePermissao>} />
            <Route path="/estoque" element={<ExigePermissao permissao={PERMISSOES.estoqueVisualizar}><Estoque /></ExigePermissao>} />
            <Route path="/lotes" element={<ExigePermissao permissao={PERMISSOES.estoqueVisualizar}><Lotes /></ExigePermissao>} />
            <Route path="/lotes/:id" element={<ExigePermissao permissao={PERMISSOES.estoqueVisualizar}><RastreioLote /></ExigePermissao>} />
            <Route path="/movimentacoes" element={<ExigePermissao permissao={PERMISSOES.estoqueVisualizar}><Movimentacoes /></ExigePermissao>} />
            <Route path="/preferencias" element={<PreferenciasPagina />} />
            <Route path="/configuracoes/empresa" element={<DadosEmpresaPagina />} />
            <Route path="/configuracoes/auditoria" element={<Auditoria />} />
            <Route path="/configuracoes/regional" element={<ParametrosRegionais />} />
            <Route path="/configuracoes/negocio" element={<ParametrosNegocio />} />
            <Route path="/configuracoes/integracoes" element={<Integracoes />} />
            <Route path="/configuracoes/banco" element={<BancoDeDados />} />
            <Route path="/configuracoes/perfis" element={<PerfisPermissoes />} />
            <Route path="/configuracoes/usuarios" element={<ExigePermissao permissao={PERMISSOES.configUsuarios}><Usuarios /></ExigePermissao>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}
