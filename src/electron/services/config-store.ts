import Store from 'electron-store'

const electronStoreSchema = {
  chromeVersion: {
    type: 'string',
  },
  cockpitFolderPath: {
    type: 'string',
  },
  cockpitVersion: {
    type: 'string',
  },
  windowBounds: {
    type: 'object',
    properties: {
      width: {
        type: 'number',
      },
      height: {
        type: 'number',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
  },
}

/**
 * Electron store schema
 * Stores configuration data
 */
export interface ElectronStoreSchema {
  /**
   * Chromium version that last opened this userData folder, as `process.versions.chrome` (e.g. `122.0.6261.156`)
   */
  chromeVersion: string | undefined
  /**
   * Custom Cockpit folder path, overriding the default ~/Cockpit
   */
  cockpitFolderPath: string | undefined
  /**
   * Cockpit version that last opened this userData folder, as `app.getVersion()` (e.g. `1.18.3`)
   */
  cockpitVersion: string | undefined
  /**
   * Window bounds
   */
  windowBounds:
    | undefined
    | {
        /**
         * Last known window width
         */
        width: number
        /**
         * Last known window height
         */
        height: number
        /**
         * Last known window x position
         */
        x: number
        /**
         * Last known window y position
         */
        y: number
      }
}

const store = new Store<ElectronStoreSchema>({ schema: electronStoreSchema })

export default store
