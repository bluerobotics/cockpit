/**
 * Edges of a north-up rectangle, in degrees
 */
export interface MapMeshQuadBounds {
  /**
   * Longitude of the western edge
   */
  west: number
  /**
   * Longitude of the eastern edge
   */
  east: number
  /**
   * Latitude of the northern edge
   */
  north: number
  /**
   * Latitude of the southern edge
   */
  south: number
}

/**
 * A rectangle on the ground, centered on a point and turned to a heading
 */
export interface MapMeshQuadAround {
  /**
   * Latitude of the center, in degrees
   */
  lat: number
  /**
   * Longitude of the center, in degrees
   */
  lon: number
  /**
   * Length of the forward and back edges, in meters
   */
  widthMeters: number
  /**
   * Length of the left and right edges, in meters
   */
  heightMeters: number
  /**
   * Direction the forward edge faces, in degrees clockwise from north. Defaults to 0.
   */
  headingDegrees?: number
}

/**
 * A sonar beam: the part of a ring between two ranges, swept between two bearings
 */
export interface MapMeshWedge {
  /**
   * Latitude of the sonar, in degrees
   */
  lat: number
  /**
   * Longitude of the sonar, in degrees
   */
  lon: number
  /**
   * Direction of the beam's center, in degrees clockwise from north
   */
  bearingDegrees: number
  /**
   * Angle the beam spans, in degrees
   */
  widthDegrees: number
  /**
   * Range of the beam's far edge, in meters
   */
  rangeMeters: number
  /**
   * Range of the beam's near edge, in meters. Defaults to 0, which draws a triangle from the sonar.
   */
  minRangeMeters?: number
}

const radiansPerDegree = Math.PI / 180
const wgs84SemiMajorAxis = 6378137
const wgs84EccentricitySquared = 0.00669437999014

// Degrees of latitude and of longitude per meter north and east of a latitude, from the WGS84 ellipsoid's radii of
// curvature there. Scaling every offset by them is a local equirectangular projection: at 60° latitude the edges of a
// quad 300 m across come out about a centimeter off, the error growing with the square of its size.
const degreesPerMeter = (lat: number): [north: number, east: number] => {
  const sinLat = Math.sin(lat * radiansPerDegree)
  const w = 1 - wgs84EccentricitySquared * sinLat * sinLat
  const meridianRadius = (wgs84SemiMajorAxis * (1 - wgs84EccentricitySquared)) / (w * Math.sqrt(w))
  const parallelRadius = (wgs84SemiMajorAxis * Math.cos(lat * radiansPerDegree)) / Math.sqrt(w)
  return [1 / (meridianRadius * radiansPerDegree), 1 / (parallelRadius * radiansPerDegree)]
}

/**
 * Corners of a north-up rectangle, as `setMapMeshQuads` takes them: NW, NE, SE, SW, so a quad sent without `uv` shows
 * its strip upright, its first row along the north edge.
 * @param {MapMeshQuadBounds} bounds - Edges of the rectangle
 * @param {Float64Array} [out] - Array to write the 8 numbers into, instead of a new one, as when filling a batch
 * @param {number} [offset] - Index of `out` to write the first number at
 * @returns {Float64Array} `out`, holding (longitude, latitude) of each corner
 */
export function quadFromBounds(
  { west, east, north, south }: MapMeshQuadBounds,
  out = new Float64Array(8),
  offset = 0
): Float64Array {
  out[offset] = west
  out[offset + 1] = north
  out[offset + 2] = east
  out[offset + 3] = north
  out[offset + 4] = east
  out[offset + 5] = south
  out[offset + 6] = west
  out[offset + 7] = south
  return out
}

/**
 * Corners of a rectangle on the ground, centered on a point and turned to a heading: forward-left, forward-right,
 * back-right and back-left, so a quad sent without `uv` shows its strip upright, its first row along the forward edge.
 * At heading 0 they are NW, NE, SE and SW. Placed with a local equirectangular projection around the center, so keep
 * quads within a few hundred meters.
 * @param {MapMeshQuadAround} quad - Center, size and heading of the rectangle
 * @param {Float64Array} [out] - Array to write the 8 numbers into, instead of a new one, as when filling a batch
 * @param {number} [offset] - Index of `out` to write the first number at
 * @returns {Float64Array} `out`, holding (longitude, latitude) of each corner
 */
export function quadAround(
  { lat, lon, widthMeters, heightMeters, headingDegrees = 0 }: MapMeshQuadAround,
  out = new Float64Array(8),
  offset = 0
): Float64Array {
  const [degreesNorth, degreesEast] = degreesPerMeter(lat)
  const sin = Math.sin(headingDegrees * radiansPerDegree)
  const cos = Math.cos(headingDegrees * radiansPerDegree)
  // Half the forward and the rightward edges, as longitude and latitude offsets.
  const forwardLon = (sin * heightMeters * degreesEast) / 2
  const forwardLat = (cos * heightMeters * degreesNorth) / 2
  const rightLon = (cos * widthMeters * degreesEast) / 2
  const rightLat = (-sin * widthMeters * degreesNorth) / 2
  out[offset] = lon + forwardLon - rightLon
  out[offset + 1] = lat + forwardLat - rightLat
  out[offset + 2] = lon + forwardLon + rightLon
  out[offset + 3] = lat + forwardLat + rightLat
  out[offset + 4] = lon - forwardLon + rightLon
  out[offset + 5] = lat - forwardLat + rightLat
  out[offset + 6] = lon - forwardLon - rightLon
  out[offset + 7] = lat - forwardLat - rightLat
  return out
}

/**
 * Corners of a sonar beam as one quad: near-left, far-left, far-right and near-right, left being counterclockwise
 * from the bearing. A quad sent without `uv` then runs u along the range and v across the beam, so each strip is one
 * ping, its width the range bins from `minRangeMeters` to `rangeMeters`. The far edge is the chord between the far
 * corners rather than an arc, which for a 2° beam falls short of the range by 0.015%. Placed with a local
 * equirectangular projection around the sonar, so keep ranges within a few hundred meters.
 * @param {MapMeshWedge} wedge - Position of the sonar, and direction, width and ranges of the beam
 * @param {Float64Array} [out] - Array to write the 8 numbers into, instead of a new one, as when filling a batch
 * @param {number} [offset] - Index of `out` to write the first number at
 * @returns {Float64Array} `out`, holding (longitude, latitude) of each corner
 */
export function wedge(
  { lat, lon, bearingDegrees, widthDegrees, rangeMeters, minRangeMeters = 0 }: MapMeshWedge,
  out = new Float64Array(8),
  offset = 0
): Float64Array {
  const [degreesNorth, degreesEast] = degreesPerMeter(lat)
  const left = (bearingDegrees - widthDegrees / 2) * radiansPerDegree
  const right = (bearingDegrees + widthDegrees / 2) * radiansPerDegree
  // Longitude and latitude offsets of one meter along each edge.
  const leftLon = Math.sin(left) * degreesEast
  const leftLat = Math.cos(left) * degreesNorth
  const rightLon = Math.sin(right) * degreesEast
  const rightLat = Math.cos(right) * degreesNorth
  out[offset] = lon + minRangeMeters * leftLon
  out[offset + 1] = lat + minRangeMeters * leftLat
  out[offset + 2] = lon + rangeMeters * leftLon
  out[offset + 3] = lat + rangeMeters * leftLat
  out[offset + 4] = lon + rangeMeters * rightLon
  out[offset + 5] = lat + rangeMeters * rightLat
  out[offset + 6] = lon + minRangeMeters * rightLon
  out[offset + 7] = lat + minRangeMeters * rightLat
  return out
}
