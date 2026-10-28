import { formatDistanceToNow } from 'date-fns'

import { trafficContactLabel } from '@/libs/traffic/traffic'
import { type DisplayUnitPreferences, formatValueWithUnit } from '@/libs/units'
import { escapeHtml } from '@/libs/utils'
import type { TrafficContact, TrafficKind } from '@/types/traffic'

/** How wide and tall a contact's glyph is drawn, which is also what the map anchors it by */
export const TRAFFIC_ICON_SIZE_PX = 22

/* eslint-disable jsdoc/require-jsdoc -- How each kind of contact reads on the map, listed right below. */
interface TrafficKindStyle {
  layerLabel: string
  color: string
  glyph: string
}
/* eslint-enable jsdoc/require-jsdoc */

// Both glyphs point north when unrotated, so each marker can be turned to the bearing its contact reports.
export const TRAFFIC_KIND_STYLES: Record<TrafficKind, TrafficKindStyle> = {
  aircraft: { layerLabel: 'Air traffic', color: '#7DD3FC', glyph: 'mdi-airplane' },
  vessel: { layerLabel: 'Vessel traffic', color: '#F472B6', glyph: 'mdi-navigation' },
}

const contactBearing = (contact: TrafficContact): number | undefined => contact.headingDeg ?? contact.courseDeg

/**
 * Writes the glyph a contact is drawn as, turned to the bearing it broadcasts.
 * @param {TrafficContact} contact The contact to draw
 * @returns {string} The marker's HTML content
 */
export const trafficMarkerContent = (contact: TrafficContact): string => {
  const { color, glyph } = TRAFFIC_KIND_STYLES[contact.kind]
  const bearing = contactBearing(contact)
  // A contact that reports only where it is gets a dot, since a pointed marker would invent a bearing for it.
  const icon = bearing === undefined ? 'mdi-circle-medium' : glyph
  const rotation = bearing === undefined ? '' : `transform:rotate(${bearing}deg);`
  // The icon font gives the glyph's `::before` a box but leaves the element itself inline, and a transform is
  // dropped on an inline box, so the glyph is given a box of its own to turn within and centre on.
  const box = `display:block;width:${TRAFFIC_ICON_SIZE_PX}px;height:${TRAFFIC_ICON_SIZE_PX}px;text-align:center;`
  const type = `font-size:${TRAFFIC_ICON_SIZE_PX}px;line-height:${TRAFFIC_ICON_SIZE_PX}px;color:${color};`
  const style = `${box}${type}text-shadow:0 0 3px rgba(0,0,0,0.9);${rotation}`
  return `<span class="mdi ${icon}" style="${style}"></span>`
}

/**
 * Writes a contact's tooltip in the units the user picked, reading like the vehicle's own marker.
 * @param {TrafficContact} contact The contact to describe
 * @param {DisplayUnitPreferences} preferences The units picked for each quantity
 * @returns {string} The tooltip's HTML content
 */
export const trafficTooltipContent = (contact: TrafficContact, preferences: DisplayUnitPreferences): string => {
  // Names and callsigns are free text broadcast by any transmitter, so they are escaped before reaching the DOM.
  const title = escapeHtml(trafficContactLabel(contact))
  const callsign = contact.name !== undefined ? contact.callsign : undefined
  const bearing = contactBearing(contact)
  const coordinates = `${contact.latitude.toFixed(6)}, ${contact.longitude.toFixed(6)}`

  return [
    `<p><strong>${title}</strong></p>`,
    callsign !== undefined ? `<p>Callsign: ${escapeHtml(callsign)}</p>` : undefined,
    `<p>Coordinates: ${coordinates}</p>`,
    contact.speedMps !== undefined
      ? `<p>Velocity: ${formatValueWithUnit(contact.speedMps, 'm/s', preferences, 2)}</p>`
      : undefined,
    bearing !== undefined ? `<p>Heading: ${formatValueWithUnit(bearing, 'deg', preferences, 2)}</p>` : undefined,
    contact.altitudeMeters !== undefined
      ? `<p>Altitude: ${formatValueWithUnit(contact.altitudeMeters, 'm', preferences, 1)}</p>`
      : undefined,
    `<p>Last seen: ${formatDistanceToNow(contact.lastHeardAtMs, { includeSeconds: true })} ago</p>`,
  ]
    .filter(Boolean)
    .join('')
}
