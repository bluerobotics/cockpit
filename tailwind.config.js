/* eslint-env node */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        critical: '#7F34CF',
      },
    },
  },
  plugins: [require('tailwind-scrollbar-hide')],
}
