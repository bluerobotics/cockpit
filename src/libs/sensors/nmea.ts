/**
 * Framework-agnostic NMEA 0183 parsing utilities for GNSS receivers.
 *
 * NMEA is self-describing (each sentence starts with a talker+type header such as `GPGGA`), so the
 * message kind never needs to be configured by the user. This module validates checksums, decodes the
 * sentence types Cockpit cares about (GGA/RMC/GSA/GSV/VTG/GLL) and merges them, via {@link NmeaAggregator},
 * into a single consolidated {@link GnssFix}. It intentionally has no Vue/data-lake dependencies so it can
 * be unit-tested and reused.
 */

import type { GnssFix, ParsedNmeaSentence } from '@/types/gnss'

const KNOTS_TO_MPS = 0.514444

const fixQualityLabels: Record<number, string> = {
  0: 'No fix',
  1: 'GNSS',
  2: 'DGPS',
  3: 'PPS',
  4: 'RTK fixed',
  5: 'RTK float',
  6: 'Estimated',
  7: 'Manual',
  8: 'Simulation',
}

/**
 * Maps a GGA fix quality code to a human-readable label.
 * @param {number} quality - The GGA fix quality code.
 * @returns {string} The label for the given quality, or 'Unknown' if unrecognized.
 */
export const fixQualityLabel = (quality: number): string => fixQualityLabels[quality] ?? 'Unknown'

/**
 * Validates the XOR checksum of an NMEA sentence.
 * @param {string} sentence - The raw NMEA sentence, including the leading `$` and trailing `*HH`.
 * @returns {boolean} True when the computed checksum matches the one in the sentence.
 */
export const validateNmeaChecksum = (sentence: string): boolean => {
  const start = sentence.indexOf('$')
  const asterisk = sentence.indexOf('*')
  if (start === -1 || asterisk === -1 || asterisk < start) return false

  const body = sentence.slice(start + 1, asterisk)
  const provided = sentence.slice(asterisk + 1, asterisk + 3).toUpperCase()
  if (provided.length < 2) return false

  let computed = 0
  for (let i = 0; i < body.length; i++) {
    computed ^= body.charCodeAt(i)
  }
  return computed.toString(16).toUpperCase().padStart(2, '0') === provided
}

/**
 * Parses and checksum-validates a single NMEA sentence.
 * @param {string} line - The raw sentence line.
 * @returns {ParsedNmeaSentence | null} The parsed sentence, or null when invalid.
 */
export const parseNmeaSentence = (line: string): ParsedNmeaSentence | null => {
  const trimmed = line.trim()
  if (!trimmed.startsWith('$') || !trimmed.includes('*')) return null
  if (!validateNmeaChecksum(trimmed)) return null

  const body = trimmed.slice(1, trimmed.indexOf('*'))
  const parts = body.split(',')
  const header = parts[0]
  if (header.length < 5) return null

  return { talker: header.slice(0, 2), type: header.slice(2), fields: parts.slice(1) }
}

