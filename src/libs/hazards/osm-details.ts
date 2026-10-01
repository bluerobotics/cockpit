import type { OverpassElement } from '@/libs/overpass'

const WATER_LEVELS: Record<string, string> = {
  submerged: 'Always submerged',
  covers: 'Covers and uncovers with the tide',
  awash: 'Awash at the waterline',
  dry: 'Dry at low water',
  always_dry: 'Always dry',
  floating: 'Floating',
  floods: 'Floods at high water',
  below_mwl: 'Below mean water level',
  above_mwl: 'Above mean water level',
  part_submerged: 'Partly submerged at high water',
}

// Tags already shown elsewhere (the label, the source) or that carry nothing an operator can act on.
const SKIPPED_TAGS = new Set(['name', 'seamark:name', 'seamark:type', 'type', 'fixme', 'FIXME'])

const humanize = (value: string): string => {
  const text = value.replace(/;/g, ', ').replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const meters = (value: string): string => (/^-?\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()} m` : value)

const osmReference = (element: OverpassElement): string[] =>
  element.type && element.id !== undefined ? [`OpenStreetMap ${element.type} ${element.id}`] : []

// Everything left under the given prefixes, so a tag nobody anticipated still reaches the operator.
const remainingTags = (tags: Record<string, string>, used: Set<string>, prefixes: string[]): string[] =>
  Object.entries(tags)
    .filter(([key]) => !used.has(key) && !SKIPPED_TAGS.has(key) && prefixes.some((prefix) => key.startsWith(prefix)))
    .map(([key, value]) => {
      const name = key.slice(prefixes.find((prefix) => key.startsWith(prefix))?.length ?? 0)
      return `${humanize(name.replace(/:/g, ' '))}: ${humanize(value)}`
    })

const collect = (
  tags: Record<string, string>,
  used: Set<string>,
  entries: [key: string, format: (value: string) => string][]
): string[] =>
  entries.flatMap(([key, format]) => {
    const value = tags[key]?.trim()
    if (!value) return []
    used.add(key)
    return [format(value)]
  })

let selfChecked = false

/**
 * Operator-facing facts about a charted rock, wreck or obstruction, from its OpenSeaMap tags.
 * @param {OverpassElement} element The element as returned by Overpass.
 * @returns {string[]} One line per fact, the most useful for navigation first.
 */
export const seamarkDetails = (element: OverpassElement): string[] => {
  runSelfCheckOnce()
  const tags = element.tags ?? {}
  const type = tags['seamark:type'] ?? ''
  const prefix = `seamark:${type}:`
  const used = new Set<string>()
  const depth = [`${prefix}value_of_sounding`, `${prefix}depth`, 'seamark:sounding', 'depth', 'wreck:depth'].find(
    (key) => tags[key]
  )
  return [
    ...collect(tags, used, [
      [`${prefix}category`, (value) => `Category: ${humanize(value)}`],
      [`${prefix}water_level`, (value) => WATER_LEVELS[value] ?? `Water level: ${humanize(value)}`],
      ...(depth
        ? ([[depth, (value: string) => `Depth over it: ${meters(value)}`]] as [string, (v: string) => string][])
        : []),
      [`${prefix}height`, (value) => `Height: ${meters(value)}`],
      ['wreck:type', (value) => `Wreck of a ${value.replace(/_/g, ' ')}`],
      ['wreck:date_sunk', (value) => `Sunk ${value}`],
      ['wreck:cargo', (value) => `Cargo: ${value.replace(/_/g, ' ')}`],
      ['wreck:visible_at_low_tide', (value) => (value === 'yes' ? 'Visible at low tide' : 'Not visible at low tide')],
      [
        'wreck:visible_at_high_tide',
        (value) => (value === 'yes' ? 'Visible at high tide' : 'Not visible at high tide'),
      ],
      ['description', (value) => value],
      ['seamark:information', (value) => value],
      ['note', (value) => value],
      ['source', (value) => `Source: ${value}`],
    ]),
    ...remainingTags(tags, used, [prefix, 'wreck:']),
    ...osmReference(element),
  ]
}

/**
 * Operator-facing facts about a protected or restricted area, from its OpenStreetMap tags.
 * @param {OverpassElement} element The element as returned by Overpass.
 * @returns {string[]} One line per fact, the restrictions first.
 */
export const restrictedAreaDetails = (element: OverpassElement): string[] => {
  const tags = element.tags ?? {}
  const used = new Set<string>()
  const prefix = 'seamark:restricted_area:'
  return [
    ...collect(tags, used, [
      [`${prefix}restriction`, (value) => `Restrictions: ${humanize(value).toLowerCase()}`],
      [`${prefix}category`, (value) => `Category: ${humanize(value)}`],
      ['protection_title', (value) => value],
      ['designation', (value) => humanize(value)],
      ['protect_class', (value) => `Protection class ${value}`],
      ['iucn_level', (value) => `IUCN level ${value}`],
      ['fishing', (value) => `Fishing: ${value.replace(/_/g, ' ')}`],
      ['boat', (value) => `Boats: ${value.replace(/_/g, ' ')}`],
      ['access', (value) => `Access: ${value.replace(/_/g, ' ')}`],
      ['operator', (value) => `Managed by ${value}`],
      ['start_date', (value) => `Established ${value}`],
      ['description', (value) => value],
      ['seamark:information', (value) => value],
      ['website', (value) => value],
      ['source', (value) => `Source: ${value}`],
    ]),
    ...remainingTags(tags, used, [prefix]),
    ...osmReference(element),
  ]
}

// Runs once, on the first real use in a development session, after bootstrap has installed `assert`.
const runSelfCheckOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV) return
  selfChecked = true

  const wreck = seamarkDetails({
    type: 'node',
    id: 42,
    tags: {
      'seamark:type': 'wreck',
      'seamark:wreck:category': 'dangerous',
      'seamark:wreck:water_level': 'covers',
      'seamark:wreck:value_of_sounding': '4.2',
      'seamark:wreck:surface': 'metal',
      'wreck:date_sunk': '1917',
    },
  })
  assert(wreck[0] === 'Category: Dangerous', 'The category must lead the wreck details')
  assert(wreck.includes('Covers and uncovers with the tide'), 'A known water level must be spelled out')
  assert(wreck.includes('Depth over it: 4.2 m'), 'A numeric sounding must read in meters')
  assert(wreck.includes('Surface: Metal'), 'An unanticipated seamark tag must still be listed')
  assert(wreck[wreck.length - 1] === 'OpenStreetMap node 42', 'The OpenStreetMap reference must close the list')
  assert(seamarkDetails({ tags: { 'seamark:type': 'rock' } }).length === 0, 'A bare seamark must add nothing')

  const reserve = restrictedAreaDetails({
    tags: { 'seamark:restricted_area:restriction': 'no_anchoring;no_fishing', 'protect_class': '4' },
  })
  assert(reserve[0] === 'Restrictions: no anchoring, no fishing', 'Restrictions must be listed first and readable')
}
