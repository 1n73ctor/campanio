/** Companio design tokens — candy colours + neo-brutalist borders & hard shadows. Shared by web, admin (and later mobile via NativeWind). */
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#141414', soft: '#3a3a3a', mute: '#6b6b6b' },
        paper: { DEFAULT: '#FFF8EE', deep: '#FCEFD9', white: '#FFFFFF' },
        pink: { DEFAULT: '#FF7AC6', soft: '#FFD1EA', deep: '#E4449C' },
        lime: { DEFAULT: '#C6F432', soft: '#EDFBC0', deep: '#8DB800' },
        lavender: { DEFAULT: '#B8A4FF', soft: '#E6DEFF', deep: '#7B5CF0' },
        sky: { DEFAULT: '#7CD4FF', soft: '#D5F1FF', deep: '#2A9ED8' },
        sunny: { DEFAULT: '#FFD23F', soft: '#FFF1BF', deep: '#E0A800' },
        tangerine: { DEFAULT: '#FF9F43', soft: '#FFE0C2', deep: '#E06E00' },
        mint: { DEFAULT: '#7CF5C4', soft: '#D6FDEC', deep: '#1FBF83' },
        danger: { DEFAULT: '#FF4D4D', soft: '#FFD6D6' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderWidth: { 3: '3px' },
      borderRadius: { blob: '1.25rem', chunky: '0.875rem' },
      boxShadow: {
        brutal: '4px 4px 0 0 #141414',
        'brutal-sm': '2px 2px 0 0 #141414',
        'brutal-lg': '7px 7px 0 0 #141414',
        'brutal-pink': '5px 5px 0 0 #FF7AC6',
      },
      keyframes: {
        wiggle: { '0%,100%': { transform: 'rotate(-2deg)' }, '50%': { transform: 'rotate(2deg)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: { wiggle: 'wiggle 3s ease-in-out infinite', floaty: 'floaty 4s ease-in-out infinite', marquee: 'marquee 30s linear infinite' },
    },
  },
};
