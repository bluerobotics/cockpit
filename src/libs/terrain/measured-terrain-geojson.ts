import * as turf from '@turf/turf'
import { z } from 'zod'

import { externalMapOverlayFeatureSchema } from '@/libs/map/external-overlay-api'
import type { WaypointCoordinates } from '@/types/mission'

import {
  type MeasuredCell,
  type MeasuredTerrain,
  CELL_DEG,
  measuredCellCenter,
  measuredCellKey,
  measuredSpreadM,
  MIN_TRUSTED_COUNT,
  trustedCells,
} from './measured-terrain'
import type { TerrainVehicleClass } from './mission-profile'

/**
 * A cell as exported, keyed the same way the measured grid keys it.
 */
export type SelectedCell = [string, MeasuredCell]

/**
 * What a measured terrain file says about itself, under its `cockpit` foreign member.
 */
export interface MeasuredTerrainMeta {
  /**
   * Marks the file as measured terrain rather than any other GeoJSON.
   */
  kind: 'measured-terrain'
  /**
   * Format revision, so a later Cockpit can tell how to read it.
   */
  version: 1
  /**
   * Side of the grid cells the points were averaged over, in degrees.
   */
  cellSizeDeg: number
  /**
   * Water surface height the depths were measured against, meters above the model's sea level.
   */
  waterLevelM: number
  /**
   * Mission the measurements were taken over, when they came from one.
   */
  missionName?: string
  /**
   * How the vehicle met the terrain, which is what decides whether depths are written.
   */
  vehicleClass: TerrainVehicleClass
}

/**
 * One measured cell as a GeoJSON point, carrying its height as the position's altitude.
 */
export interface MeasuredTerrainFeature {
  /**
   * GeoJSON feature marker.
   */
  type: 'Feature'
  /**
   * The cell's center, as [longitude, latitude, height above sea level].
   */
  geometry: {
    /**
     * GeoJSON point marker.
     */
    type: 'Point'
    /**
     * Longitude, latitude and height above sea level, in meters.
     */
    coordinates: [number, number, number]
  }
  /**
   * The measurement, its comparison with the model, and the simplestyle properties that color it.
   */
  properties: Record<string, unknown>
}

/**
 * Measured terrain as a GeoJSON feature collection, which QGIS and the overlay layer both read.
 */
export interface MeasuredTerrainGeoJson {
  /**
   * GeoJSON feature collection marker.
   */
  type: 'FeatureCollection'
  /**
   * One point per exported cell.
   */
  features: MeasuredTerrainFeature[]
  /**
   * What the dataset is, for Cockpit to read back.
   */
  cockpit: MeasuredTerrainMeta
}

/**
 * What the export needs beyond the cells themselves.
 */
export interface MeasuredTerrainExportOptions {
  /**
   * Water surface height, to report depths against.
   */
  waterLevelM: number
  /**
   * How the vehicle meets the terrain; depths are only written for vehicles on or in the water.
   */
  vehicleClass: TerrainVehicleClass
  /**
   * Mission the measurements were taken over, when they came from one.
   */
  missionName?: string
  /**
   * Model height at each cell, in the same order as the cells, for the comparison properties.
   */
  modelM: (number | null)[]
}

/**
 * What reading a file produced.
 */
export interface MeasuredTerrainImport {
  /**
   * The cells read from it.
   */
  cells: MeasuredTerrain
  /**
   * How many features were not points, and so could not be read as measurements.
   */
  skipped: number
}

/**
 * How far from a mission's path a measurement still counts as taken over it, in meters. Wide enough to hold a
 * survey swath or a leg flown slightly off track, narrow enough not to reach the next site.
 */
export const MISSION_AREA_MARGIN_M = 100

const measuredFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(externalMapOverlayFeatureSchema),
})

const marineClasses: TerrainVehicleClass[] = ['surface', 'underwater']

/**
 * Deep blue at the lowest measured point to pale yellow at the highest, the usual bathymetry ramp.
 * @param {number} fraction Where the point sits between the lowest and the highest, from 0 to 1.
 * @returns {string} The color as an `rgb()` string.
 */
export const rampColor = (fraction: number): string => {
  const clamped = Math.max(0, Math.min(1, fraction))
  return `rgb(${Math.round(20 + 235 * clamped)}, ${Math.round(60 + 175 * clamped)}, ${Math.round(160 - 40 * clamped)})`
}

