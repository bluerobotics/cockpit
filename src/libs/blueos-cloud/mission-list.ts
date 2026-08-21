import type { BlueOsCloudMission } from './types'

/**
 * Orders offered by the BlueOS Cloud mission picker.
 */
export type MissionSortKey = 'newest' | 'oldest' | 'name'

const startTimeOf = (mission: BlueOsCloudMission): number | null => {
  const time = mission.start_time ? new Date(mission.start_time).getTime() : NaN
  return Number.isFinite(time) ? time : null
}

const locationTextOf = (mission: BlueOsCloudMission): string | null => {
  if (!mission.start_latitude || !mission.start_longitude) return null
  const lat = parseFloat(mission.start_latitude)
  const lng = parseFloat(mission.start_longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

const metaPartsOf = (mission: BlueOsCloudMission): string[] => {
  const parts: string[] = []
  const startTime = startTimeOf(mission)
  if (startTime !== null) parts.push(new Date(startTime).toLocaleString())
  const location = locationTextOf(mission)
  if (location) parts.push(location)
  return parts
}

/**
 * Start time and start coordinates of a mission, as shown under its name on the picker rows.
 * @param {BlueOsCloudMission} mission - Mission to describe.
 * @returns {string} Formatted metadata, or a placeholder when the mission carries none.
 */
export const formatMissionMeta = (mission: BlueOsCloudMission): string =>
  metaPartsOf(mission).join(' • ') || 'No metadata'

/**
 * Filters missions by a free-text query and sorts what is left.
 *
 * The query is matched against the same text the picker displays (name, description, date and coordinates), so
 * searching for a date or a coordinate prefix narrows the list just like searching for a name does.
 * @param {BlueOsCloudMission[]} missions - Missions to narrow down.
 * @param {string} query - Free-text search, matched case-insensitively against every word the user typed.
 * @param {MissionSortKey} sortKey - Order to apply to the remaining missions.
 * @returns {BlueOsCloudMission[]} New array with the matching missions in the requested order.
 */
export const filterAndSortMissions = (
  missions: BlueOsCloudMission[],
  query: string,
  sortKey: MissionSortKey
): BlueOsCloudMission[] => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)

  const matching = missions.filter((mission) => {
    if (terms.length === 0) return true
    const searchable = [mission.title, mission.description, ...metaPartsOf(mission)].join(' ').toLowerCase()
    return terms.every((term) => searchable.includes(term))
  })

  // Missions with no usable start time are treated as the oldest ones, so they never push dated missions down.
  return matching.sort((a, b) => {
    if (sortKey === 'name') return (a.title || '').localeCompare(b.title || '')
    const [first, second] = [startTimeOf(a) ?? 0, startTimeOf(b) ?? 0]
    return sortKey === 'oldest' ? first - second : second - first
  })
}
