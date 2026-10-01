import type { GeoBbox } from '@/types/general'
import type { HazardArea, HazardAreaSourceId, HazardFetchResult, TerrainGrid } from '@/types/hazards'

const isCoordinate = (value: unknown): boolean =>
  Array.isArray(value) && value.length === 2 && value.every((part) => Number.isFinite(part))

const isHazardArea = (value: unknown, sourceId: HazardAreaSourceId): value is HazardArea => {
  const area = value as HazardArea
  return (
    area?.sourceId === sourceId &&
    typeof area.id === 'string' &&
    typeof area.label === 'string' &&
    (area.kind === 'line' || area.kind === 'polygon') &&
    Array.isArray(area.coordinates) &&
    area.coordinates.every(isCoordinate) &&
    (area.details === undefined ||
      (Array.isArray(area.details) && area.details.every((line) => typeof line === 'string')))
  )
}

const isGeoBbox = (value: unknown): value is GeoBbox =>
  (['south', 'west', 'north', 'east'] as const).every((edge) => Number.isFinite((value as GeoBbox)?.[edge]))

const isHazardFetchResult = (value: unknown, sourceId: HazardAreaSourceId): value is HazardFetchResult => {
  const result = value as HazardFetchResult
  return (
    Number.isFinite(result?.fetchedAtMs) &&
    typeof result.truncated === 'boolean' &&
    isGeoBbox(result.bbox) &&
    Array.isArray(result.areas) &&
    result.areas.every((area) => isHazardArea(area, sourceId))
  )
}

const isTerrainGrid = (value: unknown): value is TerrainGrid => {
  const grid = value as TerrainGrid
  return (
    Number.isFinite(grid?.fetchedAtMs) &&
    isGeoBbox(grid.bbox) &&
    Number.isInteger(grid.columns) &&
    Number.isInteger(grid.rows) &&
    grid.columns >= 2 &&
    grid.rows >= 2 &&
    Array.isArray(grid.elevationsM) &&
    grid.elevationsM.length === grid.columns * grid.rows &&
    grid.elevationsM.every((elevation) => elevation === null || Number.isFinite(elevation))
  )
}

/**
 * Parses a stored terrain grid, discarding one that no longer matches the schema.
 * @param {string} json Stored JSON text.
 * @returns {TerrainGrid | null} The parsed grid, or `null` when unreadable or stale.
 */
export const parseStoredTerrainGrid = (json: string): TerrainGrid | null => {
  try {
    const stored: unknown = JSON.parse(json)
    if (isTerrainGrid(stored)) return stored
    console.warn('The stored terrain grid does not match the expected shape; ignoring it.')
    return null
  } catch (error) {
    console.error('Failed to read the stored terrain grid:', error)
    return null
  }
}

/**
 * Parses stored areas for one source. The stored copy outlives the schema that wrote it, so an entry
 * that no longer matches is discarded rather than handed to the overlay and the mission checks.
 * @param {HazardAreaSourceId} sourceId Source the stored entry belongs to.
 * @param {string} json Stored JSON text.
 * @returns {HazardFetchResult | null} The parsed result, or `null` when unreadable or stale.
 */
export const parseStoredHazards = (sourceId: HazardAreaSourceId, json: string): HazardFetchResult | null => {
  try {
    const stored: unknown = JSON.parse(json)
    if (isHazardFetchResult(stored, sourceId)) return { ...stored, sourceId }

    // Left in storage rather than deleted: the next successful fetch replaces it, and a reader that
    // has grown stricter than the writer must not be the thing that loses the operator's data.
    console.warn(`Stored hazard areas for ${sourceId} do not match the expected shape; ignoring them.`)
    return null
  } catch (error) {
    console.error(`Failed to read stored hazard areas for ${sourceId}:`, error)
    return null
  }
}