/**
 * Trusted cells inside a mission's area: within a margin of its path, or inside one of its survey polygons.
 * @param {MeasuredTerrain} terrain Every measured cell, which is one global grid.
 * @param {WaypointCoordinates[]} path The mission's waypoints, in order.
 * @param {WaypointCoordinates[][]} surveyPolygons The areas its surveys cover.
 * @param {number} marginM How far from the path a measurement still belongs to the mission, in meters.
 * @returns {SelectedCell[]} The cells inside the area, empty when the mission has no area.
 */
export const cellsInMissionArea = (
  terrain: MeasuredTerrain,
  path: WaypointCoordinates[],
  surveyPolygons: WaypointCoordinates[][],
  marginM: number
): SelectedCell[] => {
  const toPosition = ([lat, lng]: WaypointCoordinates): [number, number] => [lng, lat]
  const rings = surveyPolygons.filter((ring) => ring.length >= 3)
  const polygons = rings.map((ring) => {
    const positions = ring.map(toPosition)
    return turf.polygon([[...positions, positions[0]]])
  })
  const line = path.length >= 2 ? turf.lineString(path.map(toPosition)) : null
  const anchor = path.length === 1 ? turf.point(toPosition(path[0])) : null
  const corners = [...rings.flat(), ...path]
  if (corners.length === 0) return []

  // The grid spans every site the vehicle has ever measured, so cells far from this mission are dropped on a
  // bounding box before any geometry runs on them.
  const marginKm = marginM / 1000
  const south = Math.min(...corners.map(([lat]) => lat))
  const north = Math.max(...corners.map(([lat]) => lat))
  const west = Math.min(...corners.map(([, lng]) => lng))
  const east = Math.max(...corners.map(([, lng]) => lng))
  const latMargin = marginKm / 110.574
  const lngMargin = latMargin / Math.max(0.01, Math.cos((((south + north) / 2) * Math.PI) / 180))

  const insideArea = (center: WaypointCoordinates): boolean => {
    const point = turf.point(toPosition(center))
    if (polygons.some((polygon) => turf.booleanPointInPolygon(point, polygon))) return true
    if (line) return turf.pointToLineDistance(point, line) <= marginKm
    return anchor !== null && turf.distance(point, anchor) <= marginKm
  }

  return trustedCells(terrain).filter(([key]) => {
    const [lat, lng] = measuredCellCenter(key)
    if (lat < south - latMargin || lat > north + latMargin) return false
    if (lng < west - lngMargin || lng > east + lngMargin) return false
    return insideArea([lat, lng])
  })
}

/**
 * Measured cells as a GeoJSON point collection, colored by the bathymetry ramp so the map overlay layer draws
 * them with no extra styling.
 * @param {SelectedCell[]} cells Cells to write, as {@link cellsInMissionArea} selects them.
 * @param {MeasuredTerrainExportOptions} options Water level, vehicle class, mission name and model heights.
 * @returns {MeasuredTerrainGeoJson} The collection, with Cockpit's own description under `cockpit`.
 */
export const measuredTerrainToGeoJson = (
  cells: SelectedCell[],
  options: MeasuredTerrainExportOptions
): MeasuredTerrainGeoJson => {
  // ponytail: a whole survey is written in one string; stream it per feature once datasets reach tens of MB.
  const { waterLevelM, vehicleClass, missionName, modelM } = options
  const marine = marineClasses.includes(vehicleClass)
  const heights = cells.map(([, cell]) => cell.sum / cell.count)
  const low = Math.min(...heights)
  const span = Math.max(...heights) - low

  const features = cells.map(([key, cell], index): MeasuredTerrainFeature => {
    const [lat, lng] = measuredCellCenter(key)
    const height = heights[index]
    const model = modelM[index] ?? null
    const properties: Record<string, unknown> = {
      'height_m': Number(height.toFixed(2)),
      'samples': cell.count,
      'spread_m': Number(measuredSpreadM(cell).toFixed(2)),
      'last_measured_utc': new Date(cell.lastMs).toISOString(),
      'model_height_m': model === null ? null : Number(model.toFixed(2)),
      'difference_m': model === null ? null : Number((height - model).toFixed(2)),
      'marker-color': rampColor(span > 0 ? (height - low) / span : 1),
      'marker-size': 'small',
    }
    if (marine) properties.depth_m = Number(Math.max(0, waterLevelM - height).toFixed(2))
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(lng.toFixed(7)), Number(lat.toFixed(7)), height] },
      properties,
    }
  })

  return {
    type: 'FeatureCollection',
    features,
    cockpit: {
      kind: 'measured-terrain',
      version: 1,
      cellSizeDeg: CELL_DEG,
      waterLevelM,
      ...(missionName ? { missionName } : {}),
      vehicleClass,
    },
  }
}

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

