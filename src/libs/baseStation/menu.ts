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
