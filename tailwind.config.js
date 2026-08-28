/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper:   'var(--paper)',
        paper2:  'var(--paper-2)',
        paper3:  'var(--paper-3)',
        paper4:  'var(--paper-4)',
        ink:     'var(--ink)',
        ink2:    'var(--ink-2)',
        ink3:    'var(--ink-3)',
        ink4:    'var(--ink-4)',
        rule:    'var(--rule)',
        rule2:   'var(--rule-2)',
        accent:  'var(--accent)',
        success: 'var(--success)',
        warn:    'var(--warn)',
        danger:  'var(--danger)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
        serif: ['ui-serif', 'New York', 'Iowan Old Style', 'Palatino', 'Charter', 'Georgia', 'Times New Roman', 'serif'],
      },
      fontSize: {
        '2xs': ['10.5px', { lineHeight: '1.4' }],
        xs: ['11.5px', { lineHeight: '1.5' }],
        sm: ['13px', { lineHeight: '1.55' }],
        base: ['14px', { lineHeight: '1.55' }],
        md: ['15px', { lineHeight: '1.55' }],
        lg: ['17px', { lineHeight: '1.5' }],
        xl: ['20px', { lineHeight: '1.4' }],
        '2xl': ['24px', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        '3xl': ['30px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        '4xl': ['38px', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        '5xl': ['48px', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        '6xl': ['60px', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '3px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        // Very subtle. No 'lg' / 'xl' bloat.
        DEFAULT: '0 1px 0 rgba(20, 16, 8, 0.02)',
        raised: '0 4px 12px -6px rgba(20, 16, 8, 0.12), 0 1px 2px rgba(20, 16, 8, 0.04)',
        popover: '0 12px 32px -12px rgba(20, 16, 8, 0.18), 0 2px 6px rgba(20, 16, 8, 0.06)',
      },
      maxWidth: {
        page: '1120px',
      },
    },
  },
  plugins: [],
};
