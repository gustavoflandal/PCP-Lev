/** @type {import('tailwindcss').Config} */
// Os valores vem dos tokens definidos em src/estilos/tokens.css.
// Nenhum componente deve usar hex solto — sempre a classe do token.
//
// fontSize/spacing/minHeight (exceto `px`, um hairline que nao deve
// escalar) estao em `rem`, nao `px` -- e o que permite Tamanho de Fonte
// (Fase 4.1) escalar tudo proporcionalmente via `font-size` no <html>,
// sem tocar nenhum componente. 1rem = 16px, entao os valores em 100%
// (tamanho padrao) sao identicos aos que existiam antes desta fase.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Escala de 4px do sistema de design. Nada fora disso.
    spacing: {
      0: '0',
      1: '0.25rem',
      2: '0.5rem',
      3: '0.75rem',
      4: '1rem',
      6: '1.5rem',
      8: '2rem',
      12: '3rem',
      px: '1px',
    },
    borderRadius: {
      none: '0',
      campo: '4px',
      cartao: '6px',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      elevado: '0 1px 2px rgba(16, 24, 40, .06)',
    },
    extend: {
      colors: {
        surface: {
          base: 'var(--surface-base)',
          raised: 'var(--surface-raised)',
          sunken: 'var(--surface-sunken)',
        },
        borda: {
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        texto: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          disabled: 'var(--text-disabled)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          subtle: 'var(--brand-subtle)',
        },
        foco: 'var(--focus-ring)',
        estado: {
          done: 'var(--state-done)',
          'done-bg': 'var(--state-done-bg)',
          pending: 'var(--state-pending)',
          'pending-bg': 'var(--state-pending-bg)',
          warning: 'var(--state-warning)',
          'warning-bg': 'var(--state-warning-bg)',
          blocked: 'var(--state-blocked)',
          'blocked-bg': 'var(--state-blocked-bg)',
          neutral: 'var(--state-neutral)',
          'neutral-bg': 'var(--state-neutral-bg)',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        display: ['1.75rem', { lineHeight: '2.125rem', fontWeight: '600' }],
        title: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        subtitle: ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        label: ['0.75rem', { lineHeight: '1rem', fontWeight: '500', letterSpacing: '.02em' }],
        dado: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
        'dado-lg': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
      },
      minHeight: {
        // Densidade (Fase 4.1): compacta/confortavel trocam --altura-linha
        // em tokens.css, nao esta classe -- um so lugar decide a altura.
        linha: 'var(--altura-linha)',
        toque: '2.75rem',
      },
    },
  },
  plugins: [],
};
