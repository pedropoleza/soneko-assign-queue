import type { Config } from 'tailwindcss';

/** Tudo aponta para os tokens de `index.css`, então os dois temas saem de graça. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        surface: {
          DEFAULT: token('surface'),
          2: token('surface-2'),
        },
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
        },
        ink: {
          DEFAULT: token('ink'),
          2: token('ink-2'),
          3: token('ink-3'),
        },
        accent: {
          DEFAULT: token('accent'),
          deep: token('accent-deep'),
          soft: token('accent-soft'),
        },
        btn: {
          DEFAULT: token('btn'),
          ink: token('btn-ink'),
        },
        warn: {
          DEFAULT: token('warn'),
          soft: token('warn-soft'),
        },
        danger: {
          DEFAULT: token('danger'),
          soft: token('danger-soft'),
        },
        chat: {
          bg: token('chat-bg'),
          bubble: token('chat-bubble'),
          ink: token('chat-ink'),
        },
      },
      fontFamily: {
        display: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Public Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.375rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 35 28 / 0.04), 0 8px 24px -16px rgb(16 35 28 / 0.18)',
        lift: '0 2px 4px rgb(16 35 28 / 0.05), 0 18px 40px -20px rgb(16 35 28 / 0.28)',
      },
    },
  },
  plugins: [],
} satisfies Config;
