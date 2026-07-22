/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Apple-style system palette
        ink: {
          DEFAULT: '#1d1d1f',
          50: '#fbfbfd',
          100: '#f5f5f7',
          200: '#e8e8ed',
          300: '#d2d2d7',
          400: '#a1a1a6',
          500: '#86868b',
          600: '#6e6e73',
          700: '#424245',
          800: '#1d1d1f',
          900: '#000000',
        },

        // Legacy slate-* tokens are remapped to Apple-style
        // light surfaces so old dark-theme classes (bg-slate-950,
        // text-slate-400, border-slate-800, etc.) repaint into the
        // new light, Apple-inspired palette without a per-page
        // rewrite.
        slate: {
          950: '#fbfbfd',
          900: '#ffffff',
          800: '#f5f5f7',
          700: '#e8e8ed',
          600: '#d2d2d7',
          500: '#a1a1a6',
          400: '#86868b',
          300: '#6e6e73',
          200: '#424245',
          100: '#1d1d1f',
          50:  '#000000',
        },

        apple: {
          50: '#eaf3ff',
          100: '#d6e7ff',
          200: '#a3c9ff',
          300: '#6eaaff',
          400: '#3a8eff',
          500: '#0071e3',
          600: '#0066cc',
          700: '#0055aa',
          800: '#003d7a',
          900: '#002a55',
        },
        success: '#00863a',
        danger:  '#ff3b30',
        warning: '#ff9500',

        // brand color repainted to Apple system blue
        brand: {
          50:  '#eaf3ff',
          100: '#d6e7ff',
          200: '#a3c9ff',
          300: '#6eaaff',
          400: '#3a8eff',
          500: '#0071e3',
          600: '#0066cc',
          700: '#0055aa',
          800: '#003d7a',
          900: '#002a55',
          950: '#001a36',
        },
        cream: {
          50: '#fdfbf7',
          100: '#faf6ee',
          200: '#f5efe3',
          300: '#efe6d3',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['72px', { lineHeight: '1.05', letterSpacing: '-0.015em', fontWeight: '600' }],
        'display-lg': ['56px', { lineHeight: '1.07', letterSpacing: '-0.015em', fontWeight: '600' }],
        'display-md': ['48px', { lineHeight: '1.08', letterSpacing: '-0.015em', fontWeight: '600' }],
        'display-sm': ['40px', { lineHeight: '1.1',  letterSpacing: '-0.01em',  fontWeight: '600' }],
      },
      animation: {
        'fade-in':  'fadeIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(28px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        float: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-12px)' } },
      },
      boxShadow: {
        'apple-sm': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'apple':    '0 4px 14px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        'apple-lg': '0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
}
