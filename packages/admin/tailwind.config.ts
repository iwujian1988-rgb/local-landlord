import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#F5D78E',
        'primary-hover': '#EBCB6E',
        'warm-bg': '#FDF8F3',
        'warm-card': '#FFFDF9',
        'text-primary': '#4A4038',
        'text-secondary': '#8B7E74',
      },
    },
  },
  plugins: [],
};

export default config;
