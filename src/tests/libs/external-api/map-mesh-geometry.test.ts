import { describe, expect, test } from 'vitest'

import { quadAround, quadFromBounds, wedge } from '@/libs/external-api/map-mesh-geometry'

const radiansPerDegree = Math.PI / 180

// Earth-centered coordinates on the WGS84 ellipsoid, whose straight-line distances match the ground's to well under a
// millimeter at these sizes, so they check the helpers' projection independently of it.
const ecef = (lon: number, lat: number): [number, number, number] => {
  const [sinLat, cosLat] = [Math.sin(lat * radiansPerDegree), Math.cos(lat * radiansPerDegree)]
  const e2 = 0.00669437999014
  const n = 6378137 / Math.sqrt(1 - e2 * sinLat * sinLat)
  const [sinLon, cosLon] = [Math.sin(lon * radiansPerDegree), Math.cos(lon * radiansPerDegree)]
  return [n * cosLat * cosLon, n * cosLat * sinLon, n * (1 - e2) * sinLat]
}

const corner = (corners: Float64Array, index: number): [number, number] => [corners[index * 2], corners[index * 2 + 1]]

const meters = ([lonA, latA]: [number, number], [lonB, latB]: [number, number]): number => {
  const [a, b] = [ecef(lonA, latA), ecef(lonB, latB)]
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

const centimeter = 0.01

describe('quadFromBounds', () => {
  test('gives the corners NW, NE, SE, SW as (longitude, latitude)', () => {
    const corners = quadFromBounds({ west: -48.56, east: -48.55, north: -27.59, south: -27.6 })
    expect(corners).toBeInstanceOf(Float64Array)
    expect([...corners]).toEqual([-48.56, -27.59, -48.55, -27.59, -48.55, -27.6, -48.56, -27.6])
  })

  test('writes into a batch at an offset, leaving the rest of it alone', () => {
    const batch = new Float64Array(24).fill(7)
    expect(quadFromBounds({ west: 1, east: 2, north: 4, south: 3 }, batch, 8)).toBe(batch)
    expect([...batch]).toEqual([...Array(8).fill(7), 1, 4, 2, 4, 2, 3, 1, 3, ...Array(8).fill(7)])
  })
})

describe('quadAround', () => {
  const center = { lat: -27.59, lon: -48.55 }

  test('is NW, NE, SE, SW around its center at heading 0', () => {
    const corners = quadAround({ ...center, widthMeters: 200, heightMeters: 50 })
    const [nw, ne, se, sw] = [0, 1, 2, 3].map((index) => corner(corners, index))
    expect(nw[0]).toBeCloseTo(sw[0], 12)
    expect(ne[0]).toBeCloseTo(se[0], 12)
    expect(nw[1]).toBeCloseTo(ne[1], 12)
    expect(sw[1]).toBeCloseTo(se[1], 12)
    expect(nw[0] < center.lon && ne[0] > center.lon && nw[1] > center.lat && sw[1] < center.lat).toBe(true)
    expect((nw[0] + se[0]) / 2).toBeCloseTo(center.lon, 12)
    expect((nw[1] + se[1]) / 2).toBeCloseTo(center.lat, 12)
  })

  test('turns its forward edge to the east at heading 90', () => {
    const corners = quadAround({ ...center, widthMeters: 200, heightMeters: 50, headingDegrees: 90 })
    const [forwardLeft, forwardRight, backRight, backLeft] = [0, 1, 2, 3].map((index) => corner(corners, index))
    expect(forwardLeft[0]).toBeCloseTo(forwardRight[0], 12)
    expect(forwardLeft[0]).toBeGreaterThan(center.lon)
    expect(backLeft[0]).toBeLessThan(center.lon)
    expect(forwardLeft[1]).toBeGreaterThan(forwardRight[1])
    expect(backLeft[1]).toBeCloseTo(forwardLeft[1], 12)
    expect(backRight[1]).toBeCloseTo(forwardRight[1], 12)
  })

  test('has the size asked for, within a centimeter, at any heading and latitude a vehicle works at', () => {
    for (const lat of [0, -27.59, 60]) {
      for (const headingDegrees of [0, 37, 90, 225]) {
        const corners = quadAround({ lat, lon: -48.55, widthMeters: 300, heightMeters: 120, headingDegrees })
        const [c0, c1, c2, c3] = [0, 1, 2, 3].map((index) => corner(corners, index))
        const diagonal = Math.hypot(300, 120)
        const sizes = [meters(c0, c1), meters(c1, c2), meters(c2, c3), meters(c3, c0), meters(c0, c2), meters(c1, c3)]
        sizes.forEach((size, i) => {
          expect(
            Math.abs(size - [300, 120, 300, 120, diagonal, diagonal][i]),
            `${lat}° ${headingDegrees}°`
          ).toBeLessThan(centimeter)
        })
      }
    }
  })

  test('writes into a batch at an offset', () => {
    const batch = new Float64Array(16)
    const quad = { ...center, widthMeters: 10, heightMeters: 10, headingDegrees: 30 }
    expect(quadAround(quad, batch, 8)).toBe(batch)
    expect([...batch.subarray(8)]).toEqual([...quadAround(quad)])
    expect([...batch.subarray(0, 8)]).toEqual(Array(8).fill(0))
  })
})

describe('wedge', () => {
  const sonar = { lat: -27.59, lon: -48.55 }
  const origin: [number, number] = [sonar.lon, sonar.lat]

  test('is near-left, far-left, far-right, near-right, left being counterclockwise from the bearing', () => {
    const corners = wedge({ ...sonar, bearingDegrees: 0, widthDegrees: 10, rangeMeters: 50, minRangeMeters: 5 })
    const [nearLeft, farLeft, farRight, nearRight] = [0, 1, 2, 3].map((index) => corner(corners, index))
    expect(farLeft[0]).toBeLessThan(sonar.lon)
    expect(farRight[0]).toBeGreaterThan(sonar.lon)
    expect(nearLeft[0]).toBeLessThan(sonar.lon)
    expect(nearRight[0]).toBeGreaterThan(sonar.lon)
    expect(farLeft[1]).toBeCloseTo(farRight[1], 12)
    expect(farLeft[1]).toBeGreaterThan(nearLeft[1])
    expect(nearLeft[1]).toBeGreaterThan(sonar.lat)

    const east = wedge({ ...sonar, bearingDegrees: 90, widthDegrees: 10, rangeMeters: 50 })
    expect(corner(east, 1)[1]).toBeGreaterThan(corner(east, 2)[1])
  })

  test('reaches its ranges along both edges within a centimeter, meeting at the sonar without a minimum range', () => {
    for (const bearingDegrees of [0, 45, 200]) {
      const ranged = wedge({ ...sonar, bearingDegrees, widthDegrees: 2, rangeMeters: 300, minRangeMeters: 20 })
      const ranges = [0, 1, 2, 3].map((index) => meters(origin, corner(ranged, index)))
      ranges.forEach((range, i) => expect(Math.abs(range - [20, 300, 300, 20][i])).toBeLessThan(centimeter))
      expect(
        Math.abs(meters(corner(ranged, 1), corner(ranged, 2)) - 2 * 300 * Math.sin(radiansPerDegree))
      ).toBeLessThan(centimeter)
    }
    const triangle = wedge({ ...sonar, bearingDegrees: 120, widthDegrees: 2, rangeMeters: 50 })
    expect([...triangle.subarray(0, 2)]).toEqual(origin)
    expect([...triangle.subarray(6, 8)]).toEqual(origin)
  })

  test('writes into a batch at an offset', () => {
    const beam = { ...sonar, bearingDegrees: 10, widthDegrees: 1.8, rangeMeters: 50 }
    const batch = new Float64Array(16)
    expect(wedge(beam, batch, 8)).toBe(batch)
    expect([...batch.subarray(8)]).toEqual([...wedge(beam)])
  })
})
