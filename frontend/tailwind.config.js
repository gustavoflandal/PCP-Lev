/** @type {import('tailwindcss').Config} */
// Os valores vem dos tokens definidos em src/estilos/tokens.css.
// Nenhum componente deve usar hex solto — sempre a classe do token.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Escala de 4px do sistema de design. Nada fora disso.
    spacing: {
      0: '0',
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      6: '24px',
      8: '32px',
      12: '48px',
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
        display: ['28px', { lineHeight: '34px', fontWeight: '600' }],
        title: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        subtitle: ['16px', { lineHeight: '24px', fontWeight: '600' }],
        body: ['14px', { lineHeight: '20px', fontWeight: '400' }],
        label: ['12px', { lineHeight: '16px', fontWeight: '500', letterSpacing: '.02em' }],
        dado: ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'dado-lg': ['18px', { lineHeight: '24px', fontWeight: '600' }],
      },
      minHeight: {
        linha: '40px',
        'linha-confortavel': '48px',
        toque: '44px',
      },
    },
  },
  plugins: [],
};
