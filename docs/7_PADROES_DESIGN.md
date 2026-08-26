# Padrões de Design - Sistema PCP 3PL

**Versão**: 1.0  
**Data**: Agosto 2026  
**Framework**: Tailwind CSS + shadcn/ui  
**Responsividade**: Mobile-first (breakpoints: 640px, 1024px, 1280px)

---

## 📋 Índice

1. [Paleta de Cores](#paleta-de-cores)
2. [Tipografia](#tipografia)
3. [Componentes Reutilizáveis](#componentes-reutilizáveis)
4. [Layouts Padrão](#layouts-padrão)
5. [Padrões de Interação](#padrões-de-interação)
6. [Acessibilidade](#acessibilidade)

---

## Paleta de Cores

### Cores Primárias

```
Primária: #2563EB (Azul)
Secundária: #7C3AED (Roxo)
Sucesso: #10B981 (Verde)
Alerta: #F59E0B (Laranja)
Erro: #EF4444 (Vermelho)
Informação: #3B82F6 (Azul Claro)
```

### Cores de Status

```
OP Aberta: #2563EB (Azul)
OP On-time: #10B981 (Verde)
OP Próximo de Atrasar: #F59E0B (Laranja - < 1 dia)
OP Atrasada: #EF4444 (Vermelho)
Estoque OK: #10B981 (Verde)
Estoque Crítico: #EF4444 (Vermelho)
PC Recebido: #10B981 (Verde)
PC em Atraso: #F59E0B (Laranja)
```

### Escala de Cinza

```
Fundo: #FFFFFF
Superfície: #F9FAFB
Borda: #E5E7EB
Texto Primário: #111827
Texto Secundário: #6B7280
Desabilitado: #D1D5DB
```

### Implementação Tailwind

```tailwind
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
  }
  
  .btn-secondary {
    @apply px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors;
  }
  
  .badge-success {
    @apply inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium;
  }
  
  .badge-error {
    @apply inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium;
  }
  
  .badge-warning {
    @apply inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium;
  }
}
```

---

## Tipografia

### Fontes

```
Font Stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
Monospace: "Courier New", Courier, monospace
```

### Tamanhos

```
H1: 32px / 1.25 (font-bold)
H2: 24px / 1.33 (font-bold)
H3: 20px / 1.4 (font-semibold)
H4: 18px / 1.44 (font-semibold)

Body: 16px / 1.5 (font-normal)
Small: 14px / 1.43 (font-normal)
Xs: 12px / 1.33 (font-normal)

Button: 14px / 1.43 (font-medium)
Label: 14px / 1.43 (font-semibold)
```

### Implementação

```css
/* tailwind.config.js */
module.exports = {
  theme: {
    fontSize: {
      'xs': ['12px', { lineHeight: '16px' }],
      'sm': ['14px', { lineHeight: '20px' }],
      'base': ['16px', { lineHeight: '24px' }],
      'lg': ['18px', { lineHeight: '28px' }],
      'xl': ['20px', { lineHeight: '28px' }],
      '2xl': ['24px', { lineHeight: '32px' }],
      '3xl': ['32px', { lineHeight: '40px' }],
    }
  }
}
```

---

## Componentes Reutilizáveis

### Button

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  children,
  ...props
}) => {
  const baseStyles = 'font-medium rounded-lg transition-colors';
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    ghost: 'bg-transparent text-blue-600 hover:bg-blue-50',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? '...' : children}
    </button>
  );
};
```

### Input

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="font-semibold text-gray-900">{label}</label>}
      <input
        className={`px-3 py-2 border rounded-lg ${
          error 
            ? 'border-red-500 bg-red-50' 
            : 'border-gray-300 focus:border-blue-500'
        }`}
        {...props}
      />
      {error && <span className="text-red-600 text-sm">{error}</span>}
      {helperText && <span className="text-gray-600 text-sm">{helperText}</span>}
    </div>
  );
};
```

### Table

```tsx
interface TableProps {
  columns: Array<{ key: string; label: string; width?: string }>;
  data: any[];
  onRowClick?: (row: any) => void;
  actions?: (row: any) => React.ReactNode;
}

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  onRowClick,
  actions,
}) => {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full">
        <thead className="bg-gray-100 border-b">
          <tr>
            {columns.map(col => (
              <th key={col.key} className="px-6 py-3 text-left font-semibold">
                {col.label}
              </th>
            ))}
            {actions && <th className="px-6 py-3">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              className="border-b hover:bg-gray-50 cursor-pointer"
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(col => (
                <td key={col.key} className="px-6 py-4">
                  {row[col.key]}
                </td>
              ))}
              {actions && <td className="px-6 py-4">{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### Card

```tsx
interface CardProps {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  children,
  footer,
  className,
}) => {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
      {footer && <div className="px-6 py-4 border-t border-gray-200">{footer}</div>}
    </div>
  );
};
```

### Badge

```tsx
interface BadgeProps {
  status: 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ status, children }) => {
  const styles = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
  };
  
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
      {children}
    </span>
  );
};
```

### Modal

```tsx
interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  onClose,
  actions,
  children,
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="font-semibold text-lg">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {actions && <div className="px-6 py-4 border-t flex gap-2 justify-end">{actions}</div>}
      </div>
    </div>
  );
};
```

---

## Layouts Padrão

### Layout Principal

```tsx
export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        {/* Menu */}
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold">Título da Página</h1>
        </header>
        
        {/* Content */}
        <section className="p-6">
          {children}
        </section>
      </main>
    </div>
  );
};
```

### Layout de Listagem

```
┌─────────────────────────────────────┐
│ Título | [Filtro] [Busca] [Ações]   │
├─────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Tabela com dados             │   │
│  │ - Coluna 1  | Coluna 2 | ... │   │
│  │ - Linha 1   | Linha 1  | ... │   │
│  │ - Linha 2   | Linha 2  | ... │   │
│  └──────────────────────────────┘   │
│                                      │
│  [◄ Anterior] Página 1/10 [Próximo►] │
└─────────────────────────────────────┘
```

### Layout de Detalhes

```
┌──────────────────────────────────────────┐
│ ◄ Voltar | Título                  [✎ Editar]
├──────────────────────────────────────────┤
│                                          │
│ Seção 1                                  │
│ ├─ Campo 1: Valor 1                     │
│ ├─ Campo 2: Valor 2                     │
│                                          │
│ Seção 2                                  │
│ ├─ Subtabela com dados                  │
│                                          │
└──────────────────────────────────────────┘
```

---

## Padrões de Interação

### Feedback de Operação

```tsx
// Sucesso
<Toast type="success" message="Operação realizada com sucesso!" duration={3000} />

