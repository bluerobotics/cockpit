import { t } from 'ttag'

import { seamarkDetails } from '@/libs/hazards/osm-details'
import { overpassRegion, runOverpassQuery } from '@/libs/overpass'
import type { GeoBbox } from '@/types/general'

/**
 * Something OpenStreetMap charts in or beside a stretch of possibly shallow water.
 */
export interface ShallowsNote {
  /**
   * Its name, or what it is when unnamed.
   */
  label: string
  /**
   * Further facts mapped on it, one line each.
   */
  details: string[]
}

const SELECTORS = [
  '["natural"~"^(shoal|reef)$"]',
  '["wetland"="tidalflat"]',
  '["seamark:type"~"^(rock|wreck|obstruction)$"]',
]

const KIND_LABELS: Record<string, string> = {
  shoal: t`Shoal`,
  reef: t`Reef`,
  tidalflat: t`Tidal flat`,
  rock: t`Rock`,
  wreck: t`Wreck`,
  obstruction: t`Obstruction`,
}

// More than a tooltip can show, on a stretch only a few hundred meters long.
const MAX_NOTES = 6

/**
 * Reads the shoals, reefs, tidal flats, rocks, wrecks and obstructions OpenStreetMap charts in an area.
 * @param {GeoBbox} bbox Area to look in.
 * @param {AbortSignal} signal Cancellation signal.
 * @returns {Promise<ShallowsNote[]>} What is charted there, empty when nothing is.
 */
export const fetchShallowsNotes = async (bbox: GeoBbox, signal: AbortSignal): Promise<ShallowsNote[]> => {
  const region = overpassRegion(bbox)
  const selectors = SELECTORS.map((selector) => `nwr${selector}${region};`).join('')
  const elements = await runOverpassQuery(`[out:json][timeout:25];(${selectors});out tags ${MAX_NOTES};`, signal)
  return elements.map((element) => {
    const tags = element.tags ?? {}
    const kind = tags['seamark:type'] ?? tags.natural ?? tags.wetland ?? ''
    const label = tags.name?.trim() || tags['seamark:name']?.trim() || KIND_LABELS[kind] || t`Charted feature`
    return { label, details: seamarkDetails(element) }
  })
}
