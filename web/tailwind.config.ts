import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#050816',
        surface: '#0B1220',
        primary: '#22C55E',
        secondary: '#38BDF8',
        'text-primary': '#F9FAFB',
        'text-secondary': '#9CA3AF',
        border: '#1F2933',
        error: '#F87171',
      },
    },
  },
  plugins: [],
};

export default config;
