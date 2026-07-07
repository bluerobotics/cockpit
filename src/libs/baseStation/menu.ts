export const baseStationMenuIcon = 'mdi-radio-tower'
export const configureBaseStationMenuIcon = 'mdi-cog'
export const configureBaseStationMenuLabel = 'Configure base station'
export const removeBaseStationMenuLabel = 'Remove base station'

/**
 * Label for the "place base station" context-menu entry, shared by the Map widget and the
 * mission-planning context menus so both surfaces stay in sync.
 * @param {boolean} enabled Whether a base station is already placed.
 * @returns {string} Menu entry label.
 */
export const baseStationPlaceMenuLabel = (enabled: boolean): string =>
  enabled ? 'Move base station here' : 'Set base station here'

/**
 * Icon for the signal-visibility toggle, shared by the context popup and both map context menus.
 * @param {boolean} shown Whether the signal overlays are currently shown.
 * @returns {string} MDI icon name.
 */
export const baseStationSignalVisibilityIcon = (shown: boolean): string => (shown ? 'mdi-eye' : 'mdi-eye-off')

/**
 * Label for the signal-visibility toggle, shared by the context popup and both map context menus.
 * @param {boolean} shown Whether the signal overlays are currently shown.
 * @returns {string} Menu entry label.
 */
export const baseStationSignalVisibilityLabel = (shown: boolean): string =>
  shown ? 'Hide signal on map' : 'Show signal on map'
