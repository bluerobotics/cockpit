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
const isLibrary = process.env.BUILD_MODE === 'library'

// Base configuration that will be merged
const baseConfig = {
  plugins: [
    (isElectron || isBuilding) &&
      electron([
        {
          entry: 'src/electron/main.ts',
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
          entry: 'src/electron/preload.ts',
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
    // Only include PWA plugin when NOT building the library
    !isLibrary &&
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
}

// Library-specific configuration
const libraryConfig = {
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/libs/external-api/api.ts'),
      name: 'CockpitAPI',
      formats: ['es', 'umd', 'iife'],
      fileName: (format: string) => {
        switch (format) {
          case 'iife':
            return 'cockpit-external-api.browser.js'
          default:
            return `cockpit-external-api.${format}.js`
        }
      },
    },
    rollupOptions: {
      external: ['vue', 'vuetify'],
      output: {
        globals: {
          vue: 'Vue',
          vuetify: 'Vuetify',
        },
      },
    },
    outDir: 'dist/lib',
    // Add copyPublicDir: false to prevent copying public assets
    copyPublicDir: false,
  },
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default defineConfig((_configEnv) => {
  if (isLibrary) {
    // For library builds, merge the base config with library-specific settings
    return {
      ...baseConfig,
      ...libraryConfig,
    } as any
  }
  return baseConfig as any
})
