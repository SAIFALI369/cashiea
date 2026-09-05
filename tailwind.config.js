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
        success: 'rgb(var(--positive) / <alpha-value>)',
        error: 'rgb(var(--negative) / <alpha-value>)',
        disabled: 'rgb(var(--disabled) / <alpha-value>)',

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
        // Full legacy-palette safety net: ANY stray Tailwind palette name
        // resolves onto the semantic tokens so pages can never drift off-theme
        // (audit finding: purple/cyan/pink/orange/emerald leaked through).
        gray: { 50: 'rgb(var(--fg))', 100: 'rgb(var(--fg))', 200: 'rgb(var(--fg-muted))', 300: 'rgb(var(--fg-muted))', 400: 'rgb(var(--fg-muted))', 500: 'rgb(var(--fg-subtle))', 600: 'rgb(var(--fg-subtle))', 700: 'rgb(var(--line-2))', 800: 'rgb(var(--line))', 900: 'rgb(var(--surface-2))', 950: 'rgb(var(--paper-deep))' },
        zinc: { DEFAULT: 'rgb(var(--fg-muted))', 50: 'rgb(var(--fg))', 100: 'rgb(var(--fg))', 200: 'rgb(var(--fg-muted))', 300: 'rgb(var(--fg-muted))', 400: 'rgb(var(--fg-muted))', 500: 'rgb(var(--fg-subtle))', 600: 'rgb(var(--fg-subtle))', 700: 'rgb(var(--line-2))', 800: 'rgb(var(--line))', 900: 'rgb(var(--surface-2))', 950: 'rgb(var(--paper-deep))' },
        neutral: { DEFAULT: 'rgb(var(--fg-muted))', 50: 'rgb(var(--fg))', 100: 'rgb(var(--fg))', 200: 'rgb(var(--fg-muted))', 300: 'rgb(var(--fg-muted))', 400: 'rgb(var(--fg-muted))', 500: 'rgb(var(--fg-subtle))', 600: 'rgb(var(--fg-subtle))', 700: 'rgb(var(--line-2))', 800: 'rgb(var(--line))', 900: 'rgb(var(--surface-2))', 950: 'rgb(var(--paper-deep))' },
        stone: { DEFAULT: 'rgb(var(--fg-muted))', 50: 'rgb(var(--fg))', 100: 'rgb(var(--fg))', 200: 'rgb(var(--fg-muted))', 300: 'rgb(var(--fg-muted))', 400: 'rgb(var(--fg-muted))', 500: 'rgb(var(--fg-subtle))', 600: 'rgb(var(--fg-subtle))', 700: 'rgb(var(--line-2))', 800: 'rgb(var(--line))', 900: 'rgb(var(--surface-2))', 950: 'rgb(var(--paper-deep))' },
        blue: { DEFAULT: 'rgb(var(--info))', 50: 'rgb(var(--surface))', 100: 'rgb(var(--surface-2))', 200: 'rgb(var(--line))', 300: 'rgb(var(--info))', 400: 'rgb(var(--info))', 500: 'rgb(var(--info))', 600: 'rgb(var(--info))', 700: 'rgb(var(--info))', 800: 'rgb(var(--info))', 900: 'rgb(var(--info))', 950: 'rgb(var(--info))' },
        sky: { DEFAULT: 'rgb(var(--info))', 400: 'rgb(var(--info))', 500: 'rgb(var(--info))' },
        cyan: { DEFAULT: 'rgb(var(--info))', 300: 'rgb(var(--info))', 400: 'rgb(var(--info))', 500: 'rgb(var(--info))', 600: 'rgb(var(--info))' },
        indigo: { DEFAULT: 'rgb(var(--info))', 400: 'rgb(var(--info))', 500: 'rgb(var(--info))' },
        violet: { DEFAULT: 'rgb(var(--gold))', 400: 'rgb(var(--gold))', 500: 'rgb(var(--gold))' },
        purple: { DEFAULT: 'rgb(var(--gold))', 300: 'rgb(var(--gold))', 400: 'rgb(var(--gold))', 500: 'rgb(var(--gold))', 600: 'rgb(var(--copper))' },
        fuchsia: { DEFAULT: 'rgb(var(--gold))', 400: 'rgb(var(--gold))', 500: 'rgb(var(--gold))' },
        pink: { DEFAULT: 'rgb(var(--negative))', 400: 'rgb(var(--negative))', 500: 'rgb(var(--negative))' },
        rose: { DEFAULT: 'rgb(var(--negative))', 400: 'rgb(var(--negative))', 500: 'rgb(var(--negative))' },
        orange: { DEFAULT: 'rgb(var(--warning))', 400: 'rgb(var(--warning))', 500: 'rgb(var(--warning))', 600: 'rgb(var(--warning))' },
        yellow: { DEFAULT: 'rgb(var(--warning))', 400: 'rgb(var(--warning))', 500: 'rgb(var(--warning))' },
        amber: { DEFAULT: 'rgb(var(--warning))', 400: 'rgb(var(--warning))', 500: 'rgb(var(--warning))', 600: 'rgb(var(--warning))' },
        lime: { DEFAULT: 'rgb(var(--positive))', 400: 'rgb(var(--positive))', 500: 'rgb(var(--positive))' },
        teal: { DEFAULT: 'rgb(var(--positive))', 400: 'rgb(var(--positive))', 500: 'rgb(var(--positive))' },
        emerald: { DEFAULT: 'rgb(var(--positive))', 300: 'rgb(var(--positive))', 400: 'rgb(var(--positive))', 500: 'rgb(var(--positive))', 600: 'rgb(var(--positive))', 700: 'rgb(var(--positive))', 800: 'rgb(var(--positive))', 900: 'rgb(var(--positive))' },
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
        card: '1rem',            // cards / panels / sheets (16px)
        control: '0.75rem',      // buttons / inputs / chips (12px)
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
        // Edge shadow cast by a page sliding over another (native-stack feel).
        'page-edge': 'inset -1px 0 0 rgb(var(--shadow) / 0.06), -8px 0 24px -6px rgb(var(--shadow) / 0.18)',
        'page-edge-r': 'inset 1px 0 0 rgb(var(--shadow) / 0.06), 8px 0 24px -6px rgb(var(--shadow) / 0.18)',
        // Soft accent halo for primary CTAs / active nav.
        'glow-accent': '0 6px 20px -6px rgb(var(--accent) / 0.45)',
      },
      transitionTimingFunction: {
        // "Butter" — the app-wide signature curves.
        'butter': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'butter-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
        'swipe': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        // Skeleton shimmer — a highlight sweeping across the bone.
        'shimmer': 'shimmer 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        // Slow ambient drift for decorative gradients.
        'drift': 'drift 14s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        drift: { '0%': { transform: 'translate3d(0, 0, 0) scale(1)' }, '100%': { transform: 'translate3d(4%, -3%, 0) scale(1.06)' } },
      },
    },
  },
  plugins: [],
}
