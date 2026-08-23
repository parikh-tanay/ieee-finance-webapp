import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#101B30',
        ink: '#16233D',
        inkSoft: '#5B6B8C',
        gold: '#B8892B',
        goldSoft: '#F3E7CC',
        income: '#276B5D',
        incomeSoft: '#E1EFEA',
        expense: '#A6412F',
        expenseSoft: '#F5E4E0',
        bg: '#EEF1F6',
        border: '#DCE2ED',
      },
      fontFamily: {
        display: ['Georgia', '"Times New Roman"', 'serif'],
        mono: ['ui-monospace', '"SFMono-Regular"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
