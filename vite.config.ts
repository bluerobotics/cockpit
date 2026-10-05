import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'
import { type Plugin, defineConfig } from 'vite'
import electron, { startup, treeKillSync } from 'vite-plugin-electron'
import { VitePWA } from 'vite-plugin-pwa'
import vuetify from 'vite-plugin-vuetify'

import { importCycleGuard } from './scripts/import-cycles.mjs'
import { getVersion } from './src/libs/non-browser-utils'

// Check if we're running in Electron mode or building the application
const isElectron = process.env.ELECTRON === 'true'
const isBuilding = process.argv.includes('build')
const isLibrary = process.env.BUILD_MODE === 'library'

// CesiumJS loads its workers, textures and third-party code at runtime from `CESIUM_BASE_URL`, so those directories
// are served from the package in development and copied next to the build.
const cesiumRuntimeDirectories = ['Workers', 'Assets', 'ThirdParty', 'Widgets']
const cesiumBuildPath = path.resolve(__dirname, 'node_modules/cesium/Build/Cesium')
// Module workers and WebAssembly are refused without these types.
const cesiumContentTypes: Record<string, string> = {
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}
const cesiumRuntimeAssets = (): Plugin => {
  let outDir = 'dist'
  return {
    name: 'cockpit-cesium-runtime-assets',
    configResolved: (config) => {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer: (server) => {
      server.middlewares.use('/cesium', (request, response, next) => {
        const relativePath = decodeURIComponent((request.url ?? '').split('?')[0])
        const filePath = path.join(cesiumBuildPath, relativePath)
        if (!filePath.startsWith(cesiumBuildPath) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next()
          return
        }
        const contentType = cesiumContentTypes[path.extname(filePath)]
        if (contentType) response.setHeader('Content-Type', contentType)
        fs.createReadStream(filePath).pipe(response)
      })
    },
    closeBundle: () => {
      cesiumRuntimeDirectories.forEach((directory) => {
        fs.cpSync(path.join(cesiumBuildPath, directory), path.join(outDir, 'cesium', directory), { recursive: true })
      })
    },
  }
}

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
    !isLibrary && cesiumRuntimeAssets(),
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
    !isLibrary && importCycleGuard(__dirname),
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
