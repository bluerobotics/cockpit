import Store from 'electron-store'

const electronStoreSchema = {
  chromiumSwitches: {
    type: 'array',
    items: {
      type: 'string',
    },
  },
  chromiumSwitchesBootPending: {
    type: 'boolean',
  },
  chromiumSwitchesDisabled: {
    type: 'array',
    items: {
      type: 'string',
    },
  },
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
   * Extra Chromium command-line switches applied at launch, as a workaround for GPU and video driver bugs
   */
  chromiumSwitches: string[] | undefined
  /**
   * Whether a launch with custom Chromium switches is still waiting to be confirmed as successful
   */
  chromiumSwitchesBootPending: boolean | undefined
  /**
   * Switches that were set aside because Cockpit failed to start with them
   */
  chromiumSwitchesDisabled: string[] | undefined
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
