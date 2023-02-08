/* eslint-env node */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,vue}'],
  theme: {
    colors: {
      critical: '#7F34CF',
    },
    extend: {},
  },
  plugins: [],
}
