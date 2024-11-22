import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'
import electron, { startup, treeKillSync } from 'vite-plugin-electron'
import { VitePWA } from 'vite-plugin-pwa'
import vuetify from 'vite-plugin-vuetify'

import { getVersion } from './src/libs/non-browser-utils'

// Check if we're running in Electron mode or building the application
const isElectron = process.env.ELECTRON === 'true'
const isBuilding = process.argv.includes('build')

export default defineConfig({
  plugins: [
    (isElectron || isBuilding) &&
      electron([
        {
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
        },
        {
          entry: 'electron/preload.ts',
          vite: {
            build: {
              outDir: 'dist/electron',
            },
          },
        },
      ]),
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
  define: {
    'process.env': {},
    '__APP_VERSION__': JSON.stringify(getVersion().version),
    '__APP_VERSION_DATE__': JSON.stringify(getVersion().date),
    '__APP_VERSION_LINK__': JSON.stringify(getVersion().link),
  },
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