// Erro
<Toast type="error" message="Erro ao salvar. Tente novamente." duration={5000} />

// Loading
<div className="flex items-center gap-2">
  <Spinner size="sm" />
  <span>Processando...</span>
</div>
```

### Confirmação de Ação

```tsx
<Confirm
  title="Deletar Produto?"
  message="Esta ação não pode ser desfeita."
  okText="Deletar"
  cancelText="Cancelar"
  onConfirm={handleDelete}
/>
```

### Validação em Tempo Real

```tsx
<Input
  label="Código do Produto"
  placeholder="VMS-01"
  value={codigo}
  onChange={(e) => setCodigo(e.target.value)}
  error={codigoError}
  helperText={codigoError ? "Código inválido" : "Formato: XXX-NN"}
/>
```

---

## Acessibilidade

### WCAG 2.1 Level AA

- Contraste mínimo de 4.5:1 para texto
- Todos os inputs com labels
- Navegação por teclado (Tab, Enter, Esc)
- ARIA labels quando necessário
- Suporte a leitores de tela

### Implementação

```tsx
// ✅ Bom: Input com label explícito
<label htmlFor="codigo">Código do Produto</label>
<input id="codigo" type="text" aria-label="Código do Produto" />

// ✅ Bom: Botão com aria-label
<button aria-label="Deletar item">
  <TrashIcon />
</button>

// ✅ Bom: Anúncio de estado de loading
<div role="status" aria-live="polite" aria-busy={isLoading}>
  {isLoading && "Carregando..."}
</div>
```

---

## Responsividade

### Breakpoints

```
Mobile: < 640px
Tablet: 640px - 1023px
Desktop: 1024px+
```

### Exemplo: Grid Responsivo

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => (
    <Card key={item.id}>{/* ... */}</Card>
  ))}
</div>
```

---

**Data de Revisão**: Setembro 2026

