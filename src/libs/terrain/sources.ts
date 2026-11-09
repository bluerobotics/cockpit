import { t } from 'ttag'

import type { TerrainSourceId } from '@/types/terrain'

import type { BathymetryTileSourceId } from './bathymetry'
import { type TerrainTile, terrainTileKey } from './tiles'

/**
 * Sources that publish tiles of their own, the terrain sources and the bathymetry models.
 */
export type TerrainTileSourceId = TerrainSourceId | BathymetryTileSourceId

/**
 * What a terrain source is and how far it can be trusted.
 */
export interface TerrainSourceInfo {
  /**
   * Name shown to the user.
   */
  label: string
  /**
   * Short name, for tags with little room.
   */
  name: string
  /**
   * One sentence on what the model holds.
   */
  description: string
  /**
   * Shallowest zoom the source is read at; coarser requests fall back to the Tilezen model.
   */
  minZoom: number
  /**
   * Deepest zoom the source publishes.
   */
  maxZoom: number
  /**
   * Typical vertical error on land, in meters, used for the uncertainty band.
   */
  verticalUncertaintyM: number
  /**
   * Attribution the source's licence requires wherever its data is shown.
   */
  attribution: string
  /**
   * True when the source can only be read by Cockpit Standalone.
   */
  standaloneOnly: boolean
}

const TILEZEN_TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

const TILEZEN_ATTRIBUTION =
  'Elevation: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain Tiles</a>, ' +
  'USGS 3DEP, SRTM, GMTED2010, ETOPO1, EU-DEM and the other sources listed there'

const COPERNICUS_ATTRIBUTION =
  'Elevation: Copernicus DEM GLO-30, © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 ' +
  'provided under COPERNICUS by the European Union and ESA; all rights reserved'

export const TERRAIN_SOURCES: Record<TerrainSourceId, TerrainSourceInfo> = {
  tilezen: {
    label: t`Tilezen terrain`,
    name: t`Tilezen`,
    description: t`Bare ground, about 30 m per sample in most of the world, with coarse ocean depths of its own.`,
    minZoom: 0,
    maxZoom: 15,
    verticalUncertaintyM: 16,
    attribution: TILEZEN_ATTRIBUTION,
    standaloneOnly: false,
  },
  copernicus: {
    label: t`Copernicus surface model`,
    name: t`Copernicus`,
    description: t`Ground with trees and buildings, 30 m per sample worldwide; the sea reads as 0 m.`,
    minZoom: 8,
    maxZoom: 13,
    verticalUncertaintyM: 4,
    attribution: COPERNICUS_ATTRIBUTION,
    standaloneOnly: true,
  },
  custom: {
    label: t`Custom Terrarium tiles`,
    name: t`Custom tiles`,
    description: t`Your own Terrarium-encoded elevation tiles, such as a survey of the operating area.`,
    minZoom: 0,
    maxZoom: 15,
    verticalUncertaintyM: 2,
    attribution: 'Elevation: custom tiles',
    standaloneOnly: false,
  },
}

/**
 * Fills a `{z}/{x}/{y}` URL template for one tile.
 * @param {string} template URL template.
 * @param {TerrainTile} tile Tile to address.
 * @returns {string} The tile URL.
 */
const fillTileUrlTemplate = (template: string, { z, x, y }: TerrainTile): string =>
  template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))

/**
 * Whether a custom tile URL template addresses tiles by zoom, column and row.
 * @param {string} template Template to check.
 * @returns {boolean} True when it holds `{z}`, `{x}` and `{y}` and is an http(s) URL.
 */
export const isValidTileUrlTemplate = (template: string): boolean =>
  /^https?:\/\//.test(template) && ['{z}', '{x}', '{y}'].every((token) => template.includes(token))

/**
 * URL of a tile of a source that is fetched over HTTP.
 * @param {'tilezen' | 'custom'} sourceId Source to address.
 * @param {TerrainTile} tile Tile to address.
 * @param {string} customTemplate URL template of the custom source.
 * @returns {string} The tile URL.
 */
export const terrainTileUrl = (sourceId: 'tilezen' | 'custom', tile: TerrainTile, customTemplate = ''): string =>
  fillTileUrlTemplate(sourceId === 'tilezen' ? TILEZEN_TILE_URL : customTemplate, tile)

/**
 * Cache key of one tile of one source. The custom source keys by its template, so pointing it at
 * other tiles never serves the previous ones.
 * @param {TerrainTileSourceId} sourceId Source of the tile.
 * @param {TerrainTile} tile Tile to key.
 * @param {string} customTemplate URL template of the custom source.
 * @returns {string} The cache key.
 */
export const terrainSourceTileKey = (sourceId: TerrainTileSourceId, tile: TerrainTile, customTemplate = ''): string => {
  if (sourceId !== 'custom') return `${sourceId}/${terrainTileKey(tile)}`
  let hash = 0
  for (let index = 0; index < customTemplate.length; index++) {
    hash = (hash * 31 + customTemplate.charCodeAt(index)) | 0
  }
  return `custom-${(hash >>> 0).toString(36)}/${terrainTileKey(tile)}`
}