const floatOrUndefined = (value: string | undefined): number | undefined => {
  if (value === undefined || value === '') return undefined
  const parsed = parseFloat(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

const intOrUndefined = (value: string | undefined): number | undefined => {
  if (value === undefined || value === '') return undefined
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * Converts an NMEA ddmm.mmmm / dddmm.mmmm coordinate to decimal degrees.
 * @param {string | undefined} value - The coordinate value (degrees and minutes concatenated).
 * @param {string | undefined} hemisphere - The hemisphere indicator (N/S/E/W).
 * @returns {number | undefined} The coordinate in decimal degrees, or undefined when not parseable.
 */
export const parseCoordinate = (value: string | undefined, hemisphere: string | undefined): number | undefined => {
  if (!value || !hemisphere) return undefined
  const raw = parseFloat(value)
  if (Number.isNaN(raw)) return undefined

  const degrees = Math.floor(raw / 100)
  const minutes = raw - degrees * 100
  const decimal = degrees + minutes / 60
  return hemisphere === 'S' || hemisphere === 'W' ? -decimal : decimal
}

/**
 * Accumulates NMEA sentences into a single, always-current {@link GnssFix}.
 *
 * Position is treated as authoritative from GGA (and RMC/GLL when they report an active fix), and is
 * withheld while the receiver reports no fix, so downstream consumers never see stale coordinates.
 */
export class NmeaAggregator {
  private fix: GnssFix = { hasValidFix: false }
  private ggaHasFix = false
  private rmcHasFix = false

  /**
   * Ingests a single raw NMEA line, updating the internal state.
   * @param {string} line - The raw NMEA sentence line.
   * @returns {boolean} True when the line was a valid, recognized NMEA sentence.
   */
  ingest(line: string): boolean {
    const parsed = parseNmeaSentence(line)
    if (!parsed) return false

    switch (parsed.type) {
      case 'GGA':
        this.applyGga(parsed.fields)
        break
      case 'RMC':
        this.applyRmc(parsed.fields)
        break
      case 'GSA':
        this.applyGsa(parsed.fields)
        break
      case 'GSV':
        this.applyGsv(parsed.fields)
        break
      case 'VTG':
        this.applyVtg(parsed.fields)
        break
      case 'GLL':
        this.applyGll(parsed.fields)
        break
      default:
        return false
    }
    return true
  }

  /**
   * Returns a snapshot copy of the current consolidated GNSS state.
   * @returns {GnssFix} The current fix.
   */
  snapshot(): GnssFix {
    return { ...this.fix }
  }

  /**
   * Recomputes the overall fix validity from the latest GGA and RMC sentences.
   * @returns {void}
   */
  private updateHasValidFix(): void {
    this.fix.hasValidFix = this.ggaHasFix || this.rmcHasFix
  }

  /**
   * Applies a GGA sentence (position, altitude, fix quality, satellites used, HDOP).
   * @param {string[]} fields - The GGA data fields.
   * @returns {void}
   */
  private applyGga(fields: string[]): void {
    const quality = intOrUndefined(fields[5])
    const latitude = parseCoordinate(fields[1], fields[2])
    const longitude = parseCoordinate(fields[3], fields[4])

    if (fields[0]) this.fix.utcTime = fields[0]
    this.fix.fixQuality = quality
    if (quality !== undefined) this.fix.fixQualityLabel = fixQualityLabel(quality)
    this.fix.satellitesUsed = intOrUndefined(fields[6])
    this.fix.hdop = floatOrUndefined(fields[7])
    this.fix.altitudeMslM = floatOrUndefined(fields[8])
    this.fix.geoidSeparationM = floatOrUndefined(fields[10])

    const valid = quality !== undefined && quality > 0 && latitude !== undefined && longitude !== undefined
    this.ggaHasFix = valid
    if (valid) {
      this.fix.latitude = latitude
      this.fix.longitude = longitude
    } else if (quality === 0) {
      this.fix.latitude = undefined
      this.fix.longitude = undefined
    }
    this.updateHasValidFix()
  }

  /**
   * Applies an RMC sentence (position, speed, course, and active/void status).
   * @param {string[]} fields - The RMC data fields.
   * @returns {void}
   */
  private applyRmc(fields: string[]): void {
    if (fields[0]) this.fix.utcTime = fields[0]
    const speedKnots = floatOrUndefined(fields[6])
    if (speedKnots !== undefined) this.fix.speedOverGroundMps = speedKnots * KNOTS_TO_MPS
    const course = floatOrUndefined(fields[7])
    if (course !== undefined) this.fix.courseOverGroundDeg = course

    this.rmcHasFix = fields[1] === 'A'
    if (this.rmcHasFix) {
      const latitude = parseCoordinate(fields[2], fields[3])
      const longitude = parseCoordinate(fields[4], fields[5])
      if (latitude !== undefined && longitude !== undefined) {
        this.fix.latitude = latitude
        this.fix.longitude = longitude
      }
    }
    this.updateHasValidFix()
  }

  /**
   * Applies a GSA sentence (fix mode and dilution-of-precision values).
   * @param {string[]} fields - The GSA data fields.
   * @returns {void}
   */
  private applyGsa(fields: string[]): void {
    this.fix.fixMode = intOrUndefined(fields[1])
    this.fix.pdop = floatOrUndefined(fields[14])
    const hdop = floatOrUndefined(fields[15])
    if (hdop !== undefined) this.fix.hdop = hdop
    this.fix.vdop = floatOrUndefined(fields[16])
  }

  /**
   * Applies a GSV sentence (number of satellites in view).
   * @param {string[]} fields - The GSV data fields.
   * @returns {void}
   */
  private applyGsv(fields: string[]): void {
    const satellitesInView = intOrUndefined(fields[2])
    if (satellitesInView !== undefined) this.fix.satellitesInView = satellitesInView
  }

  /**
   * Applies a VTG sentence (course and ground speed).
   * @param {string[]} fields - The VTG data fields.
   * @returns {void}
   */
  private applyVtg(fields: string[]): void {
    const course = floatOrUndefined(fields[0])
    if (course !== undefined) this.fix.courseOverGroundDeg = course
    const speedKnots = floatOrUndefined(fields[4])
    if (speedKnots !== undefined) this.fix.speedOverGroundMps = speedKnots * KNOTS_TO_MPS
  }

  /**
   * Applies a GLL sentence (position, when the status is active).
   * @param {string[]} fields - The GLL data fields.
   * @returns {void}
   */
  private applyGll(fields: string[]): void {
    if (fields[5] !== 'A') return
    const latitude = parseCoordinate(fields[0], fields[1])
    const longitude = parseCoordinate(fields[2], fields[3])
    if (latitude !== undefined && longitude !== undefined) {
      this.fix.latitude = latitude
      this.fix.longitude = longitude
    }
  }
}
