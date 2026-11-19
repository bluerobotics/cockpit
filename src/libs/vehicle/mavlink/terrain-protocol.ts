import type { WaypointCoordinates } from '@/types/mission'

/** Blocks in a terrain grid, 8 east by 7 north, one bit each in a request's mask. */
const TERRAIN_GRID_BLOCKS = 56

// The same constants ArduPilot's Location class uses, so every point lands where the vehicle expects it.
const LOCATION_SCALING_FACTOR_INV = 89.83204953368922
const BLOCKS_EAST = 8
const POINTS_PER_BLOCK_SIDE = 4

/**
 * Blocks a terrain request asks for. The mask is a 56-bit integer and reaches Cockpit as a JSON
 * number, rounded to the nearest double once it passes 2^53, which can carry into any higher bit.
 * Every block set in any mask that rounds to the received one is sent: an extra block costs a
 * message, a missing one leaves the vehicle without terrain.
 * @param {number} mask Request mask, one bit per block.
 * @returns {number[]} Requested block indices, ascending.
 */
export const requestedTerrainBlocks = (mask: number): number[] => {
  const received = BigInt(mask)
  const halfStep = mask >= 2 ** 53 ? BigInt(2 ** (Math.floor(Math.log2(mask)) - 53)) : 0n
  let bits = 0n
  for (let candidate = received - halfStep; candidate <= received + halfStep; candidate++) bits |= candidate
  return Array.from({ length: TERRAIN_GRID_BLOCKS }, (_, bit) => bit).filter((bit) => (bits >> BigInt(bit)) & 1n)
}

const longitudeScale = (latE7: number): number => Math.max(0.01, Math.cos((latE7 * 1e-7 * Math.PI) / 180))

/**
 * Positions of the 16 points of one block, in the order of a TERRAIN_DATA message's `data`: row by
 * row from the south, west to east, offset from the grid's south-west corner the way ArduPilot does.
 * @param {number} latE7 Grid south-west corner latitude, in 1e-7 degrees.
 * @param {number} lonE7 Grid south-west corner longitude, in 1e-7 degrees.
 * @param {number} spacingM Grid spacing in meters.
 * @param {number} block Block index, 0 to 55.
 * @returns {WaypointCoordinates[]} The 16 positions.
 */
export const terrainBlockPoints = (
  latE7: number,
  lonE7: number,
  spacingM: number,
  block: number
): WaypointCoordinates[] => {
  const blockNorth = Math.floor(block / BLOCKS_EAST) * POINTS_PER_BLOCK_SIDE
  const blockEast = (block % BLOCKS_EAST) * POINTS_PER_BLOCK_SIDE
  const points: WaypointCoordinates[] = []
  for (let north = 0; north < POINTS_PER_BLOCK_SIDE; north++) {
    for (let east = 0; east < POINTS_PER_BLOCK_SIDE; east++) {
      const dLat = Math.trunc((blockNorth + north) * spacingM * LOCATION_SCALING_FACTOR_INV)
      const dLng = Math.trunc(
        ((blockEast + east) * spacingM * LOCATION_SCALING_FACTOR_INV) / longitudeScale(latE7 + dLat / 2)
      )
      points.push([(latE7 + dLat) * 1e-7, (lonE7 + dLng) * 1e-7])
    }
  }
  return points
}

/**
 * Heights for a TERRAIN_DATA message, whole meters as the vehicle stores them.
 * @param {(number | null)[]} heightsM The 16 heights, in block order.
 * @returns {number[] | null} Whole meters clamped to int16, or null when any height is unknown, in
 * which case the block is not sent and the vehicle asks again.
 */
export const terrainBlockData = (heightsM: (number | null)[]): number[] | null => {
  if (heightsM.length !== POINTS_PER_BLOCK_SIDE ** 2 || heightsM.some((height) => height === null)) return null
  return heightsM.map((height) => Math.max(-32768, Math.min(32767, Math.round(height!))))
}

// TERRAIN_CHECK is answered one position at a time, so a long survey is checked by a sample of its waypoints.
export const MAX_CHECKED_WAYPOINTS = 40

/**
 * Positions spread along a list for a terrain check, so a long mission is checked in a few seconds.
 * @param {T[]} points Positions in mission order.
 * @returns {T[]} Every nth position, at most 40 of them.
 */
export const terrainCheckSample = <T>(points: T[]): T[] => {
  const stride = Math.max(1, Math.ceil(points.length / MAX_CHECKED_WAYPOINTS))
  return points.filter((_, index) => index % stride === 0)
}

let selfChecked = false

/**
 * Development self-check of the grid layout, run once where bootstrap installed `assert`.
 */
export const checkTerrainProtocolOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true
  assert(requestedTerrainBlocks(0b101).join() === '0,2', 'Mask bits map to block indices')
  assert(requestedTerrainBlocks(2 ** 56 - 1).length === TERRAIN_GRID_BLOCKS, 'A full mask rounded up sends every block')
  const rounded = requestedTerrainBlocks(2 ** 55 + 2 ** 10).join()
  assert(rounded === '0,1,2,3,4,5,6,7,8,9,10,55', 'A rounded mask sends every block a borrow could have set')
  const points = terrainBlockPoints(0, 0, 100, 9)
  assert(Math.abs(points[0][0] - 0.003593) < 1e-5, 'Block 9 starts four points north of the corner')
  assert(Math.abs(points[1][1] - 0.004492) < 1e-5, 'Points step east within a block row')
}
