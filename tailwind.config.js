/** @type {import('tailwindcss').Config} */
// ────────────────────────────────────────────────────────────────
// Cashiea design system — single source of truth.
// Colors are CSS variables (set in src/index.css for :root and .dark),
// so every surface flips with the theme. Legacy color names (slate,
// white, brand, green, red, amber) are remapped onto the same variables
// so existing className usage themes automatically — no second palette.
// ────────────────────────────────────────────────────────────────
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Semantic tokens (the only palette pages should use) ──
        paper: 'rgb(var(--paper) / <alpha-value>)',
        'paper-deep': 'rgb(var(--paper-deep) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-2': 'rgb(var(--line-2) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
        'fg-subtle': 'rgb(var(--fg-subtle) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-strong': 'rgb(var(--accent-strong) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        gold: 'rgb(var(--gold) / <alpha-value>)',
        copper: 'rgb(var(--copper) / <alpha-value>)',
        olive: 'rgb(var(--olive) / <alpha-value>)',
        positive: 'rgb(var(--positive) / <alpha-value>)',
        negative: 'rgb(var(--negative) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',

        // ── Legacy remap (existing pages keep working + become themed) ──
        white: 'rgb(var(--fg) / <alpha-value>)',
        black: 'rgb(var(--paper-deep) / <alpha-value>)',
        slate: {
          50: 'rgb(var(--fg) / <alpha-value>)',
          100: 'rgb(var(--fg) / <alpha-value>)',
          200: 'rgb(var(--fg) / <alpha-value>)',
          300: 'rgb(var(--fg-muted) / <alpha-value>)',
          400: 'rgb(var(--fg-muted) / <alpha-value>)',
          500: 'rgb(var(--fg-subtle) / <alpha-value>)',
          600: 'rgb(var(--line-2) / <alpha-value>)',
          700: 'rgb(var(--line) / <alpha-value>)',
          800: 'rgb(var(--surface-2) / <alpha-value>)',
          900: 'rgb(var(--surface) / <alpha-value>)',
          950: 'rgb(var(--paper-deep) / <alpha-value>)',
        },
        brand: {
          50: 'rgb(var(--accent-soft) / <alpha-value>)',
          100: 'rgb(var(--accent-soft) / <alpha-value>)',
          200: 'rgb(var(--gold) / <alpha-value>)',
          300: 'rgb(var(--gold) / <alpha-value>)',
          400: 'rgb(var(--accent) / <alpha-value>)',
          500: 'rgb(var(--accent) / <alpha-value>)',
          600: 'rgb(var(--accent-strong) / <alpha-value>)',
          700: 'rgb(var(--accent-strong) / <alpha-value>)',
          800: 'rgb(var(--accent-strong) / <alpha-value>)',
          900: 'rgb(var(--accent-strong) / <alpha-value>)',
          950: 'rgb(var(--accent-strong) / <alpha-value>)',
        },
        green: {
          400: 'rgb(var(--positive) / <alpha-value>)', 500: 'rgb(var(--positive) / <alpha-value>)',
          600: 'rgb(var(--positive) / <alpha-value>)',
        },
        red: {
          400: 'rgb(var(--negative) / <alpha-value>)', 500: 'rgb(var(--negative) / <alpha-value>)',
        },
        amber: {
          400: 'rgb(var(--warning) / <alpha-value>)', 500: 'rgb(var(--warning) / <alpha-value>)',
          600: 'rgb(var(--warning) / <alpha-value>)',
        },
        // Old cream scale → keep as alias to paper/surface for any stragglers.
        cream: {
          50: 'rgb(var(--paper) / <alpha-value>)',
          100: 'rgb(var(--surface) / <alpha-value>)',
          200: 'rgb(var(--surface-2) / <alpha-value>)',
          300: 'rgb(var(--surface-3) / <alpha-value>)',
        },
      },
      fontFamily: {
        // Single refined family (Inter) for headings + body — consistent & premium.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Tighter, more confident display sizes.
        'display-lg': ['3rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display': ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-sm': ['1.75rem', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '600' }],
      },
      borderRadius: {
        // One disciplined radius scale.
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      spacing: {
        // Half-step sizes used by icon containers (e.g. w-5.5 h-5.5).
        // Without these, classes like `w-5.5` resolve to nothing and
        // icons render at 0×0, making them invisible in the UI.
        '5.5': '1.375rem',
      },
      boxShadow: {
        // Soft elevation (warm, never harsh/neon).
        'soft': '0 1px 2px rgb(var(--shadow) / 0.04), 0 1px 3px rgb(var(--shadow) / 0.06)',
        'lift': '0 4px 12px -2px rgb(var(--shadow) / 0.08), 0 2px 6px -2px rgb(var(--shadow) / 0.06)',
        'float': '0 12px 32px -8px rgb(var(--shadow) / 0.16), 0 4px 12px -4px rgb(var(--shadow) / 0.08)',
        'focus': '0 0 0 3px rgb(var(--accent) / 0.22)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
}
