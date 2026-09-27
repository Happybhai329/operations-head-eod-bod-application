/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        prime: {
          navy: '#041C32',
          navyLight: '#0A2647',
          gold: '#F5D042',
          goldHover: '#E3BE30',
          bg: '#F4F7F6',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
