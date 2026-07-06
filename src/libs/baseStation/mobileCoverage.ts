import {
  type BaseStationConfig,
  type CachedOpenCellIdSite,
  type CachedOverpassTower,
  type MobileCoverageCache,
  MobileCoverageProvider,
} from '@/types/baseStation'
import type { WaypointCoordinates } from '@/types/mission'

export type MobileCoverageCircle = {
  /** Circle center in [lat, lng]. */
  center: WaypointCoordinates
  /** Effective coverage radius in meters. */
  rangeMeters: number
}

export const OSM_DEFAULT_RANGE_METERS = 1800

const splitTagList = (value?: string): string[] =>
  value
    ?.split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean) ?? []

/**
 * Normalized list of radio technologies declared on an OSM Overpass mobile-phone tower.
 * Combines the modern `technology:mobile_phone` and legacy `communication:mobile_phone` tags.
 * @param {Record<string, string>} tags Overpass tags for the tower.
 * @returns {string[]} Lowercase, deduped list of radio technologies (empty when none declared).
 */
export const overpassTechnologies = (tags: Record<string, string>): string[] => {
  const technologies = splitTagList(tags['technology:mobile_phone']).map((tech) => tech.toLowerCase())
  const legacyCommunication = splitTagList(tags['communication:mobile_phone'])
    .map((tech) => tech.toLowerCase())
    .filter((tech) => tech !== 'yes')
  return [...new Set([...technologies, ...legacyCommunication])]
}

/**
 * Approximate coverage radius for an OSM Overpass mobile-phone tower based on its declared
 * radio technologies. Falls back to {@link OSM_DEFAULT_RANGE_METERS} when nothing is declared.
 * @param {Record<string, string>} tags Overpass tags for the tower.
 * @returns {number} Range in meters.
 */
export const overpassRangeMeters = (tags: Record<string, string>): number => {
  const technologies = overpassTechnologies(tags)
  if (technologies.length === 0) return OSM_DEFAULT_RANGE_METERS
  return Math.max(
    ...technologies.map((tech) => {
      if (tech.includes('nr') || tech.includes('5g')) return 1200
      if (tech.includes('lte')) return 1800
      if (tech.includes('umts')) return 2200
      if (tech.includes('gsm')) return 2800
      return OSM_DEFAULT_RANGE_METERS
    })
  )
}

/**
 * Build the operator label used to filter OpenCellID sites by network. Returns null when the
 * site doesn't carry mobile country / network codes.
 * @param {CachedOpenCellIdSite} site OpenCellID site.
 * @returns {string | null} Operator label or null.
 */
export const openCellIdOperatorLabel = (site: CachedOpenCellIdSite): string | null => {
  if (site.mcc === undefined || site.mnc === undefined) return null
  return `MCC ${site.mcc} / MNC ${site.mnc}`
}

/**
 * Filter OpenCellID sites by the user-selected operator label. Empty operator keeps everything.
 * @param {CachedOpenCellIdSite[]} sites OpenCellID sites.
 * @param {string} selectedOperator Operator label (empty string = no filter).
 * @returns {CachedOpenCellIdSite[]} Filtered sites.
 */
export const filterOpenCellIdSites = (
  sites: CachedOpenCellIdSite[],
  selectedOperator: string
): CachedOpenCellIdSite[] => {
  if (!selectedOperator) return sites
  return sites.filter((site) => openCellIdOperatorLabel(site) === selectedOperator)
}

const filterOverpassTowers = (towers: CachedOverpassTower[], selectedOperator: string): CachedOverpassTower[] => {
  if (!selectedOperator) return towers
  return towers.filter((tower) => tower.operator === selectedOperator)
}

const dedupeOpenCellIdSites = (sites: CachedOpenCellIdSite[]): CachedOpenCellIdSite[] => {
  const map = new Map<string, CachedOpenCellIdSite>()
  for (const site of sites) {
    const key = `${site.lat.toFixed(6)}|${site.lon.toFixed(6)}|${site.cellId ?? ''}`
    if (!map.has(key)) map.set(key, site)
  }
  return [...map.values()]
}

const dedupeOverpassTowers = (towers: CachedOverpassTower[]): CachedOverpassTower[] => {
  const map = new Map<number, CachedOverpassTower>()
  for (const tower of towers) {
    if (!map.has(tower.id)) map.set(tower.id, tower)
  }
  return [...map.values()]
}

/**
 * Merge two OpenCellID site lists, deduplicating by (lat, lon, cell id).
 * @param {CachedOpenCellIdSite[] | null} existing Sites already known.
 * @param {CachedOpenCellIdSite[]} incoming New sites to fold in.
 * @returns {CachedOpenCellIdSite[]} Merged, deduplicated sites.
 */
export const mergeOpenCellIdSites = (
  existing: CachedOpenCellIdSite[] | null,
  incoming: CachedOpenCellIdSite[]
): CachedOpenCellIdSite[] => dedupeOpenCellIdSites([...(existing ?? []), ...incoming])

/**
 * Merge two Overpass tower lists, deduplicating by OSM id.
 * @param {CachedOverpassTower[] | null} existing Towers already known.
 * @param {CachedOverpassTower[]} incoming New towers to fold in.
 * @returns {CachedOverpassTower[]} Merged, deduplicated towers.
 */
export const mergeOverpassTowers = (
  existing: CachedOverpassTower[] | null,
  incoming: CachedOverpassTower[]
): CachedOverpassTower[] => dedupeOverpassTowers([...(existing ?? []), ...incoming])

/**
 * Collect the active mobile coverage circles for the current base station configuration. Returns
 * an empty array when the comms type isn't MobileData or when no cached data is available for
 * the active provider.
 * @param {BaseStationConfig} config Base station configuration.
 * @param {MobileCoverageCache} cache Persisted mobile coverage cache.
 * @returns {MobileCoverageCircle[]} Filtered coverage circles.
 */
export const getMobileCoverageCircles = (
  config: BaseStationConfig,
  cache: MobileCoverageCache
): MobileCoverageCircle[] => {
  const { provider, openCellIdOperator, osmOperator } = config.mobileCoverage

  if (provider === MobileCoverageProvider.OpenCellID) {
    const sites = dedupeOpenCellIdSites(cache.openCellId.flatMap((entry) => entry.data))
    return filterOpenCellIdSites(sites, openCellIdOperator).map((site) => ({
      center: [site.lat, site.lon] as WaypointCoordinates,
      rangeMeters: site.rangeMeters,
    }))
  }

  if (provider === MobileCoverageProvider.OSMOverpass) {
    const towers = dedupeOverpassTowers(cache.osmOverpass.flatMap((entry) => entry.data))
    return filterOverpassTowers(towers, osmOperator).map((tower) => ({
      center: [tower.lat, tower.lon] as WaypointCoordinates,
      rangeMeters: overpassRangeMeters(tower.tags),
    }))
  }

  return []
}
