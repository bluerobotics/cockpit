import { expect, test } from 'vitest'

import { fillTileTemplate, offlineTilesInBounds } from '@/libs/map/tile-loading'

const osmTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

// The tiles leaflet.offline enumerated for this view, so saving offline keeps fetching the same set.
const leafletOfflineTiles = [
  [11, 747, 1187],
  [11, 748, 1187],
  [12, 1494, 2374],
  [12, 1495, 2374],
  [12, 1496, 2374],
  [12, 1494, 2375],
  [12, 1495, 2375],
  [12, 1496, 2375],
  [13, 2989, 4748],
  [13, 2990, 4748],
  [13, 2991, 4748],
  [13, 2992, 4748],
  [13, 2993, 4748],
  [13, 2989, 4749],
  [13, 2990, 4749],
  [13, 2991, 4749],
  [13, 2992, 4749],
  [13, 2993, 4749],
  [13, 2989, 4750],
  [13, 2990, 4750],
  [13, 2991, 4750],
  [13, 2992, 4750],
  [13, 2993, 4750],
]

test('offlineTilesInBounds enumerates the same tiles leaflet.offline did', () => {
  const tiles = offlineTilesInBounds(
    osmTemplate,
    [
      [-27.55, -48.62],
      [-27.62, -48.45],
    ],
    11,
    13
  )
  expect(tiles.map((tile) => [tile.z, tile.x, tile.y])).toEqual(leafletOfflineTiles)
  expect(tiles[0].key).toBe('https://tile.openstreetmap.org/11/747/1187.png')
  expect(tiles[0].url).toBe(tiles[0].key)
  expect(tiles[0].urlTemplate).toBe(osmTemplate)
})

test('offline keys use the first subdomain while downloads rotate through them', () => {
  const tiles = offlineTilesInBounds(
    'https://{s}.tile.example.com/{z}/{x}/{y}.png',
    [
      [10, 10],
      [9.9, 10.2],
    ],
    12,
    12,
    ['a', 'b', 'c']
  )
  expect(tiles.every((tile) => tile.key.startsWith('https://a.'))).toBe(true)
  expect(new Set(tiles.map((tile) => tile.url.split('.')[0])).size).toBeGreaterThan(1)
})

test('fillTileTemplate fills the Leaflet placeholders', () => {
  const coords = { z: 3, x: 2, y: 1 }
  expect(fillTileTemplate('https://{s}.x/{z}/{x}/{y}{r}.png', coords, 'b')).toBe('https://b.x/3/2/1.png')
  expect(fillTileTemplate('https://x/{z}/{x}/{-y}.png', coords)).toBe('https://x/3/2/6.png')
})
