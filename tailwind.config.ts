import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#12151B',
        surface: '#1A1E27',
        surfaceRaised: '#222736',
        border: '#2B3142',
        borderBright: '#3A4358',
        ink: '#EDEDEF',
        inkSoft: '#8B90A0',
        copper: '#E8A33D',
        copperSoft: 'rgba(232,163,61,0.14)',
        income: '#4ADE80',
        incomeSoft: 'rgba(74,222,128,0.12)',
        expense: '#F87171',
        expenseSoft: 'rgba(248,113,113,0.12)',
        // kept for anything not yet migrated
        navy: '#12151B',
        gold: '#E8A33D',
        goldSoft: 'rgba(232,163,61,0.14)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
