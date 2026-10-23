import { z } from 'zod'

/**
 * Id external software gives a map overlay, so it can replace or remove it later. Every sender shares the same
 * ids, so prefix it with the sender's name (e.g. `simple-ping-survey-contours`) to keep two extensions from
 * replacing each other's overlays.
 */
export const externalMapOverlayIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single dashes.')

// Longitude first, as GeoJSON writes it, with an optional altitude.
const positionSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)], z.number())
const ringSchema = z.array(positionSchema).min(4)

const geometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'), coordinates: positionSchema }),
  z.object({ type: z.literal('MultiPoint'), coordinates: z.array(positionSchema) }),
  z.object({ type: z.literal('LineString'), coordinates: z.array(positionSchema).min(2) }),
  z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(positionSchema).min(2)) }),
  z.object({ type: z.literal('Polygon'), coordinates: z.array(ringSchema) }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(ringSchema)) }),
])

/**
 * GeoJSON feature of an external map overlay, styled by its simplestyle-spec properties
 */
export const externalMapOverlayFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: geometrySchema,
  properties: z.record(z.string(), z.unknown()).nullable().default(null),
})

/**
 * Map overlay external software sends to be shown on Cockpit's maps
 */
export const externalMapOverlaySchema = z.object({
  id: externalMapOverlayIdSchema,
  name: z.string().min(1),
  live: z.boolean().default(false),
  geojson: z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(externalMapOverlayFeatureSchema),
  }),
})

/**
 * GeoTIFF overlay external software asks Cockpit to download and show on its maps
 */
export const externalMapGeoTiffSchema = z.object({
  id: externalMapOverlayIdSchema,
  name: z.string().min(1),
  url: z.string().regex(/^https?:\/\//, 'Use an http or https URL.'),
  renderMode: z.enum(['grayscale', 'intensity', 'bathymetry']).default('grayscale'),
})

/**
 * Commands external software (embedded iframes, WebSocket servers) can send to manage map overlays.
 */
export const externalMapOverlayCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cockpit:setMapOverlay'), overlay: externalMapOverlaySchema }),
  z.object({
    type: z.literal('cockpit:appendMapOverlayFeatures'),
    id: externalMapOverlayIdSchema,
    features: z.array(externalMapOverlayFeatureSchema).min(1),
  }),
  z.object({ type: z.literal('cockpit:clearMapOverlay'), id: externalMapOverlayIdSchema }),
  z.object({ type: z.literal('cockpit:setMapGeoTiff'), geoTiff: externalMapGeoTiffSchema }),
  z.object({ type: z.literal('cockpit:removeMapOverlay'), id: externalMapOverlayIdSchema }),
])

/**
 * A validated map overlay command from external software
 */
export type ExternalMapOverlayCommand = z.output<typeof externalMapOverlayCommandSchema>

/**
 * Map overlay as external software sends it
 */
export type ExternalMapOverlay = z.input<typeof externalMapOverlaySchema>

/**
 * GeoTIFF overlay as external software sends it
 */
export type ExternalMapGeoTiff = z.input<typeof externalMapGeoTiffSchema>

/**
 * A validated GeoTIFF overlay from external software
 */
export type ValidatedMapGeoTiff = z.output<typeof externalMapGeoTiffSchema>

/**
 * A validated GeoJSON feature of an external map overlay
 */
export type ExternalMapOverlayFeature = z.output<typeof externalMapOverlayFeatureSchema>

/**
 * Tells whether a message is meant as a map overlay command, before validating it.
 * @param {unknown} message - Message received from external software
 * @returns {boolean} Whether the message carries one of the map overlay command types
 */
export const isExternalMapOverlayCommand = (message: unknown): boolean => {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false
  return externalMapOverlayCommandSchema.options.some((option) => option.shape.type.value === message.type)
}
