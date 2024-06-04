/* eslint-env node */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,vue}', 'node_modules/flowbite-vue/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        critical: '#7F34CF',
      },
      screens: {
        'xs': { max: '719px' }, // Extra small devices (5-6" mobile screens in landscape)
        'sm': { min: '720px', max: '979px' }, // Small devices (6-7" mobile screens in landscape)
        'md': { min: '980px', max: '1279px' }, // Medium devices (7-10" tablets in landscape)
        'lg': { min: '1280px', max: '1599px' }, // Large devices (HD in landscape)
        'xl': { min: '1600px', max: '1919px' }, // Extra large devices (HD+ desktop/laptop screens in landscape)
        '2xl': { min: '1920px' }, // FullHD and above - Extra extra large devices
      },
    },
  },
  plugins: [require('tailwind-scrollbar-hide'), require('flowbite/plugin')],
}
