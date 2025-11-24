/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FFD700',
        secondary: '#000000',
        accent: '#FFA500',
        bg: {
          gray: '#808080',
          white: '#FFFFFF',
          black: '#000000',
        },
      },
    },
  },
  plugins: [],
}

