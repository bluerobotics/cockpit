import { z } from 'zod'

/**
 * Id external software gives a point of interest, so it can update or remove it later
 */
export const externalPoiIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single dashes.')

// Coordinates are numbers only, since a string source is a data-lake expression Cockpit evaluates. Icon and
// color are written unescaped into the marker HTML, so they are held to an mdi class and a hex code.
const poiFields = {
  id: externalPoiIdSchema,
  name: z.string().min(1),
  description: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().nullable(),
  icon: z.string().regex(/^mdi-[a-z0-9-]+$/, 'Use a Material Design Icons class, e.g. mdi-map-marker.'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color, e.g. #FF0000.'),
}

/**
 * Point of interest external software adds, with defaults for the fields it leaves out
 */
export const externalPoiSchema = z.object({
  ...poiFields,
  description: poiFields.description.default(''),
  heading: poiFields.heading.optional(),
  icon: poiFields.icon.default('mdi-map-marker'),
  color: poiFields.color.default('#FF0000'),
})

/**
 * Changes external software makes to an existing point of interest, identified by its id
 */
export const externalPoiUpdateSchema = z
  .object(poiFields)
  .partial()
  .required({ id: true })
  .refine((poi) => (poi.latitude === undefined) === (poi.longitude === undefined), {
    message: 'Send latitude and longitude together.',
  })

/**
 * Commands external software (embedded iframes, WebSocket servers) can send to manage points of interest.
 */
export const externalPoiCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cockpit:addPointOfInterest'), poi: externalPoiSchema }),
  z.object({ type: z.literal('cockpit:updatePointOfInterest'), poi: externalPoiUpdateSchema }),
  z.object({ type: z.literal('cockpit:removePointOfInterest'), id: externalPoiIdSchema }),
])

/**
 * A validated point-of-interest command from external software
 */
export type ExternalPoiCommand = z.output<typeof externalPoiCommandSchema>

/**
 * Point of interest as external software sends it to be added
 */
export type ExternalPoi = z.input<typeof externalPoiSchema>

/**
 * Changes external software sends for an existing point of interest
 */
export type ExternalPoiUpdate = z.input<typeof externalPoiUpdateSchema>

/**
 * Tells whether a message is meant as a point-of-interest command, before validating it.
 * @param {unknown} message - Message received from external software
 * @returns {boolean} Whether the message carries one of the point-of-interest command types
 */
export const isExternalPoiCommand = (message: unknown): boolean => {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false
  return externalPoiCommandSchema.options.some((option) => option.shape.type.value === message.type)
}
