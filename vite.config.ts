import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import { VitePWA } from 'vite-plugin-pwa'
import vuetify from 'vite-plugin-vuetify'

const path = require('path') // eslint-disable-line @typescript-eslint/no-var-requires

export default defineConfig({
  plugins: [
    electron({
      entry: 'electron/main.ts',
      vite: {
        build: {
          outDir: 'dist/electron',
        },
      },
    }),
    vue(),
    vuetify({
      autoImport: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
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
  },
  server: {
    host: '0.0.0.0',
  },
})
