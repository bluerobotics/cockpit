/* eslint-env node */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,vue}', 'node_modules/flowbite-vue/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        critical: '#7F34CF',
      },
    },
  },
  plugins: [require('tailwind-scrollbar-hide'), require('flowbite/plugin')],
}
