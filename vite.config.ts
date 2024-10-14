import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import electron, { startup, treeKillSync } from 'vite-plugin-electron'
import { VitePWA } from 'vite-plugin-pwa'
import vuetify from 'vite-plugin-vuetify'

const path = require('path') // eslint-disable-line @typescript-eslint/no-var-requires

// Check if we're running in Electron mode
const isElectron = process.env.ELECTRON === 'true'

export default defineConfig({
  plugins: [
    isElectron &&
      electron({
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist/electron',
          },
        },
        onstart: () => {
          // @ts-ignore: process.electronApp exists in vite-plugin-electron but not in the types
          if (process.electronApp) {
            // @ts-ignore: process.electronApp.pid exists in vite-plugin-electron but not in the types
            treeKillSync(process.electronApp.pid)
          }
          startup()
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
  ].filter(Boolean),
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
