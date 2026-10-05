/**
 * Ordered stacking slots for everything drawn on the map. These replace Leaflet's panes: each slot is drawn at its own
 * small height, which Cesium's straight-down 2D view shows at the same place but depth-tests in this order, so
 * stacking stays fixed whatever order the composables draw in.
 */
export const mapLayerSlots = [
  'base',
  'raster-overlay',
  'geotiff',
  'coverage',
  'fence',
  'mission',
  'survey-area',
  'survey',
  'vehicle-path',
  'survey-legs',
  'grid',
  'measure',
] as const

/**
 * One of the map's stacking slots.
 */
export type MapLayerSlot = (typeof mapLayerSlots)[number]

/**
 * Height, in meters, at which a slot's vectors are drawn. Only the order matters, as the 2D view has no parallax.
 * @param {MapLayerSlot} slot - The stacking slot.
 * @returns {number} The height to draw at.
 */
export const slotHeight = (slot: MapLayerSlot): number => (mapLayerSlots.indexOf(slot) + 1) * 10