// The third coordinate is where our own files carry the height; the properties cover soundings written by other
// software, which usually give either a height or a depth below the surface.
const heightFromFeature = (
  coordinates: number[],
  properties: Record<string, unknown>,
  waterLevelM: number
): number | null => {
  const fromAltitude = numberOrNull(coordinates[2])
  if (fromAltitude !== null) return fromAltitude
  const fromHeight = numberOrNull(properties.height_m)
  if (fromHeight !== null) return fromHeight
  const depth = numberOrNull(properties.depth_m)
  return depth === null ? null : waterLevelM - depth
}

/**
 * Reads measured cells from a GeoJSON point collection, Cockpit's own files and plain soundings alike. A point
 * with no sample count is taken as an already-averaged sounding, so it counts as a trusted cell on its own.
 * @param {unknown} json The parsed file.
 * @param {number} waterLevelM Water surface height, to turn depths into heights.
 * @returns {MeasuredTerrainImport} The cells read and how many features were skipped.
 * @throws {Error} When the file is not a GeoJSON feature collection, naming the first problem found.
 */
export const measuredTerrainFromGeoJson = (json: unknown, waterLevelM: number): MeasuredTerrainImport => {
  selfCheck()
  const parsed = measuredFeatureCollectionSchema.safeParse(json)
  if (!parsed.success) {
    const [issue] = parsed.error.issues
    throw new Error(`${issue.path.join('.') || 'file'}: ${issue.message}`)
  }

  const stored = numberOrNull((json as MeasuredTerrainGeoJson)?.cockpit?.waterLevelM)
  const surfaceM = stored ?? waterLevelM
  const cells: MeasuredTerrain = new Map()
  let skipped = 0

  for (const feature of parsed.data.features) {
    if (feature.geometry.type !== 'Point') {
      skipped += 1
      continue
    }
    const properties = feature.properties ?? {}
    const height = heightFromFeature(feature.geometry.coordinates, properties, surfaceM)
    if (height === null) {
      skipped += 1
      continue
    }
    const [lng, lat] = feature.geometry.coordinates
    const count = Math.max(1, Math.round(numberOrNull(properties.samples) ?? MIN_TRUSTED_COUNT))
    const spread = Math.max(0, numberOrNull(properties.spread_m) ?? 0)
    const lastMs = Date.parse(String(properties.last_measured_utc))
    const key = measuredCellKey([lat, lng])
    const existing = cells.get(key)
    // Rebuilt from the mean and the spread, which is what makes our own files read back to the same cells.
    const cell: MeasuredCell = {
      sum: height * count,
      sumSquares: (spread * spread + height * height) * count,
      count,
      lastMs: Number.isFinite(lastMs) ? lastMs : Date.now(),
    }
    if (!existing) {
      cells.set(key, cell)
      continue
    }
    existing.sum += cell.sum
    existing.sumSquares += cell.sumSquares
    existing.count += cell.count
    existing.lastMs = Math.max(existing.lastMs, cell.lastMs)
  }

  return { cells, skipped }
}

let selfChecked = false
const selfCheck = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true
  const original: MeasuredTerrain = new Map([['-276000:-485000', { sum: -30, sumSquares: 302, count: 3, lastMs: 1 }]])
  const [key] = [...original.keys()]
  const exported = measuredTerrainToGeoJson([[key, original.get(key)!]], {
    waterLevelM: 0,
    vehicleClass: 'surface',
    modelM: [-12],
  })
  assert(exported.features[0].properties.depth_m === 10, 'A vessel reports the depth under the water level')
  assert(exported.features[0].properties.difference_m === 2, 'The model comparison is measured minus model')
  const { cells, skipped } = measuredTerrainFromGeoJson(exported, 0)
  const restored = cells.get(key)
  assert(skipped === 0 && restored?.count === 3, 'Our own files read back cell for cell')
  assert(Math.abs((restored?.sum ?? 0) - -30) < 0.01, 'The mean survives the round trip')
  assert(Math.abs((restored?.sumSquares ?? 0) - 302) < 0.1, 'The spread survives the round trip')
  const sounding = { type: 'Feature', geometry: { type: 'Point', coordinates: [-48.5, -27.6] }, properties: {} }
  const fromDepth = measuredTerrainFromGeoJson(
    { type: 'FeatureCollection', features: [{ ...sounding, properties: { depth_m: 4 } }] },
    1
  )
  assert([...fromDepth.cells.values()][0].sum === -9, 'A depth becomes a height under the water level, trusted')
  const skippedLine = measuredTerrainFromGeoJson(
    {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
          properties: {},
        },
      ],
    },
    0
  )
  assert(skippedLine.cells.size === 0 && skippedLine.skipped === 1, 'Features that are not points are counted out')
}
