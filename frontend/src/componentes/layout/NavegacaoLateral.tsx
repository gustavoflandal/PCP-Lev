import { NavLink } from 'react-router-dom';
import { icones, type NomeIcone } from '@/componentes/ui/icones';
import { cn } from '@/lib/cn';

interface ItemNavegacao {
  rota: string;
  rotulo: string;
  icone: NomeIcone;
}

interface ItemFuturo {
  rotulo: string;
  icone: NomeIcone;
}

const PAINEL: ItemNavegacao = { rota: '/', rotulo: 'Painel', icone: 'layout-dashboard' };

const CADASTROS: ItemNavegacao[] = [
  { rota: '/produtos-acabados', rotulo: 'Produtos acabados', icone: 'package' },
  { rota: '/partes-pecas', rotulo: 'Partes e peças', icone: 'boxes' },
  { rota: '/fornecedores', rotulo: 'Fornecedores', icone: 'users' },
];

const COMPRAS: ItemNavegacao[] = [
  { rota: '/cotacoes', rotulo: 'Cotações', icone: 'clipboard-list' },
  { rota: '/pedidos-compra', rotulo: 'Pedidos de compra', icone: 'shopping-cart' },
];

// Ficam visiveis de proposito: quem usa o sistema precisa saber que estes
// modulos vao existir, e em que ordem chegam.
const FUTUROS: ItemFuturo[] = [{ rotulo: 'Produção', icone: 'factory' }];

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

export function NavegacaoLateral() {
  return (
    <nav
      aria-label="Módulos do sistema"
      className="w-[220px] shrink-0 border-r border-borda-subtle bg-surface-raised p-3"
    >
      <ul className="flex flex-col gap-1">
        <li>
          <Link item={PAINEL} />
        </li>
      </ul>

      <p className="mb-1 mt-6 px-3 text-label text-texto-disabled">Cadastros</p>
      <ul className="flex flex-col gap-1">
        {CADASTROS.map((item) => (
          <li key={item.rota}>
            <Link item={item} />
          </li>
        ))}
      </ul>

      <p className="mb-1 mt-6 px-3 text-label text-texto-disabled">Compras</p>
      <ul className="flex flex-col gap-1">
        {COMPRAS.map((item) => (
          <li key={item.rota}>
            <Link item={item} />
          </li>
        ))}
      </ul>

      <p className="mb-1 mt-6 px-3 text-label text-texto-disabled">Em construção</p>
      <ul className="flex flex-col gap-1">
        {FUTUROS.map((item) => {
          const Icone = icones[item.icone];
          return (
            <li
              key={item.rotulo}
              className="flex min-h-linha flex-col justify-center rounded-campo px-3"
            >
              <span className="flex items-center gap-2 text-body text-texto-disabled">
                <Icone size={16} aria-hidden="true" className="shrink-0" />
                {item.rotulo}
              </span>
              <span className="pl-6 text-label text-texto-disabled">Próxima sprint</span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
