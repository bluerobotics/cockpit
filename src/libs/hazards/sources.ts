import type { HazardAreaSourceId, HazardGridSourceId, HazardSourceId } from '@/types/hazards'

/**
 * How one hazard source is presented to the operator, on the map and in the advisory panel.
 */
export interface HazardSourceMeta {
  /**
   * Operator-facing name of the dataset.
   */
  label: string
  /**
   * Why the dataset must not be treated as a navigation source, shown beside its toggle.
   */
  caveat: string
  /**
   * Attribution the dataset's license requires Cockpit to display.
   */
  attribution: string
  /**
   * Color used for this source's areas on the map and its chip in the advisory list.
   */
  color: string
  /**
   * Material Design icon name shown beside the source's toggle and advisories.
   */
  icon: string
}

const TERRAIN_TILES_ATTRIBUTION =
  'Elevation: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain Tiles</a>, ' +
  'USGS 3DEP, SRTM, GMTED2010, ETOPO1, EU-DEM and the other sources listed there'

export const HAZARD_SOURCES: Record<HazardSourceId, HazardSourceMeta> = {
  'coastline': {
    label: 'Coastline',
    caveat: 'Drawn by OpenStreetMap contributors at an unspecified tide. Treat it as a rough shoreline, not a chart.',
    attribution: '© OpenStreetMap contributors',
    color: '#F59E0B',
    icon: 'mdi-waves',
  },
  'restricted-waters': {
    label: 'Protected/restricted areas',
    caveat: 'Community-mapped areas. Coverage is patchy and a missing area does not mean the water is open.',
    attribution: '© OpenStreetMap contributors',
    color: '#A855F7',
    icon: 'mdi-sail-boat',
  },
  'seamarks': {
    label: 'Rocks, wrecks and obstructions',
    caveat:
      'Charted by OpenStreetMap and OpenSeaMap contributors. Most are single points, so each is drawn as a small ' +
      'circle and only the clearance margin keeps the mission away from its real extent.',
    attribution: '© OpenStreetMap contributors',
    color: '#EF4444',
    icon: 'mdi-alert-octagon-outline',
  },
  'airspace': {
    label: 'Restricted airspace',
    caveat:
      'openAIP data needs your own key, is not a notice-to-airmen feed, and can lag real restrictions. ' +
      'Areas carry altitude limits, but a fence does not, so converting one keeps the vehicle out at every altitude.',
    attribution: '© openAIP contributors, CC BY-NC 4.0',
    color: '#38BDF8',
    icon: 'mdi-airplane-alert',
  },
  'terrain': {
    label: 'Terrain clearance',
    caveat: 'Sampled from a global elevation model with roughly 30 m spacing, so it misses masts, trees and buildings.',
    attribution: TERRAIN_TILES_ATTRIBUTION,
    color: '#F97316',
    icon: 'mdi-terrain',
  },
  'shallow-water': {
    label: 'Shallow water',
    caveat:
      'Read from the same global elevation model, whose seabed is coarse (often hundreds of meters between ' +
      'soundings) and ignores tides. Use it to spot banks and shoals, never to judge depth under the hull.',
    attribution: TERRAIN_TILES_ATTRIBUTION,
    color: '#3B82F6',
    icon: 'mdi-waves-arrow-up',
  },
}

/** Sources fetched as ready-made areas, in the order the panel and the layer control list them. */
export const HAZARD_AREA_SOURCE_IDS: HazardAreaSourceId[] = ['coastline', 'restricted-waters', 'seamarks', 'airspace']

/** Sources traced from the sampled elevation grid, listed after the area sources. */
export const HAZARD_GRID_SOURCE_IDS: HazardGridSourceId[] = ['terrain', 'shallow-water']

/** Every source, area-producing or not, in panel order. */
export const HAZARD_SOURCE_IDS: HazardSourceId[] = [...HAZARD_AREA_SOURCE_IDS, ...HAZARD_GRID_SOURCE_IDS]
