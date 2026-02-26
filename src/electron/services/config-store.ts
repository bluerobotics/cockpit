import Store from 'electron-store'

const electronStoreSchema = {
  cockpitFolderPath: {
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
   * Custom Cockpit folder path, overriding the default ~/Cockpit
   */
  cockpitFolderPath: string | undefined
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
