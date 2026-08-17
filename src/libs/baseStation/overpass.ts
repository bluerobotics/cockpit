import type { CachedOpenCellIdSite, CachedOverpassTower, CoverageBbox } from '@/types/baseStation'

import { openCellIdOperatorLabel, overpassTechnologies } from './mobileCoverage'

export type OverpassTower = CachedOverpassTower

export const OSM_DEFAULT_DIRECTIONAL_BEAMWIDTH = 90

/** Approximate width of a label glyph at {@link OSM_LABEL_FONT_SIZE_PX}, used to fit text to an arc. */
export const OSM_LABEL_CHAR_WIDTH_PX = 5.7

/** Distinct colors used to differentiate operators when none is selected. */
export const OSM_OPERATOR_COLORS = ['#38BDF8', '#22C55E', '#A855F7', '#F59E0B', '#EF4444', '#14B8A6']

const parseTagNumber = (tags: Record<string, string>, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = tags[key]
    if (!value) continue
    const parsed = parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const pickTagValue = (tags: Record<string, string>, ...keys: string[]): string | null => {
  for (const key of keys) {
    const value = tags[key]?.trim()
    if (value) return value
  }
  return null
}

const formatHeightLabel = (height: string): string => (/^[\d.]+$/.test(height) ? `${height}m` : height)

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360

/**
 * Generation labels (`2G`, `3G`, `4G`, `5G`) inferred from OSM technology tags.
 * @param {Record<string, string>} tags Overpass tags.
 * @returns {string[]} Deduped generation labels (empty when none can be inferred).
 */
export const overpassTechnologyGenerations = (tags: Record<string, string>): string[] => {
  const technologies = overpassTechnologies(tags)
  const generations = technologies.flatMap((tech) => {
    if (tech.includes('nr') || tech.includes('5g')) return ['5G']
    if (tech.includes('lte')) return ['4G']
    if (tech.includes('umts') || tech.includes('wcdma') || tech.includes('hspa') || tech.includes('hsupa'))
      return ['3G']
    if (tech.includes('gsm') || tech.includes('edge') || tech.includes('gprs')) return ['2G']
    return []
  })
  return [...new Set(generations)]
}

/**
 * Compact technology label for an OSM tower, preferring generation names when available and
 * falling back to the raw uppercased technology list otherwise.
 * @param {Record<string, string>} tags Overpass tags.
 * @returns {string | null} Display label, or null when nothing can be inferred.
 */
export const overpassTechnologyLabel = (tags: Record<string, string>): string | null => {
  const generations = overpassTechnologyGenerations(tags)
  if (generations.length > 0) return generations.join('/')
  const technologies = overpassTechnologies(tags)
  if (technologies.length === 0) return null
  return technologies.map((tech) => tech.toUpperCase()).join('/')
}

/**
 * Read the antenna bearing from any of the common OSM tag aliases, normalized to [0, 360).
 * @param {Record<string, string>} tags Overpass tags.
 * @returns {number | null} Bearing in degrees, or null when not declared.
 */
export const overpassBearing = (tags: Record<string, string>): number | null => {
  const parsed = parseTagNumber(tags, 'communications_transponder:bearing', 'antenna:direction', 'direction', 'bearing')
  return parsed === null ? null : normalizeAngle(parsed)
}

/**
 * Resolve the antenna beamwidth from OSM tags, defaulting to a directional 90° when a bearing is
 * declared but no beamwidth, and to 360° (omni) when there's no bearing.
 * @param {Record<string, string>} tags Overpass tags.
 * @param {number | null} bearing Resolved bearing.
 * @returns {number} Beamwidth in degrees.
 */
export const overpassBeamwidth = (tags: Record<string, string>, bearing: number | null): number => {
  const parsed = parseTagNumber(tags, 'beamwidth', 'antenna:beamwidth')
  if (parsed !== null && parsed > 0 && parsed <= 360) return parsed
  return bearing === null ? 360 : OSM_DEFAULT_DIRECTIONAL_BEAMWIDTH
}

/**
 * Build the human-readable label parts for an OSM tower (operator, technology, mast type, height).
 * @param {OverpassTower} tower Overpass tower.
 * @returns {string[]} Ordered label parts; the joined form is rim-fitted later.
 */
export const overpassLabelParts = (tower: OverpassTower): string[] => {
  const parts = [tower.operator ?? 'Unknown operator']
  const technologyLabel = overpassTechnologyLabel(tower.tags)
  const manMade = pickTagValue(tower.tags, 'man_made')
  const height = pickTagValue(tower.tags, 'height')

  if (technologyLabel) parts.push(technologyLabel)
  if (manMade) parts.push(manMade)
  if (height) parts.push(formatHeightLabel(height))
  return parts
}

/**
 * Pick the longest prefix of `parts` that fits inside `maxWidthPx` when joined with " - ".
 * Falls back to truncating the first part with an ellipsis when even that doesn't fit.
 * @param {string[]} parts Ordered label parts.
 * @param {number} maxWidthPx Maximum rendered width.
 * @returns {string} Best-fit label.
 */
export const fitLabelToArc = (parts: string[], maxWidthPx: number): string => {
  for (let count = parts.length; count > 0; count--) {
    const candidate = parts.slice(0, count).join(' - ')
    if (candidate.length * OSM_LABEL_CHAR_WIDTH_PX <= maxWidthPx) return candidate
  }
  const fallback = parts[0]
  const maxChars = Math.max(8, Math.floor(maxWidthPx / OSM_LABEL_CHAR_WIDTH_PX) - 1)
  return fallback.length > maxChars ? `${fallback.slice(0, maxChars)}…` : fallback
}

/**
 * Build the label parts for an OpenCellID site (operator MCC/MNC, radio, range, cell id).
 * @param {CachedOpenCellIdSite} site OpenCellID site.
 * @returns {string[]} Ordered label parts.
 */
export const openCellIdLabelParts = (site: CachedOpenCellIdSite): string[] => {
  const parts: string[] = []
  const operator = openCellIdOperatorLabel(site)
  if (operator) parts.push(operator)
  if (site.radio) parts.push(site.radio.toUpperCase())
  parts.push(`${Math.round(site.rangeMeters)}m`)
  if (site.cellId !== undefined) parts.push(`CID ${site.cellId}`)
  return parts
}

/**
 * Stable per-operator color, picked from {@link OSM_OPERATOR_COLORS} via a string-hash on the
 * operator name, so the same operator always paints the same hue across reloads.
 * @param {string | null} operator Operator name.
 * @returns {string} Hex color from the palette.
 */
export const operatorColor = (operator: string | null): string => {
  if (!operator) return OSM_OPERATOR_COLORS[0]
  const hash = [...operator].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return OSM_OPERATOR_COLORS[hash % OSM_OPERATOR_COLORS.length]
}

/* eslint-disable jsdoc/require-jsdoc -- Inline transport DTOs; field meanings follow upstream docs. */
type OverpassNode = { id?: number; lat?: number; lon?: number; tags?: Record<string, string> }

type OverpassResponse = { elements?: OverpassNode[] }

type ResolvedOverpassNode = { id: number; lat: number; lon: number; tags?: Record<string, string> }
/* eslint-enable jsdoc/require-jsdoc */

/**
 * Fetch mobile-phone tower nodes from the public Overpass API for `bbox`.
 * @param {CoverageBbox} bbox Bounding box.
 * @param {AbortSignal} signal Cancellation signal.
 * @returns {Promise<OverpassTower[]>} Deduped towers.
 */
export const fetchOverpassTowers = async (bbox: CoverageBbox, signal: AbortSignal): Promise<OverpassTower[]> => {
  const region = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`
  const query =
    `[out:json][timeout:25];` +
    // Limit the overlay to mobile-phone infrastructure so the map reflects cellular coverage
    // rather than every generic communications site in the area.
    `(node["communication:mobile_phone"]${region};` +
    `node["technology:mobile_phone"]${region};);` +
    `out body;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
    signal,
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
  const data = (await res.json()) as OverpassResponse
  const seenIds = new Set<number>()
  return (data.elements ?? [])
    .filter(
      (e): e is ResolvedOverpassNode =>
        typeof e.id === 'number' && typeof e.lat === 'number' && typeof e.lon === 'number'
    )
    .filter((e) => {
      if (seenIds.has(e.id)) return false
      seenIds.add(e.id)
      return true
    })
    .map<OverpassTower>((e) => ({
      id: e.id,
      lat: e.lat,
      lon: e.lon,
      operator: e.tags?.operator?.trim() || null,
      tags: e.tags ?? {},
    }))
}
