import 'leaflet'

declare module 'leaflet-rotate'

declare module 'leaflet' {
  /**
   * Map creation options added by the leaflet-rotate plugin.
   */
  interface MapOptions {
    /** Enables map rotation support (added by the leaflet-rotate plugin). */
    rotate?: boolean
    /** Initial map bearing, in degrees. */
    bearing?: number
    /** Whether to show the plugin's built-in rotate control. */
    rotateControl?: boolean
    /** Whether a two-finger twist gesture rotates the map. */
    touchRotate?: boolean
    /** Whether holding Shift while dragging rotates the map. */
    shiftKeyRotate?: boolean
  }

  /**
   * Map instance methods added by the leaflet-rotate plugin.
   */
  interface Map {
    /**
     * Rotates the map by the given bearing.
     * @param {number} theta - Bearing in degrees.
     * @returns {void}
     */
    setBearing(theta: number): void
    /**
     * Reads the current map bearing.
     * @returns {number} The current bearing, in degrees.
     */
    getBearing(): number
  }
}
