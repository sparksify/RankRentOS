import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0f17',
        panel: '#111827',
        edge: '#1f2937',
        brand: '#34d399',
        warn: '#fbbf24',
        bad: '#f87171',
      },
    },
  },
  plugins: [],
} satisfies Config;
