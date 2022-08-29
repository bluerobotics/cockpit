import vue from '@vitejs/plugin-vue'
import vuetify from '@vuetify/vite-plugin'
import { defineConfig } from 'vite'

const path = require('path') // eslint-disable-line @typescript-eslint/no-var-requires

export default defineConfig({
  plugins: [
    vue(),
    vuetify({
      autoImport: true,
    }),
  ],
  define: { 'process.env': {} },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      branches: 90,
      functions: 95,
      lines: 98,
      perFile: true,
      reporter: ['html', 'text'],
      statements: 95,
    },
  },
})
