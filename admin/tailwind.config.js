/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eaf3fb',
          100: '#cbe0f4',
          200: '#98c1e9',
          300: '#5f9edb',
          400: '#2e7fcb',
          500: '#0f5cab', // primary
          600: '#0c4a8a',
          700: '#093a6c',
          800: '#062851',
          900: '#031a37',
        },
      },
    },
  },
  plugins: [],
};
