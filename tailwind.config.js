/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Canvas
        bg:        'var(--bg)',
        bg2:       'var(--bg-2)',
        bg3:       'var(--bg-3)',
        bg4:       'var(--bg-4)',
        card:      'var(--card)',
        card2:     'var(--card-2)',

        // Ink
        ink:       'var(--ink)',
        ink2:      'var(--ink-2)',
        ink3:      'var(--ink-3)',
        ink4:      'var(--ink-4)',

        // Rules
        separator: 'var(--separator)',
        separator2:'var(--separator-2)',

        // iOS system colors
        red:       'var(--red)',
        orange:    'var(--orange)',
        yellow:    'var(--yellow)',
        green:     'var(--green)',
        mint:      'var(--mint)',
        teal:      'var(--teal)',
        cyan:      'var(--cyan)',
        blue:      'var(--blue)',
        indigo:    'var(--indigo)',
        purple:    'var(--purple)',
        pink:      'var(--pink)',
        brown:     'var(--brown)',

        // Compat aliases with the previous kit
        paper:     'var(--bg)',
        paper2:    'var(--card)',
        paper3:    'var(--bg-3)',
        paper4:    'var(--bg-4)',
        rule:      'var(--separator)',
        rule2:     'var(--separator-2)',
        accent:    'var(--blue)',
        success:   'var(--green)',
        warn:      'var(--orange)',
        danger:    'var(--red)',
      },
      fontFamily: {
        sans:  'var(--font-sans)',
        mono:  'var(--font-mono)',
        serif: 'var(--font-serif)',
      },
      fontSize: {
        '2xs':  ['10.5px', { lineHeight: '1.35' }],
        xs:    ['11.5px', { lineHeight: '1.4' }],
        sm:    ['13px',   { lineHeight: '1.45' }],
        base:  ['14px',   { lineHeight: '1.45' }],
        md:    ['15px',   { lineHeight: '1.45' }],
        lg:    ['17px',   { lineHeight: '1.35' }],
        xl:    ['22px',   { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        '2xl': ['28px',   { lineHeight: '1.14', letterSpacing: '-0.02em' }],
        '3xl': ['34px',   { lineHeight: '1.08', letterSpacing: '-0.024em' }],
        '4xl': ['44px',   { lineHeight: '1.04', letterSpacing: '-0.028em' }],
        '5xl': ['56px',   { lineHeight: '1.0',  letterSpacing: '-0.032em' }],
        '6xl': ['72px',   { lineHeight: '0.98', letterSpacing: '-0.036em' }],
      },
      borderRadius: {
        DEFAULT: '10px',
        sm:  '6px',
        md:  '10px',
        lg:  '14px',
        xl:  '18px',
        '2xl':'22px',
        '3xl':'28px',
      },
      boxShadow: {
        DEFAULT:  '0 1px 0 rgba(0,0,0,0.02)',
        raised:   '0 8px 24px -8px rgba(0,0,0,0.20), 0 2px 4px rgba(0,0,0,0.05)',
        popover:  '0 20px 60px -20px rgba(0,0,0,0.40), 0 4px 12px rgba(0,0,0,0.10)',
        ring:     'inset 0 0 0 1px var(--separator)',
      },
      maxWidth: {
        page: '1160px',
      },
    },
  },
  plugins: [],
};
