import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        // Display face for the Leão brand headings (docs/cotacao.md §8).
        display: ["var(--font-display)", "Outfit", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        page: "hsl(var(--page))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          soft: "hsl(var(--accent-soft))",
        },
        // Soft status palette (not saturated) — for badges.
        status: {
          "green-bg": "hsl(var(--status-green-bg))",
          "green-fg": "hsl(var(--status-green-fg))",
          "amber-bg": "hsl(var(--status-amber-bg))",
          "amber-fg": "hsl(var(--status-amber-fg))",
          "red-bg": "hsl(var(--status-red-bg))",
          "red-fg": "hsl(var(--status-red-fg))",
          "blue-bg": "hsl(var(--status-blue-bg))",
          "blue-fg": "hsl(var(--status-blue-fg))",
          "gray-bg": "hsl(var(--status-gray-bg))",
          "gray-fg": "hsl(var(--status-gray-fg))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.04)",
        "card-hover": "0 2px 8px -2px rgb(16 24 40 / 0.08)",
        // Layered elevation for the Leão surfaces — depth instead of a 1px line.
        raise: "0 1px 2px rgb(20 32 58 / 0.04), 0 8px 24px -12px rgb(20 32 58 / 0.18)",
        "raise-lg": "0 2px 4px rgb(20 32 58 / 0.05), 0 20px 40px -16px rgb(20 32 58 / 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
