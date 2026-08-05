import type { Config } from 'tailwindcss';

/**
 * Mesma paleta dos outros painéis de iframe do GHL (neutro `ink` + azul `brand`).
 * Os tokens semânticos ficam em `index.css` e os componentes só falam com eles.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // tokens semânticos
        paper: token('paper'),
        surface: { DEFAULT: token('surface'), 2: token('surface-2') },
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        ink: {
          DEFAULT: token('ink'),
          2: token('ink-2'),
          3: token('ink-3'),
          // escala completa, idêntica à do painel Soneko
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        accent: { DEFAULT: token('accent'), deep: token('accent-deep'), soft: token('accent-soft') },
        btn: { DEFAULT: token('btn'), ink: token('btn-ink') },
        warn: { DEFAULT: token('warn'), soft: token('warn-soft') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        chat: { bg: token('chat-bg'), bubble: token('chat-bubble'), ink: token('chat-ink') },
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        card: '0 1px 3px 0 rgb(15 23 42 / 0.05), 0 1px 2px 0 rgb(15 23 42 / 0.03)',
        lift: '0 10px 30px -12px rgb(15 23 42 / 0.22)',
      },
    },
  },
  plugins: [],
} satisfies Config;
