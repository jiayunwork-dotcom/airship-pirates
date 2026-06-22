/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          dark: '#1e3a5f',
          DEFAULT: '#3b82f6',
          light: '#93c5fd',
        },
        brass: {
          DEFAULT: '#b58863',
          light: '#d4a574',
          dark: '#8b6914',
        },
        leather: {
          DEFAULT: '#8b4513',
          light: '#a0522d',
        },
        steam: {
          DEFAULT: '#d3d3d3',
          dark: '#a9a9a9',
        },
      },
      fontFamily: {
        steampunk: ['Georgia', 'serif'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
