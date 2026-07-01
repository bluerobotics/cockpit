import {
  createTransformingFunction,
  deleteTransformingFunction,
  getAllTransformingFunctions,
  updateTransformingFunction,
} from '@/libs/actions/data-lake-transformations'
import type { PoiCoordinateSource } from '@/types/mission'

/**
 * Builds the data-lake variable id holding a POI's latitude.
 * @param {string} poiId - The POI id
 * @returns {string} The latitude variable id
 */
export const poiLatitudeVariableId = (poiId: string): string => `cockpit/pois/${poiId}/latitude`

/**
 * Builds the data-lake variable id holding a POI's longitude.
 * @param {string} poiId - The POI id
 * @returns {string} The longitude variable id
 */
export const poiLongitudeVariableId = (poiId: string): string => `cockpit/pois/${poiId}/longitude`

// Prefix shared by every POI-backing data-lake variable, used to find and prune orphaned ones.
const poiVariablePrefix = 'cockpit/pois/'

/**
 * A POI coordinate definition, used to keep the backing data-lake variables in sync.
 */
export interface PoiCoordinateDefinition {
  /** The POI id */
  id: string
  /** The POI name, used to label the backing transforming functions */
  name: string
  /** Latitude source: a fixed number or a data-lake expression */
  latitude: PoiCoordinateSource
  /** Longitude source: a fixed number or a data-lake expression */
  longitude: PoiCoordinateSource
}

// Every POI coordinate is backed by a transforming function: a fixed number resolves to itself, an
// expression (e.g. "{{ mavlink/buoy/latitude }} + 0.0001") is evaluated and tracks its dependencies.
const coordinateExpression = (source: PoiCoordinateSource): string =>
  typeof source === 'number' ? String(source) : source

const ensureCoordinateFunction = (variableId: string, name: string, source: PoiCoordinateSource): void => {
  const expression = coordinateExpression(source)
  const existing = getAllTransformingFunctions().find((func) => func.id === variableId)

  if (existing) {
    if (existing.expression !== expression || existing.name !== name) {
      updateTransformingFunction({ ...existing, name, type: 'number', expression })
    }
    return
  }

  createTransformingFunction(variableId, name, 'number', expression)
}

const deleteCoordinateFunction = (variableId: string): void => {
  const existing = getAllTransformingFunctions().find((func) => func.id === variableId)
  if (existing) deleteTransformingFunction(existing)
}

/**
 * Removes the transforming functions backing a POI's coordinates.
 * @param {string} poiId - The POI id
 */
export const unregisterPoiCoordinateVariables = (poiId: string): void => {
  deleteCoordinateFunction(poiLatitudeVariableId(poiId))
  deleteCoordinateFunction(poiLongitudeVariableId(poiId))
}

/**
 * Keeps the transforming functions backing every POI's coordinates in sync with the given
 * definitions. Creates/updates a function for each current coordinate and prunes those of POIs that
 * no longer exist. Safe to call repeatedly; functions whose expression is unchanged are left as-is.
 * @param {PoiCoordinateDefinition[]} pois - The current POI coordinate definitions
 */
export const syncPoiCoordinateVariables = (pois: PoiCoordinateDefinition[]): void => {
  const presentIds = new Set<string>()

  pois.forEach((poi) => {
    const latitudeVariableId = poiLatitudeVariableId(poi.id)
    const longitudeVariableId = poiLongitudeVariableId(poi.id)
    ensureCoordinateFunction(latitudeVariableId, `${poi.name} latitude`, poi.latitude)
    ensureCoordinateFunction(longitudeVariableId, `${poi.name} longitude`, poi.longitude)
    presentIds.add(latitudeVariableId)
    presentIds.add(longitudeVariableId)
  })

  // Prune transforming functions for POIs (or coordinates) that no longer exist.
  getAllTransformingFunctions()
    .filter((func) => func.id.startsWith(poiVariablePrefix) && !presentIds.has(func.id))
    .forEach(deleteTransformingFunction)
}
